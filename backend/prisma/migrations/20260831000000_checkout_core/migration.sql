-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CheckoutRecoveryStatus" AS ENUM ('PENDING', 'SENT', 'MANUAL', 'RECOVERED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderDeliveryType" AS ENUM ('SHIPPING', 'PICKUP');

-- CreateEnum
CREATE TYPE "CheckoutIdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "userId" TEXT,
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "recoveryStatus" "CheckoutRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "snapshotData" JSONB NOT NULL DEFAULT '{}',
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEmailSentAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT,
    "cartId" TEXT,
    "checkoutSessionId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryType" "OrderDeliveryType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "customerEmail" TEXT NOT NULL,
    "customerFirstName" TEXT NOT NULL,
    "customerLastName" TEXT NOT NULL,
    "customerDni" TEXT,
    "customerPhone" TEXT,
    "customerSnapshot" JSONB NOT NULL DEFAULT '{}',
    "shippingAddressSnapshot" JSONB,
    "deliverySnapshot" JSONB NOT NULL DEFAULT '{}',
    "discountSnapshot" JSONB NOT NULL DEFAULT '{}',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "couponCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sku" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "weightGrams" INTEGER,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "paymentOptionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethodSnapshot" JSONB NOT NULL DEFAULT '{}',
    "bankTransferSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutIdempotencyKey" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "CheckoutIdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "responseSnapshot" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "customerKeyHash" TEXT,
    "couponCode" TEXT NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");

-- CreateIndex
CREATE INDEX "Cart_status_updatedAt_idx" ON "Cart"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_key" ON "CartItem"("cartId", "productId", "variantId");

-- CreateIndex
CREATE INDEX "CheckoutSession_cartId_status_idx" ON "CheckoutSession"("cartId", "status");

-- CreateIndex
CREATE INDEX "CheckoutSession_userId_status_idx" ON "CheckoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "CheckoutSession_status_abandonedAt_idx" ON "CheckoutSession"("status", "abandonedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_tokenHash_key" ON "CheckoutSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutSessionId_key" ON "Order"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_cartId_idx" ON "Order"("cartId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_orderId_key" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_status_createdAt_idx" ON "OrderPayment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPayment_paymentMethodId_idx" ON "OrderPayment"("paymentMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutIdempotencyKey_ownerKey_idempotencyKey_key" ON "CheckoutIdempotencyKey"("ownerKey", "idempotencyKey");

-- CreateIndex
CREATE INDEX "CheckoutIdempotencyKey_orderId_idx" ON "CheckoutIdempotencyKey"("orderId");

-- CreateIndex
CREATE INDEX "CheckoutIdempotencyKey_status_createdAt_idx" ON "CheckoutIdempotencyKey"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_couponId_orderId_key" ON "CouponRedemption"("couponId", "orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_customerKeyHash_idx" ON "CouponRedemption"("couponId", "customerKeyHash");

-- CreateIndex
CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");

-- CreateIndex
-- PostgreSQL treats NULL values as distinct in a regular unique index. The
-- expression closes that gap for product lines without a selected variant.
CREATE UNIQUE INDEX "CartItem_cartId_productId_variantId_coalesced_key"
  ON "CartItem"("cartId", "productId", COALESCE("variantId", ''));

-- CreateIndex
-- Only one live account cart/session is authoritative at a time. Guest carts
-- remain scoped by their opaque checkout session instead of a user ID.
CREATE UNIQUE INDEX "Cart_userId_active_key"
  ON "Cart"("userId")
  WHERE "userId" IS NOT NULL AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX "CheckoutSession_cart_active_key"
  ON "CheckoutSession"("cartId")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "CheckoutSession_user_active_key"
  ON "CheckoutSession"("userId")
  WHERE "userId" IS NOT NULL AND "status" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutIdempotencyKey" ADD CONSTRAINT "CheckoutIdempotencyKey_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_positive_check"
  CHECK ("quantity" > 0);

ALTER TABLE "CheckoutSession"
  ADD CONSTRAINT "CheckoutSession_tokenHash_non_empty_check"
  CHECK (btrim("tokenHash") <> '');

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customer_email_non_empty_check"
  CHECK (btrim("customerEmail") <> ''),
  ADD CONSTRAINT "Order_customer_first_name_non_empty_check"
  CHECK (btrim("customerFirstName") <> ''),
  ADD CONSTRAINT "Order_customer_last_name_non_empty_check"
  CHECK (btrim("customerLastName") <> ''),
  ADD CONSTRAINT "Order_money_non_negative_check"
  CHECK (
    "subtotal" >= 0
    AND "discountAmount" >= 0
    AND "shippingCost" >= 0
    AND "total" >= 0
    AND "total" = "subtotal" - "discountAmount" + "shippingCost"
  ),
  ADD CONSTRAINT "Order_snapshot_objects_check"
  CHECK (
    jsonb_typeof("customerSnapshot") = 'object'
    AND jsonb_typeof("deliverySnapshot") = 'object'
    AND jsonb_typeof("discountSnapshot") = 'object'
    AND ("shippingAddressSnapshot" IS NULL OR jsonb_typeof("shippingAddressSnapshot") = 'object')
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive_check"
  CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_unit_price_non_negative_check"
  CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "OrderItem_compare_at_price_check"
  CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= "unitPrice"),
  ADD CONSTRAINT "OrderItem_weight_non_negative_check"
  CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0),
  ADD CONSTRAINT "OrderItem_line_subtotal_check"
  CHECK ("lineSubtotal" >= 0 AND "lineSubtotal" = ROUND("unitPrice" * "quantity", 2)),
  ADD CONSTRAINT "OrderItem_snapshot_objects_check"
  CHECK (jsonb_typeof("attributes") = 'object' AND jsonb_typeof("snapshot") = 'object');

ALTER TABLE "OrderPayment"
  ADD CONSTRAINT "OrderPayment_amount_non_negative_check"
  CHECK ("amount" >= 0),
  ADD CONSTRAINT "OrderPayment_payment_method_non_empty_check"
  CHECK (btrim("paymentMethodId") <> ''),
  ADD CONSTRAINT "OrderPayment_snapshot_objects_check"
  CHECK (
    jsonb_typeof("paymentMethodSnapshot") = 'object'
    AND ("bankTransferSnapshot" IS NULL OR jsonb_typeof("bankTransferSnapshot") = 'object')
  );

ALTER TABLE "CheckoutIdempotencyKey"
  ADD CONSTRAINT "CheckoutIdempotencyKey_owner_non_empty_check"
  CHECK (btrim("ownerKey") <> ''),
  ADD CONSTRAINT "CheckoutIdempotencyKey_key_non_empty_check"
  CHECK (btrim("idempotencyKey") <> ''),
  ADD CONSTRAINT "CheckoutIdempotencyKey_hash_non_empty_check"
  CHECK (btrim("requestHash") <> ''),
  ADD CONSTRAINT "CheckoutIdempotencyKey_completed_state_check"
  CHECK (("status" = 'COMPLETED') = ("orderId" IS NOT NULL AND "responseSnapshot" IS NOT NULL AND "completedAt" IS NOT NULL));

ALTER TABLE "Coupon"
  ADD CONSTRAINT "Coupon_usage_count_non_negative_check"
  CHECK ("usageCount" >= 0),
  ADD CONSTRAINT "Coupon_total_usage_limit_check"
  CHECK (
    ("totalUsageLimitType" = 'UNLIMITED' AND "totalUsageLimit" IS NULL)
    OR ("totalUsageLimitType" = 'LIMITED' AND "totalUsageLimit" IS NOT NULL AND "totalUsageLimit" > 0 AND "usageCount" <= "totalUsageLimit")
  ),
  ADD CONSTRAINT "Coupon_customer_usage_limit_check"
  CHECK (
    ("customerLimitType" <> 'LIMITED' AND "customerUsageLimit" IS NULL)
    OR ("customerLimitType" = 'LIMITED' AND "customerUsageLimit" IS NOT NULL AND "customerUsageLimit" > 0)
  );

ALTER TABLE "CouponRedemption"
  ADD CONSTRAINT "CouponRedemption_coupon_code_non_empty_check"
  CHECK (btrim("couponCode") <> ''),
  ADD CONSTRAINT "CouponRedemption_discount_non_negative_check"
  CHECK ("discountAmount" >= 0);

-- Order lines are placement-time snapshots. Lifecycle status/payment updates
-- remain possible, but their captured catalog and configuration values cannot
-- be changed after insertion.
CREATE FUNCTION "prevent_order_item_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."productId" IS DISTINCT FROM OLD."productId"
    OR NEW."variantId" IS DISTINCT FROM OLD."variantId"
    OR NEW."productName" IS DISTINCT FROM OLD."productName"
    OR NEW."variantName" IS DISTINCT FROM OLD."variantName"
    OR NEW."sku" IS DISTINCT FROM OLD."sku"
    OR NEW."attributes" IS DISTINCT FROM OLD."attributes"
    OR NEW."quantity" IS DISTINCT FROM OLD."quantity"
    OR NEW."unitPrice" IS DISTINCT FROM OLD."unitPrice"
    OR NEW."compareAtPrice" IS DISTINCT FROM OLD."compareAtPrice"
    OR NEW."weightGrams" IS DISTINCT FROM OLD."weightGrams"
    OR NEW."lineSubtotal" IS DISTINCT FROM OLD."lineSubtotal"
    OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'OrderItem snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "OrderItem_snapshot_immutable"
  BEFORE UPDATE ON "OrderItem"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_order_item_snapshot_mutation"();

CREATE FUNCTION "prevent_order_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."number" IS DISTINCT FROM OLD."number"
    OR NEW."deliveryType" IS DISTINCT FROM OLD."deliveryType"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."customerEmail" IS DISTINCT FROM OLD."customerEmail"
    OR NEW."customerFirstName" IS DISTINCT FROM OLD."customerFirstName"
    OR NEW."customerLastName" IS DISTINCT FROM OLD."customerLastName"
    OR NEW."customerDni" IS DISTINCT FROM OLD."customerDni"
    OR NEW."customerPhone" IS DISTINCT FROM OLD."customerPhone"
    OR NEW."customerSnapshot" IS DISTINCT FROM OLD."customerSnapshot"
    OR NEW."shippingAddressSnapshot" IS DISTINCT FROM OLD."shippingAddressSnapshot"
    OR NEW."deliverySnapshot" IS DISTINCT FROM OLD."deliverySnapshot"
    OR NEW."discountSnapshot" IS DISTINCT FROM OLD."discountSnapshot"
    OR NEW."subtotal" IS DISTINCT FROM OLD."subtotal"
    OR NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount"
    OR NEW."shippingCost" IS DISTINCT FROM OLD."shippingCost"
    OR NEW."total" IS DISTINCT FROM OLD."total"
    OR NEW."couponCode" IS DISTINCT FROM OLD."couponCode" THEN
    RAISE EXCEPTION 'Order snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Order_snapshot_immutable"
  BEFORE UPDATE ON "Order"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_order_snapshot_mutation"();

CREATE FUNCTION "prevent_order_payment_snapshot_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."paymentMethodId" IS DISTINCT FROM OLD."paymentMethodId"
    OR NEW."paymentOptionId" IS DISTINCT FROM OLD."paymentOptionId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."paymentMethodSnapshot" IS DISTINCT FROM OLD."paymentMethodSnapshot"
    OR NEW."bankTransferSnapshot" IS DISTINCT FROM OLD."bankTransferSnapshot" THEN
    RAISE EXCEPTION 'Order payment snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "OrderPayment_snapshot_immutable"
  BEFORE UPDATE ON "OrderPayment"
  FOR EACH ROW
  EXECUTE FUNCTION "prevent_order_payment_snapshot_mutation"();
