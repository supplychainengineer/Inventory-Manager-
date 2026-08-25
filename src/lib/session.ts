import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/** Returns the current session or redirects to /login when unauthenticated. */
export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

/** Returns the current session or redirects; additionally requires admin role. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/catalog");
  }
  return user;
}

/** Non-redirecting accessor. */
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}
