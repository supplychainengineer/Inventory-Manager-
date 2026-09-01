import { PageHeader } from "@/components/AppShell";
import { ReminderSettingsForm } from "@/components/admin/ReminderSettingsForm";
import { InventoryBufferForm } from "@/components/admin/InventoryBufferForm";
import { getReminderRecipients, getInventoryBufferPct } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [recipients, bufferPct] = await Promise.all([
    getReminderRecipients(),
    getInventoryBufferPct(),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Reminder recipients and inventory tracking defaults."
      />

      <section className="card mb-8 p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Inventory buffer</h2>
        <InventoryBufferForm bufferPct={bufferPct} />
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Reminder recipients</h2>
        <ReminderSettingsForm recipients={recipients} />
      </section>

      <section className="card mt-8 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide">How reminders work</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
          <li>
            A daily job checks every <strong>ordered</strong> request whose due date has
            arrived and that hasn&apos;t already been reminded.
          </li>
          <li>
            A reminder email goes to the recipients above with a link back to the request.
          </li>
          <li>
            Once sent, the request is flagged so the reminder never repeats.
          </li>
          <li>
            If a request is marked <strong>received</strong> before the due date, no reminder
            is sent — the received check happens first.
          </li>
          <li>
            The job endpoint is <code className="font-mono">/api/cron/reminders</code>,
            protected by the <code className="font-mono">x-cron-secret</code> header.
          </li>
        </ul>
      </section>
    </div>
  );
}
