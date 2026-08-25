import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Asana Ortho Procurement <procurement@example.com>";

const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Sends an email via Resend. When RESEND_API_KEY is not configured the message
 * is logged to the server console instead of sent, so the app runs end-to-end
 * in local development without credentials.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const cleaned = recipients.map((r) => r.trim()).filter(Boolean);

  if (cleaned.length === 0) {
    return { ok: false, error: "No recipients" };
  }

  if (!resend) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[email:simulated] to=${cleaned.join(", ")}\n  subject: ${input.subject}\n  ${input.text ?? "(html body)"}\n`,
    );
    return { ok: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: cleaned,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}

export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
