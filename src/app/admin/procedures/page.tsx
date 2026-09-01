import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/AppShell";
import {
  ProceduresManager,
  type ProcedureDTO,
  type ProductLite,
} from "@/components/admin/ProceduresManager";

export const dynamic = "force-dynamic";

export default async function AdminProceduresPage() {
  const [procedures, products] = await Promise.all([
    prisma.procedure.findMany({ orderBy: { name: "asc" }, include: { bom: true } }),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
  ]);

  const procedureDTOs: ProcedureDTO[] = procedures.map((p) => ({
    id: p.id,
    name: p.name,
    bom: p.bom.map((b) => ({ productId: b.productId, qty: b.qty })),
  }));

  const productLites: ProductLite[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
  }));

  return (
    <div>
      <PageHeader
        title="Procedures & BOM"
        description="Define what materials each procedure consumes. When someone logs a procedure, these quantities are deducted from stock automatically."
      />
      <ProceduresManager procedures={procedureDTOs} products={productLites} />
    </div>
  );
}
