# API Contract Map (Phase 0)

This document freezes the REST contracts to be implemented by the standalone Backend Core. Paths are fully qualified under `/api/v1`; request DTOs are Zod-validated transport contracts, response DTOs are mapper projections, and no Prisma model is exposed directly.

## General Conventions

- **Authentication:** Public endpoints require no token; `CUSTOMER` and `ADMIN` mean backend-enforced JWT authorization. Refresh credentials use an HttpOnly cookie and access credentials use a Bearer token.
- **Errors:** Every listed key error uses the shared envelope; endpoint-specific errors supplement the baseline `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, and `INTERNAL_ERROR` as applicable.
- **Ownership:** Protected customer-account and wishlist operations derive the authoritative `userId` exclusively from the validated JWT. A client-supplied account identifier is never accepted as an ownership selector.

  ```json
  {
    "ok": false,
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "field": "optional_field_name",
    "issues": []
  }
  ```

- **Success:** A mapper DTO or `{ "ok": true, "data": DTO }` according to the consuming frontend repository. Command endpoints return the updated projection unless noted otherwise.
- **Pagination:** Collection endpoints use `?page=1&limit=20` plus their documented filters.
- **Scope boundary:** Provider, carrier, webhook, label, tracking, and real payment integration calls are Post-Core and are not API contracts here.

---

## 1. Authentication

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | `RegisterRequest` | `AuthSession` (`accessToken`, `user`) | `EMAIL_EXISTS`, `VALIDATION_ERROR` |
| POST | `/api/v1/auth/login` | Public | `LoginRequest` | `AuthSession` | `INVALID_CREDENTIALS` |
| POST | `/api/v1/auth/refresh` | Public (refresh cookie) | None | `AccessTokenResponse` | `UNAUTHORIZED` |
| POST | `/api/v1/auth/logout` | Any authenticated session | None | `{ ok: true }` | `UNAUTHORIZED` |
| POST | `/api/v1/auth/forgot-password` | Public | `ForgotPasswordRequest` | `{ ok: true }` | `VALIDATION_ERROR` |
| POST | `/api/v1/auth/reset-password` | Public | `ResetPasswordRequest` | `{ ok: true }` | `INVALID_RESET_TOKEN`, `VALIDATION_ERROR` |
| POST | `/api/v1/auth/change-password` | CUSTOMER or ADMIN | `ChangePasswordRequest` | `{ ok: true }` | `INVALID_CREDENTIALS`, `VALIDATION_ERROR` |
| GET | `/api/v1/auth/me` | Valid JWT | None | `User` | `UNAUTHORIZED` |

---

## 2. Public Catalog

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/categories` | Public | `CategoryListQuery` | `PublicCategory[]` (flat) | — |
| GET | `/api/v1/products` | Public | `ProductListQuery` (`categorySlug`, `sort`, pagination) | `ProductSummaryPage` | — |
| GET | `/api/v1/products/:publicSlug` | Public | Path parameter | `ProductDetail` | `NOT_FOUND` |

---

## 3. Customer Account and Wishlist

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/account/profile` | CUSTOMER | None | `AccountProfile` | `NOT_FOUND` |
| PUT | `/api/v1/account/profile` | CUSTOMER | `AccountProfileRequest` | `AccountProfile` | `VALIDATION_ERROR` |
| GET | `/api/v1/account/addresses` | CUSTOMER | None | `UserAddress[]` | — |
| POST | `/api/v1/account/addresses` | CUSTOMER | `UserAddressRequest` | `UserAddress` | `ADDRESS_LIMIT_REACHED`, `VALIDATION_ERROR` |
| PUT | `/api/v1/account/addresses/:id` | CUSTOMER | `UserAddressRequest` | `UserAddress` | `NOT_FOUND`, `VALIDATION_ERROR` |
| DELETE | `/api/v1/account/addresses/:id` | CUSTOMER | None | `{ ok: true }` | `NOT_FOUND` |
| GET | `/api/v1/account/orders` | CUSTOMER | `AccountOrderListQuery` | `AccountOrder[]` (empty until Orders persistence) | — |
| GET | `/api/v1/wishlist` | CUSTOMER | None | `ProductSummary[]` | — |
| POST | `/api/v1/wishlist/:productId` | CUSTOMER | None | `{ ok: true }` | `PRODUCT_NOT_FOUND`, `WISHLIST_ITEM_EXISTS` |
| DELETE | `/api/v1/wishlist/:productId` | CUSTOMER | None | `{ ok: true }` | `WISHLIST_ITEM_NOT_FOUND` |

The address `:id` is resolved within the authenticated customer's address set; foreign address IDs must return a safe not-found/authorization result without mutation. The wishlist paths follow PRD §25; guest wishlist behavior may remain local. Product visibility and availability are checked by the backend before a relation is created.

Account and wishlist services MUST NOT accept `userId` in route parameters or request bodies. They use the JWT-derived actor and return only that actor's profile, addresses, wishlist products, and account projections.

Password recovery has a deliberately narrow error contract: `forgot-password` returns the same successful `{ "ok": true }` response for known and unknown emails, while `reset-password` returns `INVALID_RESET_TOKEN` for missing, expired, or consumed credentials. Reset tokens are persisted only as hashes and never appear in responses or logs.

`GET /api/v1/account/orders` is a stable DTO collection boundary. Until the Orders phase adds persistence, it returns `[]` and MUST NOT project the current static order mock as persisted history.

---

## 4. Checkout

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| POST | `/api/v1/checkout/quote` | Public | `QuoteRequest` | `CheckoutQuoteResponse` | `OUT_OF_STOCK`, `COUPON_NOT_VALID`, `SHIPPING_OPTION_UNAVAILABLE` |
| POST | `/api/v1/checkout/complete` | Public or CUSTOMER | `CheckoutCompleteRequest` | `CheckoutCompleteResponse` (`ok`, `orderId`, `number`) | `OUT_OF_STOCK`, `COUPON_USAGE_LIMIT_REACHED`, `SHIPPING_OPTION_UNAVAILABLE` |

Both operations re-read product, variant, price, inventory, coupon, payment, and shipping configuration. Browser-provided totals are never authoritative.

---

## 5. CRM Admin — Catalog and Inventory

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/products` | ADMIN | `AdminProductListQuery` | `AdminProductPage` | — |
| POST | `/api/v1/admin/products` | ADMIN | `ProductCreateRequest` | `AdminProduct` | `SLUG_CONFLICT`, `VALIDATION_ERROR` |
| POST | `/api/v1/admin/products/:id/duplicate` | ADMIN | None | `AdminProduct` | `NOT_FOUND`, `SLUG_CONFLICT` |
| GET | `/api/v1/admin/categories` | ADMIN | None | `AdminCategory[]` (recursive) | — |
| POST | `/api/v1/admin/categories` | ADMIN | `CategoryFormRequest` | `AdminCategory` | `CATEGORY_CYCLE`, `SLUG_CONFLICT`, `VALIDATION_ERROR` |
| DELETE | `/api/v1/admin/categories/:id` | ADMIN | None | `{ ok: true }` | `CATEGORY_IN_USE`, `NOT_FOUND` |
| PUT | `/api/v1/admin/inventory/:productId` | ADMIN | `InventoryUpdateRequest` (`variantId?`, operation, delta/replacement, reason) | `InventoryRecord` | `NOT_FOUND`, `INVALID_INVENTORY_OPERATION`, `OUT_OF_STOCK`, `VALIDATION_ERROR` |
| GET | `/api/v1/admin/inventory/history` | ADMIN | `InventoryHistoryQuery` (`productId?`, `variantId?`, pagination) | `InventoryHistoryPage` | `NOT_FOUND` |

Inventory writes create an immutable history entry in the same transaction. `InventoryUpdateRequest` never accepts a client-authoritative resulting-stock value.

---

## 6. CRM Admin — Sales and Purchase Orders

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/sales` | ADMIN | `AdminSaleListQuery` (`status`, `archived`, pagination) | `AdminSalePage` | — |
| GET | `/api/v1/admin/sales/:id` | ADMIN | None | `AdminSale` (items and history) | `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/cancel` | ADMIN | `SaleCancelRequest` (`reason`, `restoreInventory?`) | `AdminSale` | `INVALID_STATE_TRANSITION`, `SALE_NOT_EDITABLE` |
| POST | `/api/v1/admin/sales/:id/reopen` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/mark-payment-received` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/pack` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/unpack` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/ship` | ADMIN | `SaleShipRequest` (`trackingCode?`) | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/deliver` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/ready-for-pickup` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/complete-pickup` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/sales/:id/archive` | ADMIN | None | `AdminSale` | `SALE_NOT_ARCHIVABLE`, `INVALID_STATE_TRANSITION`, `NOT_FOUND` |
| POST | `/api/v1/admin/purchase-orders/:id/convert` | ADMIN | None | `AdminSale` | `INVALID_STATE_TRANSITION`, `OUT_OF_STOCK`, `NOT_FOUND` |

Command transitions and audit events are fixed by PRD §§52–58: pack `to_pack → to_ship` / `package_packed`; unpack `to_ship → to_pack` / `package_unpacked`; ship `to_ship → shipped` / `package_shipped`; deliver `shipped → delivered` / `package_delivered`; ready for pickup `to_pack → pickup` / `pickup_ready`; complete pickup `pickup → delivered` / `pickup_completed`; and receive payment `pending → received` / `payment_received`. Receiving payment must not deduct inventory again. Cancellation, reopening, archiving, and purchase-order conversion remain explicit commands.

---

## 7. CRM Admin — Customers

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/customers` | ADMIN | `CrmCustomerListQuery` (`search`, pagination) | `CrmCustomerPage` | — |
| GET | `/api/v1/admin/customers/:id` | ADMIN | None | `CrmCustomerDetail` | `NOT_FOUND` |
| PUT | `/api/v1/admin/customers/:id` | ADMIN | `CrmCustomerUpdateRequest` | `CrmCustomerDetail` | `CUSTOMER_ANONYMIZED`, `EMAIL_EXISTS`, `VALIDATION_ERROR` |
| GET | `/api/v1/admin/customers/:id/export` | ADMIN | `CustomerExportQuery` (`format=csv`) | `CustomerExportCsv` | `NOT_FOUND` |
| POST | `/api/v1/admin/customers/:id/anonymize` | ADMIN | None | `CrmCustomer` | `CUSTOMER_ALREADY_ANONYMIZED`, `NOT_FOUND` |

Export returns only the requested customer's permitted CRM projection and never passwords, refresh tokens, secrets, or unrelated customer data. Anonymization is a transactional soft-delete operation that retains non-PII transaction history.

---

## 8. CRM Admin — Commerce Configuration

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/discounts/coupons` | ADMIN | `CouponListQuery` | `Coupon[]` | — |
| POST | `/api/v1/admin/discounts/coupons` | ADMIN | `CouponRequest` | `Coupon` | `COUPON_CODE_ALREADY_EXISTS`, `VALIDATION_ERROR` |
| PUT | `/api/v1/admin/discounts/coupons/:id` | ADMIN | `CouponRequest` | `Coupon` | `COUPON_CODE_ALREADY_EXISTS`, `NOT_FOUND`, `VALIDATION_ERROR` |
| DELETE | `/api/v1/admin/discounts/coupons/:id` | ADMIN | None | `{ ok: true }` | `NOT_FOUND` |
| GET | `/api/v1/admin/discounts/shipping` | ADMIN | `ShippingDiscountListQuery` | `ShippingDiscount[]` | — |
| POST | `/api/v1/admin/discounts/shipping` | ADMIN | `ShippingDiscountRequest` | `ShippingDiscount` | `INVALID_SHIPPING_METHOD`, `VALIDATION_ERROR` |
| PUT | `/api/v1/admin/discounts/shipping/:id` | ADMIN | `ShippingDiscountRequest` | `ShippingDiscount` | `INVALID_SHIPPING_METHOD`, `NOT_FOUND`, `VALIDATION_ERROR` |
| DELETE | `/api/v1/admin/discounts/shipping/:id` | ADMIN | None | `{ ok: true }` | `NOT_FOUND` |
| GET | `/api/v1/admin/payment-methods` | ADMIN | None | `PaymentMethodConfig[]` | — |
| PUT | `/api/v1/admin/payment-methods/:providerId` | ADMIN | `PaymentMethodConfigRequest` | `PaymentMethodConfig` | `INVALID_PROVIDER_OPTION`, `VALIDATION_ERROR` |
| GET | `/api/v1/admin/shipping/providers` | ADMIN | None | `ShippingProviderConfig[]` | — |
| PUT | `/api/v1/admin/shipping/providers/:providerId` | ADMIN | `ShippingProviderConfigRequest` | `ShippingProviderConfig` | `INVALID_PROVIDER_STATUS`, `INVALID_WEIGHT_RANGE`, `VALIDATION_ERROR` |
| GET | `/api/v1/admin/pickup-points` | ADMIN | None | `PickupPoint[]` | — |
| PUT | `/api/v1/admin/pickup-points/:id` | ADMIN | `PickupPointRequest` | `PickupPoint` | `PICKUP_SCHEDULE_OVERLAP`, `INVALID_PICKUP_CONFIGURATION`, `NOT_FOUND` |

Shipping-discount deletion is a soft delete whenever a historical checkout or order snapshot references the record. Soft-deleted discounts are unavailable to checkout but remain auditable; no redemption counter or external shipping integration is introduced. Provider configuration persists EntrenAR-managed prices and settings only.

---

## 9. CRM Admin — Statistics

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/statistics/overview` | ADMIN | `StatisticsPeriodQuery` (`from`, `to`) | `OverviewStats` | `INVALID_DATE_RANGE` |
| GET | `/api/v1/admin/statistics/sales` | ADMIN | `StatisticsPeriodQuery` | `SalesStatistics` | `INVALID_DATE_RANGE` |
| GET | `/api/v1/admin/statistics/products` | ADMIN | `StatisticsPeriodQuery` | `ProductStatistics` | `INVALID_DATE_RANGE` |
| GET | `/api/v1/admin/statistics/customers` | ADMIN | `StatisticsPeriodQuery` | `CustomerStatistics` | `INVALID_DATE_RANGE` |
| GET | `/api/v1/admin/statistics/coupons` | ADMIN | `StatisticsPeriodQuery` | `CouponStatistics` | `INVALID_DATE_RANGE` |

Statistics are server-side aggregates. Revenue, average ticket, top customers, province distribution, and payment-method distribution use payment-received, non-cancelled, non-refunded sales; visits and traffic remain unavailable until a tracking subsystem exists.

---

## Frontend Repository Ownership

The Next.js frontend consumes these contracts through domain-facing repositories. Direct `fetch()` calls inside React components are prohibited. Zustand stores coordinate local/UI state and delegate persistent mutations to repositories after their domain migrates.
