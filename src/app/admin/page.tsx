import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { formatMoney, toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // Spend is computed off ordered + received requests (approved purchase orders).
  const orders = await prisma.request.findMany({
    where: { status: { in: ["ordered", "received"] } },
    include: { product: true, vendor: true },
  });

  const orderCount = orders.length;
  let totalSpend = 0;
  const byVendor = new Map<string, number>();
  const byCategory = new Map<string, number>();

  for (const o of orders) {
    const lineTotal = toNumber(o.price) * o.qty;
    totalSpend += lineTotal;
    const vName = o.vendor?.name ?? "Unassigned";
    byVendor.set(vName, (byVendor.get(vName) ?? 0) + lineTotal);
    byCategory.set(o.product.category, (byCategory.get(o.product.category) ?? 0) + lineTotal);
  }

  const avgOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;

  const pendingCount = await prisma.request.count({ where: { status: "pending" } });
  const awaitingCount = await prisma.request.count({ where: { status: "ordered" } });

  const vendorRows = [...byVendor.entries()].sort((a, b) => b[1] - a[1]);
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxVendor = vendorRows[0]?.[1] ?? 0;
  const maxCategory = categoryRows[0]?.[1] ?? 0;

  return (
    <div>
      <PageHeader
        title="Budget & Spend"
        description="Spend across all approved purchase orders (ordered + received)."
        actions={
          <a href="/api/admin/export" className="btn-secondary px-3 py-2 text-xs">
            Export POs (CSV)
          </a>
        }
      />

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-4">
        <Kpi label="Total Spend" value={formatMoney(totalSpend)} />
        <Kpi label="Order Count" value={String(orderCount)} />
        <Kpi label="Avg Order Value" value={formatMoney(avgOrderValue)} />
        <Kpi label="Pending / Awaiting" value={`${pendingCount} / ${awaitingCount}`} />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <SpendTable
          title="Spend by Vendor"
          rows={vendorRows}
          max={maxVendor}
          total={totalSpend}
        />
        <SpendTable
          title="Spend by Category"
          rows={categoryRows}
          max={maxCategory}
          total={totalSpend}
        />
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/admin/requests" className="btn-secondary px-3 py-2 text-xs">
          Review pending requests ({pendingCount})
        </Link>
        <Link href="/admin/awaiting" className="btn-secondary px-3 py-2 text-xs">
          Awaiting delivery ({awaitingCount})
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function SpendTable({
  title,
  rows,
  max,
  total,
}: {
  title: string;
  rows: [string, number][];
  max: number;
  total: number;
}) {
  return (
    <section className="card">
      <div className="border-b border-hairline bg-paper px-4 py-2">
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="text-right">Spend</th>
              <th className="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, value]) => (
              <tr key={name}>
                <td className="font-semibold">
                  <div>{name}</div>
                  <div className="mt-1 h-1.5 w-full bg-paper">
                    <div
                      className="h-1.5 bg-accent"
                      style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
                    />
                  </div>
                </td>
                <td className="text-right">{formatMoney(value)}</td>
                <td className="text-right">
                  {total > 0 ? `${Math.round((value / total) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-muted">
                  No spend recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
