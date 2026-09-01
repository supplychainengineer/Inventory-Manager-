import type { Prisma } from "@prisma/client";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

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
