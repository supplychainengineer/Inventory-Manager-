"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { applyStock } from "@/lib/stock";

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

  // Receiving replenishes stock: qty is in packs, converted to base units.
  const pieces = request.qty * (request.product.packSize || 1);

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: {
        status: "received",
        receivedAt: new Date(),
        // Cancel any pending reminder for this request.
        reminderSent: true,
        reminderSentAt: request.reminderSentAt ?? new Date(),
      },
    });
    await applyStock(tx, request.productId, pieces, "received", request.id);
    await logAudit(
      {
        actorId: user.id,
        action: "request.received",
        details: `${user.name} received ${request.qty} × ${request.product.name} → +${pieces} ${request.product.unit} to stock`,
      },
      tx,
    );
  });

  revalidatePath("/my-requests");
  revalidatePath("/admin/awaiting");
  revalidatePath("/admin");
  revalidatePath("/admin/inventory");
  return { ok: true };
}

const logProcedureSchema = z.object({
  procedureId: z.string().min(1),
  count: z.coerce.number().int().positive().max(10000),
});

/** Records that a procedure was performed and auto-deducts its BOM from stock. */
export async function logProcedure(formData: FormData) {
  const user = await requireUser();
  const parsed = logProcedureSchema.safeParse({
    procedureId: formData.get("procedureId"),
    count: formData.get("count"),
  });
  if (!parsed.success) throw new Error("Invalid procedure log input");

  const procedure = await prisma.procedure.findUnique({
    where: { id: parsed.data.procedureId },
    include: { bom: true },
  });
  if (!procedure) throw new Error("Procedure not found");

  await prisma.$transaction(async (tx) => {
    await tx.procedureLog.create({
      data: {
        procedureId: procedure.id,
        count: parsed.data.count,
        loggedById: user.id,
      },
    });
    for (const line of procedure.bom) {
      await applyStock(tx, line.productId, -(line.qty * parsed.data.count), "procedure", procedure.name);
    }
    await logAudit(
      {
        actorId: user.id,
        action: "procedure.logged",
        details: `${user.name} logged ${parsed.data.count} × ${procedure.name} (auto-deducted ${procedure.bom.length} material(s))`,
      },
      tx,
    );
  });

  revalidatePath("/logwork");
  revalidatePath("/admin/inventory");
  return { ok: true };
}
