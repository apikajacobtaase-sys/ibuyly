-- CreateTable
CREATE TABLE "concierge_interactions" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "product_id" TEXT,
    "seller_id" TEXT,
    "category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concierge_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concierge_interactions_seller_id_event_type_created_at_idx" ON "concierge_interactions"("seller_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "concierge_interactions_product_id_event_type_created_at_idx" ON "concierge_interactions"("product_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "concierge_interactions_category_id_created_at_idx" ON "concierge_interactions"("category_id", "created_at");

-- CreateIndex
CREATE INDEX "concierge_interactions_user_id_created_at_idx" ON "concierge_interactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "concierge_interactions_event_type_created_at_idx" ON "concierge_interactions"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "concierge_interactions" ADD CONSTRAINT "concierge_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_interactions" ADD CONSTRAINT "concierge_interactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_interactions" ADD CONSTRAINT "concierge_interactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concierge_interactions" ADD CONSTRAINT "concierge_interactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
