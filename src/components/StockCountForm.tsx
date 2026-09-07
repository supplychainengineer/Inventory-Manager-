"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitStockCount } from "@/app/(portal)/actions";

export interface CountRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  lastCount: number | null;
}

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function StockCountForm({ rows }: { rows: CountRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.id, String(r.onHand)])),
  );
  const [saved, setSaved] = useState(false);

  function submit() {
    const items = rows
      .map((r) => ({ productId: r.id, raw: values[r.id] }))
      .filter((x) => x.raw !== "" && x.raw != null)
      .map((x) => ({ productId: x.productId, boxes: Math.max(0, Number(x.raw) || 0) }));
    if (items.length === 0) return;
    const fd = new FormData();
    fd.set("items", JSON.stringify(items));
    startTransition(async () => {
      await submitStockCount(fd);
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <section className="card mb-8">
      <div className="border-b border-hairline bg-paper px-4 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">This week&apos;s count (boxes on hand)</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Last count</th>
              <th className="text-right">Boxes now</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">
                  {r.name}
                  <div className="text-xs text-muted">{r.category}</div>
                </td>
                <td className="text-right tabular-nums text-muted">
                  {r.lastCount == null ? "—" : fmtQty(r.lastCount)}
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={values[r.id] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                    className="w-20 rounded border border-hairline px-2 py-1 text-right text-sm outline-none focus:border-accent"
                    aria-label={`Boxes of ${r.name}`}
                  />
                </td>
                <td className="text-muted">{r.unit}(es)</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted">
                  No products to count yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-hairline px-4 py-4">
        <button onClick={submit} disabled={pending || rows.length === 0} className="btn-primary px-4 py-2">
          {pending ? "Saving…" : "Submit weekly count"}
        </button>
        <span className="text-xs text-muted">Leave a box blank to keep its current number.</span>
        {saved && (
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">Count saved ✓</span>
        )}
      </div>
    </section>
  );
}
