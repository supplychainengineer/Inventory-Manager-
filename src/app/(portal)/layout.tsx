import { AppShell, type NavItem } from "@/components/AppShell";
import { requireUser } from "@/lib/session";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const nav: NavItem[] = [
    { href: "/catalog", label: "Catalog" },
    { href: "/my-requests", label: "My Requests" },
  ];
  if (user.role === "admin") {
    nav.push({ href: "/admin", label: "Admin" });
  }

  return (
    <AppShell user={user} nav={nav}>
      {children}
    </AppShell>
  );
}
