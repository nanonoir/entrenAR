-- Enforce catalog invariants that Prisma's schema language cannot express.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_salePrice_positive_check"
  CHECK ("salePrice" > 0),
  ADD CONSTRAINT "Product_promotionalPrice_check"
  CHECK (
    "promotionalPrice" IS NULL
    OR ("promotionalPrice" > 0 AND "promotionalPrice" < "salePrice")
  ),
  ADD CONSTRAINT "Product_stockState_check"
  CHECK (
    ("stockMode" = 'TRACKED' AND "quantity" IS NOT NULL AND "quantity" >= 0)
    OR ("stockMode" IN ('INFINITE', 'OUT_OF_STOCK') AND "quantity" IS NULL)
  ),
  ADD CONSTRAINT "Product_sku_non_empty_check"
  CHECK (btrim("sku") <> '');

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_price_positive_check"
  CHECK ("price" IS NULL OR "price" > 0),
  ADD CONSTRAINT "ProductVariant_compareAtPrice_check"
  CHECK (
    "compareAtPrice" IS NULL
    OR (
      "compareAtPrice" > 0
      AND ("price" IS NULL OR "compareAtPrice" > "price")
    )
  ),
  ADD CONSTRAINT "ProductVariant_stockState_check"
  CHECK (
    ("stockMode" = 'TRACKED' AND "quantity" IS NOT NULL AND "quantity" >= 0)
    OR ("stockMode" IN ('INFINITE', 'OUT_OF_STOCK') AND "quantity" IS NULL)
  ),
  ADD CONSTRAINT "ProductVariant_sku_non_empty_check"
  CHECK (btrim("sku") <> '');

ALTER TABLE "CatalogSettings"
  ADD CONSTRAINT "CatalogSettings_singleton_check"
  CHECK ("id" = 'singleton');

CREATE UNIQUE INDEX "ProductVariant_one_default_per_product_key"
  ON "ProductVariant"("productId")
  WHERE "isDefault";

CREATE FUNCTION "prevent_inventory_history_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'InventoryHistory is append-only';
END;
$$;

CREATE TRIGGER "InventoryHistory_append_only"
  BEFORE UPDATE OR DELETE ON "InventoryHistory"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_inventory_history_mutation"();
