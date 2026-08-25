"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRequest } from "@/app/(portal)/actions";

export function RequestItemForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("qty", String(qty));
    startTransition(async () => {
      await createRequest(fd);
      setDone(true);
      setQty(1);
      router.refresh();
      setTimeout(() => setDone(false), 2500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 border-2 border-ink bg-white px-2 py-1 text-sm outline-none focus:border-accent"
        aria-label="Quantity"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="btn-primary px-3 py-1 text-xs"
      >
        {pending ? "Requesting…" : done ? "Requested ✓" : "Request"}
      </button>
    </div>
  );
}
