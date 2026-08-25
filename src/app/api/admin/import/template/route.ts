import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { authOptions } from "@/lib/auth";
import { TEMPLATE_HEADERS, TEMPLATE_EXAMPLE_ROWS } from "@/lib/inventory-import";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Asana Ortho Inventory Manager";
  const ws = wb.addWorksheet("Inventory");

  ws.columns = TEMPLATE_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: Math.max(14, h.length + 4),
  }));

  // Themed header row (dark fill, white bold text) to match the app.
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1A1A1A" },
  };
  headerRow.alignment = { horizontal: "left" };

  for (const row of TEMPLATE_EXAMPLE_ROWS) {
    ws.addRow(row);
  }

  // Notes sheet documenting the columns.
  const notes = wb.addWorksheet("Instructions");
  notes.getColumn(1).width = 100;
  const lines = [
    "How to use this template",
    "",
    "• One row per product/vendor pricing line. Rows with the SAME Product name are grouped into one product with multiple vendor options.",
    "• Required columns: Product, Category, Vendor, Price, Delivery Days.",
    "• Vendor Email is required only for vendors that do not already exist in the system.",
    "• Preferred: put yes / y / x / 1 to mark that vendor as the product's preferred vendor (the one used when an order is approved).",
    "• If no Preferred is marked for a new product, the cheapest vendor becomes preferred automatically.",
    "• Existing products/vendors are matched by name (case-insensitive) and updated; pricing is overwritten per product+vendor.",
    "• Save as .xlsx or .csv and upload it on the Products page → Import from Excel.",
  ];
  lines.forEach((l) => notes.addRow([l]));
  notes.getRow(1).font = { bold: true, size: 14 };

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="inventory-import-template.xlsx"',
    },
  });
}
