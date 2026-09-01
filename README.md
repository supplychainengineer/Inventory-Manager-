# Asana Ortho Inventory Manager

An internal procurement / ordering portal for a dental practice's staff and admin.
Staff browse a product catalog and request items; admins approve requests (which
snapshots the preferred vendor's price, sends a real purchase-order email, and
starts a delivery clock), manage catalog data, track spend, and rely on an
automated daily job that emails reminders for overdue deliveries.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **PostgreSQL** via **Prisma**
- **NextAuth** (credentials provider, bcrypt-hashed passwords, JWT sessions)
- **Resend** for email (falls back to console logging when no API key is set)
- **Tailwind CSS** (flat / architectural design system)
- **Vercel Cron** (or the included **node-cron** runner) for the daily reminder job

## Roles

Two roles only: `staff` and `admin`. There is **no public signup** — an admin
creates users in the backend (see `prisma/seed.ts` for the demo users). Every
page requires login; unauthenticated requests are redirected to `/login` by
middleware. `/admin/*` is restricted to admins.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    then edit .env — at minimum set DATABASE_URL and NEXTAUTH_SECRET

# 3. Create the schema and generate the client
npx prisma migrate dev --name init

# 4. Seed demo data (vendors, products, users, sample requests)
npm run db:seed

# 5. Run
npm run dev            # http://localhost:3000
```

### Demo accounts (from the seed)

| Role  | Email                   | Password      |
| ----- | ----------------------- | ------------- |
| Admin | `admin@asanaortho.com`  | `password123` |
| Staff | `staff@asanaortho.com`  | `password123` |

The password is configurable via `SEED_USER_PASSWORD`.

## Data model

`User`, `Vendor`, `Product`, `VendorPricing` (many vendors per product for
price/delivery comparison), `Request` (with snapshot + reminder bookkeeping
fields), `AuditLog`, and a single-row `ReminderSettings` holding the recipient
list. See `prisma/schema.prisma`.

## Key flows

### Requesting & receiving (staff)

- **Catalog** (`/catalog`) — products grouped by category with preferred vendor,
  price, and delivery timeline; request any item with a quantity → creates a
  `pending` request.
- **My Requests** (`/my-requests`) — status of each request, due dates, and a
  **Mark Received** button on the staff member's own `ordered` requests. Marking
  received sets `receivedAt` and cancels any pending reminder for that request.

### Approval → purchase order (admin)

Approving a pending request (`/admin/requests`):

1. Snapshots the **preferred vendor's** `price` and `deliveryDays` onto the request.
2. Sets `status = ordered`, `orderedAt = now`, `dueDate = orderedAt + deliveryDays`.
3. Writes an `AuditLog` entry.
4. Sends a real **purchase-order email** to the vendor's email address.

(Approval is blocked until the product has a preferred vendor with pricing.)

### Automated reminders (the core requirement)

A daily job checks every `ordered` request where `dueDate <= today` **and**
`reminderSent = false`, and for each sends an email to the configured recipient
list:

> Order for [qty] × [product] was due [date] — please confirm receipt or mark it
> received in the portal.

…with a link back to the request. Each reminded request is flagged
(`reminderSent = true`, `reminderSentAt`) so a reminder is **never sent twice**.
If a request is marked received before the job runs, it is skipped — the received
check happens first. Admins can also **send a reminder manually** at any time
from **Awaiting Delivery** (`/admin/awaiting`).

The job lives behind a secret-protected API route:

```
POST /api/cron/reminders
Header: x-cron-secret: $CRON_SECRET
        (or Authorization: Bearer $CRON_SECRET — the Vercel Cron shape)
```

- **Vercel Cron:** `vercel.json` schedules a daily `GET /api/cron/reminders`.
  Set `CRON_SECRET` in the project; Vercel sends it as the `Authorization` header.
- **Self-hosted:** run `npx tsx scripts/cron.ts` (requires `npm install node-cron`),
  which calls the same endpoint on a schedule.

Trigger it locally:

```bash
curl -X POST http://localhost:3000/api/cron/reminders \
  -H "x-cron-secret: <your CRON_SECRET>"
```

### Admin management

- **Products / Vendors / Vendor Pricing** — full CRUD, with a per-product price
  comparison list from which you set the preferred vendor.
- **Bulk import from Excel** — on the Products page, **Import from Excel** accepts
  an `.xlsx` or `.csv` where each row is a product/vendor pricing line. It shows a
  preview (what's new vs. updated, resolved preferred vendor, any new vendors and
  skipped rows), then applies everything in one transaction. Imported products
  appear in the catalog for ordering immediately. Download a pre-formatted
  template from the same dialog (`GET /api/admin/import/template`).

  **Columns:** `Product`, `Category`, `Vendor`, `Vendor Email`, `Vendor Contact`,
  `Price`, `Delivery Days`, `Preferred` (headers are matched case-insensitively
  with common synonyms). Product/Category/Vendor/Price/Delivery Days are required;
  Vendor Email is required only for vendors that don't already exist. Rows sharing
  a product name become one product with multiple vendor options; mark one row
  `Preferred` (yes/y/x/1) to set the preferred vendor, otherwise the cheapest
  vendor is chosen for new products. Existing products and vendors are matched by
  name and updated.
- **Budget & Spend** dashboard (`/admin`) — total spend, spend by vendor, spend by
  category, order count, average order value (computed off `ordered` + `received`).
- **Audit Log** (`/admin/audit`) — every action, timestamped.
- **CSV export** — `GET /api/admin/export` streams all purchase orders as CSV.
- **Settings** (`/admin/settings`) — reminder recipients and the default inventory buffer.

### Consumption-based inventory (BOM)

Instead of counting SKUs daily, the team logs the procedures they performed and
stock is deducted automatically from each procedure's bill of materials.

- **Procedures & BOM** (`/admin/procedures`, admin) — define, per procedure, how
  many pieces of each product it consumes (e.g. *Composite Filling = 2 gloves +
  1 composite application + 1 bonding application*).
- **Log Work** (`/logwork`, staff + admin) — enter "we did N of procedure X" and
  the BOM quantities are deducted from on-hand stock in one transaction. Remote
  team members can do this without touching SKUs.
- **Inventory Analysis** (`/admin/inventory`, admin) — the founder's view: live
  on-hand per item shown as an **estimate range** (±the product's buffer),
  days-of-cover from recent burn rate, and an **OK / Low / Reorder** status
  computed off the *conservative* end of the estimate so reorders fire early.
  One-click **Reorder** raises a pending request; **Set count** corrects drift.
- **Margin of error** — each product has a `bufferPct` (falling back to the
  global default in Settings). It both widens the displayed estimate range and
  pulls low-stock alerts earlier, giving breathing room since not every SKU is
  counted.
- **Stock ledger** — receiving an approved order adds `qty × packSize` pieces
  back to stock; every movement (received / procedure / count) is recorded in
  `StockTxn` and shown under recent movements.

Units: `onHand` and `reorderPoint` are in a product's base `unit` (pieces);
`packSize` converts an ordered pack back into pieces on receipt.

## Email

`src/lib/email.ts` sends via Resend when `RESEND_API_KEY` is set; otherwise it
logs a simulated message to the server console so the app runs end-to-end without
credentials. Set `EMAIL_FROM` to a verified sender for real delivery.

## Scripts

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the dev server                         |
| `npm run build`        | `prisma generate` + production build         |
| `npm start`            | Start the production server                  |
| `npm run db:seed`      | Seed demo data                               |
| `npm run db:reset`     | Reset the database and re-seed               |
| `npm run typecheck`    | `tsc --noEmit`                               |
| `npm run lint`         | Next.js lint                                 |

## Design

Flat / architectural: a near-mono red (`#ec3013`) accent on white / off-white
(`#f3f2f2`), the **Archivo** typeface, zero border-radius, 2px section dividers,
flush-left labels, no drop shadows beyond a subtle card/modal elevation, and
data-dense tables with themed header rows for admin lists.
