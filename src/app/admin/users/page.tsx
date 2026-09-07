import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/AppShell";
import { UsersManager, type UserRow } from "@/components/admin/UsersManager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isSelf: u.id === me.id,
  }));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create logins for your team. There is no public signup — you add each staff or admin account here."
      />
      <UsersManager users={rows} />
    </div>
  );
}
