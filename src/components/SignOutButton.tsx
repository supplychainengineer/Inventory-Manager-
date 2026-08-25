"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs font-semibold uppercase tracking-wide text-muted hover:text-accent"
    >
      Sign out
    </button>
  );
}
