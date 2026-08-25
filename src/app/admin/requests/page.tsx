import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { formatDate, formatMoney } from "@/lib/format";
import { approveRequest, rejectRequest } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function PendingRequestsPage() {
  const pending = await prisma.request.findMany({
    where: { status: "pending" },
    orderBy: { requestedAt: "asc" },
    include: {
      product: { include: { preferredVendor: true, pricing: true } },
      requestedBy: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Pending Requests"
        description="Approve to snapshot the preferred vendor's price & delivery, send a PO, and start the delivery clock. Reject to decline."
      />

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Requested</th>
              <th>Requested By</th>
              <th>Product</th>
              <th className="text-right">Qty</th>
              <th>Preferred Vendor</th>
              <th className="text-right">Unit / Delivery</th>
              <th className="text-right">Est. Total</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r) => {
              const preferred = r.product.pricing.find(
                (p) => p.vendorId === r.product.preferredVendorId,
              );
              const canApprove = !!preferred;
              const estTotal = preferred ? Number(preferred.price.toString()) * r.qty : null;
              return (
                <tr key={r.id}>
                  <td>{formatDate(r.requestedAt)}</td>
                  <td>{r.requestedBy.name}</td>
                  <td className="font-semibold">{r.product.name}</td>
                  <td className="text-right">{r.qty}</td>
                  <td>{r.product.preferredVendor?.name ?? "— none set —"}</td>
                  <td className="text-right">
                    {preferred
                      ? `${formatMoney(preferred.price)} · ${preferred.deliveryDays}d`
                      : "—"}
                  </td>
                  <td className="text-right">
                    {estTotal !== null ? formatMoney(estTotal) : "—"}
                  </td>
                  <td>
                    <form className="flex justify-end gap-2">
                      <input type="hidden" name="requestId" value={r.id} />
                      <button
                        formAction={approveRequest}
                        disabled={!canApprove}
                        title={
                          canApprove
                            ? "Approve and send purchase order"
                            : "Set a preferred vendor with pricing before approving"
                        }
                        className="btn-primary px-3 py-1 text-xs"
                      >
                        Approve
                      </button>
                      <button
                        formAction={rejectRequest}
                        className="btn-danger px-3 py-1 text-xs"
                      >
                        Reject
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {pending.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sm text-muted">
                  No pending requests. All caught up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
