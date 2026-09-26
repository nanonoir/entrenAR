CREATE OR REPLACE FUNCTION enforce_product_variant_presence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ProductVariant" WHERE "productId" = NEW."id") THEN
    RAISE EXCEPTION 'Product % must have at least one ProductVariant', NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER product_requires_variant
AFTER INSERT ON "Product"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_product_variant_presence();
