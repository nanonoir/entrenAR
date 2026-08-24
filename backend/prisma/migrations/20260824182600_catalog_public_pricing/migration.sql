-- Public compare-at pricing is presentation compatibility metadata, distinct
-- from the admin promotional price contract.
ALTER TABLE "Product" ADD COLUMN "compareAtPrice" DECIMAL(12,2);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_compareAtPrice_check"
  CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "salePrice");
