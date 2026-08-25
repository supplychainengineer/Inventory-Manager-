"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { createVendor, updateVendor, deleteVendor } from "@/app/admin/actions";

export interface VendorRow {
  id: string;
  name: string;
  contact: string | null;
  email: string;
  productCount: number;
  orderCount: number;
}

export function VendorsManager({ vendors }: { vendors: VendorRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);

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
          + New Vendor
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Contact</th>
              <th>Email</th>
              <th className="text-right">Products</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td className="font-semibold">{v.name}</td>
                <td>{v.contact ?? "—"}</td>
                <td className="font-mono text-xs">{v.email}</td>
                <td className="text-right">{v.productCount}</td>
                <td className="text-right">{v.orderCount}</td>
                <td>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditing(v)} className="btn-ghost">
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete vendor "${v.name}"?`)) {
                          const fd = new FormData();
                          fd.set("id", v.id);
                          run(deleteVendor, fd);
                        }
                      }}
                      className="btn-ghost text-muted hover:text-accent"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-muted">
                  No vendors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit Vendor" : "New Vendor"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(editing ? updateVendor : createVendor, fd, () => {
              setCreating(false);
              setEditing(null);
            });
          }}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="mb-3">
            <label className="field-label">Name</label>
            <input name="name" required defaultValue={editing?.name ?? ""} className="field-input" />
          </div>
          <div className="mb-3">
            <label className="field-label">Contact</label>
            <input
              name="contact"
              defaultValue={editing?.contact ?? ""}
              placeholder="Account rep, phone…"
              className="field-input"
            />
          </div>
          <div className="mb-4">
            <label className="field-label">Order Email</label>
            <input
              name="email"
              type="email"
              required
              defaultValue={editing?.email ?? ""}
              className="field-input"
            />
          </div>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Saving…" : "Save Vendor"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
