-- Add the canonical Product-owned price without dropping legacy ownership yet.
ALTER TABLE "Product" ADD COLUMN "price" DECIMAL(12,2);
UPDATE "Product"
SET "price" = COALESCE("promotionalPrice", "salePrice")
WHERE "price" IS NULL;

-- ProductImage is the ordered, persisted gallery used by imported products.
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductImage_productId_position_key" ON "ProductImage"("productId", "position");
CREATE UNIQUE INDEX "ProductImage_productId_storageKey_key" ON "ProductImage"("productId", "storageKey");
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariant" ADD COLUMN "primaryImageId" TEXT;
CREATE INDEX "ProductVariant_primaryImageId_idx" ON "ProductVariant"("primaryImageId");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_primaryImageId_fkey"
  FOREIGN KEY ("primaryImageId") REFERENCES "ProductImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Products without variants receive the universal invisible variant. Existing
-- variant rows and historical snapshots are not rewritten.
INSERT INTO "ProductVariant" ("id", "productId", "sku", "name", "attributes", "stockMode", "quantity", "isDefault", "createdAt", "updatedAt")
SELECT 'pv_' || md5(p."id" || ':default'), p."id", COALESCE(p."sku", p."id") || '-DEFAULT', 'Simple product', '{}'::jsonb,
       COALESCE(p."stockMode", 'OUT_OF_STOCK'::"StockMode"),
       CASE WHEN p."stockMode" = 'TRACKED' THEN COALESCE(p."quantity", 0) ELSE NULL END,
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p
WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id");

-- Backfill cart references only where the product has one unambiguous variant.
UPDATE "CartItem" ci
SET "variantId" = v."id"
FROM "ProductVariant" v
WHERE ci."productId" = v."productId"
  AND ci."variantId" IS NULL
  AND (SELECT COUNT(*) FROM "ProductVariant" all_v WHERE all_v."productId" = ci."productId") = 1;

-- Preserve only already-canonical legacy image keys during the additive phase.
INSERT INTO "ProductImage" ("id", "productId", "storageKey", "position")
SELECT 'pi_' || md5(p."id" || ':' || p."imageUrl"), p."id", p."imageUrl", 1
FROM "Product" p
WHERE p."imageUrl" ~ '^products/[^/]+/[0-9]+\.webp$'
  AND NOT EXISTS (SELECT 1 FROM "ProductImage" i WHERE i."productId" = p."id");
