-- CreateEnum
CREATE TYPE "RefundOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION');

-- CreateEnum
CREATE TYPE "RefundInitiatorType" AS ENUM ('CUSTOMER', 'SELLER', 'ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "commission_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "seller_financial_records" ADD COLUMN     "refund_operation_id" TEXT;

-- CreateTable
CREATE TABLE "refund_operations" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "initiated_by_id" TEXT,
    "initiated_by_type" "RefundInitiatorType" NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "merchandise_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "provider" "PaymentProvider" NOT NULL,
    "status" "RefundOperationStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "provider_reference" TEXT,
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refund_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_operation_items" (
    "id" TEXT NOT NULL,
    "refund_operation_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "refunded_quantity" INTEGER NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "commission_reversal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "refund_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_operation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_operations_idempotency_key_key" ON "refund_operations"("idempotency_key");

-- CreateIndex
CREATE INDEX "refund_operations_order_id_idx" ON "refund_operations"("order_id");

-- CreateIndex
CREATE INDEX "refund_operations_payment_id_idx" ON "refund_operations"("payment_id");

-- CreateIndex
CREATE INDEX "refund_operations_initiated_by_id_idx" ON "refund_operations"("initiated_by_id");

-- CreateIndex
CREATE INDEX "refund_operations_status_idx" ON "refund_operations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "refund_operations_provider_provider_reference_key" ON "refund_operations"("provider", "provider_reference");

-- CreateIndex
CREATE INDEX "refund_operation_items_order_item_id_idx" ON "refund_operation_items"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_operation_items_refund_operation_id_order_item_id_key" ON "refund_operation_items"("refund_operation_id", "order_item_id");

-- CreateIndex
CREATE INDEX "seller_financial_records_refund_operation_id_idx" ON "seller_financial_records"("refund_operation_id");

-- AddForeignKey
ALTER TABLE "seller_financial_records" ADD CONSTRAINT "seller_financial_records_refund_operation_id_fkey" FOREIGN KEY ("refund_operation_id") REFERENCES "refund_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_operations" ADD CONSTRAINT "refund_operations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_operations" ADD CONSTRAINT "refund_operations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_operations" ADD CONSTRAINT "refund_operations_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_operation_items" ADD CONSTRAINT "refund_operation_items_refund_operation_id_fkey" FOREIGN KEY ("refund_operation_id") REFERENCES "refund_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_operation_items" ADD CONSTRAINT "refund_operation_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
