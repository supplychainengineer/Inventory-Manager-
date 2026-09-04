// Weekly-count inventory math. Pure functions so they're easy to test and safe
// to use from server components and actions alike. On-hand is measured in BOXES.

export const DEFAULT_BUFFER_PCT = 10;

export interface StockLike {
  onHand: number;
  reorderPoint: number;
  bufferPct: number | null;
}

export function effectiveBuffer(p: Pick<StockLike, "bufferPct">, globalPct: number): number {
  return p.bufferPct == null ? globalPct : p.bufferPct;
}

export interface EstRange {
  nom: number;
  low: number;
  high: number;
  pct: number;
}

/** On-hand shown as an estimate range around the nominal box count. */
export function estRange(p: StockLike, globalPct: number): EstRange {
  const pct = effectiveBuffer(p, globalPct);
  const b = pct / 100;
  return {
    nom: p.onHand,
    low: Math.max(0, p.onHand * (1 - b)),
    high: p.onHand * (1 + b),
    pct,
  };
}

export type StockStatusKey = "out" | "reorder" | "low" | "ok";

export interface StockStatus {
  key: StockStatusKey;
  label: string;
  rank: number; // 0 = most urgent
}

/** Status is computed off the conservative (low) end of the estimate range, so
 * the buffer gives breathing space and alerts fire early. */
export function invStatus(p: StockLike, globalPct: number): StockStatus {
  const { low } = estRange(p, globalPct);
  const rp = p.reorderPoint || 0;
  if (low <= 0) return { key: "out", label: "Out (est.)", rank: 0 };
  if (low <= rp) return { key: "reorder", label: "Reorder", rank: 1 };
  if (low <= rp * 1.5) return { key: "low", label: "Low", rank: 2 };
  return { key: "ok", label: "OK", rank: 3 };
}

export interface CountLike {
  at: Date | string;
  items: { productId: string; boxes: number }[];
}

/** Boxes of a product recorded in a given count, or null when absent. */
function boxesIn(count: CountLike | undefined, productId: string): number | null {
  const it = count?.items.find((i) => i.productId === productId);
  return it ? it.boxes : null;
}

/**
 * Boxes used since the previous weekly count (second-most-recent minus most
 * recent), per product. Returns 0 when stock went up, null when there aren't two
 * comparable counts. `counts` must be sorted newest-first.
 */
export function usedLastWeek(counts: CountLike[], productId: string): number | null {
  if (counts.length < 2) return null;
  const cur = boxesIn(counts[0], productId);
  const prev = boxesIn(counts[1], productId);
  if (cur == null || prev == null) return null;
  return Math.max(0, prev - cur);
}

/** Weeks of cover from the conservative on-hand estimate and weekly usage. */
export function coverageWeeks(estLow: number, usedPerWeek: number | null): number | null {
  if (usedPerWeek == null || usedPerWeek <= 0) return null;
  return estLow / usedPerWeek;
}

/** Suggested reorder quantity in whole boxes to get back above 2× reorder point. */
export function suggestedReorderBoxes(p: StockLike, globalPct: number): number {
  const { low } = estRange(p, globalPct);
  const target = (p.reorderPoint || 0) * 2;
  return Math.max(1, Math.ceil(target - low));
}
