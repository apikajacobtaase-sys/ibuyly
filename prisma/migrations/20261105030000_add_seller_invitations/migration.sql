-- CreateTable
CREATE TABLE "seller_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "application_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_invitations_token_hash_key" ON "seller_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "seller_invitations_application_id_key" ON "seller_invitations"("application_id");

-- CreateIndex
CREATE INDEX "seller_invitations_email_idx" ON "seller_invitations"("email");

-- CreateIndex
CREATE INDEX "seller_invitations_invited_by_idx" ON "seller_invitations"("invited_by");

-- AddForeignKey
ALTER TABLE "seller_invitations" ADD CONSTRAINT "seller_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_invitations" ADD CONSTRAINT "seller_invitations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "seller_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;