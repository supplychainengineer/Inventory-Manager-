# Deploying Asana Ortho Inventory Manager (live, 24/7)

Two paths are documented here:

- **Railway (~$5/month, recommended)** — one platform runs the app **and**
  Postgres together, always-on, deploys straight from GitHub. Cheapest way to
  a real multi-user tool. **Start here** ↓
- **Vercel + Neon + Resend** — the "managed, near-zero ops" path, ~$20–40/month.
  See [Alternative: Vercel + Neon](#alternative-vercel--neon--resend) below.

Either way you'll need a GitHub account (the repo is already pushed). Email
(Resend) is optional on both — without it, reminder/PO emails log to the server
console instead of sending.

---

## Railway (~$5/month) — recommended

`railway.json` in the repo already tells Railway to run database migrations
automatically on every deploy (`prisma migrate deploy`) and to start the app,
so the only manual database step is seeding the very first admin (once).

### 1. Create the project
1. Go to [railway.app](https://railway.app) → **Login with GitHub**.
2. **New Project** → **Deploy from GitHub repo** → pick
   `supplychainengineer/Inventory-Manager-`.
3. Choose the branch to deploy (`claude/asana-ortho-inventory-manager-9ngrns`,
   or merge it to `main` first and deploy `main`).

The first build fails because there's no database yet — that's expected.

### 2. Add Postgres (same project)
In the project canvas → **New** → **Database** → **Add PostgreSQL**. Railway
provisions it and exposes a `DATABASE_URL` you reference in the next step.

### 3. Set environment variables
App service → **Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (type it literally — Railway links it) |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 32` and paste the result |
| `NEXTAUTH_URL` | your Railway URL (step 4), e.g. `https://…up.railway.app` |
| `APP_URL` | same as `NEXTAUTH_URL` |
| `CRON_SECRET` | run `openssl rand -hex 24` and paste the result |
| `SEED_USER_PASSWORD` | a strong password — this is your first admin login |
| `RESEND_API_KEY` | from Resend (optional; omit to log emails to console) |
| `EMAIL_FROM` | your verified sender (optional) |

### 4. Get your URL, then redeploy
1. App service → **Settings → Networking → Generate Domain**.
2. Put that full `https://…` URL into both `NEXTAUTH_URL` and `APP_URL`.
3. **Redeploy** (Deployments → ⋯ → Redeploy). Migrations run automatically.

### 5. Seed the first admin (one time only)
Migrations already ran; you just need the starter admin + sample data. From the
app service → ⋯ → **Terminal** (or `railway run` via the CLI locally):

```bash
npm run db:seed   # creates vendors, products, admin@asanaortho.com + staff
```

Sign in at your URL as `admin@asanaortho.com` with your `SEED_USER_PASSWORD`,
then go to **Admin → Users** to create real logins for your team. Don't re-run
seed after this — it's a one-time bootstrap.

### 6. The daily reminder job
Railway does **not** read `vercel.json`, so the reminder cron must be wired
separately. Two options — the endpoint accepts either the `x-cron-secret` header
or an `Authorization: Bearer <secret>` header:

- **A — External free cron (simplest).** At [cron-job.org](https://cron-job.org)
  create a job: **GET** `https://YOUR-URL/api/cron/reminders`, daily, with a
  request header `x-cron-secret: <your CRON_SECRET>`. Zero cost, nothing to
  deploy.
- **B — Railway cron service.** Add a second service in the same project on a
  schedule (Railway "Cron" setting) whose command curls the same endpoint with
  the header. Stays in one platform; adds a few cents.

### 7. (Optional) Custom domain, uptime, backups
- **Domain:** App service → Settings → Networking → add your domain, follow the
  DNS steps, then update `NEXTAUTH_URL`/`APP_URL` and redeploy.
- **Uptime:** add a free monitor at [uptimerobot.com](https://uptimerobot.com).
- **Backups:** enable backups on the Railway Postgres plugin.

---

## Alternative: Vercel + Neon + Resend

This is the "managed, near-zero ops" path: **Vercel** (app + daily cron) +
**Neon** (Postgres) + **Resend** (email). Budget ~$20–40/month. Total setup is
about 20–30 minutes. You'll need a GitHub account (the repo is already pushed),
plus free Vercel, Neon, and Resend accounts.

---

## Accounts & first login

The app is production-hardened: the login page no longer shows any credentials,
and admins create every account in-app under **Admin → Users** (there is no
public signup).

Getting your first admin:

1. Set a strong `SEED_USER_PASSWORD` before you seed (step 4). Seeding creates a
   starter admin `admin@asanaortho.com` with that password, plus sample data so
   you can see the app working.
2. Sign in as that admin, open **Admin → Users**, and create real logins for
   your team (staff or admin). Change the starter admin's own password there too.
3. The demo `staff@asanaortho.com` account and sample products/requests are just
   examples — leave them for the pilot, or re-seed clean when you go live.

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
