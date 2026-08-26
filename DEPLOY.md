# Deploying Asana Ortho Inventory Manager (live, 24/7)

This is the "managed, near-zero ops" path: **Vercel** (app + daily cron) +
**Neon** (Postgres) + **Resend** (email). Budget ~$20–40/month. Total setup is
about 20–30 minutes. You'll need a GitHub account (the repo is already pushed),
plus free Vercel, Neon, and Resend accounts.

---

## ⚠️ Before you go public — production hardening

The app currently ships in **demo mode**:

- the login page **shows** `admin@asanaortho.com / password123` to everyone, and
- the seed creates users with that shared password.

**Do not expose this publicly as-is.** Before (or immediately after) the first
deploy, do both of these:

1. Remove the demo-credentials block from the login page
   (`src/app/login/page.tsx`).
2. Set real passwords: change `SEED_USER_PASSWORD` to something strong before
   seeding, and change the seeded emails in `prisma/seed.ts` to your real admin
   address — or create your own admin user and delete the demo ones.

Ask and I'll make these changes for you in a few minutes.

---

## 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project (pick a region
   near your practice).
2. Use a **paid tier** ($19/mo) for an always-on tool — free-tier databases
   auto-**pause** after inactivity, which you don't want.
3. Copy the **connection string** (looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
   You'll paste this as `DATABASE_URL`.

## 2. Set up email (Resend)

1. Sign up at [resend.com](https://resend.com).
2. Add and **verify your sending domain** (add the DNS records Resend shows you).
3. Create an **API key** → this is `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to a verified address, e.g.
   `Asana Ortho Procurement <procurement@yourdomain.com>`.

> Skipping this? The app still runs — with no `RESEND_API_KEY`, reminder/PO
> emails are logged to the server console instead of sent. Fine for a first look,
> not for real reminders.

## 3. Deploy the app (Vercel)

1. Sign up at [vercel.com](https://vercel.com) and **Import** this GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build settings default
   (the build runs `prisma generate && next build`).
3. Add **Environment Variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `NEXTAUTH_SECRET` | run `openssl rand -base64 32` and paste the result |
   | `NEXTAUTH_URL` | your final URL, e.g. `https://yourdomain.com` |
   | `APP_URL` | same as `NEXTAUTH_URL` |
   | `RESEND_API_KEY` | from Resend (optional for first look) |
   | `EMAIL_FROM` | your verified sender |
   | `CRON_SECRET` | run `openssl rand -hex 24` and paste the result |
   | `SEED_USER_PASSWORD` | a strong password for the first admin |

4. **Deploy.** You'll get a `*.vercel.app` URL immediately.

## 4. Create the schema and first admin

Run these once against the production database (locally, with `DATABASE_URL`
pointed at Neon, or from the Vercel dashboard's console):

```bash
npx prisma migrate deploy   # creates the tables
npm run db:seed             # creates vendors, products, and the admin/staff users
```

After seeding, sign in as the admin and manage everything from the UI. (Once
you're set up, you can remove or repurpose the demo staff user.)

## 5. The daily reminder job

Already wired — `vercel.json` schedules `GET /api/cron/reminders` daily at
13:00 UTC. Vercel automatically sends your `CRON_SECRET` as the `Authorization`
header, and the endpoint checks it. Nothing else to configure.

To change the time, edit the `schedule` (cron syntax, UTC) in `vercel.json`.

## 6. Point your domain

In Vercel → Project → **Domains**, add your custom domain and follow the DNS
instructions. Vercel provisions HTTPS automatically. Update `NEXTAUTH_URL` and
`APP_URL` to the custom domain and redeploy.

## 7. (Recommended) Uptime + backups

- **Uptime:** add a free monitor at [uptimerobot.com](https://uptimerobot.com)
  or BetterStack pinging your URL, so you're alerted if it goes down.
- **Backups:** Neon keeps automatic backups / point-in-time restore on paid
  tiers — no action needed, but know where the restore button is.

---

## Notes

- **No patient data.** This tool stores staff logins and supply requests, not
  PHI, so it stays outside HIPAA scope. Keep it that way — don't enter patient
  information in request notes.
- **Self-hosting instead?** A single small VPS (Hetzner/DigitalOcean, ~$6–12/mo)
  running the app + Postgres + Caddy via Docker Compose also works; you then own
  backups and updates. Ask if you want that path written up.
