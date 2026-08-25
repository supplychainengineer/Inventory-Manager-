import ExcelJS from "exceljs";

/**
 * Inventory bulk-import parsing.
 *
 * The admin uploads a spreadsheet where each ROW is one product/vendor pricing
 * line. Rows that share a product name are grouped into a single product with
 * multiple vendor options. Expected columns (header names are matched
 * case-insensitively, with a few synonyms each):
 *
 *   Product | Category | Vendor | Vendor Email | Vendor Contact | Price | Delivery Days | Preferred
 *
 * Only Product, Category, Vendor, Price and Delivery Days are required per row.
 * Vendor Email is required only when the vendor does not already exist (checked
 * later, against the database). "Preferred" (yes/true/x/1) marks that vendor as
 * the product's preferred vendor.
 */

export const MAX_IMPORT_ROWS = 2000;

export interface RawRow {
  rowNumber: number; // 1-based spreadsheet row (including header offset)
  product: string;
  category: string;
  vendor: string;
  vendorEmail: string | null;
  vendorContact: string | null;
  price: number;
  deliveryDays: number;
  preferred: boolean;
}

export interface RowError {
  rowNumber: number;
  message: string;
}

export interface ParseResult {
  rows: RawRow[];
  errors: RowError[];
  fatal?: string;
}

const HEADER_SYNONYMS: Record<keyof Omit<RawRow, "rowNumber">, string[]> = {
  product: ["product", "product name", "name", "item", "item name"],
  category: ["category", "type"],
  vendor: ["vendor", "vendor name", "supplier", "supplier name"],
  vendorEmail: ["vendor email", "email", "supplier email", "order email"],
  vendorContact: ["vendor contact", "contact", "rep", "account rep"],
  price: ["price", "unit price", "cost", "unit cost"],
  deliveryDays: ["delivery days", "delivery", "lead time", "days", "delivery timeline"],
  preferred: ["preferred", "preferred vendor", "is preferred", "default"],
};

/** Canonical template column order, used for the downloadable template. */
export const TEMPLATE_HEADERS = [
  "Product",
  "Category",
  "Vendor",
  "Vendor Email",
  "Vendor Contact",
  "Price",
  "Delivery Days",
  "Preferred",
];

export const TEMPLATE_EXAMPLE_ROWS: (string | number)[][] = [
  ["Nitrile Exam Gloves (Box of 200)", "Consumables", "Patterson Dental", "orders@patterson.example.com", "Devon Ospina", 11.95, 5, "yes"],
  ["Nitrile Exam Gloves (Box of 200)", "Consumables", "Henry Schein Dental", "orders@henryschein.example.com", "Marcy Lin", 12.5, 3, ""],
  ["Prophy Paste (Box of 200)", "Consumables", "Benco Dental", "orders@benco.example.com", "Priya Raman", 34.0, 4, "yes"],
];

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Coerces an ExcelJS cell value (which may be rich text, a hyperlink, or a
 * formula result) into a plain string. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("result" in v) return cellToString(v.result);
    if ("text" in v) return cellToString(v.text);
    if ("richText" in v && Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("").trim();
    }
    if ("hyperlink" in v && "text" in v) return cellToString(v.text);
  }
  return String(value).trim();
}

const TRUTHY = new Set(["yes", "y", "true", "1", "x", "preferred", "default"]);

/** Parses an uploaded workbook (xlsx) or CSV buffer into a normalized matrix. */
async function toMatrix(buffer: Buffer, filename: string): Promise<string[][]> {
  const isCsv = /\.csv$/i.test(filename);
  if (isCsv) {
    return parseCsv(buffer.toString("utf8"));
  }
  const wb = new ExcelJS.Workbook();
  // exceljs's bundled types predate the generic Buffer<ArrayBufferLike>.
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.values is 1-indexed; slice off the leading empty slot.
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    for (const v of values) cells.push(cellToString(v));
    matrix.push(cells);
  });
  return matrix;
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushField();
      pushRow();
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  // flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

/** Parses an uploaded file into normalized rows plus per-row errors. */
export async function parseInventoryFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  let matrix: string[][];
  try {
    matrix = await toMatrix(buffer, filename);
  } catch {
    return { rows: [], errors: [], fatal: "Could not read the file. Upload a valid .xlsx or .csv." };
  }

  if (matrix.length === 0) {
    return { rows: [], errors: [], fatal: "The file is empty." };
  }

  // Map header row.
  const header = matrix[0].map(normalizeHeader);
  const colIndex: Partial<Record<keyof Omit<RawRow, "rowNumber">, number>> = {};
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [
    keyof Omit<RawRow, "rowNumber">,
    string[],
  ][]) {
    const idx = header.findIndex((h) => synonyms.includes(h));
    if (idx >= 0) colIndex[field] = idx;
  }

  const missing: string[] = [];
  for (const req of ["product", "category", "vendor", "price", "deliveryDays"] as const) {
    if (colIndex[req] === undefined) missing.push(req);
  }
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [],
      fatal:
        `Missing required column(s): ${missing.join(", ")}. ` +
        `Expected headers: ${TEMPLATE_HEADERS.join(", ")}.`,
    };
  }

  if (matrix.length - 1 > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [],
      fatal: `Too many rows (${matrix.length - 1}). The limit is ${MAX_IMPORT_ROWS}.`,
    };
  }

  const rows: RawRow[] = [];
  const errors: RowError[] = [];
  const get = (cells: string[], field: keyof Omit<RawRow, "rowNumber">): string => {
    const idx = colIndex[field];
    if (idx === undefined) return "";
    return (cells[idx] ?? "").trim();
  };

  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const rowNumber = r + 1; // 1-based, header is row 1
    const product = get(cells, "product");
    const category = get(cells, "category");
    const vendor = get(cells, "vendor");
    const priceStr = get(cells, "price");
    const daysStr = get(cells, "deliveryDays");

    // Skip fully-blank rows silently.
    if (!product && !category && !vendor && !priceStr && !daysStr) continue;

    const rowErrors: string[] = [];
    if (!product) rowErrors.push("missing Product");
    if (!category) rowErrors.push("missing Category");
    if (!vendor) rowErrors.push("missing Vendor");

    const price = Number(priceStr.replace(/[$,]/g, ""));
    if (!priceStr || Number.isNaN(price) || price < 0) rowErrors.push("invalid Price");

    const deliveryDays = Number(daysStr.replace(/[^0-9.\-]/g, ""));
    if (!daysStr || !Number.isFinite(deliveryDays) || deliveryDays < 0 || !Number.isInteger(deliveryDays)) {
      rowErrors.push("invalid Delivery Days");
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, message: rowErrors.join(", ") });
      continue;
    }

    rows.push({
      rowNumber,
      product,
      category,
      vendor,
      vendorEmail: get(cells, "vendorEmail") || null,
      vendorContact: get(cells, "vendorContact") || null,
      price,
      deliveryDays,
      preferred: TRUTHY.has(get(cells, "preferred").toLowerCase()),
    });
  }

  return { rows, errors };
}
