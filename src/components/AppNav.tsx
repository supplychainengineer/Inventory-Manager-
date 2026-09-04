"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";
import type { NavItem } from "@/components/AppShell";

export function AppNav({
  nav,
  user,
}: {
  nav: NavItem[];
  user: { name?: string | null; role: string };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: inline nav + user box */}
      <div className="hidden items-center gap-6 md:flex">
        <nav className="flex flex-wrap items-center gap-5">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} exact={item.exact} />
          ))}
        </nav>
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

      {/* Mobile: hamburger toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center border-2 border-ink md:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <span className="sr-only">Menu</span>
        <div className="flex flex-col gap-[3px]">
          <span className={`h-0.5 w-5 bg-ink transition-transform ${open ? "translate-y-[5px] rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-ink transition-transform ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
        </div>
      </button>

      {/* Mobile: dropdown panel */}
      {open && (
        <div className="w-full border-t-2 border-ink pt-3 md:hidden">
          <nav className="flex flex-col">
            {nav.map((item) => {
              const active =
                item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={
                    "border-b border-muted/20 py-3 text-sm font-semibold uppercase tracking-wide " +
                    (active ? "text-accent" : "text-ink")
                  }
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between">
            <div className="leading-tight">
              <span className="block text-sm font-semibold">{user.name}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-accent">
                {user.role}
              </span>
            </div>
            <SignOutButton />
          </div>
        </div>
      )}
    </>
  );
}
