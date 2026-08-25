import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_USER_PASSWORD || "password123";
  const passwordHash = await bcrypt.hash(password, 10);

  console.log("Seeding Asana Ortho Inventory Manager…");

  // Reset in dependency-safe order (idempotent seed).
  await prisma.auditLog.deleteMany();
  await prisma.request.deleteMany();
  await prisma.vendorPricing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.reminderSettings.deleteMany();

  // --- Users -----------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      name: "Dr. Alina Reyes",
      email: "admin@asanaortho.com",
      passwordHash,
      role: "admin",
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: "Jordan Blake",
      email: "staff@asanaortho.com",
      passwordHash,
      role: "staff",
    },
  });

  // --- Vendors ---------------------------------------------------------------
  const henrySchein = await prisma.vendor.create({
    data: {
      name: "Henry Schein Dental",
      contact: "Marcy Lin, Account Rep",
      email: "orders@henryschein.example.com",
    },
  });
  const patterson = await prisma.vendor.create({
    data: {
      name: "Patterson Dental",
      contact: "Devon Ospina, Account Rep",
      email: "orders@patterson.example.com",
    },
  });
  const benco = await prisma.vendor.create({
    data: {
      name: "Benco Dental",
      contact: "Priya Raman, Account Rep",
      email: "orders@benco.example.com",
    },
  });

  // --- Products with vendor pricing ------------------------------------------
  type PricingSeed = { vendorId: string; price: number; deliveryDays: number };
  async function makeProduct(
    name: string,
    category: string,
    pricing: PricingSeed[],
    preferredVendorId: string,
  ) {
    const product = await prisma.product.create({
      data: { name, category, preferredVendorId },
    });
    for (const p of pricing) {
      await prisma.vendorPricing.create({
        data: {
          productId: product.id,
          vendorId: p.vendorId,
          price: new Prisma.Decimal(p.price),
          deliveryDays: p.deliveryDays,
        },
      });
    }
    return product;
  }

  const nitrileGloves = await makeProduct(
    "Nitrile Exam Gloves (Box of 200)",
    "Consumables",
    [
      { vendorId: henrySchein.id, price: 12.5, deliveryDays: 3 },
      { vendorId: patterson.id, price: 11.95, deliveryDays: 5 },
    ],
    patterson.id,
  );

  const compositeResin = await makeProduct(
    "Composite Resin Kit — A2 Shade",
    "Restorative",
    [
      { vendorId: henrySchein.id, price: 89.0, deliveryDays: 4 },
      { vendorId: benco.id, price: 84.5, deliveryDays: 6 },
    ],
    benco.id,
  );

  const orthoBrackets = await makeProduct(
    "Self-Ligating Ortho Brackets (Case)",
    "Ortho Supplies",
    [
      { vendorId: patterson.id, price: 245.0, deliveryDays: 7 },
      { vendorId: benco.id, price: 239.0, deliveryDays: 8 },
    ],
    benco.id,
  );

  const alginate = await makeProduct(
    "Alginate Impression Material (1lb)",
    "Impression",
    [{ vendorId: henrySchein.id, price: 18.75, deliveryDays: 3 }],
    henrySchein.id,
  );

  const sterilPouches = await makeProduct(
    "Self-Seal Sterilization Pouches (Box of 200)",
    "Sterilization",
    [
      { vendorId: patterson.id, price: 22.0, deliveryDays: 4 },
      { vendorId: henrySchein.id, price: 23.5, deliveryDays: 2 },
    ],
    patterson.id,
  );

  const bondingAgent = await makeProduct(
    "Universal Bonding Agent (5ml)",
    "Restorative",
    [
      { vendorId: benco.id, price: 64.0, deliveryDays: 5 },
      { vendorId: henrySchein.id, price: 66.5, deliveryDays: 3 },
    ],
    benco.id,
  );

  // --- Sample requests across statuses ---------------------------------------
  // 1) Pending request awaiting admin approval.
  await prisma.request.create({
    data: {
      productId: nitrileGloves.id,
      qty: 10,
      requestedById: staff.id,
      status: "pending",
    },
  });

  // 2) Ordered request, due in the future (no reminder yet).
  const orderedFuture = await prisma.request.create({
    data: {
      productId: sterilPouches.id,
      qty: 6,
      requestedById: staff.id,
      status: "ordered",
      vendorId: patterson.id,
      price: new Prisma.Decimal(22.0),
      deliveryDays: 4,
      orderedAt: daysFromNow(-1),
      dueDate: daysFromNow(3),
      reminderSent: false,
    },
  });

  // 3) Ordered request, already overdue and not yet reminded — the daily job
  //    would pick this one up.
  await prisma.request.create({
    data: {
      productId: orthoBrackets.id,
      qty: 2,
      requestedById: staff.id,
      status: "ordered",
      vendorId: benco.id,
      price: new Prisma.Decimal(239.0),
      deliveryDays: 8,
      orderedAt: daysFromNow(-12),
      dueDate: daysFromNow(-4),
      reminderSent: false,
    },
  });

  // 4) Received request (contributes to spend, never reminded).
  await prisma.request.create({
    data: {
      productId: compositeResin.id,
      qty: 3,
      requestedById: staff.id,
      status: "received",
      vendorId: benco.id,
      price: new Prisma.Decimal(84.5),
      deliveryDays: 6,
      orderedAt: daysFromNow(-20),
      dueDate: daysFromNow(-14),
      receivedAt: daysFromNow(-15),
      reminderSent: false,
    },
  });

  // 5) Rejected request.
  await prisma.request.create({
    data: {
      productId: bondingAgent.id,
      qty: 25,
      requestedById: staff.id,
      status: "rejected",
    },
  });

  // Reference alginate so the linter/product is clearly used in the catalog.
  void alginate;
  void orderedFuture;

  // --- Reminder settings -----------------------------------------------------
  await prisma.reminderSettings.create({
    data: {
      id: 1,
      recipientEmails: ["admin@asanaortho.com", "frontdesk@asanaortho.com"],
    },
  });

  // --- Seed audit entries ----------------------------------------------------
  await prisma.auditLog.create({
    data: { actorId: admin.id, action: "seed.init", details: "Database seeded with demo data" },
  });

  console.log("Seed complete.");
  console.log(`  Admin login: admin@asanaortho.com / ${password}`);
  console.log(`  Staff login: staff@asanaortho.com / ${password}`);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
