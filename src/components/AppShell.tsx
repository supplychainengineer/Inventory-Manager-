import Link from "next/link";
import type { ReactNode } from "react";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function AppShell({
  user,
  nav,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                Asana Ortho
              </span>
              <span className="text-base font-extrabold">Inventory Manager</span>
            </Link>
            <nav className="flex items-center gap-5">
              {nav.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} exact={item.exact} />
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-accent">
                {user.role}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-4">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
