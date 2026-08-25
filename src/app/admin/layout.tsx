import { AppShell, type NavItem } from "@/components/AppShell";
import { requireAdmin } from "@/lib/session";

const nav: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
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
  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
