# API Contract Map (Phase 5 Checkout)

This document records the verified REST contracts for the standalone Backend Core through Phase 5 Checkout. Paths are fully qualified under `/api/v1`; request DTOs are Zod-validated transport contracts, response DTOs are mapper projections, and no Prisma model is exposed directly.

## Phase 5 Outcome

- ✅ `POST /api/v1/checkout/quote` returns server-authoritative ARS totals and eligible commerce configuration.
- ✅ `POST /api/v1/checkout/complete` revalidates the quote and atomically creates a pending order, payment record, snapshots, stock history, coupon usage, cart cleanup, and session completion.
- ✅ Guest sessions use opaque credentials; authenticated checkout derives ownership from the JWT and can merge the guest cart into the customer cart without duplicate lines.
- ✅ `GET /api/v1/account/orders` returns the authenticated customer's immutable order-history projection backed by placement-time snapshots.
- ✅ The frontend reaches checkout through `src/lib/api/checkout/`; static checkout mocks remain available as the explicit default/fallback source.

Phase 5 does not call a real payment or shipping provider. A successful completion creates a pending payment/order intent only.

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
- **Scope boundary:** Provider/carrier calls, payment-gateway sessions, webhooks, labels, tracking, refunds, financial reconciliation, and external notifications are Post-Core and are not API contracts here.

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
| GET | `/api/v1/account/orders` | CUSTOMER | `AccountOrderListQuery` | `AccountOrder[]` (JWT-owned snapshot projection) | — |
| GET | `/api/v1/wishlist` | CUSTOMER | None | `ProductSummary[]` | — |
| POST | `/api/v1/wishlist/:productId` | CUSTOMER | None | `{ ok: true }` | `PRODUCT_NOT_FOUND`, `WISHLIST_ITEM_EXISTS` |
| DELETE | `/api/v1/wishlist/:productId` | CUSTOMER | None | `{ ok: true }` | `WISHLIST_ITEM_NOT_FOUND` |

The address `:id` is resolved within the authenticated customer's address set; foreign address IDs must return a safe not-found/authorization result without mutation. The wishlist paths follow PRD §25; guest wishlist behavior may remain local. Product visibility and availability are checked by the backend before a relation is created.

Account and wishlist services MUST NOT accept `userId` in route parameters or request bodies. They use the JWT-derived actor and return only that actor's profile, addresses, wishlist products, and account projections.

Password recovery has a deliberately narrow error contract: `forgot-password` returns the same successful `{ "ok": true }` response for known and unknown emails, while `reset-password` returns `INVALID_RESET_TOKEN` for missing, expired, or consumed credentials. Reset tokens are persisted only as hashes and never appear in responses or logs.

`GET /api/v1/account/orders` is a stable DTO collection boundary. In Phase 5 it reads persisted orders owned by the JWT subject and maps only immutable placement-time fields. It returns an empty collection when that customer has no persisted orders; it never projects the static order mock as server history.

---

## 4. Checkout

| Method | Path | Auth / role | Request DTO | Response DTO | Key errors |
|---|---|---|---|---|---|
| POST | `/api/v1/checkout/quote` | Public or CUSTOMER | `CheckoutQuoteRequest` | `CheckoutQuoteResponse` | `VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `COUPON_NOT_VALID`, `SHIPPING_OPTION_UNAVAILABLE`, `CHECKOUT_SESSION_INVALID`, `FORBIDDEN` |
| POST | `/api/v1/checkout/complete` | Public or CUSTOMER | `CheckoutCompleteRequest` | `CheckoutCompleteResponse` (`ok`, `orderId`, `number`, `status`, `total`) | `VALIDATION_ERROR`, `PRODUCT_NOT_FOUND`, `VARIANT_NOT_FOUND`, `OUT_OF_STOCK`, `COUPON_NOT_VALID`, `COUPON_USAGE_LIMIT_REACHED`, `PAYMENT_METHOD_UNAVAILABLE`, `SHIPPING_OPTION_UNAVAILABLE`, `PRICE_CHANGED`, `IDEMPOTENCY_KEY_REUSED`, `CHECKOUT_SESSION_INVALID`, `FORBIDDEN` |

Both operations re-read product, variant, price, inventory, coupon, payment, and shipping configuration. Browser-provided totals, prices, stock, cart IDs, user IDs, payment state, and order status are never authoritative.

### 4.1 Request Contract

| Request | Required fields | Optional selection fields | Server-owned exclusions |
|---|---|---|---|
| `CheckoutQuoteRequest` | `items[]` with `productId`, optional `variantId`, and integer `quantity` from 1–1,000 | `sessionToken`, `deliveryType`, `address` or `addressId`, `city`, `province`, `postalCode`, `shippingMethodId`, `shippingProviderId`, `pickupPointId`, `couponCode` | `total`, line `price`, line `stock`, `cartId`, `userId`, payment state, order state |
| `CheckoutCompleteRequest` | All quote selections, `customer.email/firstName/lastName`, `idempotencyKey` (8–128 chars), `paymentMethodId` | `paymentOptionId`, `quoteId`, customer `dni`/`phone`, delivery address fields | Same quote exclusions; ownership is derived from JWT/session and the payment is only initialized as pending |

`address` and `addressId` are mutually exclusive. Shipping and pickup selections are mutually exclusive. Duplicate product/variant lines are rejected by the transport schema or reconciled by the frontend adapter before transport. Supported public payment method IDs are `bank-transfer`, `mercado-pago`, and `stripe`; supported shipping method IDs are normalized by the backend.

### 4.2 Quote Response Contract

`CheckoutQuoteResponse` is `{ ok: true, currency: "ARS", quoteId, items, subtotal, discount, shipping, total, paymentMethods, shippingOptions, pickupPoints, warnings }` with optional `coupon`, `expiresAt`, and guest `sessionToken`.

| Projection | Authoritative fields |
|---|---|
| `items[]` | `productId`, `variantId`, `productName`, `variantName`, `sku`, `quantity`, `unitPrice`, `lineSubtotal`, `compareAtPrice`, `weightGrams`, and `availableQuantity` (`null` for unlimited stock) |
| `shippingOptions[]` | `id`, `providerId`, `providerName`, `label`, `modality`, `cost`, and optional `estimatedDelivery` |
| `pickupPoints[]` | `id`, `name`, `address`, and `preparationHours`; only active/configured points whose coverage matches the requested province are exposed |
| `paymentMethods[]` | public method metadata, options, selected option, and narrow bank-transfer fields (`holderName`, `alias`, `bankName`, `cbuCvu`, `cuitCuil`) when configured |
| `coupon` / `warnings` | controlled coupon result and safe `{ code, message }` warnings; no internal configuration is exposed |

The backend calculates `subtotal`, product `discount`, final `shipping`, and `total` from current catalog and commerce records. Quote IDs and guest session tokens are opaque; only token hashes are persisted.

### 4.3 Completion and Ownership Contract

`CheckoutCompleteResponse` returns the pending order projection (`currency`, `id`, `number`, `status: "pending"`, `total`) plus `orderId`, `number`, `status`, `total`, and `ok: true`. Completion revalidates any supplied `quoteId`/session snapshot before stock deduction.

| Boundary | Behavior |
|---|---|
| Guest | A quote may issue an opaque session token. Completion requires that active token and creates an order with no `userId`; the token is never returned from persistence. |
| CUSTOMER | The validated JWT supplies `userId`. A supplied guest token may be merged into the customer's active cart; overlapping lines are combined and the guest cart is abandoned. |
| Foreign session/cart | Returns `CHECKOUT_SESSION_INVALID` without changing cart, stock, order, or idempotency state. |
| ADMIN | Returns `FORBIDDEN`; admin actors cannot use customer checkout ownership. |
| Retry | `idempotencyKey` is scoped to the owner. A matching replay returns the original response without duplicate stock/history/order writes; a different request returns `IDEMPOTENCY_KEY_REUSED`. |

Completion uses `201`; successful quote/history reads use `200`. Validation errors use `400`, ownership/authentication errors use `401`/`403`, missing catalog references use `404`, and stock/configuration/stale-quote/idempotency conflicts use `409`. Every failure uses the shared `{ ok: false, code, message, issues? }` envelope.

### 4.4 Phase 5 Verification and Exclusions

- The adapter harness proves mock-default/API-opt-in selection, DTO authority, cart reconciliation, controlled errors, refresh retry, idempotency, and mock fallback.
- The checkout unit suite proves quote authority, hidden-product rejection, atomic completion coordination, replay, race loss, stale quotes, commerce discounts, and ADMIN rejection.
- Disposable-PostgreSQL integration and HTTP E2E suites prove persistence constraints, snapshots, cart cleanup, coupon usage, guest/customer ownership, replay, final-unit races, request IDs, and account history.
- No real Mercado Pago/Stripe session, provider/carrier request, webhook, refund, financial reconciliation, email/notification, Phase 6 sales lifecycle, or Phase 8 abandoned-cart recovery contract is introduced.
- The inherited shared-development catalog fixture failure involving residual `cmthk...` categories is unrelated to checkout; checkout verification is isolated with disposable PostgreSQL and does not modify that fixture.

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
