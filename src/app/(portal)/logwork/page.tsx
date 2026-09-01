import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/AppShell";
import { LogWorkTable, type ProcedureDTO } from "@/components/LogWorkTable";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export default async function LogWorkPage() {
  await requireUser();

  const [procedures, recent] = await Promise.all([
    prisma.procedure.findMany({
      orderBy: { name: "asc" },
      include: { bom: { include: { product: true } } },
    }),
    prisma.procedureLog.findMany({
      orderBy: { at: "desc" },
      take: 10,
      include: { procedure: true, loggedBy: true },
    }),
  ]);

  const dtos: ProcedureDTO[] = procedures.map((p) => ({
    id: p.id,
    name: p.name,
    materials: p.bom.map((b) => ({
      label: `${fmtQty(b.qty)} ${b.product.unit} · ${b.product.name}`,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="Log Work"
        description="Enter the procedures your team performed — materials are auto-deducted from stock using each procedure's bill of materials. No SKU counting needed."
      />

      <section className="card mb-8">
        <div className="border-b-2 border-ink bg-paper px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide">Procedures performed</h2>
        </div>
        <LogWorkTable procedures={dtos} />
      </section>

      <section className="card">
        <div className="border-b-2 border-ink bg-paper px-4 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide">Recent activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Procedure</th>
                <th className="text-right">Count</th>
                <th>Logged by</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.at)}</td>
                  <td>{l.procedure.name}</td>
                  <td className="text-right tabular-nums">{l.count}</td>
                  <td>{l.loggedBy?.name ?? "—"}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-muted">
                    Nothing logged yet.
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
