import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/AppShell";
import { StockCountForm, type CountRow } from "@/components/StockCountForm";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export default async function StockCountPage() {
  await requireUser();

  const [products, recent] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.stockCount.findMany({
      orderBy: { at: "desc" },
      take: 8,
      include: { countedBy: true, items: { include: { product: true } } },
    }),
  ]);

  const latest = recent[0];
  const rows: CountRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    onHand: p.onHand,
    lastCount: latest ? latest.items.find((i) => i.productId === p.id)?.boxes ?? null : null,
  }));

  return (
    <div>
      <PageHeader
        title="Weekly Stock Count"
        description="Count how many boxes of each product you have on the shelf and enter them below. Submitting updates the on-hand stock everyone sees. Do this once a week."
      />

      <StockCountForm rows={rows} />

      <section className="card">
        <div className="border-b border-hairline bg-paper px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide">Recent counts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Counted by</th>
                <th className="text-right">Items</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">{formatDateTime(c.at)}</td>
                  <td>{c.countedBy?.name ?? "—"}</td>
                  <td className="text-right tabular-nums">{c.items.length}</td>
                  <td className="text-muted">
                    {c.items
                      .slice(0, 4)
                      .map((i) => `${i.product.name.split(" ")[0]} ${fmtQty(i.boxes)}`)
                      .join(" · ")}
                    {c.items.length > 4 ? " …" : ""}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    No counts yet.
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
