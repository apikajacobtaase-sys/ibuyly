-- Reconcile indexes already present in the existing Neon database.
-- IF NOT EXISTS makes this safe when those indexes already exist.

CREATE INDEX IF NOT EXISTS "products_title_idx"
ON "products"("title");

CREATE INDEX IF NOT EXISTS "products_created_at_idx"
ON "products"("created_at" DESC);