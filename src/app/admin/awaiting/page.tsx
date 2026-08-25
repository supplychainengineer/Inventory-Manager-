import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { StatusBadge, OverdueBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney, isOverdue, poNumber } from "@/lib/format";
import { sendReminderNow } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AwaitingPage() {
  const ordered = await prisma.request.findMany({
    where: { status: "ordered" },
    orderBy: { dueDate: "asc" },
    include: { product: true, vendor: true, requestedBy: true },
  });

  const overdueCount = ordered.filter((r) => isOverdue(r.dueDate)).length;

  return (
    <div>
      <PageHeader
        title="Awaiting Delivery"
        description={`${ordered.length} open order(s)${overdueCount ? ` — ${overdueCount} overdue` : ""}. Send a reminder manually at any time.`}
      />

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO</th>
              <th>Product</th>
              <th className="text-right">Qty</th>
              <th>Vendor</th>
              <th>Ordered</th>
              <th>Due</th>
              <th>Status</th>
              <th>Reminder</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const overdue = isOverdue(r.dueDate);
              return (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{poNumber(r.id)}</td>
                  <td className="font-semibold">{r.product.name}</td>
                  <td className="text-right">{r.qty}</td>
                  <td>{r.vendor?.name ?? "—"}</td>
                  <td>{formatDate(r.orderedAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {formatDate(r.dueDate)}
                      {overdue && <OverdueBadge />}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="text-xs text-muted">
                    {r.reminderSent
                      ? `Sent ${formatDate(r.reminderSentAt)}`
                      : "Not sent"}
                  </td>
                  <td>
                    <form className="flex justify-end">
                      <input type="hidden" name="requestId" value={r.id} />
                      <button
                        formAction={sendReminderNow}
                        className="btn-secondary px-3 py-1 text-xs"
                      >
                        Send reminder now
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {ordered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-muted">
                  Nothing awaiting delivery.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Estimated open value:{" "}
        <span className="font-semibold text-ink">
          {formatMoney(
            ordered.reduce((sum, r) => sum + Number(r.price?.toString() ?? 0) * r.qty, 0),
          )}
        </span>
      </p>
    </div>
  );
}
