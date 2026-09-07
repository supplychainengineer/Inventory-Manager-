"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { createUser, updateUser, deleteUser } from "@/app/admin/actions";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "staff" | "admin";
  isSelf: boolean;
}

export function UsersManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  function run(action: (fd: FormData) => Promise<unknown>, fd: FormData, after?: () => void) {
    startTransition(async () => {
      try {
        await action(fd);
        router.refresh();
        after?.();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-2 text-xs">
          + Add user
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-semibold">
                  {u.name}
                  {u.isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                </td>
                <td className="font-mono text-xs">{u.email}</td>
                <td>
                  <span className={u.role === "admin" ? "badge badge-ordered" : "badge badge-pending"}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditing(u)} className="btn-ghost">
                      Edit
                    </button>
                    {!u.isSelf && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${u.name} (${u.email})?`)) {
                            const fd = new FormData();
                            fd.set("id", u.id);
                            run(deleteUser, fd);
                          }
                        }}
                        className="btn-ghost text-muted hover:text-accent"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Add user">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(createUser, fd, () => setCreating(false));
          }}
        >
          <div className="mb-3">
            <label className="field-label">Name</label>
            <input name="name" required className="field-input" />
          </div>
          <div className="mb-3">
            <label className="field-label">Email</label>
            <input name="email" type="email" required className="field-input" />
          </div>
          <div className="mb-3">
            <label className="field-label">Temporary password (min 8 chars)</label>
            <input name="password" type="text" required minLength={8} className="field-input" />
          </div>
          <div className="mb-4">
            <label className="field-label">Role</label>
            <select name="role" defaultValue="staff" className="field-input">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Saving…" : "Create user"}
          </button>
        </form>
      </Modal>

      {/* Edit */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit user">
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(updateUser, fd, () => setEditing(null));
            }}
          >
            <input type="hidden" name="id" value={editing.id} />
            <div className="mb-3">
              <label className="field-label">Name</label>
              <input name="name" required defaultValue={editing.name} className="field-input" />
            </div>
            <div className="mb-3">
              <label className="field-label">Email</label>
              <input value={editing.email} disabled className="field-input opacity-60" />
            </div>
            <div className="mb-3">
              <label className="field-label">Role</label>
              <select name="role" defaultValue={editing.role} className="field-input">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="field-label">New password (leave blank to keep)</label>
              <input name="password" type="text" minLength={8} className="field-input" />
            </div>
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
