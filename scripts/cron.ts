/**
 * Standalone node-cron runner — an alternative to Vercel Cron for self-hosted
 * deployments. It calls the same protected endpoint the platform scheduler
 * would, so the reminder logic lives in exactly one place.
 *
 * Usage:
 *   APP_URL=http://localhost:3000 CRON_SECRET=... npx tsx scripts/cron.ts
 *
 * Requires the `node-cron` package (add it with `npm install node-cron`).
 * Runs daily at 13:00 UTC by default; override with CRON_SCHEDULE.
 */
import cron from "node-cron";

const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/cron/reminders`;
const secret = process.env.CRON_SECRET || "";
const schedule = process.env.CRON_SCHEDULE || "0 13 * * *";

async function trigger() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret },
    });
    const body = await res.json();
    // eslint-disable-next-line no-console
    console.log(`[cron] ${new Date().toISOString()} -> ${res.status}`, body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[cron] failed:", err);
  }
}

// eslint-disable-next-line no-console
console.log(`[cron] scheduling reminders at "${schedule}" -> ${url}`);
cron.schedule(schedule, trigger);
