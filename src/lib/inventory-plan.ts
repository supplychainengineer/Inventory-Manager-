import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RawRow } from "@/lib/inventory-import";

export interface VendorPlan {
  name: string;
  email: string | null;
  contact: string | null;
  status: "new" | "existing";
  error?: string;
}

export interface ProductPlan {
  name: string;
  category: string;
  status: "new" | "existing";
  preferredVendor: string | null; // vendor name to set as preferred, or null = unchanged
  vendorCount: number;
}

export interface ImportPlan {
  vendors: VendorPlan[];
  products: ProductPlan[];
  pricingCount: number;
  rowCount: number;
  blocking: string[];
}

interface GroupedVendor {
  name: string;
  email: string | null;
  contact: string | null;
}

interface GroupedProduct {
  name: string;
  category: string;
  preferredVendorName: string | null; // explicit preferred from a flagged row
  pricing: Map<string, { vendorName: string; price: number; deliveryDays: number }>;
}

/** Groups raw rows by vendor and product (case-insensitive keys). */
function group(rows: RawRow[]) {
  const vendors = new Map<string, GroupedVendor>();
  const products = new Map<string, GroupedProduct>();

  for (const row of rows) {
    const vKey = row.vendor.toLowerCase();
    const existingV = vendors.get(vKey);
    if (existingV) {
      // Fill missing details from later rows.
      if (!existingV.email && row.vendorEmail) existingV.email = row.vendorEmail;
      if (!existingV.contact && row.vendorContact) existingV.contact = row.vendorContact;
    } else {
      vendors.set(vKey, {
        name: row.vendor,
        email: row.vendorEmail,
        contact: row.vendorContact,
      });
    }

    const pKey = row.product.toLowerCase();
    let prod = products.get(pKey);
    if (!prod) {
      prod = {
        name: row.product,
        category: row.category,
        preferredVendorName: null,
        pricing: new Map(),
      };
      products.set(pKey, prod);
    }
    if (row.preferred) {
      prod.preferredVendorName = row.vendor; // last flagged wins
    }
    prod.pricing.set(vKey, {
      vendorName: row.vendor,
      price: row.price,
      deliveryDays: row.deliveryDays,
    });
  }

  return { vendors, products };
}

/** Builds a DB-aware preview of what an import would create/update. No writes. */
export async function buildImportPlan(rows: RawRow[]): Promise<ImportPlan> {
  const { vendors, products } = group(rows);

  const [dbVendors, dbProducts] = await Promise.all([
    prisma.vendor.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, name: true, preferredVendorId: true } }),
  ]);
  const existingVendorNames = new Set(dbVendors.map((v) => v.name.toLowerCase()));
  const existingProductNames = new Set(dbProducts.map((p) => p.name.toLowerCase()));

  const blocking: string[] = [];

  const vendorPlans: VendorPlan[] = [...vendors.values()].map((v) => {
    const isNew = !existingVendorNames.has(v.name.toLowerCase());
    const plan: VendorPlan = {
      name: v.name,
      email: v.email,
      contact: v.contact,
      status: isNew ? "new" : "existing",
    };
    if (isNew && !v.email) {
      plan.error = "New vendor requires a Vendor Email";
      blocking.push(`Vendor "${v.name}" is new but has no Vendor Email.`);
    }
    return plan;
  });

  let pricingCount = 0;
  const productPlans: ProductPlan[] = [...products.values()].map((p) => {
    pricingCount += p.pricing.size;
    const isNew = !existingProductNames.has(p.name.toLowerCase());

    // Determine preferred vendor: explicit flag wins; otherwise for a NEW
    // product default to the cheapest vendor; for existing, leave unchanged.
    let preferred = p.preferredVendorName;
    if (!preferred && isNew) {
      const cheapest = [...p.pricing.values()].sort((a, b) => a.price - b.price)[0];
      preferred = cheapest?.vendorName ?? null;
    }

    return {
      name: p.name,
      category: p.category,
      status: isNew ? "new" : "existing",
      preferredVendor: preferred,
      vendorCount: p.pricing.size,
    };
  });

  return {
    vendors: vendorPlans,
    products: productPlans,
    pricingCount,
    rowCount: rows.length,
    blocking,
  };
}

export interface CommitResult {
  vendorsCreated: number;
  vendorsUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  pricingUpserted: number;
}

/** Applies an import in a single transaction. Throws if there are blocking
 * errors (a new vendor without an email). */
export async function commitImport(rows: RawRow[]): Promise<CommitResult> {
  const plan = await buildImportPlan(rows);
  if (plan.blocking.length > 0) {
    throw new Error(plan.blocking.join(" "));
  }

  const { vendors, products } = group(rows);

  return prisma.$transaction(async (tx) => {
    const result: CommitResult = {
      vendorsCreated: 0,
      vendorsUpdated: 0,
      productsCreated: 0,
      productsUpdated: 0,
      pricingUpserted: 0,
    };

    // Resolve/creates vendors, building a name(lower) -> id map.
    const dbVendors = await tx.vendor.findMany({ select: { id: true, name: true } });
    const vendorIdByName = new Map<string, string>();
    for (const v of dbVendors) vendorIdByName.set(v.name.toLowerCase(), v.id);

    for (const v of vendors.values()) {
      const key = v.name.toLowerCase();
      const existingId = vendorIdByName.get(key);
      if (existingId) {
        // Update contact/email only when new details were supplied.
        if (v.email || v.contact) {
          await tx.vendor.update({
            where: { id: existingId },
            data: {
              ...(v.email ? { email: v.email } : {}),
              ...(v.contact ? { contact: v.contact } : {}),
            },
          });
          result.vendorsUpdated++;
        }
      } else {
        const created = await tx.vendor.create({
          data: { name: v.name, email: v.email ?? "", contact: v.contact },
        });
        vendorIdByName.set(key, created.id);
        result.vendorsCreated++;
      }
    }

    // Resolve/creates products.
    const dbProducts = await tx.product.findMany({
      select: { id: true, name: true, preferredVendorId: true },
    });
    const productByName = new Map(dbProducts.map((p) => [p.name.toLowerCase(), p]));

    for (const p of products.values()) {
      const key = p.name.toLowerCase();
      const existing = productByName.get(key);

      // Preferred vendor: explicit flag wins; for new products fall back to the
      // cheapest supplied vendor.
      let preferredName = p.preferredVendorName;
      if (!preferredName && !existing) {
        const cheapest = [...p.pricing.values()].sort((a, b) => a.price - b.price)[0];
        preferredName = cheapest?.vendorName ?? null;
      }
      const preferredId = preferredName
        ? vendorIdByName.get(preferredName.toLowerCase()) ?? null
        : null;

      let productId: string;
      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            category: p.category,
            // Only overwrite preferred vendor when the sheet specified one.
            ...(preferredName ? { preferredVendorId: preferredId } : {}),
          },
        });
        productId = existing.id;
        result.productsUpdated++;
      } else {
        const created = await tx.product.create({
          data: {
            name: p.name,
            category: p.category,
            preferredVendorId: preferredId,
          },
        });
        productId = created.id;
        result.productsCreated++;
      }

      // Upsert each vendor pricing line.
      for (const line of p.pricing.values()) {
        const vendorId = vendorIdByName.get(line.vendorName.toLowerCase());
        if (!vendorId) continue; // should not happen
        await tx.vendorPricing.upsert({
          where: { productId_vendorId: { productId, vendorId } },
          create: {
            productId,
            vendorId,
            price: new Prisma.Decimal(line.price),
            deliveryDays: line.deliveryDays,
          },
          update: {
            price: new Prisma.Decimal(line.price),
            deliveryDays: line.deliveryDays,
          },
        });
        result.pricingUpserted++;
      }
    }

    return result;
  });
}
