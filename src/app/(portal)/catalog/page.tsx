import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/AppShell";
import { RequestItemForm } from "@/components/RequestItemForm";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireUser();

  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      preferredVendor: true,
      pricing: { include: { vendor: true } },
    },
  });

  // Group by category for a data-dense sectioned catalog.
  const byCategory = new Map<string, typeof products>();
  for (const p of products) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  return (
    <div>
      <PageHeader
        title="Product Catalog"
        description="Browse consumables and supplies, then request items with a quantity."
      />

      <div className="space-y-8">
        {[...byCategory.entries()].map(([category, items]) => (
          <section key={category} className="card">
            <div className="border-b border-hairline bg-paper px-4 py-2">
              <h2 className="text-sm font-bold uppercase tracking-wide">{category}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Preferred Vendor</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Delivery</th>
                    <th className="text-right">Request</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const preferred =
                      p.pricing.find((pr) => pr.vendorId === p.preferredVendorId) ??
                      p.pricing[0];
                    return (
                      <tr key={p.id}>
                        <td className="font-semibold">{p.name}</td>
                        <td>{p.preferredVendor?.name ?? "—"}</td>
                        <td className="text-right">
                          {preferred ? formatMoney(preferred.price) : "—"}
                        </td>
                        <td className="text-right">
                          {preferred ? `${preferred.deliveryDays} day(s)` : "—"}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <RequestItemForm productId={p.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-muted">No products in the catalog yet.</p>
        )}
      </div>
    </div>
  );
}
