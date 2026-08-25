"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReminderRecipients } from "@/app/admin/actions";

export function ReminderSettingsForm({ recipients }: { recipients: string[] }) {
  const router = useRouter();
  const [value, setValue] = useState(recipients.join("\n"));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const fd = new FormData();
    fd.set("emails", value);
    startTransition(async () => {
      const res = await updateReminderRecipients(fd);
      if (res?.recipients) setValue(res.recipients.join("\n"));
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={submit} className="max-w-lg">
      <label className="field-label">Recipient emails (one per line or comma-separated)</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={5}
        className="field-input font-mono"
        placeholder="frontdesk@asanaortho.com&#10;admin@asanaortho.com"
      />
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2">
          {pending ? "Saving…" : "Save Recipients"}
        </button>
        {saved && (
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Saved ✓
          </span>
        )}
      </div>
    </form>
  );
}
