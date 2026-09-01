-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "bufferPct" INTEGER,
ADD COLUMN     "onHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "packSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reorderPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'unit';

-- AlterTable
ALTER TABLE "ReminderSettings" ADD COLUMN     "inventoryBufferPct" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procedureId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "loggedById" TEXT,

    CONSTRAINT "ProcedureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTxn" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT,

    CONSTRAINT "StockTxn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BomItem_procedureId_productId_key" ON "BomItem"("procedureId", "productId");

-- CreateIndex
CREATE INDEX "ProcedureLog_at_idx" ON "ProcedureLog"("at");

-- CreateIndex
CREATE INDEX "StockTxn_at_idx" ON "StockTxn"("at");

-- CreateIndex
CREATE INDEX "StockTxn_productId_idx" ON "StockTxn"("productId");

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTxn" ADD CONSTRAINT "StockTxn_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
