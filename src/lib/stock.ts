import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A weekly count is considered due after this many days. */
export const COUNT_DUE_DAYS = 7;

/** True when there is no stock count yet, or the latest one is a week+ old. */
export async function isStockCountDue(): Promise<boolean> {
  const latest = await prisma.stockCount.findFirst({
    orderBy: { at: "desc" },
    select: { at: true },
  });
  if (!latest) return true;
  const ageDays = (Date.now() - latest.at.getTime()) / 86_400_000;
  return ageDays >= COUNT_DUE_DAYS;
}

/**
 * Applies a stock movement inside a transaction: adjusts a product's on-hand
 * (clamped at zero) and appends an immutable ledger entry. `reason` is one of
 * "received" | "procedure" | "count" | "adjustment".
 */
export async function applyStock(
  tx: Prisma.TransactionClient,
  productId: string,
  delta: number,
  reason: string,
  ref?: string | null,
) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { onHand: true },
  });
  if (!product) return;
  const next = Math.max(0, round3(product.onHand + delta));
  await tx.product.update({ where: { id: productId }, data: { onHand: next } });
  await tx.stockTxn.create({
    data: { productId, delta: round3(delta), reason, ref: ref ?? null },
  });
}
