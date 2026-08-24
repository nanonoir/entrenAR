# Proposed ER Model (Backend Core)

This document represents the conceptual relational model for EntrenAR Phase 0, designed prior to Prisma syntax. It outlines entities, key fields, cardinalities, constraints, and explicit legacy-compatibility decisions.

## 1. Catalog & Inventory

### `Product`
- **Keys:** `id` (PK, CUID/UUID), `slug` (Unique, CRM namespace), `publicSlug` (Unique, Public namespace), `sku` (Optional, Unique)
- **Fields:** `name`, `brand`, `description`, `shortDescription`, `seoTitle`, `seoDescription`, `imageUrl`, `imageTone`, `tags` (Array/JSON), `highlightSections` (Array/JSON), `weightGrams`, `heightCm`, `widthCm`, `lengthCm`, `visibility` (Enum: `visible`, `hidden`), `stockMode` (Enum: `limited`, `infinite`), `salePrice` (Decimal), `promotionalPrice` (Decimal, Optional), `manualOrder` (Int), `salesCount` (Int), `createdAt`, `updatedAt`
- **Relations:**
  - 1:M with `Variant`
  - M:N with `Category` (via implicitly or explicitly defined join table)
  - 1:M with `InventoryHistory`
- **Invariants:** `promotionalPrice < salePrice`.

### `Variant`
- **Keys:** `id` (PK)
- **Fields:** `productId` (FK), `sku`, `name`, `stockMode` (Enum), `stockQuantity` (Int, Nullable), `price` (Decimal, Optional), `properties` (JSON)
- **Relations:** M:1 with `Product`

### `Category`
- **Keys:** `id` (PK), `slug` (Unique)
- **Fields:** `parentId` (FK, Nullable), `name`, `description`, `imageUrl`, `googleShoppingCategory`, `seoTitle`, `seoDescription`, `visibility` (Enum), `sortOrder` (Int)
- **Relations:** 1:M self-relation (`children`), M:N with `Product`
- **Invariants:** No circular parent references. Hiding cascades to descendants.

### `InventoryHistory`
- **Keys:** `id` (PK)
- **Fields:** `productId` (FK), `variantId` (FK, Nullable), `operation` (Enum: `add`, `subtract`, `replace`), `delta` (Int, Nullable), `resultingStock` (Int, Nullable), `isInfinite` (Boolean), `type` (String: `stock-edit`, `sale_deduction`, etc.), `actorId` (String, Nullable), `reason` (String, Nullable), `createdAt`
- **Audit Table:** Append-only.

## 2. Users & CRM Customers

### `User` (Public/Admin Auth)
- **Keys:** `id` (PK), `email` (Unique)
- **Fields:** `passwordHash`, `role` (Enum: `CUSTOMER`, `ADMIN`), `firstName`, `lastName`, `dni`, `gender`, `birthDate`, `phone`, `createdAt`, `updatedAt`
- **Relations:** 1:M with `UserAddress`, 1:M with `WishlistItem`, 0:1 with `CrmCustomer`

### `UserAddress` (Public Account Address)
- **Keys:** `id` (PK)
- **Fields:** `userId` (FK), `label`, `recipient`, `street`, `city`, `province`, `postalCode`, `phone`
- **Relations:** M:1 with `User`
- **Invariants:** Max 6 per User. This limit applies only to public account addresses.

### `CrmCustomer`
- **Keys:** `id` (PK), `email` (Unique, Nullable if anonymized)
- **Fields:** `userId` (FK, Nullable), `fullName`, `phone`, `dniOrCuil`, `firstInteractionDate`, `notes`, `isAnonymized` (Boolean)
- **Relations:** 1:M with `Sale`, 1:M with `PurchaseOrder`, 0:1 with `CrmCustomerAddress`
- **Invariants:** Soft delete = Anonymization (clear PII, set `isAnonymized = true`, drop email uniqueness constraint logically using partial index where `isAnonymized = false`).

### `CrmCustomerAddress` (CRM Customer Address)
- **Keys:** `id` (PK)
- **Fields:** `crmCustomerId` (FK), `street`, `number`, `floorOrApartment` (Optional), `postalCode`, `neighborhood` (Optional), `city`, `provinceOrState`, `country`
- **Relations:** 1:1 with `CrmCustomer` (optional from the CRM customer perspective)
- **Invariants:** This is a CRM-detail contract, not a public checkout-address projection. It has no per-customer maximum-address rule; if supplied, it must satisfy the frontend's required-address semantics. It is cleared when its customer is anonymized.

## 3. Orders (Sales & Purchase Orders)

### `Sale`
- **Keys:** `id` (PK), `number` (Sequence/Unique Business ID)
- **Fields:** `customerId` (FK, Nullable), `sourceOrderId` (FK, Nullable), `paymentStatus` (Enum: `pending`, `received`, `cancelled`, `refunded`), `shippingStatus` (Enum: `to_pack`, `to_ship`, `shipped`, `delivered`, `pickup`, `cancelled`), `paymentMethodId`, `subtotal` (Decimal), `discountType` (Enum: `percentage`, `fixed`), `discountValue` (Decimal), `shippingCost` (Decimal), `total` (Decimal), `archived` (Boolean), `cancellationReason`, `previousPaymentStatus`, `previousShippingStatus`, `notes`, `trackingCode`, `createdAt`, `updatedAt`
- **Relations:** 1:M with `SaleItem`, 1:M with `SaleHistory`

### `SaleItem` (Snapshot)
- **Keys:** `id` (PK)
- **Fields:** `saleId` (FK), `productId`, `variantId`, `name`, `quantity` (Int), `unitPrice` (Decimal)
- **Invariants:** Read-only post-creation. DTO maps this exactly.

### `SaleHistory`
- **Keys:** `id` (PK)
- **Fields:** `saleId` (FK), `type` (Enum, e.g., `sale_created`, `payment_received`), `actor`, `note`, `createdAt`

### `PurchaseOrder`
- **Keys:** `id` (PK), `number` (Unique Business ID: `OC-{YEAR}-{SEQ}`)
- **Fields:** `customerId` (FK, Nullable), `status` (Enum: `pending`, `converted`, `cancelled`), `convertedSaleId` (Nullable), `subtotal`, `discountType`, `discountValue`, `shippingCost`, `total`, `notes`, `createdAt`
- **Relations:** 1:M with `PurchaseOrderItem`
- **Invariants:** Conversion is idempotent.

### `PurchaseOrderItem` (Snapshot)
- **Keys:** `id` (PK)
- **Fields:** `purchaseOrderId` (FK), `productId`, `variantId` (Nullable), `name`, `quantity` (Int), `unitPrice` (Decimal)
- **Relations:** M:1 with `PurchaseOrder`; each purchase order owns 1:M `PurchaseOrderItem` records.
- **Invariants:** Item values are captured when the purchase order is created and are immutable thereafter. Conversion creates the linked sale transactionally from these snapshots; later catalog changes cannot rewrite purchase-order history.

## 4. Commerce Configuration

### `Coupon`
- **Keys:** `id` (PK), `code` (Unique where `deletedAt` is NULL)
- **Fields:** `discountType`, `discountValue` (Decimal), `includeShippingCost` (Boolean), `targetType`, `canCombineWithPromotions`, `totalUsageLimitType`, `totalUsageLimit` (Int), `usageCount` (Int), `customerLimitType`, `customerUsageLimit` (Int), `dateLimitType`, `startDate`, `endDate`, `minimumCartAmount`, `maxDiscountType`, `maxDiscountAmount`, `status` (Enum: `active`, `inactive`), `createdAt`, `updatedAt`, `deletedAt` (Soft Delete)
- **Relations:** 1:M with `CouponHistory`, M:N with `Category`, M:N with `Product`
- **Invariants:** Soft deletion mandatory for historical referential integrity.

### `PickupPoint`
- **Keys:** `id` (PK)
- **Fields:** `name`, `status`, `isMain` (Boolean), `street`, `number`, `city`, `province`, `postalCode`, `contactName`, `contactPhone`, `preparationHours`, `costType`, `fixedCost`, `coverageType`, `provinces` (JSON), `updatedAt`
- **Relations:** 1:M with `PickupPointSchedule`.
- **Invariants:** A partial unique constraint enforces **at most one** `isMain = true`; choosing a new main point unsets the old main point transactionally. A configured/active point requires at least one schedule range. `fixedCost` is required when `costType = fixed`; at least one province is required when `coverageType = provinces`.

### `PickupPointSchedule`
- **Keys:** `id` (PK)
- **Fields:** `pickupPointId` (FK), `dayOfWeek`, `opensAt`, `closesAt`, `sortOrder`
- **Relations:** M:1 with `PickupPoint`.
- **Invariants:** Ranges are ordered by `dayOfWeek`, then opening time; `closesAt` must be later than `opensAt`; ranges for the same pickup point and day must not overlap. The unconfigured default seed may have no ranges until the point is configured.

### `ShippingProvider`
- **Keys:** `id` (PK, string identifier e.g. `andreani`)
- **Fields:** `name`, `status` (`not_configured`, `configured_inactive`, `active`), `enabledModalities` (JSON array), `originSenderName`, `originStreet` (etc.), `freeShippingThreshold` (Decimal, Nullable), `weightRanges` (JSON array of cost mappings).

### `ShippingDiscount`
- **Keys:** `id` (PK)
- **Fields:** `shippingMethodIds` (collection of stable composite IDs in `{providerId}:{service-slug}` form), `onlyCheapestShippingMethod` (Boolean), `targetType` (Enum: `all_store`, `categories`), `categoryIds` (collection, required when category-targeted), `canCombineWithPromotions` (Boolean), `zoneTargetType` (Enum: `all`, `specific`), `zoneIds` (collection, required when zone-targeted), `minimumCartAmount` (Decimal), `status` (Enum: `active`, `inactive`), `createdAt`, `updatedAt`, `deletedAt` (Nullable)
- **Relations:** M:N with `Category` when `targetType = categories`; shipping-method IDs are validated against fixed provider-service definitions rather than treated as mutable carrier integrations.
- **Invariants:** At least one `shippingMethodId` is required. Composite method IDs must resolve to a supported provider service. Shipping discounts are distinct from coupons and have no redemption counter or history aggregate. Use soft deletion when a discount is referenced by historical checkout or order snapshots; retain the snapshot reference and exclude soft-deleted records from active checkout evaluation.

## 5. Checkout & Carts

### `CheckoutSession` / `AbandonedCart`
- **Keys:** `id` (PK)
- **Fields:** `customerId` (FK, Nullable), `snapshotData` (JSON - Cart items, totals), `recoveryStatus` (Enum: `pending`, `sent`, `manual`, `recovered`), `lastEmailSentAt`, `abandonedAt`, `createdAt`

## 6. Implementation Notes

- **Money Handling:** All prices and totals (`salePrice`, `unitPrice`, `subtotal`, `shippingCost`, etc.) use `Decimal` (mapped to `NUMERIC(12,2)` in PostgreSQL). Mappers will convert to JavaScript `number` for frontend compatibility.
- **DTO Mappings:**
  - `SaleShippingStatus` maps to Public UX: `to_pack`/`to_ship` -> `preparacion`, `shipped` -> `en-camino`, `delivered` -> `entregado`, `pickup` -> `listo-para-retirar`.
- **Legacy IDs:** Seed scripts will preserve `mock` IDs (e.g. `prod-1`, `retiro-principal`) by explicitly inserting them into the CUID/String PK fields.
- **Transactions:**
  - Order creation wraps: `Sale` insert, `SaleItem` inserts, `InventoryHistory` insert, Stock deduction, `Coupon` usage increment.
  - Category deletion wraps: Child constraint validation, Subtree removal.
