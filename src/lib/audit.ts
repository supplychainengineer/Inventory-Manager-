import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Writes an audit-log entry. Accepts an optional transaction client. */
export async function logAudit(
  params: { actorId?: string | null; action: string; details?: string | null },
  tx?: Prisma.TransactionClient,
) {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      details: params.details ?? null,
    },
  });
}
