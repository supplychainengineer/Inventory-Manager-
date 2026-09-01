"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { ImportInventory } from "@/components/admin/ImportInventory";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setPreferredVendor,
  upsertVendorPricing,
  deleteVendorPricing,
} from "@/app/admin/actions";

export interface PricingDTO {
  id: string;
  vendorId: string;
  vendorName: string;
  price: number;
  deliveryDays: number;
}
export interface ProductDTO {
  id: string;
  name: string;
  category: string;
  preferredVendorId: string | null;
  preferredVendorName: string | null;
  unit: string;
  packSize: number;
  onHand: number;
  reorderPoint: number;
  bufferPct: number | null;
  pricing: PricingDTO[];
}

function fmtQty(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}
export interface VendorDTO {
  id: string;
  name: string;
}

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function ProductsManager({
  products,
  vendors,
}: {
  products: ProductDTO[];
  vendors: VendorDTO[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [pricingFor, setPricingFor] = useState<ProductDTO | null>(null);

  function run(action: (fd: FormData) => Promise<unknown>, fd: FormData, after?: () => void) {
    startTransition(async () => {
      await action(fd);
      router.refresh();
      after?.();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-3">
        <ImportInventory />
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-2 text-xs">
          + New Product
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th className="text-right">On hand</th>
              <th>Preferred Vendor</th>
              <th className="text-right">Vendors</th>
              <th className="text-right">Best Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const best = p.pricing.length
                ? Math.min(...p.pricing.map((pr) => pr.price))
                : null;
              return (
                <tr key={p.id}>
                  <td className="font-semibold">{p.name}</td>
                  <td>{p.category}</td>
                  <td className="text-right tabular-nums">
                    {fmtQty(p.onHand)} <span className="text-muted">{p.unit}</span>
                  </td>
                  <td>{p.preferredVendorName ?? <span className="text-accent">— none —</span>}</td>
                  <td className="text-right">{p.pricing.length}</td>
                  <td className="text-right">{best !== null ? money(best) : "—"}</td>
                  <td>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setPricingFor(p)}
                        className="btn-ghost"
                      >
                        Pricing
                      </button>
                      <button onClick={() => setEditing(p)} className="btn-ghost">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${p.name}"?`)) {
                            const fd = new FormData();
                            fd.set("id", p.id);
                            run(deleteProduct, fd);
                          }
                        }}
                        className="btn-ghost text-muted hover:text-accent"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-muted">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit product modal */}
      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit Product" : "New Product"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(editing ? updateProduct : createProduct, fd, () => {
              setCreating(false);
              setEditing(null);
            });
          }}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="mb-3">
            <label className="field-label">Name</label>
            <input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              className="field-input"
            />
          </div>
          <div className="mb-3">
            <label className="field-label">Category</label>
            <input
              name="category"
              required
              defaultValue={editing?.category ?? ""}
              placeholder="Consumables, Restorative, Ortho Supplies…"
              className="field-input"
            />
          </div>
          <div className="mb-3">
            <label className="field-label">Preferred Vendor</label>
            <select
              name="preferredVendorId"
              defaultValue={editing?.preferredVendorId ?? ""}
              className="field-input"
            >
              <option value="">— none —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="flex-1" style={{ minWidth: 110 }}>
              <label className="field-label">Base unit</label>
              <input
                name="unit"
                defaultValue={editing?.unit ?? ""}
                placeholder="glove, kit…"
                className="field-input"
              />
            </div>
            <div className="flex-1" style={{ minWidth: 110 }}>
              <label className="field-label">Pack size</label>
              <input
                name="packSize"
                type="number"
                min={1}
                defaultValue={editing?.packSize ?? 1}
                className="field-input"
              />
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex-1" style={{ minWidth: 100 }}>
              <label className="field-label">On hand</label>
              <input
                name="onHand"
                type="number"
                min={0}
                step="0.01"
                defaultValue={editing?.onHand ?? 0}
                className="field-input"
              />
            </div>
            <div className="flex-1" style={{ minWidth: 100 }}>
              <label className="field-label">Reorder pt</label>
              <input
                name="reorderPoint"
                type="number"
                min={0}
                step="0.01"
                defaultValue={editing?.reorderPoint ?? 0}
                className="field-input"
              />
            </div>
            <div className="flex-1" style={{ minWidth: 90 }}>
              <label className="field-label">Buffer %</label>
              <input
                name="bufferPct"
                type="number"
                min={0}
                max={90}
                defaultValue={editing?.bufferPct ?? ""}
                placeholder="10"
                className="field-input"
              />
            </div>
          </div>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Saving…" : "Save Product"}
          </button>
        </form>
      </Modal>

      {/* Pricing / vendor comparison modal */}
      <Modal
        open={pricingFor !== null}
        onClose={() => setPricingFor(null)}
        title={pricingFor ? `Pricing — ${pricingFor.name}` : "Pricing"}
      >
        {pricingFor && (
          <PricingEditor
            product={pricingFor}
            vendors={vendors}
            pending={pending}
            onRun={run}
          />
        )}
      </Modal>
    </div>
  );
}

function PricingEditor({
  product,
  vendors,
  pending,
  onRun,
}: {
  product: ProductDTO;
  vendors: VendorDTO[];
  pending: boolean;
  onRun: (action: (fd: FormData) => Promise<unknown>, fd: FormData, after?: () => void) => void;
}) {
  const usedVendorIds = new Set(product.pricing.map((p) => p.vendorId));
  const availableVendors = vendors.filter((v) => !usedVendorIds.has(v.id));

  return (
    <div>
      <table className="data-table mb-4">
        <thead>
          <tr>
            <th>Vendor</th>
            <th className="text-right">Price</th>
            <th className="text-right">Delivery</th>
            <th className="text-right">Preferred</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {product.pricing.map((pr) => {
            const isPreferred = pr.vendorId === product.preferredVendorId;
            return (
              <tr key={pr.id}>
                <td className="font-semibold">{pr.vendorName}</td>
                <td className="text-right">{money(pr.price)}</td>
                <td className="text-right">{pr.deliveryDays}d</td>
                <td className="text-right">
                  {isPreferred ? (
                    <span className="badge badge-received">Preferred</span>
                  ) : (
                    <button
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("productId", product.id);
                        fd.set("vendorId", pr.vendorId);
                        onRun(setPreferredVendor, fd);
                      }}
                      className="btn-ghost"
                    >
                      Set preferred
                    </button>
                  )}
                </td>
                <td className="text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${pr.vendorName} pricing?`)) {
                        const fd = new FormData();
                        fd.set("id", pr.id);
                        onRun(deleteVendorPricing, fd);
                      }
                    }}
                    className="btn-ghost text-muted hover:text-accent"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
          {product.pricing.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-sm text-muted">
                No vendor pricing yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="section-divider pt-4">
        <p className="field-label">Add / update vendor pricing</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("productId", product.id);
            const form = e.currentTarget;
            onRun(upsertVendorPricing, fd, () => form.reset());
          }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        >
          <select name="vendorId" required className="field-input sm:col-span-2">
            <option value="">Select vendor…</option>
            {availableVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
            {/* Allow re-selecting an existing vendor to update its pricing. */}
            {product.pricing.map((pr) => (
              <option key={pr.vendorId} value={pr.vendorId}>
                {pr.vendorName} (update)
              </option>
            ))}
          </select>
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Price"
            className="field-input"
          />
          <input
            name="deliveryDays"
            type="number"
            min="0"
            required
            placeholder="Days"
            className="field-input"
          />
          <button type="submit" disabled={pending} className="btn-primary sm:col-span-4">
            Save Pricing
          </button>
        </form>
      </div>
    </div>
  );
}
