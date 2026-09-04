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

  // Receiving replenishes stock: qty is the number of boxes ordered.
  const boxes = request.qty;

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
    await applyStock(tx, request.productId, boxes, "received", request.id);
    await logAudit(
      {
        actorId: user.id,
        action: "request.received",
        details: `${user.name} received ${request.qty} × ${request.product.name} → +${boxes} ${request.product.unit} to stock`,
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

const stockCountSchema = z.object({
  // JSON array of { productId, boxes } — one line per product the staff counted.
  items: z
    .array(z.object({ productId: z.string().min(1), boxes: z.coerce.number().nonnegative().max(100000) }))
    .min(1, "Enter at least one count"),
});

/**
 * Practice staff submit a weekly stock count: the number of boxes on hand for
 * each product. The submission becomes the on-hand truth, records a StockCount
 * snapshot, and writes ledger entries for the deltas.
 */
export async function submitStockCount(formData: FormData) {
  const user = await requireUser();

  let itemsRaw: unknown = [];
  try {
    itemsRaw = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    throw new Error("Invalid stock count data");
  }
  const parsed = stockCountSchema.safeParse({ items: itemsRaw });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid stock count");

  // Only accept lines for real products.
  const products = await prisma.product.findMany({ select: { id: true, onHand: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = parsed.data.items.filter((i) => byId.has(i.productId));
  if (items.length === 0) throw new Error("No valid products in the count");

  await prisma.$transaction(async (tx) => {
    await tx.stockCount.create({
      data: {
        countedById: user.id,
        items: { create: items.map((i) => ({ productId: i.productId, boxes: i.boxes })) },
      },
    });
    for (const i of items) {
      const current = byId.get(i.productId)!.onHand;
      const delta = i.boxes - current;
      if (delta !== 0) await applyStock(tx, i.productId, delta, "count", "weekly count");
    }
    await logAudit(
      {
        actorId: user.id,
        action: "stock.counted",
        details: `${user.name} submitted a weekly stock count (${items.length} items)`,
      },
      tx,
    );
  });

  revalidatePath("/stock-count");
  revalidatePath("/admin/inventory");
  return { ok: true };
}
