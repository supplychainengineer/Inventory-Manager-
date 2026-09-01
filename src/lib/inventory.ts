// Consumption-based inventory math. Pure functions so they're easy to test and
// safe to use from server components and actions alike.

export const DEFAULT_BUFFER_PCT = 10;

export interface StockLike {
  onHand: number;
  reorderPoint: number;
  bufferPct: number | null;
  packSize: number;
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

/** On-hand shown as an estimate range around the nominal count. */
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

export interface ProcedureWithBom {
  id: string;
  bom: { productId: string; qty: number }[];
}
export interface ProcedureLogLike {
  procedureId: string;
  count: number;
  at: Date | string;
}

/** Average pieces/day consumed per product over the recent window. */
export function burnByProduct(
  procedures: ProcedureWithBom[],
  logs: ProcedureLogLike[],
  days = 14,
): Map<string, number> {
  const since = Date.now() - days * 86_400_000;
  const bomByProc = new Map(procedures.map((p) => [p.id, p.bom]));
  const totals = new Map<string, number>();
  for (const log of logs) {
    const at = typeof log.at === "string" ? new Date(log.at) : log.at;
    if (at.getTime() < since) continue;
    const bom = bomByProc.get(log.procedureId);
    if (!bom) continue;
    for (const line of bom) {
      totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.qty * log.count);
    }
  }
  const perDay = new Map<string, number>();
  for (const [productId, total] of totals) perDay.set(productId, total / days);
  return perDay;
}

/** Days of cover from the conservative on-hand estimate and the daily burn. */
export function coverageDays(estLow: number, burnPerDay: number): number | null {
  if (burnPerDay <= 0) return null;
  return estLow / burnPerDay;
}

/** Suggested reorder quantity in whole packs to get back above 2× reorder point. */
export function suggestedReorderPacks(p: StockLike, globalPct: number): number {
  const { low } = estRange(p, globalPct);
  const target = (p.reorderPoint || 0) * 2;
  const need = Math.max(p.packSize || 1, target - low);
  return Math.max(1, Math.ceil(need / (p.packSize || 1)));
}
