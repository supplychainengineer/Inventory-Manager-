import { AppShell, type NavItem } from "@/components/AppShell";
import { requireAdmin } from "@/lib/session";
import { isStockCountDue } from "@/lib/stock";

const nav: NavItem[] = [
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/stock-count", label: "Stock Count" },
  { href: "/admin", label: "Spend", exact: true },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/awaiting", label: "Awaiting" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const countDue = await isStockCountDue();
  return (
    <AppShell user={user} nav={nav} countDue={countDue}>
      {children}
    </AppShell>
  );
}
