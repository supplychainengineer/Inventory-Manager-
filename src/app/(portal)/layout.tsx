import { AppShell, type NavItem } from "@/components/AppShell";
import { requireUser } from "@/lib/session";
import { isStockCountDue } from "@/lib/stock";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const countDue = await isStockCountDue();

  const nav: NavItem[] = [
    { href: "/catalog", label: "Catalog" },
    { href: "/my-requests", label: "My Requests" },
    { href: "/stock-count", label: "Stock Count" },
  ];
  if (user.role === "admin") {
    nav.push({ href: "/admin", label: "Admin" });
  }

  return (
    <AppShell user={user} nav={nav} countDue={countDue}>
      {children}
    </AppShell>
  );
}
