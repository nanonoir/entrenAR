DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CartItem" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'catalog cleanup blocked: CartItem.variantId contains NULL values';
  END IF;
  IF EXISTS (SELECT 1 FROM "Product" WHERE "price" IS NULL) THEN
    RAISE EXCEPTION 'catalog cleanup blocked: Product.price contains NULL values';
  END IF;
  IF EXISTS (SELECT 1 FROM "Product" p WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id")) THEN
    RAISE EXCEPTION 'catalog cleanup blocked: Product without canonical variant';
  END IF;
  IF EXISTS (SELECT 1 FROM "ProductImage") THEN
    RAISE EXCEPTION 'catalog cleanup blocked: ProductImage rows require gallery ownership verification';
  END IF;
END $$;

ALTER TABLE "CartItem" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "ProductVariant" DROP COLUMN "compareAtPrice";
ALTER TABLE "ProductVariant" DROP COLUMN "price";
ALTER TABLE "ProductVariant" DROP COLUMN "isDefault";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_sku_key";
ALTER TABLE "Product" DROP COLUMN "sku";
ALTER TABLE "Product" DROP COLUMN "stockMode";
ALTER TABLE "Product" DROP COLUMN "quantity";
ALTER TABLE "Product" DROP COLUMN "imageUrl";
ALTER TABLE "Product" DROP COLUMN "imageTone";
ALTER TABLE "Product" DROP COLUMN "salePrice";
