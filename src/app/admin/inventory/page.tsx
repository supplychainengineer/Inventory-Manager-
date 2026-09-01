import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { InventoryActions } from "@/components/admin/InventoryActions";
import { formatMoney, formatDateTime, toNumber } from "@/lib/format";
import { getInventoryBufferPct } from "@/lib/reminders";
import { estRange, invStatus, burnByProduct, coverageDays } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  out: "badge badge-overdue",
  reorder: "badge badge-overdue",
  low: "badge badge-warn",
  ok: "badge badge-ok",
};

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export default async function InventoryPage() {
  const [products, procedures, logs, globalPct, txns] = await Promise.all([
    prisma.product.findMany({ include: { pricing: true } }),
    prisma.procedure.findMany({ include: { bom: true } }),
    prisma.procedureLog.findMany({
      where: { at: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      select: { procedureId: true, count: true, at: true },
    }),
    getInventoryBufferPct(),
    prisma.stockTxn.findMany({
      orderBy: { at: "desc" },
      take: 8,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const burn = burnByProduct(
    procedures.map((p) => ({ id: p.id, bom: p.bom.map((b) => ({ productId: b.productId, qty: b.qty })) })),
    logs,
  );

  const rows = products
    .map((p) => {
      const er = estRange(p, globalPct);
      const st = invStatus(p, globalPct);
      const b = burn.get(p.id) ?? 0;
      const cover = coverageDays(er.low, b);
      const preferred = p.pricing.find((pr) => pr.vendorId === p.preferredVendorId) ?? p.pricing[0];
      const value = preferred && p.packSize ? (p.onHand / p.packSize) * toNumber(preferred.price) : 0;
      return { p, er, st, cover, value };
    })
    .sort((a, b) => a.st.rank - b.st.rank || a.p.name.localeCompare(b.p.name));

  const needReorder = rows.filter((r) => r.st.rank <= 1).length;
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const procs14 = logs
    .filter((l) => new Date(l.at).getTime() >= Date.now() - 14 * 86_400_000)
    .reduce((s, l) => s + l.count, 0);

  return (
    <div>
      <PageHeader
        title="Inventory Analysis"
        description="Live stock position, driven by logged procedures and received orders. On-hand is shown as an estimate range; low-stock alerts fire off the conservative end so you reorder early."
      />

      <div className="mb-8 grid grid-cols-2 gap-px border-2 border-ink bg-ink md:grid-cols-4">
        <Kpi label="Tracked Items" value={String(rows.length)} />
        <Kpi label="Need Reorder" value={String(needReorder)} accent={needReorder > 0} />
        <Kpi label="Est. Stock Value" value={formatMoney(totalValue)} />
        <Kpi label="Procedures / 14d" value={String(procs14)} />
      </div>

      <section className="card mb-8">
        <div className="border-b-2 border-ink bg-paper px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide">Stock on hand</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">On hand (est.)</th>
                <th className="text-right">Reorder pt</th>
                <th className="text-right">Days cover</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, er, st, cover }) => (
                <tr key={p.id}>
                  <td className="font-semibold">
                    {p.name}
                    <div className="text-xs text-muted">{p.category}</div>
                  </td>
                  <td className="text-right">
                    <span className="font-semibold tabular-nums">{fmtQty(er.nom)}</span>{" "}
                    <span className="text-muted">{p.unit}</span>
                    <div className="text-[11px] tabular-nums text-muted">
                      est {fmtQty(er.low)}–{fmtQty(er.high)} · ±{er.pct}%
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{fmtQty(p.reorderPoint)}</td>
                  <td className="text-right tabular-nums">
                    {cover == null ? <span className="text-muted">—</span> : `${fmtQty(cover)}d`}
                  </td>
                  <td>
                    <span className={STATUS_CLASS[st.key]}>{st.label}</span>
                  </td>
                  <td>
                    <InventoryActions
                      productId={p.id}
                      name={p.name}
                      unit={p.unit}
                      onHand={p.onHand}
                      showReorder={st.rank <= 2}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted">
                    No products tracked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="border-b-2 border-ink bg-paper px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide">Recent stock movements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th className="text-right">Change</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{formatDateTime(t.at)}</td>
                  <td>{t.product.name}</td>
                  <td
                    className="text-right font-semibold tabular-nums"
                    style={{ color: t.delta < 0 ? "var(--accent)" : "#1f7a3d" }}
                  >
                    {t.delta > 0 ? "+" : ""}
                    {fmtQty(t.delta)}
                  </td>
                  <td className="text-muted">
                    {t.reason}
                    {t.ref ? ` · ${t.ref}` : ""}
                  </td>
                </tr>
              ))}
              {txns.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    No stock movements yet — log a procedure or receive an order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums" style={accent ? { color: "var(--accent)" } : undefined}>
        {value}
      </p>
    </div>
  );
}
