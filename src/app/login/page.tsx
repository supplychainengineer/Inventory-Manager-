"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-sm">
        <div className="border-b border-hairline px-6 py-5">
          <span className="block text-xs font-bold uppercase tracking-widest text-accent">
            Asana Ortho
          </span>
          <h1 className="mt-1 text-xl font-bold">Inventory Manager</h1>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-6">
          <div className="mb-4">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="mb-4">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="mb-4 border-2 border-accent bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="border-t border-hairline px-6 py-4 text-xs text-muted">
          <p className="font-semibold uppercase tracking-wide">Demo accounts</p>
          <p className="mt-1">admin@asanaortho.com</p>
          <p>staff@asanaortho.com</p>
          <p className="mt-1">password: password123</p>
        </div>
      </div>
    </main>
  );
}
