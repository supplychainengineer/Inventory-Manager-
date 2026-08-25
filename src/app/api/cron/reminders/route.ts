import { NextResponse, type NextRequest } from "next/server";
import { runDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Daily reminder job. Invoked by a scheduler (Vercel Cron or node-cron).
 * Authenticated by a shared secret sent either as the `x-cron-secret` header or
 * as an `Authorization: Bearer <secret>` header (the shape Vercel Cron uses).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: without a configured secret the endpoint is disabled.
    return false;
  }
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === secret) return true;

  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runDueReminders();
  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    checked: result.checked,
    sent: result.sent,
    outcomes: result.outcomes,
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Support GET as well so Vercel Cron (which issues GET) can trigger it.
export async function GET(req: NextRequest) {
  return handle(req);
}
