-- AlterEnum
ALTER TYPE "CheckoutRecoveryStatus" ADD VALUE 'DISCARDED';

-- AlterTable
ALTER TABLE "CheckoutSession"
ADD COLUMN "recoveryExpiresAt" TIMESTAMP(3),
ADD COLUMN "recoveryTokenHash" TEXT;

-- CreateTable
CREATE TABLE "CheckoutSessionHistory" (
    "id" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSessionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartRecoverySettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timing" TEXT NOT NULL DEFAULT '24hs',
    "emailSubject" TEXT NOT NULL DEFAULT 'Te guardamos tu carrito en EntrenAR',
    "emailHtmlBody" TEXT NOT NULL DEFAULT '<p>Hola {{nombre}},</p><p>Vimos que dejaste productos en tu carrito.</p><p><a href="{{checkoutUrl}}">Volver a mi carrito</a></p>',
    "emailPlainBody" TEXT NOT NULL DEFAULT E'Hola {{nombre}},\n\nVimos que dejaste productos en tu carrito.\n\nVolver a mi carrito: {{checkoutUrl}}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartRecoverySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_recoveryTokenHash_key" ON "CheckoutSession"("recoveryTokenHash");

-- CreateIndex
CREATE INDEX "CheckoutSessionHistory_checkoutSessionId_createdAt_idx" ON "CheckoutSessionHistory"("checkoutSessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CheckoutSessionHistory" ADD CONSTRAINT "CheckoutSessionHistory_checkoutSessionId_fkey"
  FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
