"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={
        "border-b-2 px-1 pb-1 text-sm font-semibold uppercase tracking-wide transition-colors " +
        (active
          ? "border-accent text-accent"
          : "border-transparent text-ink hover:text-accent")
      }
    >
      {label}
    </Link>
  );
}
