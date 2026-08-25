import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge, OverdueBadge } from "@/components/StatusBadge";
import { MarkReceivedButton } from "@/components/MarkReceivedButton";
import { formatDate, formatMoney, isOverdue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const user = await requireUser();

  const requests = await prisma.request.findMany({
    where: { requestedById: user.id },
    orderBy: { requestedAt: "desc" },
    include: { product: true, vendor: true },
  });

  return (
    <div>
      <PageHeader
        title="My Requests"
        description="Track the status of items you've requested."
      />

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="text-right">Qty</th>
              <th>Requested</th>
              <th>Status</th>
              <th>Vendor</th>
              <th>Due</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const overdue = r.status === "ordered" && isOverdue(r.dueDate);
              return (
                <tr key={r.id}>
                  <td className="font-semibold">{r.product.name}</td>
                  <td className="text-right">{r.qty}</td>
                  <td>{formatDate(r.requestedAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {overdue && <OverdueBadge />}
                    </div>
                  </td>
                  <td>{r.vendor?.name ?? "—"}</td>
                  <td>
                    {r.status === "received"
                      ? `Received ${formatDate(r.receivedAt)}`
                      : formatDate(r.dueDate)}
                  </td>
                  <td>
                    <div className="flex justify-end">
                      {r.status === "ordered" ? (
                        <MarkReceivedButton requestId={r.id} />
                      ) : r.price ? (
                        <span className="text-xs text-muted">
                          {formatMoney(r.price)} ea
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted">
                  You haven&apos;t requested anything yet. Visit the catalog to
                  get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
