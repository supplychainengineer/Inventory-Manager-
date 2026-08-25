import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { at: "desc" },
    take: 250,
    include: { actor: true },
  });

  return (
    <div>
      <PageHeader
        title="Audit Log & Order History"
        description="Every action across the portal, timestamped. Showing the most recent 250 entries."
      />

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{formatDateTime(l.at)}</td>
                <td>{l.actor?.name ?? "System"}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="text-muted">{l.details ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
