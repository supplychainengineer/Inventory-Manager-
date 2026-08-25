import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { poNumber, toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function iso(d: Date | null): string {
  return d ? d.toISOString() : "";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All purchase orders = any request that has been approved (ordered/received).
  const orders = await prisma.request.findMany({
    where: { status: { in: ["ordered", "received"] } },
    orderBy: { orderedAt: "desc" },
    include: { product: true, vendor: true, requestedBy: true },
  });

  const header = [
    "PO Number",
    "Status",
    "Product",
    "Category",
    "Quantity",
    "Vendor",
    "Vendor Email",
    "Unit Price",
    "Line Total",
    "Delivery Days",
    "Requested By",
    "Requested At",
    "Ordered At",
    "Due Date",
    "Received At",
    "Reminder Sent",
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const o of orders) {
    const unit = toNumber(o.price);
    lines.push(
      [
        poNumber(o.id),
        o.status,
        o.product.name,
        o.product.category,
        o.qty,
        o.vendor?.name ?? "",
        o.vendor?.email ?? "",
        unit.toFixed(2),
        (unit * o.qty).toFixed(2),
        o.deliveryDays ?? "",
        o.requestedBy.name,
        iso(o.requestedAt),
        iso(o.orderedAt),
        iso(o.dueDate),
        iso(o.receivedAt),
        o.reminderSent ? "yes" : "no",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `asana-ortho-purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
