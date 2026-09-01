"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { quickReorder, setStockCount } from "@/app/admin/actions";

export function InventoryActions({
  productId,
  name,
  unit,
  onHand,
  showReorder,
}: {
  productId: string;
  name: string;
  unit: string;
  onHand: number;
  showReorder: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [countOpen, setCountOpen] = useState(false);
  const [value, setValue] = useState(String(onHand));

  function reorder() {
    const fd = new FormData();
    fd.set("productId", productId);
    startTransition(async () => {
      await quickReorder(fd);
      router.refresh();
    });
  }

  function saveCount(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("count", value);
    startTransition(async () => {
      await setStockCount(fd);
      setCountOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {showReorder && (
        <button onClick={reorder} disabled={pending} className="btn-ghost">
          Reorder
        </button>
      )}
      <button
        onClick={() => {
          setValue(String(onHand));
          setCountOpen(true);
        }}
        className="btn-ghost text-muted hover:text-accent"
      >
        Set count
      </button>

      <Modal open={countOpen} onClose={() => setCountOpen(false)} title={`Set stock count — ${name}`}>
        <form onSubmit={saveCount}>
          <p className="mb-3 text-sm text-muted">
            Enter the actual counted quantity (in {unit}). This corrects any drift that built up
            from consumption estimates.
          </p>
          <label className="field-label">On hand ({unit})</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="field-input"
            autoFocus
          />
          <button type="submit" disabled={pending} className="btn-primary mt-4 w-full">
            {pending ? "Saving…" : "Update count"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
