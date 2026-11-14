-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "refund_operation_id" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "returns_refund_operation_id_key" ON "returns"("refund_operation_id");

-- CreateIndex
CREATE INDEX "returns_order_id_idx" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "returns_order_item_id_idx" ON "returns"("order_item_id");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_refund_operation_id_fkey" FOREIGN KEY ("refund_operation_id") REFERENCES "refund_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
