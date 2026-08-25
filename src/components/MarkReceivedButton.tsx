"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReceived } from "@/app/(portal)/actions";

export function MarkReceivedButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit() {
    const fd = new FormData();
    fd.set("requestId", requestId);
    startTransition(async () => {
      await markReceived(fd);
      router.refresh();
    });
  }

  return (
    <button onClick={submit} disabled={pending} className="btn-primary px-3 py-1 text-xs">
      {pending ? "Saving…" : "Mark Received"}
    </button>
  );
}
