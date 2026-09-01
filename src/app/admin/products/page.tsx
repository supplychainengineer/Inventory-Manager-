import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { ProductsManager, type ProductDTO, type VendorDTO } from "@/components/admin/ProductsManager";
import { toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, vendors] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        preferredVendor: true,
        pricing: { include: { vendor: true }, orderBy: { price: "asc" } },
      },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  const productDTOs: ProductDTO[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    preferredVendorId: p.preferredVendorId,
    preferredVendorName: p.preferredVendor?.name ?? null,
    unit: p.unit,
    packSize: p.packSize,
    onHand: p.onHand,
    reorderPoint: p.reorderPoint,
    bufferPct: p.bufferPct,
    pricing: p.pricing.map((pr) => ({
      id: pr.id,
      vendorId: pr.vendorId,
      vendorName: pr.vendor.name,
      price: toNumber(pr.price),
      deliveryDays: pr.deliveryDays,
    })),
  }));

  const vendorDTOs: VendorDTO[] = vendors.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage the catalog, vendor pricing, and each product's preferred vendor."
      />
      <ProductsManager products={productDTOs} vendors={vendorDTOs} />
    </div>
  );
}
