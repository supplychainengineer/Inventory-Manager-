-- DropForeignKey
ALTER TABLE "BomItem" DROP CONSTRAINT "BomItem_procedureId_fkey";

-- DropForeignKey
ALTER TABLE "BomItem" DROP CONSTRAINT "BomItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProcedureLog" DROP CONSTRAINT "ProcedureLog_loggedById_fkey";

-- DropForeignKey
ALTER TABLE "ProcedureLog" DROP CONSTRAINT "ProcedureLog_procedureId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "packSize",
ALTER COLUMN "unit" SET DEFAULT 'box';

-- DropTable
DROP TABLE "BomItem";

-- DropTable
DROP TABLE "Procedure";

-- DropTable
DROP TABLE "ProcedureLog";

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedById" TEXT,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "boxes" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockCount_at_idx" ON "StockCount"("at");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountItem_stockCountId_productId_key" ON "StockCountItem"("stockCountId", "productId");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

