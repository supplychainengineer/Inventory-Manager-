"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { createProcedure, updateProcedure, deleteProcedure } from "@/app/admin/actions";

export interface ProductLite {
  id: string;
  name: string;
  unit: string;
}
export interface BomLine {
  productId: string;
  qty: number;
}
export interface ProcedureDTO {
  id: string;
  name: string;
  bom: BomLine[];
}

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function ProceduresManager({
  procedures,
  products,
}: {
  procedures: ProcedureDTO[];
  products: ProductLite[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProcedureDTO | null>(null);
  const [creating, setCreating] = useState(false);

  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? "?";
  const pUnit = (id: string) => products.find((p) => p.id === id)?.unit ?? "";

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
          + New Procedure
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Procedure</th>
              <th>Bill of materials</th>
              <th className="text-right">Lines</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.name}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {p.bom.length ? (
                      p.bom.map((b, i) => (
                        <span key={i} className="border border-muted/40 px-2 py-0.5 text-[11px]">
                          {fmtQty(b.qty)} {pUnit(b.productId)} · {pName(b.productId)}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">no materials</span>
                    )}
                  </div>
                </td>
                <td className="text-right tabular-nums">{p.bom.length}</td>
                <td>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setEditing(p)} className="btn-ghost">
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete procedure "${p.name}"?`)) {
                          const fd = new FormData();
                          fd.set("id", p.id);
                          run(deleteProcedure, fd);
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
            {procedures.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-muted">
                  No procedures yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ProcedureEditor
          key={editing?.id ?? "new"}
          initial={editing}
          products={products}
          pending={pending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(fd) =>
            run(editing ? updateProcedure : createProcedure, fd, () => {
              setCreating(false);
              setEditing(null);
            })
          }
        />
      )}
    </div>
  );
}

function ProcedureEditor({
  initial,
  products,
  pending,
  onClose,
  onSave,
}: {
  initial: ProcedureDTO | null;
  products: ProductLite[];
  pending: boolean;
  onClose: () => void;
  onSave: (fd: FormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lines, setLines] = useState<BomLine[]>(initial?.bom ?? []);
  const [selProduct, setSelProduct] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("1");

  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? "?";
  const pUnit = (id: string) => products.find((p) => p.id === id)?.unit ?? "";

  function addLine() {
    const q = parseFloat(qty);
    if (!selProduct || isNaN(q) || q <= 0) return;
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === selProduct);
      if (existing) return ls.map((l) => (l.productId === selProduct ? { ...l, qty: q } : l));
      return [...ls, { productId: selProduct, qty: q }];
    });
    setQty("1");
  }

  function submit() {
    if (!name.trim()) {
      alert("Procedure name is required");
      return;
    }
    if (lines.length === 0) {
      alert("Add at least one material");
      return;
    }
    const fd = new FormData();
    if (initial) fd.set("id", initial.id);
    fd.set("name", name.trim());
    fd.set("bom", JSON.stringify(lines));
    onSave(fd);
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit Procedure" : "New Procedure"}>
      <div className="mb-3">
        <label className="field-label">Procedure name</label>
        <input
          className="field-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Composite Filling"
        />
      </div>

      <label className="field-label">Materials consumed per procedure</label>
      <div className="mb-3 overflow-x-auto border-2 border-ink">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th className="text-right">Qty / procedure</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.productId}>
                <td className="font-semibold">{pName(l.productId)}</td>
                <td className="text-right tabular-nums">
                  {fmtQty(l.qty)} {pUnit(l.productId)}
                </td>
                <td className="text-right">
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    className="btn-ghost text-muted hover:text-accent"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-center text-sm text-muted">
                  No materials yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <select
          value={selProduct}
          onChange={(e) => setSelProduct(e.target.value)}
          className="field-input flex-[2]"
          style={{ minWidth: 180 }}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unit})
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
          className="field-input flex-1"
          style={{ minWidth: 90 }}
        />
        <button onClick={addLine} className="btn-secondary px-3 py-2 text-xs">
          Add material
        </button>
      </div>

      <div className="mt-4 border-t-2 border-ink pt-4">
        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          {pending ? "Saving…" : "Save Procedure"}
        </button>
      </div>
    </Modal>
  );
}
