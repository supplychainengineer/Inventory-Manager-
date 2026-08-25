import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { reminderEmail } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";

const DEFAULT_SETTINGS_ID = 1;

/** Reads the configured reminder recipient list, creating the row if needed. */
export async function getReminderRecipients(): Promise<string[]> {
  const settings = await prisma.reminderSettings.findUnique({
    where: { id: DEFAULT_SETTINGS_ID },
  });
  return settings?.recipientEmails ?? [];
}

export async function setReminderRecipients(emails: string[]): Promise<string[]> {
  const cleaned = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  const settings = await prisma.reminderSettings.upsert({
    where: { id: DEFAULT_SETTINGS_ID },
    create: { id: DEFAULT_SETTINGS_ID, recipientEmails: cleaned },
    update: { recipientEmails: cleaned },
  });
  return settings.recipientEmails;
}

export interface ReminderOutcome {
  requestId: string;
  sent: boolean;
  skippedReason?: string;
  error?: string;
}

/**
 * Sends a due-delivery reminder for a single ordered request and marks it as
 * reminded. The caller is responsible for the "is it still ordered / not yet
 * reminded" gate; this function re-checks status defensively so a request
 * received in the meantime is never reminded.
 */
export async function sendReminderForRequest(
  requestId: string,
  opts: { actorId?: string | null; force?: boolean } = {},
): Promise<ReminderOutcome> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { product: true, vendor: true, requestedBy: true },
  });

  if (!request) {
    return { requestId, sent: false, skippedReason: "not-found" };
  }

  // The received check happens first: a received request is never reminded.
  if (request.status !== "ordered") {
    return { requestId, sent: false, skippedReason: `status:${request.status}` };
  }

  if (!opts.force && request.reminderSent) {
    return { requestId, sent: false, skippedReason: "already-sent" };
  }

  const recipients = await getReminderRecipients();
  if (recipients.length === 0) {
    return { requestId, sent: false, skippedReason: "no-recipients" };
  }

  const { subject, html, text } = reminderEmail({
    requestId: request.id,
    productName: request.product.name,
    qty: request.qty,
    dueDate: request.dueDate ?? request.requestedAt,
    vendorName: request.vendor?.name,
    requestedBy: request.requestedBy.name,
  });

  const result = await sendEmail({ to: recipients, subject, html, text });
  if (!result.ok) {
    return { requestId, sent: false, error: result.error };
  }

  await prisma.request.update({
    where: { id: request.id },
    data: { reminderSent: true, reminderSentAt: new Date() },
  });

  await logAudit({
    actorId: opts.actorId ?? null,
    action: opts.actorId ? "reminder.sent.manual" : "reminder.sent.auto",
    details: `Reminder for request ${request.id} (${request.qty} × ${request.product.name}) sent to ${recipients.join(", ")}`,
  });

  return { requestId, sent: true };
}

/**
 * The daily job: find all ordered requests due on/before today that have not
 * been reminded, and send a reminder for each.
 */
export async function runDueReminders(now: Date = new Date()): Promise<{
  checked: number;
  sent: number;
  outcomes: ReminderOutcome[];
}> {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const due = await prisma.request.findMany({
    where: {
      status: "ordered",
      reminderSent: false,
      dueDate: { lte: endOfToday },
    },
    select: { id: true },
  });

  const outcomes: ReminderOutcome[] = [];
  for (const { id } of due) {
    outcomes.push(await sendReminderForRequest(id));
  }

  return {
    checked: due.length,
    sent: outcomes.filter((o) => o.sent).length,
    outcomes,
  };
}
