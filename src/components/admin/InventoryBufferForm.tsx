"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInventoryBuffer } from "@/app/admin/actions";

export function InventoryBufferForm({ bufferPct }: { bufferPct: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(bufferPct));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const fd = new FormData();
    fd.set("bufferPct", value);
    startTransition(async () => {
      const res = await updateInventoryBuffer(fd);
      if (res?.bufferPct != null) setValue(String(res.bufferPct));
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={submit} className="max-w-lg">
      <label className="field-label">Default margin of error (buffer %)</label>
      <p className="mb-2 text-sm text-muted">
        Applied to any product without its own buffer. On-hand is shown as ±this %, and low-stock
        alerts fire off the conservative end so you reorder with breathing room.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          max={90}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field-input w-28"
        />
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2">
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">Saved ✓</span>
        )}
      </div>
    </form>
  );
}
