CREATE TABLE "flash_deals" ("id" TEXT NOT NULL, "offer_id" TEXT NOT NULL, "promotional_price" DECIMAL(10,2) NOT NULL, "deal_quantity" INTEGER NOT NULL, "sold_quantity" INTEGER NOT NULL DEFAULT 0, "reserved_quantity" INTEGER NOT NULL DEFAULT 0, "starts_at" TIMESTAMP(3) NOT NULL, "ends_at" TIMESTAMP(3) NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "flash_deals_pkey" PRIMARY KEY ("id"));
ALTER TABLE "order_items" ADD COLUMN "commission_rate_snapshot" DECIMAL(5,2), ADD COLUMN "flash_deal_id" TEXT;
CREATE INDEX "flash_deals_is_active_starts_at_ends_at_idx" ON "flash_deals"("is_active", "starts_at", "ends_at");
CREATE INDEX "flash_deals_offer_id_idx" ON "flash_deals"("offer_id");
CREATE INDEX "order_items_flash_deal_id_idx" ON "order_items"("flash_deal_id");
ALTER TABLE "flash_deals" ADD CONSTRAINT "flash_deals_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_flash_deal_id_fkey" FOREIGN KEY ("flash_deal_id") REFERENCES "flash_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
