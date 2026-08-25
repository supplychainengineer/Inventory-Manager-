import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import { VendorsManager, type VendorRow } from "@/components/admin/VendorsManager";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { pricing: true, requests: true } },
    },
  });

  const rows: VendorRow[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    contact: v.contact,
    email: v.email,
    productCount: v._count.pricing,
    orderCount: v._count.requests,
  }));

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Manage suppliers and the email address purchase orders are sent to."
      />
      <VendorsManager vendors={rows} />
    </div>
  );
}
