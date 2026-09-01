"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { purchaseOrderEmail } from "@/lib/email-templates";
import { poNumber } from "@/lib/format";
import {
  sendReminderForRequest,
  setReminderRecipients,
  setInventoryBufferPct,
  getInventoryBufferPct,
} from "@/lib/reminders";
import { parseInventoryFile } from "@/lib/inventory-import";
import { buildImportPlan, commitImport, type ImportPlan } from "@/lib/inventory-plan";
import { applyStock } from "@/lib/stock";
import { suggestedReorderPacks } from "@/lib/inventory";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/awaiting");
  revalidatePath("/admin/products");
  revalidatePath("/admin/vendors");
  revalidatePath("/admin/audit");
}

// ---------------------------------------------------------------------------
// Request approval / rejection
// ---------------------------------------------------------------------------

export async function approveRequest(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) throw new Error("Missing request id");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      product: { include: { preferredVendor: true } },
      requestedBy: true,
    },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") {
    throw new Error("Only pending requests can be approved");
  }

  const preferredVendorId = request.product.preferredVendorId;
  if (!preferredVendorId) {
    throw new Error(
      "This product has no preferred vendor set. Set one before approving.",
    );
  }

  const pricing = await prisma.vendorPricing.findUnique({
    where: {
      productId_vendorId: {
        productId: request.productId,
        vendorId: preferredVendorId,
      },
    },
    include: { vendor: true },
  });
  if (!pricing) {
    throw new Error(
      "No pricing found for the preferred vendor. Add vendor pricing first.",
    );
  }

  const orderedAt = new Date();
  const dueDate = new Date(orderedAt);
  dueDate.setDate(dueDate.getDate() + pricing.deliveryDays);

  // Persist the snapshot + status transition, then log the audit entry, in one
  // transaction so they never diverge.
  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: request.id },
      data: {
        status: "ordered",
        vendorId: pricing.vendorId,
        price: pricing.price,
        deliveryDays: pricing.deliveryDays,
        orderedAt,
        dueDate,
        reminderSent: false,
        reminderSentAt: null,
      },
    });
    await logAudit(
      {
        actorId: admin.id,
        action: "request.approved",
        details:
          `${admin.name} approved ${poNumber(request.id)}: ${request.qty} × ` +
          `${request.product.name} from ${pricing.vendor.name} @ ` +
          `${pricing.price.toString()} (due ${dueDate.toDateString()})`,
      },
      tx,
    );
  });

  // Send the real PO email to the vendor after the transaction commits.
  const po = purchaseOrderEmail({
    poNumber: poNumber(request.id),
    vendorName: pricing.vendor.name,
    productName: request.product.name,
    qty: request.qty,
    unitPrice: Number(pricing.price.toString()),
    deliveryDays: pricing.deliveryDays,
    dueDate,
    orderedBy: request.requestedBy.name,
  });
  const emailResult = await sendEmail({
    to: pricing.vendor.email,
    subject: po.subject,
    html: po.html,
    text: po.text,
  });
  await logAudit({
    actorId: admin.id,
    action: emailResult.ok ? "po.email.sent" : "po.email.failed",
    details: emailResult.ok
      ? `PO email for ${poNumber(request.id)} sent to ${pricing.vendor.email}${emailResult.simulated ? " (simulated)" : ""}`
      : `PO email for ${poNumber(request.id)} failed: ${emailResult.error}`,
  });

  revalidateAdmin();
}

export async function rejectRequest(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) throw new Error("Missing request id");

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { product: true },
  });
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") {
    throw new Error("Only pending requests can be rejected");
  }

  await prisma.request.update({
    where: { id: requestId },
    data: { status: "rejected" },
  });
  await logAudit({
    actorId: admin.id,
    action: "request.rejected",
    details: `${admin.name} rejected ${request.qty} × ${request.product.name}`,
  });

  revalidateAdmin();
}

export async function sendReminderNow(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = String(formData.get("requestId") || "");
  if (!requestId) throw new Error("Missing request id");

  await sendReminderForRequest(requestId, {
    actorId: admin.id,
    force: true,
  });

  revalidatePath("/admin/awaiting");
  revalidatePath("/admin/audit");
}

// ---------------------------------------------------------------------------
// Reminder recipients
// ---------------------------------------------------------------------------

export async function updateReminderRecipients(formData: FormData) {
  const admin = await requireAdmin();
  const raw = String(formData.get("emails") || "");
  const emails = raw
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter(Boolean);

  const saved = await setReminderRecipients(emails);
  await logAudit({
    actorId: admin.id,
    action: "settings.reminders.updated",
    details: `Reminder recipients set to: ${saved.join(", ") || "(none)"}`,
  });

  revalidatePath("/admin/settings");
  return { ok: true, recipients: saved };
}

// ---------------------------------------------------------------------------
// Vendor CRUD
// ---------------------------------------------------------------------------

const vendorSchema = z.object({
  name: z.string().min(1, "Name required"),
  contact: z.string().optional(),
  email: z.string().email("Valid email required"),
});

export async function createVendor(formData: FormData) {
  const admin = await requireAdmin();
  const data = vendorSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
    email: formData.get("email"),
  });
  const vendor = await prisma.vendor.create({ data });
  await logAudit({
    actorId: admin.id,
    action: "vendor.created",
    details: `Created vendor ${vendor.name}`,
  });
  revalidateAdmin();
  return { ok: true };
}

export async function updateVendor(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing vendor id");
  const data = vendorSchema.parse({
    name: formData.get("name"),
    contact: formData.get("contact") || undefined,
    email: formData.get("email"),
  });
  const vendor = await prisma.vendor.update({ where: { id }, data });
  await logAudit({
    actorId: admin.id,
    action: "vendor.updated",
    details: `Updated vendor ${vendor.name}`,
  });
  revalidateAdmin();
  return { ok: true };
}

export async function deleteVendor(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing vendor id");

  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) throw new Error("Vendor not found");

  // Block deletion if the vendor is referenced by any ordered/received request.
  const referencing = await prisma.request.count({
    where: { vendorId: id, status: { in: ["ordered", "received"] } },
  });
  if (referencing > 0) {
    throw new Error(
      "Cannot delete a vendor with orders on record. It is referenced by existing purchase orders.",
    );
  }

  await prisma.vendor.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    action: "vendor.deleted",
    details: `Deleted vendor ${vendor.name}`,
  });
  revalidateAdmin();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Product CRUD + preferred vendor + vendor pricing
// ---------------------------------------------------------------------------

const productSchema = z.object({
  name: z.string().min(1, "Name required"),
  category: z.string().min(1, "Category required"),
  preferredVendorId: z.string().optional().nullable(),
  unit: z.string().optional(),
  packSize: z.coerce.number().int().positive().max(100000).optional(),
  onHand: z.coerce.number().nonnegative().optional(),
  reorderPoint: z.coerce.number().nonnegative().optional(),
  bufferPct: z.coerce.number().min(0).max(90).optional(),
});

function readProductForm(formData: FormData) {
  return productSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    preferredVendorId: formData.get("preferredVendorId") || null,
    unit: formData.get("unit") || undefined,
    packSize: formData.get("packSize") ?? undefined,
    onHand: formData.get("onHand") ?? undefined,
    reorderPoint: formData.get("reorderPoint") ?? undefined,
    bufferPct: formData.get("bufferPct") ?? undefined,
  });
}

export async function createProduct(formData: FormData) {
  const admin = await requireAdmin();
  const data = readProductForm(formData);
  const product = await prisma.product.create({
    data: {
      name: data.name,
      category: data.category,
      preferredVendorId: data.preferredVendorId || null,
      unit: data.unit || "unit",
      packSize: data.packSize ?? 1,
      onHand: data.onHand ?? 0,
      reorderPoint: data.reorderPoint ?? 0,
      bufferPct: data.bufferPct ?? null,
    },
  });
  if ((data.onHand ?? 0) > 0) {
    await prisma.stockTxn.create({
      data: { productId: product.id, delta: data.onHand ?? 0, reason: "count", ref: "initial" },
    });
  }
  await logAudit({
    actorId: admin.id,
    action: "product.created",
    details: `Created product ${product.name}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  revalidatePath("/admin/inventory");
  return { ok: true };
}

export async function updateProduct(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing product id");
  const data = readProductForm(formData);
  const existing = await prisma.product.findUnique({ where: { id }, select: { onHand: true } });
  const nextOnHand = data.onHand ?? existing?.onHand ?? 0;
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      preferredVendorId: data.preferredVendorId || null,
      unit: data.unit || "unit",
      packSize: data.packSize ?? 1,
      onHand: nextOnHand,
      reorderPoint: data.reorderPoint ?? 0,
      bufferPct: data.bufferPct ?? null,
    },
  });
  // Record a stock adjustment when the on-hand count was changed directly.
  if (existing && nextOnHand !== existing.onHand) {
    await prisma.stockTxn.create({
      data: { productId: id, delta: nextOnHand - existing.onHand, reason: "count", ref: null },
    });
    revalidatePath("/admin/inventory");
  }
  await logAudit({
    actorId: admin.id,
    action: "product.updated",
    details: `Updated product ${product.name}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  return { ok: true };
}

export async function deleteProduct(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing product id");

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new Error("Product not found");

  const referencing = await prisma.request.count({ where: { productId: id } });
  if (referencing > 0) {
    throw new Error(
      "Cannot delete a product that has requests on record.",
    );
  }

  await prisma.product.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    action: "product.deleted",
    details: `Deleted product ${product.name}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  return { ok: true };
}

export async function setPreferredVendor(formData: FormData) {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") || "");
  const vendorId = String(formData.get("vendorId") || "");
  if (!productId || !vendorId) throw new Error("Missing ids");

  const product = await prisma.product.update({
    where: { id: productId },
    data: { preferredVendorId: vendorId },
    include: { preferredVendor: true },
  });
  await logAudit({
    actorId: admin.id,
    action: "product.preferredVendor.set",
    details: `Set preferred vendor for ${product.name} to ${product.preferredVendor?.name}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  return { ok: true };
}

const pricingSchema = z.object({
  productId: z.string().min(1),
  vendorId: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  deliveryDays: z.coerce.number().int().nonnegative(),
});

export async function upsertVendorPricing(formData: FormData) {
  const admin = await requireAdmin();
  const data = pricingSchema.parse({
    productId: formData.get("productId"),
    vendorId: formData.get("vendorId"),
    price: formData.get("price"),
    deliveryDays: formData.get("deliveryDays"),
  });

  await prisma.vendorPricing.upsert({
    where: {
      productId_vendorId: {
        productId: data.productId,
        vendorId: data.vendorId,
      },
    },
    create: {
      productId: data.productId,
      vendorId: data.vendorId,
      price: new Prisma.Decimal(data.price),
      deliveryDays: data.deliveryDays,
    },
    update: {
      price: new Prisma.Decimal(data.price),
      deliveryDays: data.deliveryDays,
    },
  });
  await logAudit({
    actorId: admin.id,
    action: "pricing.upserted",
    details: `Set pricing ${data.price} / ${data.deliveryDays}d for product ${data.productId}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk inventory import from a spreadsheet
// ---------------------------------------------------------------------------

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

async function readUploadedFile(formData: FormData) {
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    throw new Error("No file was uploaded.");
  }
  const blob = file as File;
  if (blob.size === 0) throw new Error("The uploaded file is empty.");
  if (blob.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("File is too large (max 5 MB).");
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  return { buffer, filename: blob.name || "upload.xlsx" };
}

export interface ImportPreviewResponse {
  ok: boolean;
  fatal?: string;
  plan?: ImportPlan;
  parseErrors?: { rowNumber: number; message: string }[];
}

export async function previewInventoryImport(
  formData: FormData,
): Promise<ImportPreviewResponse> {
  await requireAdmin();
  const { buffer, filename } = await readUploadedFile(formData);

  const parsed = await parseInventoryFile(buffer, filename);
  if (parsed.fatal) return { ok: false, fatal: parsed.fatal };
  if (parsed.rows.length === 0) {
    return {
      ok: false,
      fatal: "No valid rows found in the file.",
      parseErrors: parsed.errors,
    };
  }

  const plan = await buildImportPlan(parsed.rows);
  return { ok: true, plan, parseErrors: parsed.errors };
}

export interface ImportCommitResponse {
  ok: boolean;
  error?: string;
  summary?: {
    vendorsCreated: number;
    vendorsUpdated: number;
    productsCreated: number;
    productsUpdated: number;
    pricingUpserted: number;
    rowsSkipped: number;
  };
}

export async function commitInventoryImport(
  formData: FormData,
): Promise<ImportCommitResponse> {
  const admin = await requireAdmin();
  const { buffer, filename } = await readUploadedFile(formData);

  const parsed = await parseInventoryFile(buffer, filename);
  if (parsed.fatal) return { ok: false, error: parsed.fatal };
  if (parsed.rows.length === 0) {
    return { ok: false, error: "No valid rows to import." };
  }

  try {
    const result = await commitImport(parsed.rows);
    await logAudit({
      actorId: admin.id,
      action: "inventory.imported",
      details:
        `Imported "${filename}": +${result.productsCreated} products, ` +
        `~${result.productsUpdated} updated, +${result.vendorsCreated} vendors, ` +
        `${result.pricingUpserted} pricing rows (${parsed.errors.length} rows skipped)`,
    });
    revalidateAdmin();
    revalidatePath("/catalog");
    return {
      ok: true,
      summary: { ...result, rowsSkipped: parsed.errors.length },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import failed." };
  }
}

export async function deleteVendorPricing(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing pricing id");
  await prisma.vendorPricing.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    action: "pricing.deleted",
    details: `Deleted vendor pricing ${id}`,
  });
  revalidateAdmin();
  revalidatePath("/catalog");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Procedures & BOM
// ---------------------------------------------------------------------------

const bomSchema = z.array(
  z.object({ productId: z.string().min(1), qty: z.coerce.number().positive() }),
);
const procedureSchema = z.object({
  name: z.string().min(1, "Procedure name required"),
  bom: bomSchema.min(1, "Add at least one material"),
});

function readProcedureForm(formData: FormData) {
  let bomRaw: unknown = [];
  try {
    bomRaw = JSON.parse(String(formData.get("bom") || "[]"));
  } catch {
    throw new Error("Invalid BOM data");
  }
  return procedureSchema.parse({ name: formData.get("name"), bom: bomRaw });
}

export async function createProcedure(formData: FormData) {
  const admin = await requireAdmin();
  const data = readProcedureForm(formData);
  const procedure = await prisma.procedure.create({
    data: { name: data.name, bom: { create: data.bom } },
  });
  await logAudit({
    actorId: admin.id,
    action: "procedure.created",
    details: `Created procedure ${procedure.name}`,
  });
  revalidatePath("/admin/procedures");
  revalidatePath("/logwork");
  return { ok: true };
}

export async function updateProcedure(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing procedure id");
  const data = readProcedureForm(formData);
  await prisma.$transaction(async (tx) => {
    await tx.procedure.update({ where: { id }, data: { name: data.name } });
    await tx.bomItem.deleteMany({ where: { procedureId: id } });
    await tx.bomItem.createMany({
      data: data.bom.map((b) => ({ procedureId: id, productId: b.productId, qty: b.qty })),
    });
  });
  await logAudit({
    actorId: admin.id,
    action: "procedure.updated",
    details: `Updated procedure ${data.name}`,
  });
  revalidatePath("/admin/procedures");
  revalidatePath("/logwork");
  return { ok: true };
}

export async function deleteProcedure(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Missing procedure id");
  const procedure = await prisma.procedure.findUnique({ where: { id } });
  if (!procedure) throw new Error("Procedure not found");
  await prisma.procedure.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    action: "procedure.deleted",
    details: `Deleted procedure ${procedure.name}`,
  });
  revalidatePath("/admin/procedures");
  revalidatePath("/logwork");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock adjustments & reorder
// ---------------------------------------------------------------------------

export async function setStockCount(formData: FormData) {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") || "");
  const newCount = z.coerce.number().nonnegative().parse(formData.get("count"));
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const delta = newCount - product.onHand;
  await prisma.$transaction(async (tx) => {
    await applyStock(tx, productId, delta, "count", null);
    await logAudit(
      {
        actorId: admin.id,
        action: "stock.counted",
        details: `${admin.name} set ${product.name} on-hand to ${newCount} ${product.unit}`,
      },
      tx,
    );
  });
  revalidatePath("/admin/inventory");
  return { ok: true };
}

export async function quickReorder(formData: FormData) {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") || "");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const globalPct = await getInventoryBufferPct();
  const packs = suggestedReorderPacks(product, globalPct);

  await prisma.request.create({
    data: { productId, qty: packs, requestedById: admin.id, status: "pending" },
  });
  await logAudit({
    actorId: admin.id,
    action: "request.created",
    details: `${admin.name} reordered ${packs} pack(s) of ${product.name} (low stock)`,
  });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/requests");
  return { ok: true, packs };
}

export async function updateInventoryBuffer(formData: FormData) {
  const admin = await requireAdmin();
  const pct = z.coerce.number().min(0).max(90).parse(formData.get("bufferPct"));
  const saved = await setInventoryBufferPct(pct);
  await logAudit({
    actorId: admin.id,
    action: "settings.inventoryBuffer.updated",
    details: `Default inventory buffer set to ${saved}%`,
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin/inventory");
  return { ok: true, bufferPct: saved };
}
