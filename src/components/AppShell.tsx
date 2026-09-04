import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export function AppShell({
  user,
  nav,
  countDue,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  nav: NavItem[];
  countDue?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
              Asana Ortho
            </span>
            <span className="text-base font-extrabold">Inventory Manager</span>
          </Link>
          <AppNav nav={nav} user={user} />
        </div>
      </header>

      {countDue && (
        <Link
          href="/stock-count"
          className="block border-b-2 border-ink bg-accent text-white transition-colors hover:bg-accent-hover"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <span className="text-sm font-semibold">
              ⚠ Weekly stock count is due
            </span>
            <span className="text-xs font-bold uppercase tracking-wide underline">
              Start count →
            </span>
          </div>
        </Link>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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
    <div className="mb-6 flex flex-col gap-3 border-b-2 border-ink pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
