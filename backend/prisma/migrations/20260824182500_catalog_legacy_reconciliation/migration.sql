-- Preserve a resolvable source identifier when public and admin mock records
-- describe the same canonical catalog record with different IDs.
ALTER TABLE "Product" ADD COLUMN "legacySourceId" TEXT;

CREATE UNIQUE INDEX "Product_legacySourceId_key" ON "Product"("legacySourceId");
