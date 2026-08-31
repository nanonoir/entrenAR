-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ShippingProviderStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED_INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PickupPointStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED_INACTIVE', 'ACTIVE');

-- CreateEnum
CREATE TYPE "PickupCostType" AS ENUM ('FREE', 'FIXED');

-- CreateEnum
CREATE TYPE "PickupCoverageType" AS ENUM ('ALL', 'PROVINCES');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "CouponTargetType" AS ENUM ('ALL_STORE', 'CATEGORIES', 'PRODUCTS');

-- CreateEnum
CREATE TYPE "CouponUsageLimitType" AS ENUM ('UNLIMITED', 'LIMITED');

-- CreateEnum
CREATE TYPE "CouponCustomerLimitType" AS ENUM ('UNLIMITED', 'LIMITED', 'FIRST_PURCHASE');

-- CreateEnum
CREATE TYPE "CouponDateLimitType" AS ENUM ('UNLIMITED', 'PERIOD');

-- CreateEnum
CREATE TYPE "CouponMaxDiscountType" AS ENUM ('NONE', 'AMOUNT');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CouponHistoryAction" AS ENUM ('CREATED', 'ACTIVATED', 'DEACTIVATED', 'UPDATED');

-- CreateEnum
CREATE TYPE "ShippingDiscountTargetType" AS ENUM ('ALL_STORE', 'CATEGORIES');

-- CreateEnum
CREATE TYPE "ShippingZoneTargetType" AS ENUM ('ALL', 'SPECIFIC');

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logoSrc" TEXT NOT NULL,
    "acceptedMethods" JSONB NOT NULL DEFAULT '[]',
    "options" JSONB NOT NULL DEFAULT '[]',
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'INACTIVE',
    "selectedOptionId" TEXT,
    "bankConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ShippingProviderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "enabledModalities" JSONB NOT NULL DEFAULT '[]',
    "originSenderName" TEXT,
    "originCuitCuil" TEXT,
    "originPhone" TEXT,
    "originEmail" TEXT,
    "originStreet" TEXT,
    "originNumber" TEXT,
    "originCity" TEXT,
    "originProvince" TEXT,
    "originPostalCode" TEXT,
    "originFloor" TEXT,
    "originApartment" TEXT,
    "originReference" TEXT,
    "freeShippingThreshold" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightBand" (
    "id" TEXT NOT NULL,
    "shippingProviderId" TEXT NOT NULL,
    "minWeightGrams" INTEGER NOT NULL,
    "maxWeightGrams" INTEGER,
    "cost" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeightBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PickupPointStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "street" TEXT,
    "number" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "preparationHours" INTEGER NOT NULL DEFAULT 24,
    "costType" "PickupCostType" NOT NULL DEFAULT 'FREE',
    "fixedCost" DECIMAL(12,2),
    "coverageType" "PickupCoverageType" NOT NULL DEFAULT 'ALL',
    "provinces" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupPointSchedule" (
    "id" TEXT NOT NULL,
    "pickupPointId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "opensAt" TEXT NOT NULL,
    "closesAt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupPointSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "CouponDiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2),
    "includeShippingCost" BOOLEAN NOT NULL DEFAULT false,
    "targetType" "CouponTargetType" NOT NULL,
    "canCombineWithPromotions" BOOLEAN NOT NULL DEFAULT false,
    "totalUsageLimitType" "CouponUsageLimitType" NOT NULL DEFAULT 'UNLIMITED',
    "totalUsageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "customerLimitType" "CouponCustomerLimitType" NOT NULL DEFAULT 'UNLIMITED',
    "customerUsageLimit" INTEGER,
    "dateLimitType" "CouponDateLimitType" NOT NULL DEFAULT 'UNLIMITED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "minimumCartAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxDiscountType" "CouponMaxDiscountType" NOT NULL DEFAULT 'NONE',
    "maxDiscountAmount" DECIMAL(12,2),
    "status" "CouponStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "couponId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponProduct" (
    "couponId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "CouponHistory" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "action" "CouponHistoryAction" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingDiscount" (
    "id" TEXT NOT NULL,
    "shippingMethodIds" JSONB NOT NULL DEFAULT '[]',
    "onlyCheapestShippingMethod" BOOLEAN NOT NULL DEFAULT false,
    "targetType" "ShippingDiscountTargetType" NOT NULL DEFAULT 'ALL_STORE',
    "canCombineWithPromotions" BOOLEAN NOT NULL DEFAULT false,
    "zoneTargetType" "ShippingZoneTargetType" NOT NULL DEFAULT 'ALL',
    "zoneIds" JSONB NOT NULL DEFAULT '[]',
    "minimumCartAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CouponStatus" NOT NULL DEFAULT 'INACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ShippingDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingDiscountCategory" (
    "shippingDiscountId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingDiscountCategory_pkey" PRIMARY KEY ("shippingDiscountId","categoryId")
);

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_status_idx" ON "PaymentMethodConfig"("status");

-- CreateIndex
CREATE INDEX "ShippingProvider_status_idx" ON "ShippingProvider"("status");

-- CreateIndex
CREATE INDEX "WeightBand_shippingProviderId_sortOrder_idx" ON "WeightBand"("shippingProviderId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WeightBand_shippingProviderId_minWeightGrams_key" ON "WeightBand"("shippingProviderId", "minWeightGrams");

-- CreateIndex
CREATE INDEX "PickupPoint_status_idx" ON "PickupPoint"("status");

-- CreateIndex
CREATE INDEX "PickupPointSchedule_pickupPointId_dayOfWeek_sortOrder_idx" ON "PickupPointSchedule"("pickupPointId", "dayOfWeek", "sortOrder");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_status_deletedAt_idx" ON "Coupon"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Coupon_deletedAt_idx" ON "Coupon"("deletedAt");

-- CreateIndex
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");

-- CreateIndex
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");

-- CreateIndex
CREATE INDEX "CouponHistory_couponId_createdAt_idx" ON "CouponHistory"("couponId", "createdAt");

-- CreateIndex
CREATE INDEX "CouponHistory_actorId_idx" ON "CouponHistory"("actorId");

-- CreateIndex
CREATE INDEX "ShippingDiscount_status_deletedAt_idx" ON "ShippingDiscount"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "ShippingDiscount_deletedAt_idx" ON "ShippingDiscount"("deletedAt");

-- CreateIndex
CREATE INDEX "ShippingDiscountCategory_categoryId_idx" ON "ShippingDiscountCategory"("categoryId");

-- Create partial unique index for active coupon codes; soft-deleted codes can be reused.
CREATE UNIQUE INDEX "Coupon_code_active_key" ON "Coupon"("code") WHERE "deletedAt" IS NULL;

-- Create partial unique index so only one pickup point can be main at a time.
CREATE UNIQUE INDEX "PickupPoint_isMain_true_key" ON "PickupPoint"("isMain") WHERE "isMain" = true;

-- AddForeignKey
ALTER TABLE "WeightBand" ADD CONSTRAINT "WeightBand_shippingProviderId_fkey" FOREIGN KEY ("shippingProviderId") REFERENCES "ShippingProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupPointSchedule" ADD CONSTRAINT "PickupPointSchedule_pickupPointId_fkey" FOREIGN KEY ("pickupPointId") REFERENCES "PickupPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponHistory" ADD CONSTRAINT "CouponHistory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponHistory" ADD CONSTRAINT "CouponHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingDiscountCategory" ADD CONSTRAINT "ShippingDiscountCategory_shippingDiscountId_fkey" FOREIGN KEY ("shippingDiscountId") REFERENCES "ShippingDiscount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingDiscountCategory" ADD CONSTRAINT "ShippingDiscountCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
