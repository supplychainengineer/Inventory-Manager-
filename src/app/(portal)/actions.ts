"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const createRequestSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().positive().max(100000),
});

export async function createRequest(formData: FormData) {
  const user = await requireUser();
  const parsed = createRequestSchema.safeParse({
    productId: formData.get("productId"),
    qty: formData.get("qty"),
  });
  if (!parsed.success) {
    throw new Error("Invalid request input");
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
  });
  if (!product) throw new Error("Product not found");

  const request = await prisma.request.create({
    data: {
      productId: parsed.data.productId,
      qty: parsed.data.qty,
      requestedById: user.id,
      status: "pending",
    },
  });

  await logAudit({
    actorId: user.id,
    action: "request.created",
    details: `${user.name} requested ${parsed.data.qty} × ${product.name}`,
  });

  revalidatePath("/my-requests");
  revalidatePath("/catalog");
  revalidatePath("/admin/requests");
  return { ok: true, requestId: request.id };
}

export async function markReceived(formData: FormData) {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) throw new Error("Missing request id");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { product: true },
  });
  if (!request) throw new Error("Request not found");

  // Staff may only mark their own requests; admins may mark any.
  if (user.role !== "admin" && request.requestedById !== user.id) {
    throw new Error("Not authorized to modify this request");
  }
  if (request.status !== "ordered") {
    throw new Error("Only ordered requests can be marked received");
  }

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "received",
      receivedAt: new Date(),
      // Cancel any pending reminder for this request.
      reminderSent: true,
      reminderSentAt: request.reminderSentAt ?? new Date(),
    },
  });

  await logAudit({
    actorId: user.id,
    action: "request.received",
    details: `${user.name} marked ${request.qty} × ${request.product.name} as received`,
  });

  revalidatePath("/my-requests");
  revalidatePath("/admin/awaiting");
  revalidatePath("/admin");
  return { ok: true };
}
