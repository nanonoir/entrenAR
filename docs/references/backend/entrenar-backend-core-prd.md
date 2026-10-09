# PRD — EntrenAR Backend Core & Mock-to-API Migration

**Project:** EntrenAR Ecommerce  
**Repository reviewed:** `nanonoir/entrenAR`  
**Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS  
**Backend target:** Standalone NestJS 11 + TypeScript + Prisma + PostgreSQL under `backend/`  
**Architecture:** Modular Monolith  
**API style:** REST / JSON  
**Status:** Refined — Ready for Phase 0 Contract Freeze  
**Date:** 2026-08-23

---

## 1. Executive Summary

EntrenAR currently has a largely complete frontend for both the public ecommerce experience and the CRM/Admin experience. Most business behavior is implemented with:

- static/mock data,
- Zustand stores,
- React Hook Form,
- Zod schemas,
- frontend helpers,
- frontend-only state transitions,
- local persistence for some customer-facing features.

The purpose of this project is to replace the current mock/static persistence layer with a real backend while preserving the existing frontend behavior.

The backend must **adapt to the contracts already implemented by the frontend**, except where this refined PRD explicitly resolves an audited contradiction, unsafe mock behavior, or missing invariant.

The backend must not redesign existing frontend flows, rename existing domain states, alter current URL behavior, or introduce incompatible response structures unless an incompatibility is explicitly documented and approved.

The target architecture is:

```text
Frontend
Next.js + React + TypeScript
React Hook Form + Zod
Zustand for local/UI state where appropriate
                |
                | REST / JSON
                v
Backend
NestJS + TypeScript
Express adapter
Zod validation
Prisma ORM
PostgreSQL
                |
                v
External integrations
POST-BACKEND-CORE only
```

The implementation must be incremental. Existing mocks must not be removed all at once.

---

# 2. Product Goal

Build the first production-capable backend for EntrenAR that provides persistent, authoritative data for:

- authentication,
- customer accounts,
- products,
- categories,
- variants,
- inventory,
- wishlist,
- checkout calculations,
- checkout sessions,
- orders / purchase orders,
- CRM sales,
- CRM customers,
- coupons,
- shipping discounts,
- payment configuration,
- shipping configuration,
- pickup points,
- abandoned carts,
- transactional statistics.

The result must make the current ecommerce and CRM flows survive browser refreshes, server restarts and multiple sessions without losing state.

---

# 3. Core Principle — Frontend Compatibility First

The current frontend is the source of truth for Backend Core.

The implementation must preserve:

- existing TypeScript domain types,
- existing Zod validation rules,
- existing enum values,
- existing status transitions,
- current IDs and visible number formats where they are part of the UX,
- route assumptions,
- current error expectations,
- current toast-triggering conditions,
- current table/filter behavior,
- current empty states,
- current dirty-state/save behavior,
- current public product URLs,
- current customer/account flows,
- current CRM workflows.

The backend may normalize data internally, but API DTOs must remain compatible with the frontend.

### Rule

```text
Database model != API contract

Database
   |
Domain
   |
Mapper
   |
Frontend-compatible DTO
```

Prisma models must never be exposed directly as API responses.

After this repository-alignment audit, this PRD is the Backend Core Single Source of Truth. Explicit resolutions in this document take precedence over accidental mock-data inconsistencies and incomplete local-store behavior.

---

# 4. Existing Repository as Contract

The repository already contains substantial business rules.

The backend implementation must first audit and formally document:

```text
src/types/**
src/schemas/**
src/stores/**
src/lib/data/**
src/lib/**
src/components/** flows that enforce domain behavior
```

Important current contract areas include:

- `src/types/product.ts`
- `src/types/account.ts`
- `src/lib/data/admin/sales-flow/types.ts`
- `src/lib/data/admin/customers/types.ts`
- `src/lib/data/admin/discounts/types.ts`
- `src/lib/data/admin/shipping/shipping-config.ts`
- `src/schemas/admin/product-schemas.ts`
- `src/schemas/admin/order-schema.ts`
- `src/schemas/admin/customer-schema.ts`
- `src/schemas/admin/discount-schemas.ts`
- `src/schemas/admin/payment-method-schemas.ts`
- `src/schemas/admin/shipping-schemas.ts`
- current Zustand stores under `src/stores/`

These files must be considered contract evidence during implementation.

---

# 5. Legacy Prisma Warning

The repository contains:

```text
prisma/layoutschema.prisma
```

This file is **legacy reference only**.

It contains domain assumptions that no longer match the current CRM/frontend, including concepts such as:

- `Subcategory`,
- `Segment`,
- `ReviewStatus`,
- scraping fields,
- an older product representation.

The Backend Core implementation must:

1. not extend this schema,
2. not use it as the canonical database model,
3. create a new canonical schema inside the standalone backend:

```text
backend/prisma/schema.prisma
```

4. derive the new schema from the frontend contract audit,
5. keep `prisma/layoutschema.prisma` isolated as legacy reference until it can be archived or removed after the new model is approved.

No production migration may be based directly on `layoutschema.prisma`.

---

# 5A. Codebase Alignment & Invariants

The repository audit completed on 2026-08-23 establishes the following ground truth:

- the Next.js frontend is implemented at the repository root,
- `backend/` exists but is currently empty,
- NestJS and Prisma dependencies are not installed,
- no runtime API, service, canonical Prisma schema, migration, environment template, Docker setup, or backend test runner exists yet,
- public commerce data remains static under `src/lib/data`,
- customer-facing state uses local persisted Zustand stores where documented,
- Admin/CRM operational state uses in-memory Zustand stores and is lost on refresh,
- checkout is a static UX preview with hardcoded payment, shipping, pickup, bank-transfer, coupon, and free-shipping data,
- authentication is currently a mock account drawer inside the shop; no `(auth)` route group or real session exists,
- checkout routes live under `(checkout)` and must preserve `/carrito` and `/checkout`,
- public navigation categories are flat, while Admin/CRM categories support `parentId` hierarchy,
- the only Prisma file is the non-canonical legacy `prisma/layoutschema.prisma`,
- the root project has no configured unit/integration test runner.

The confirmed application boundary is:

```text
repository root/
  src/                         Next.js frontend only
  backend/
    package.json               backend dependencies and scripts
    src/
      modules/                 NestJS domain modules
      common/                  cross-cutting backend infrastructure
    prisma/
      schema.prisma            canonical database schema
      migrations/
      seed.ts
```

Architecture invariants:

1. NestJS replaces the previously documented Next.js Route Handler backend direction.
2. Authoritative business logic MUST NOT be implemented under frontend `src/app/api/*` or frontend `src/services/*`.
3. The frontend MUST access the backend through domain-facing repositories/API clients under `src/repositories/*` and/or `src/lib/api/*`.
4. Prisma MUST remain inside `backend/` and MUST never be imported by the Next.js frontend.
5. The backend owns authentication, authorization, validation, transactions, persistence, and audit actors.
6. Phase 0 contract artifacts MUST be approved before `backend/prisma/schema.prisma` is finalized.
7. Phase 1 starts by bootstrapping the empty `backend/` application; existing backend infrastructure MUST NOT be assumed.

---

# 6. Scope

## 6.1 Backend Core — Included

Backend Core includes:

### Platform

- NestJS backend
- PostgreSQL
- Prisma
- REST API
- Zod validation
- authentication
- role-based authorization
- environment configuration
- structured errors
- logging
- migrations
- seed data
- Docker
- tests
- Swagger/OpenAPI

### Ecommerce

- catalog
- categories
- products
- variants
- inventory
- account/profile
- addresses
- wishlist
- checkout quote calculation
- checkout session
- order/purchase-order creation
- account order history

### CRM

- products
- categories
- inventory
- sales
- purchase orders
- customers
- coupons
- shipping discounts
- payment configuration
- shipping providers configuration
- pickup locations
- abandoned carts
- statistics based on real transactional data

---

# 7. Explicitly Out of Scope for Backend Core

The following features must be implemented **after Backend Core is stable**:

- Mercado Pago payment API
- Stripe payment API
- Payway payment API
- provider webhooks
- automatic payment reconciliation
- real refunds
- Andreani API
- Correo Argentino API
- external shipment creation
- real carrier labels
- real carrier tracking synchronization
- automatic abandoned-cart emails
- production email provider integration for recovery campaigns
- product CSV bulk import
- product CSV bulk export
- advanced analytics event tracking
- visit tracking
- marketing automation

The architecture must prepare adapters/interfaces for these systems, but Backend Core must not depend on them.

---

# 8. Backend Technology Stack

## Required

```text
Node.js
TypeScript
NestJS 11
NestJS Express adapter
REST
Zod
Prisma
PostgreSQL
Docker
Swagger / OpenAPI
```

## Frontend remains

```text
Next.js
React
TypeScript
Tailwind CSS
React Hook Form
Zod
Zustand
```

---

# 9. Architecture

EntrenAR Backend must be implemented as a **modular monolith**.

Microservices are explicitly out of scope for Backend Core.

Required application boundary and recommended structure:

```text
backend/
  package.json
  src/
    app.module.ts
    main.ts

    modules/
      auth/
      users/
      catalog/
        products/
        categories/
        inventory/
      wishlist/
      checkout/
      sales/
      purchase-orders/
      customers/
      discounts/
      payments/
      shipping/
      abandoned-carts/
      statistics/

    common/
      auth/
      database/
      errors/
      validation/
      logging/
      decorators/
      guards/
      interceptors/
      filters/
      utils/
```

Typical module:

```text
products/
  products.module.ts
  products.controller.ts
  products.service.ts
  products.repository.ts

  dto/
  schemas/
  domain/
  mappers/
```

---

# 10. Layer Responsibilities

## Controller

Responsible for:

- HTTP transport,
- route params,
- query params,
- authentication context,
- request parsing,
- calling services,
- returning DTOs.

Controllers must contain minimal business logic.

## Service

Responsible for:

- business rules,
- state transitions,
- authorization decisions where domain-specific,
- transactions,
- orchestration,
- invariant enforcement.

## Repository

Responsible for:

- Prisma queries,
- persistence,
- database-specific operations.

## Mapper

Responsible for:

- database/domain → frontend DTO,
- customer/public DTO projections,
- admin DTO projections.

---

# 11. Validation Strategy

EntrenAR already contains valuable Zod contracts.

Do not rewrite every validation rule in `class-validator`.

Use Zod as the primary request-contract validator.

Backend must implement a reusable NestJS Zod validation pipe or equivalent pattern.

Conceptually:

```text
Frontend RHF
   |
Zod schema
   |
Request
   |
Nest Zod validation
   |
Service
```

Where practical, contracts should be extracted into reusable/shared schemas without coupling backend domain code to React.

The backend must independently enforce all business-critical constraints even if equivalent validation exists on the client.

---

# 12. Authentication & Authorization

## 12.1 Roles

Minimum roles:

```text
CUSTOMER
ADMIN
```

The exact database representation may differ, but API behavior must support these roles.

## 12.2 Public account authentication

Backend Core must support:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
GET  /auth/me
```

Passwords:

- must never be stored plaintext,
- must use a modern password hashing algorithm,
- secrets must be server-only.

Refresh-token handling must be production-safe.

## 12.3 Admin security

The current frontend does not yet provide real Admin authentication.

Backend Core must still protect all administrative API endpoints.

All `/api/v1/admin/*` endpoints require backend-enforced `ADMIN` authorization. Next.js route protection is optional UX and is never a security boundary.

A seeded/configured admin account is acceptable for the first backend phase.

The project must not delay CRM API authorization merely because the current admin UI lacks a login screen.

---

# 13. User & Account Domain

Current frontend account concepts include:

```text
email
firstName
lastName
dni
gender
birthDate
phone
```

Backend must persist these fields.

Identity-number validators remain intentionally distinct during Backend Core:

- public account `dni`: current digits-only rule, 6–9 digits,
- CRM `dniOrCuil`: current normalized rule, 7–11 digits.

They MUST NOT be silently merged into one validator during backend migration.

## Addresses

Existing customer account behavior allows a maximum of:

```text
6 addresses per account
```

The server must enforce this limit.

Account address DTO must preserve current frontend expectations:

```text
id
label
recipient
street
city
province
postalCode
phone
```

Additional internal address normalization is allowed.

---

# 14. Product Domain

## 14.1 Single persisted source of truth

There must be one persistent product domain backing both:

- public ecommerce,
- CRM/Admin.

However, the API must expose different projections.

Example:

```text
Product domain
   |
   +--> Public ProductSummary
   +--> Public ProductDetail
   +--> AdminProduct
```

Do not force the public storefront and CRM to consume the same DTO.

---

# 15. Public Product Contract

Current public frontend concepts include:

```text
ProductSummary
ProductDetail
ProductVariantOption
ProductVariant
QuickBuyProduct
```

Important public product fields include:

```text
id
slug
name
brand
categorySlug
categoryName
imageTone / visual representation
shortDescription
tags
price
compareAtPrice
rating
reviews
stock
featured flags
subcategory slugs where currently expected
description
images
variantOptions
variants
```

Backend mappers must preserve equivalent response shapes required by existing components.

---

# 16. Admin Product Contract

The current CRM product representation includes:

```text
id
slug
publicSlug
name
description
sku
imageUrl
categoryId
categoryIds
categoryName
stock
salePrice
promotionalPrice
tags
brand
seoTitle
seoDescription
highlightSections
variantProperties
variantCombinations
shippingRequired
missingLogistics
weightGrams
heightCm
widthCm
lengthCm
manualOrder
visibility
salesCount
createdAt
updatedAt
```

The backend must preserve this behavior.

---

# 17. Product Validation Rules

Backend must enforce current product rules.

## Required rules

- name minimum 3 characters
- description minimum 10 characters
- at least one category
- sale price > 0
- promotional price optional
- promotional price must be strictly lower than sale price
- visibility:

```text
visible
hidden
```

- stock mode:

```text
limited
infinite
```

- limited stock must be an integer >= 0
- SEO title <= 70 chars
- SEO description <= 160 chars
- maximum 2 variant-property levels
- duplicate variant-property names are invalid
- logistics dimensions must be positive when supplied
- submitted variant combinations must exactly match the Cartesian product of active variant properties; stale or missing combinations are invalid

---

# 18. Product Slugs

Slug rules:

- normalized,
- lowercase,
- URL-safe,
- unique,
- collision-safe.

Expected collision behavior:

```text
whey-protein
whey-protein-2
whey-protein-3
```

Admin products persist both identifiers:

- `slug`: canonical Admin/CRM identifier,
- `publicSlug`: storefront-facing identifier used by `/productos/[publicSlug]`.

Both values MUST be unique and collision-safe in their respective namespaces. Product creation and duplication MUST use the same deterministic numeric-suffix strategy. Seed migration MUST reconcile accidental mock mismatches rather than preserving broken links.

Public URLs must continue to use:

```text
/productos/[slug]
```

or the exact currently implemented shop route contract.

CRM and public product URLs must not break after backend migration.

---

# 19. Product Duplication

Existing product duplication behavior must be preserved as implemented by the repository.

A duplicate must receive:

- a new product ID,
- a new unique slug,
- a new SKU,
- independent inventory,
- independent variant persistence,
- `salesCount = 0`,
- its own timestamps,
- a new manual-order position.

The backend must not accidentally share child records between original and duplicate products.

---

# 20. Category Domain

The current Admin/CRM category model supports recursive `parentId` relationships. The public storefront navigation model is currently flat.

Canonical concept:

```text
Category
  id
  parentId?
  parent?
  children[]
```

Do not model separate fixed concepts for:

```text
Category
Subcategory
Segment
```

Backend Core must support arbitrary hierarchical depth compatible with current `parentId` behavior.

Backend mappers MUST expose a recursive Admin/CRM projection and a flat public navigation projection.

---

# 21. Category Rules

Backend must preserve:

- unique slug generation,
- hierarchical parent relationships,
- cycle prevention,
- visibility,
- SEO metadata,
- description,
- optional image,
- optional Google Shopping category.

## Cycle prevention

Invalid:

```text
A -> B -> C -> A
```

A category may never be its own parent or descendant parent.

## Visibility

When hiding a category, current behavior affects descendants.

Backend must preserve the current cascade semantics.

Hiding a category MUST hide all descendants. Showing a parent MUST NOT implicitly show its descendants; each descendant retains its own visibility state.

## Deletion

Deleting a category currently deletes its entire descendant subtree in local state.

Backend must perform this operation safely and transactionally.

Backend deletion MUST fail with `CATEGORY_IN_USE` when any product references the target category or its descendants. Products must be reassigned before deletion so the product invariant of at least one category cannot be violated and dangling category IDs cannot be created.

---

# 22. Catalog Organization

The CRM includes manual category/catalog organization.

Backend Core must persist ordering information.

Do not leave organization only in Zustand.

Persist category ordering by stable category ID, never by category name. Persist the current catalog preference `showOutOfStockAtEnd` as a backend-managed setting when the organization screen migrates.

A stable ordering strategy may use:

```text
sortOrder
```

or equivalent persisted fields.

---

# 23. Inventory

Inventory must be authoritative server-side.

Supported states:

```text
limited(quantity)
infinite
```

Variants can maintain their own inventory.

Inventory mutations must not rely on client-provided resulting values.

The public DTO currently exposes numeric `stock`. Phase 0 MUST define and golden-test the mapper for internal `limited | infinite` inventory before catalog implementation; the database MUST NOT use a fake large quantity to represent infinite stock.

---

# 24. Inventory History

Backend Core must implement persistent inventory history.

Current conceptual display fields:

```text
id
productId
variantId?
productName
variantName?
change
resultingStock
origin
actor
reason?
type
createdAt
```

Current event types include at least:

```text
stock-edit
new-product
```

Additional internal event types may be added later.

Inventory modifications must produce history records atomically with the stock change.

Canonical persistence MUST store structured values: operation (`add | subtract | replace`), numeric delta where applicable, and nullable numeric resulting stock plus explicit infinite state. Human-readable strings such as `"∞"` remain mapper/UI concerns.

---

# 25. Wishlist

Wishlist must become persistent for authenticated customers.

Required operations:

```text
GET    /wishlist
POST   /wishlist/:productId
DELETE /wishlist/:productId
```

Server must prevent duplicate wishlist entries.

Guest wishlist behavior may remain local if currently supported.

---

# 26. Cart Strategy

The current guest cart is local Zustand state.

Backend Core does **not** require moving the entire guest cart to persistent server storage.

Current behavior should remain compatible:

```text
Cart line identity:
(productId, variantId)
```

The frontend may continue to locally:

- add items,
- merge same variant,
- update quantity,
- remove,
- clear.

However, the browser must not be authoritative for final prices or stock.

---

# 27. Checkout Quote

Backend Core must implement a server-authoritative checkout quote.

Conceptual endpoint:

```text
POST /checkout/quote
```

Input may contain:

```text
productId
variantId?
quantity
postal code / delivery data
shipping selection
coupon code?
```

The backend must re-read:

- product existence,
- variant existence,
- visibility,
- current prices,
- promotional prices,
- current stock,
- active coupon rules,
- current shipping configuration,
- pickup availability,
- payment configuration where relevant.

The browser-provided total must never be trusted.

Response should provide:

```text
items
subtotal
discount
shipping
total
available shipping options
applicable pickup points
coupon result
warnings/errors
```

---

# 28. Checkout Session

Backend Core must create a persistent checkout session once a user meaningfully begins checkout.

This session provides the foundation for:

- abandoned carts,
- recovery,
- final order creation,
- server-side quote continuity.

Conceptual states:

```text
active
completed
abandoned
```

Exact names may be chosen internally if DTO compatibility is preserved.

---

# 29. Checkout Flow Compatibility

Current checkout has three user-facing stages:

```text
identification
delivery
payment
```

Backend integration must preserve that frontend flow.

The backend must not force a redesigned checkout wizard.

---

# 30. Checkout Payment Methods

Current checkout publicly supports:

```text
mercado-pago
stripe
bank-transfer
```

The CRM additionally configures:

```text
payway
```

Backend Core must not silently add Payway to the public checkout until the public frontend contract is explicitly extended.

Backend Core must persist Payway configuration but public checkout compatibility remains limited to currently supported payment method IDs.

---

# 31. Bank Transfer

Bank transfer configuration must persist:

```text
cbuCvu
alias
holderName
cuitCuil
bankName
```

Validation must preserve the existing rules, including:

- CBU/CVU exactly 22 digits,
- required alias,
- valid holder name characters,
- CUIT/CUIL exactly 11 digits, with optional display formatting `XX-XXXXXXXX-X`,
- required bank/wallet name.

Checkout must stop using hardcoded bank transfer data and read the active CRM configuration.

---

# 32. Payment Provider Configuration

Provider IDs:

```text
bank-transfer
mercado-pago
stripe
payway
```

Provider status:

```text
active
inactive
```

Persisted configuration should contain:

```text
providerId
status
selectedOptionId?
bankConfig?
updatedAt
```

`updatedAt` is a backend-added field that does not yet exist in the local Zustand configuration contract. API migration MUST add it to the frontend DTO without removing existing fields.

Provider definitions and fee options are fixed system definitions during Backend Core.

Do not implement editable fee tables unless the frontend later requires it.

---

# 33. Payment Provider Definitions

Current fixed options include conceptual IDs such as:

```text
direct-transfer
mp-instant
mp-10-days
mp-18-days
stripe-eea-standard
payway-debit
payway-credit-instant
payway-credit-8-business-days
```

These may live as backend constants/configuration.

Backend Core should validate that a persisted `selectedOptionId` belongs to the provider.

---

# 34. Payment Integrations — Post-Core

Prepare a provider interface only.

Example:

```ts
interface PaymentProvider {
  createPayment(...): Promise<...>;
  getPayment(...): Promise<...>;
  handleWebhook(...): Promise<...>;
  refund(...): Promise<...>;
}
```

Future implementations:

```text
MercadoPagoProvider
StripeProvider
PaywayProvider
```

No real provider call is required for Backend Core.

---

# 35. Internal Shipping Configuration

Shipping rate calculation in Backend Core is owned by EntrenAR.

Do not depend on carrier APIs for prices.

Provider IDs:

```text
andreani
correo-argentino
```

Configuration status:

```text
not_configured
configured_inactive
active
```

The lifecycle is `not_configured -> configured_inactive <-> active`. Once valid configuration is saved, a provider MUST NOT return to `not_configured` unless it is explicitly reset by a future administrative operation.

Modalities:

```text
home_delivery
branch_delivery
```

---

# 36. Shipping Provider Configuration

Each configured provider includes:

```text
id
name
status
enabledModalities

origin:
  senderName
  phone
  email
  street
  number
  city
  province
  postalCode

weightRanges
freeShippingThreshold?
updatedAt
```

The server must preserve these validation rules.

When present, `freeShippingThreshold` MUST be greater than zero.

---

# 37. Shipping Weight Ranges

Backend Core must support the current fixed weight bands:

```text
0–1kg
1–3kg
3–5kg
5–10kg
10kg+
```

Current seed costs:

```text
0–1kg        7500
1–3kg       10500
3–5kg       15000
5–10kg      22000
10kg+       30000
```

The limits are fixed in the current version.

The configured cost is mutable.

Canonical fixed range IDs are:

```text
range-up-to-1kg
range-1kg-to-3kg
range-3kg-to-5kg
range-5kg-to-10kg
range-over-10kg
```

The `10kg+` range is open-ended and MUST use a nullable upper bound internally rather than the frontend placeholder `999999`.

Backend must ensure:

- full range set exists,
- ranges do not overlap,
- max > min,
- current fixed boundaries are preserved.

---

# 38. Shipping Quote Engine

Backend Core must calculate shipping internally.

Conceptual flow:

```text
checkout items
   |
total shipment weight
   |
active provider / modality
   |
matching configured weight range
   |
configured shipping price
   |
free shipping threshold?
   |
discount rules?
   |
shipping quote
```

Shipping cost must never be accepted blindly from the frontend.

---

# 39. Pickup Points

Pickup points must persist.

Contract includes:

```text
id
name
status
isMain

address:
  street
  number
  city
  province
  postalCode

contactName?
contactPhone?

schedule[]

preparationHours

costType:
  free
  fixed

fixedCost?

coverageType:
  all
  provinces

provinces[]
updatedAt?
```

---

# 40. Pickup Validation

Backend must enforce:

- at least one schedule range,
- closing time later than opening time,
- no overlapping ranges on the same day,
- fixed cost required when `costType = fixed`,
- at least one province when `coverageType = provinces`.

Checkout must return only active pickup points compatible with the customer/location.

At most one pickup point may have `isMain = true`; selecting a new main pickup point MUST unset the previous one transactionally.

For Backend Core, compatibility means:

```text
status = active
AND
(coverageType = all OR customer province is included in provinces)
```

Postal-code-level pickup filtering is not part of Backend Core. The frontend MUST use the canonical 24-province Argentina list when editing coverage.

---

# 41. Default Pickup Seed

Backend initial seed must include the current conceptual default:

```text
id: retiro-principal
name: Punto de retiro principal
status: not_configured
isMain: true
preparationHours: 24
costType: free
coverageType: all
```

Address and schedule begin unconfigured.

---

# 42. Shipping Carrier Integrations — Post-Core

Prepare an interface:

```ts
interface ShippingProvider {
  createShipment(...): Promise<...>;
  getLabel(...): Promise<...>;
  getTracking(...): Promise<...>;
}
```

Future implementations:

```text
AndreaniProvider
CorreoArgentinoProvider
```

Carrier integrations must not participate in Backend Core shipping-price calculation.

---

# 43. Coupon Domain

Coupon status:

```text
active
inactive
```

Discount types:

```text
percentage
fixed
free_shipping
```

Target:

```text
all_store
categories
products
```

Total usage limit:

```text
unlimited
limited
```

Customer limit:

```text
unlimited
limited
first_purchase
```

Date limit:

```text
unlimited
period
```

Maximum discount:

```text
none
amount
```

---

# 44. Coupon Fields

Backend must persist:

```text
id
code
discountType
discountValue?
includeShippingCost
targetType
categoryIds
productIds
canCombineWithPromotions

totalUsageLimitType
totalUsageLimit?
usageCount

customerLimitType
customerUsageLimit?

dateLimitType
startDate?
endDate?

minimumCartAmount

maxDiscountType
maxDiscountAmount?

status
createdAt
updatedAt
history
```

---

# 45. Coupon Code Rules

Server must enforce:

- required,
- trim,
- uppercase,
- no spaces,
- only letters/numbers/hyphens,
- globally unique among active/non-deleted coupon records as appropriate,
- editable after creation.

Uniqueness must be enforced at database level where possible.

---

# 46. Coupon Validation

Backend checkout validation must evaluate:

- active status,
- validity period,
- minimum cart,
- target categories/products,
- total usage limit,
- customer usage limit,
- first-purchase condition,
- promotion combination behavior,
- max discount amount,
- include-shipping behavior,
- free shipping behavior.

`first_purchase` means the authenticated customer has zero prior non-cancelled, payment-received orders. Anonymous customers cannot redeem first-purchase coupons unless an approved identity strategy is added later.

Coupon redemption counting must be transaction-safe.

---

# 47. Coupon History

Coupon history actions:

```text
created
activated
deactivated
updated
```

Persist:

```text
id
action
label
userName / actor identity
createdAt
```

Backend must append history atomically with the mutation.

Coupons MUST use soft deletion so historical redemptions and audit history remain valid. Deleted coupons are unavailable for checkout and code uniqueness follows the explicitly documented active/non-deleted policy.

---

# 48. Shipping Discounts

Shipping discounts are a separate domain from coupons.

Persist:

```text
id
shippingMethodIds
onlyCheapestShippingMethod

targetType:
  all_store
  categories

categoryIds

canCombineWithPromotions

zoneTargetType:
  all
  specific

zoneIds

minimumCartAmount

status

createdAt
updatedAt
```

Backend must validate:

- at least one shipping method,
- category selection when category-targeted,
- zone selection when zone-targeted.

`shippingMethodIds` use the stable composite form `{providerId}:{service-slug}`. The backend MUST resolve and validate these IDs against fixed provider service definitions.

Shipping discounts have no redemption counter or history aggregate in Backend Core. They SHOULD use soft deletion when referenced by historical checkout/order snapshots.

---

# 49. Sales Domain

CRM sales must be a persistent domain aggregate.

Payment status contract:

```text
pending
received
cancelled
refunded
```

Shipping status contract:

```text
to_pack
to_ship
shipped
delivered
pickup
cancelled
```

Do not introduce `packed` as a shipping-status enum.

---

# 50. Sale Core Fields

Current conceptual sale DTO:

```text
id
number
customerId?
createdAt
source?
customer
shippingAddress?
products
paymentStatus
paymentMethodId?
shippingStatus
subtotal
discountType?
discountValue?
shippingCost
total
archived
cancellationReason?
previousPaymentStatus?
previousShippingStatus?
notes?
history
sourceOrderId?
trackingCode?
```

Order/sale items must be snapshots.

---

# 51. Sale Product Snapshot

Persist at least:

```text
productId
variantId?
name
quantity
unitPrice
```

Changing a product later must not alter historical orders.

Additional snapshot values may be stored internally.

---

# 52. Sale State Transitions

Current enums and user-facing behavior are the baseline, subject to the explicit audited corrections below.

## Create sale

Initial shipping status:

```text
to_pack
```

Payment:

```text
pending
or
received
```

Creating a sale MUST deduct limited inventory atomically, including when payment is still pending. Creating a purchase order does not deduct inventory until conversion creates the sale. This intentionally replaces the mock store's `stock_reserved` event-only behavior and prevents overselling.

## Pack

```text
to_pack -> to_ship
```

Append:

```text
package_packed
```

## Unpack

```text
to_ship -> to_pack
```

Append:

```text
package_unpacked
```

## Ship

```text
to_ship -> shipped
```

Append:

```text
package_shipped
```

## Deliver shipment

```text
shipped -> delivered
```

Append `package_delivered`.

## Ready for pickup

```text
to_pack -> pickup
```

Append `pickup_ready`.

## Complete pickup

```text
pickup -> delivered
```

Append `pickup_completed`.

The current frontend does not yet expose these three commands. Phase 6 MUST add compatible CRM controls when migrating the sale detail flow.

## Receive payment

```text
pending -> received
```

Receiving payment MUST append `payment_received` but MUST NOT deduct inventory a second time because sale creation already performed the deduction.

---

# 53. Sale Cancellation

Cancelling a sale must:

- persist cancellation reason,
- store previous payment status,
- store previous shipping status,
- set both payment and shipping status to `cancelled`,
- optionally restore inventory,
- append history events.

Reopening must restore the previous saved statuses.

This operation must be transactional.

---

# 54. Reopening Sales

Concept:

```text
cancelled
  |
reopen
  |
previousPaymentStatus
previousShippingStatus
```

After reopening:

- previous-status temporary fields may be cleared,
- cancellation reason may be cleared,
- `sale_reopened` history event must be appended.

---

# 55. Refunded State

`refunded` is an internal/manual CRM state in Backend Core.

Backend Core does not perform provider refunds.

The system only stores the status and related history.

Real refund provider actions are post-Core.

---

# 56. Sale Archive

Archiving is not deletion.

Backend must preserve the current archiving rules.

Only eligible sales may be archived.

Current logic allows archive according to status conditions such as:

- cancelled,
- refunded,
- delivered and payment received,

as represented by the existing helper logic.

Backend must reject invalid archive attempts.

---

# 57. Sale Editability

Backend must enforce the domain equivalent of current editability rules.

Current frontend marks sales non-editable when, among other cases:

```text
shippingStatus in:
  to_ship
  shipped
  delivered
  cancelled
```

or:

```text
paymentStatus = cancelled
```

or:

```text
archived = true
```

Do not rely only on disabled frontend controls.

---

# 58. Sale History

Current event vocabulary:

```text
sale_created
sale_updated
sale_cancelled
sale_reopened
sale_archived
payment_received
package_packed
package_unpacked
package_shipped
email_sent
email_failed
stock_reserved
stock_deducted
stock_restored
shipping_address_updated
order_converted
package_delivered
pickup_ready
pickup_completed
```

Backend Core should preserve this vocabulary.

`stock_reserved` is retained for compatibility with seeded historical events, but new Backend Core sale creation uses `stock_deducted` according to the authoritative inventory rule above.

Sale history is persistent audit data.

---

# 59. Sale Visible Numbers

Current CRM uses user-visible sale numbers similar to:

```text
101
#101
```

Backend may use UUID/CUID internal PKs, but the visible sale number contract must remain stable.

Recommended internal separation:

```text
id        -> internal database ID
number    -> public/admin business number
```

Existing mock sale IDs become initial visible numbers during seed migration. New visible numbers MUST be allocated by a database sequence or equivalent concurrency-safe mechanism, never by `MAX(id) + 1` in application memory.

---

# 60. Purchase Orders

Purchase orders are a separate lifecycle from sales.

Status:

```text
pending
converted
cancelled
```

Fields include:

```text
id
customerId?
createdAt
source?
customer
shippingAddress?
products
status
subtotal
discountType?
discountValue?
shippingCost
total
notes?
history
convertedSaleId?
```

---

# 61. Purchase Order IDs

Visible format must remain compatible with:

```text
OC-{YEAR}-{6 DIGITS}
```

Example:

```text
OC-2026-483921
```

A separate internal PK may still be used.

Purchase-order business IDs MUST be unique under concurrency. Random client-side generation is not acceptable; use a database-backed sequence or collision-safe server generator with a unique constraint and retry.

---

# 62. Purchase Order Conversion

Backend must support:

```text
PurchaseOrder
   |
convert
   v
Sale
```

On conversion:

- create sale,
- propagate `customerId` when the source order belongs to a persisted customer,
- link sale to source order,
- mark purchase order `converted`,
- store `convertedSaleId`,
- store `sourceOrderId` on sale,
- append `order_converted`,
- perform inventory/state updates transactionally.

The operation must be idempotent or protected against duplicate conversion.

---

# 63. Orders from Public Checkout

The relationship between customer checkout and CRM must be coherent.

Expected end-to-end behavior:

```text
Customer checkout
      |
server validates quote
      |
creates commerce order / purchase order
      |
CRM receives corresponding record
      |
payment/operational state determines
whether it belongs in Purchase Orders or Sales
```

The exact persistence model may use shared order tables internally, but public and CRM DTOs must preserve current conceptual separation.

---

# 64. Public Account Order Status Mapping

Public account currently expects:

```text
preparacion
en-camino
entregado
```

CRM uses:

```text
to_pack
to_ship
shipped
delivered
pickup
cancelled
```

Do not merge these enums.

Use a mapper.

Conceptual mapping:

```text
to_pack  -> preparacion
to_ship  -> preparacion
shipped  -> en-camino
delivered -> entregado
```

Pickup and cancelled states must be mapped according to the current/approved public UX.

Backend Core approves these additive public states and mappings:

```text
pickup    -> listo-para-retirar
cancelled -> cancelado
```

The account order UI and `AccountOrderStatus` type MUST add these values during the account/order migration.

---

# 65. Customers CRM

Customer contract includes:

```text
id
fullName
email
phone?
dniOrCuil?
firstInteractionDate
address?
notes?
isAnonymized
createdAt
updatedAt
```

Summary:

```text
totalSpent
ordersCount
lastOrder?
```

`totalSpent`, `ordersCount`, and `lastOrder` include payment-received, non-cancelled, non-refunded sales only.

---

# 66. Customer Address

CRM customer address contains:

```text
street
number
floorOrApartment?
postalCode
neighborhood?
city
provinceOrState
country
```

Address is optional.

If address data is provided, backend must enforce the same minimum required-address semantics as the frontend schema.

---

# 67. Customer Email Uniqueness

Current behavior:

- active customers cannot share the same normalized email,
- anonymized customers do not block reuse of their prior email,
- email comparison is case-insensitive.

Backend must enforce this invariant safely under concurrency.

---

# 68. Customer Anonymization

Customer deletion in CRM is not hard deletion.

It is anonymization.

Backend must:

- preserve historical transactions,
- preserve totals,
- preserve sale IDs,
- preserve products,
- preserve sale status/history,
- remove personal data.

Anonymized customer becomes conceptually:

```text
fullName: Cliente eliminado ({id})
email: ""
phone: null
dniOrCuil: null
address: null
notes: null
isAnonymized: true
```

Related sale customer snapshots containing PII must be anonymized according to the existing CRM behavior.

This must run transactionally.

An anonymized customer cannot be edited.

---

# 69. Customer Export

The customer detail UI exposes data export.

Backend Core should support a real customer export.

CSV is acceptable if compatible with the UI.

Export must not accidentally expose:

- password hashes,
- refresh tokens,
- internal secrets,
- unrelated customers.

---

# 70. Abandoned Carts

Backend Core must persist abandoned checkout sessions/cart snapshots sufficient to power the CRM.

Recovery status:

```text
pending
sent
manual
recovered
```

Fields include conceptually:

```text
id
abandonedAt
customer
products
total
recoveryStatus
lastEmailSentAt?
```

---

# 71. Recovery Configuration

Persist recovery configuration.

Timing values:

```text
6hs
24hs
3_days
7_days
14_days
manual
```

Configuration:

```text
timing
isActive
```

---

# 72. Recovery Email Template

Persist:

```text
subject
htmlBody
plainTextBody
```

Backend Core does not need to send real automated emails.

Current simulated send/manual behaviors may become backend state mutations.

Actual scheduled email delivery is post-Core.

---

# 73. Statistics

Statistics pages must gradually move from mock data to backend aggregates.

Backend should calculate aggregates server-side rather than sending entire transactional datasets for browser aggregation.

Suggested API:

```text
GET /admin/statistics/overview
GET /admin/statistics/sales
GET /admin/statistics/products
GET /admin/statistics/customers
GET /admin/statistics/coupons
```

Support:

```text
from
to
```

or equivalent period filters.

---

# 74. Statistics Data Sources

Backend Core can provide real metrics derived from persisted data for:

- revenue,
- sales,
- average ticket,
- product sales,
- customer purchases,
- coupon usage,
- payment-method distribution,
- order status,
- inventory-related metrics.

Canonical aggregate rules:

- revenue: sum of totals from payment-received, non-cancelled, non-refunded sales in the requested period,
- average ticket: revenue divided by the count of those qualifying sales,
- top customers: qualifying revenue grouped by customer,
- province distribution: qualifying sales grouped by shipping-address province,
- payment-method distribution: qualifying sales grouped by the payment method snapshot stored on the sale.

Sale/order snapshots MUST therefore include `paymentMethodId` when known.

---

# 75. Visit Analytics

Current visit statistics do not have a real tracking source.

Therefore:

```text
visits
unique visitors
traffic analytics
```

remain mock/unavailable until an explicit tracking subsystem exists.

Do not fabricate these metrics from order data.

Visit tracking is post-Core.

---

# 76. Money Representation

Current frontend numeric money values represent ARS amounts directly.

Example:

```text
52900
```

means:

```text
ARS $52,900
```

Do not reinterpret existing values as minor units.

Recommended PostgreSQL storage:

```text
NUMERIC(12,2)
```

Recommended Prisma handling:

```text
Decimal
```

API mappers must return JavaScript numbers/string representation compatible with current frontend contracts.

Any Decimal → number conversion must be deliberate and tested.

---

# 77. IDs

Preserve existing mock IDs during seed where practical.

Examples include patterns such as:

```text
prod-*
cat-*
cus_***
retiro-principal
```

New production records may use UUID/CUID internally.

Where the UI displays a business identifier, separate it from the internal PK.

---

# 78. API Versioning

Use:

```text
/api/v1
```

Base examples:

```text
/api/v1/auth
/api/v1/account
/api/v1/products
/api/v1/categories
/api/v1/wishlist
/api/v1/checkout

/api/v1/admin/products
/api/v1/admin/categories
/api/v1/admin/inventory
/api/v1/admin/sales
/api/v1/admin/purchase-orders
/api/v1/admin/customers
/api/v1/admin/discounts
/api/v1/admin/payment-methods
/api/v1/admin/shipping
/api/v1/admin/pickup-points
/api/v1/admin/abandoned-carts
/api/v1/admin/statistics
```

Exact endpoint names may be refined during contract audit.

---

# 79. Command-style Endpoints

For domain transitions, prefer explicit commands over generic status patching.

Good:

```text
POST /admin/sales/:id/cancel
POST /admin/sales/:id/reopen
POST /admin/sales/:id/mark-payment-received
POST /admin/sales/:id/pack
POST /admin/sales/:id/unpack
POST /admin/sales/:id/ship
POST /admin/sales/:id/archive
POST /admin/purchase-orders/:id/convert
POST /admin/customers/:id/anonymize
```

Avoid:

```text
PATCH /sale/:id { status: "whatever" }
```

for protected domain transitions.

---

# 80. Error Contract

Use structured errors.

Example:

```json
{
  "ok": false,
  "code": "COUPON_CODE_ALREADY_EXISTS",
  "message": "Ya existe un cupón con ese código.",
  "field": "code",
  "issues": []
}
```

Base error codes should include:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
EMAIL_EXISTS
OUT_OF_STOCK
INVALID_STATE_TRANSITION
COUPON_NOT_VALID
COUPON_USAGE_LIMIT_REACHED
SHIPPING_OPTION_UNAVAILABLE
INTERNAL_ERROR
```

Frontend-friendly field-level errors should be supported.

---

# 81. Transactions

Database transactions are mandatory for multi-record domain mutations.

Examples:

- order creation + items,
- purchase-order conversion,
- stock mutation + inventory history,
- sale cancellation + stock restoration + history,
- product duplication + variants,
- product creation + variants,
- category subtree deletion,
- customer anonymization + sale anonymization,
- coupon redemption + usage counters,
- sale state transitions.

---

# 82. Concurrency

Backend must defend against:

- two customers buying final stock simultaneously,
- concurrent coupon usage,
- duplicate coupon codes,
- duplicate product slugs,
- duplicate customer emails,
- converting the same purchase order twice,
- invalid parallel sale state transitions.

Frontend validation is not enough.

---

# 83. Security Baseline

Backend Core must include:

- password hashing,
- JWT/session authentication,
- refresh-token safety,
- Admin authorization,
- route guards,
- request validation,
- payload limits,
- CORS allowlist,
- security headers,
- rate limiting for sensitive endpoints,
- secret isolation,
- safe error responses,
- no production stack traces,
- structured logging,
- no password/token logging.

---

# 84. Auditability

Important CRM mutations must retain an actor when meaningful.

Examples:

```text
sale history
coupon history
inventory history
customer anonymization
```

Actor data should be derived server-side from authentication.

Do not trust user-supplied actor names.

---

# 85. Logging

Use structured backend logs.

Include:

```text
requestId
route
method
statusCode
duration
userId?
adminId?
errorCode?
```

Never log:

- passwords,
- refresh tokens,
- raw authorization headers,
- sensitive payment credentials.

---

# 86. Swagger / OpenAPI

NestJS Swagger must document the API.

Backend Core should expose development documentation.

OpenAPI is not the source of truth over frontend Zod contracts, but must accurately reflect the implemented REST API.

---

# 87. Database Migrations

Use Prisma migrations.

Required:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/**
```

Do not use `prisma db push` as the production deployment workflow.

Schema changes must be versioned.

---

# 88. Seed Strategy

Existing mocks should become deterministic development seed data.

Create:

```text
backend/prisma/seed.ts
```

Seed should include representative:

- products,
- categories,
- variants,
- customers,
- sales,
- purchase orders,
- payment configurations,
- shipping configurations,
- default pickup point,
- abandoned carts where useful.

Preserve existing IDs/slugs where they are useful for frontend compatibility.

Seed must be repeatable/idempotent where practical.

---

# 89. Mock-to-API Frontend Migration

Do not replace every store at once.

Use a progressive domain migration.

Current:

```text
Component
   |
Zustand
   |
Mock data
```

Target:

```text
Component
   |
Frontend service/repository
   |
REST API
```

Zustand may remain for:

- UI state,
- filters,
- open/closed drawers,
- local selections,
- optimistic UI where appropriate,
- guest cart state.

It must stop being the persistent source of truth for migrated domains.

The current route boundaries are part of compatibility:

- public shop under `(shop)`,
- cart and checkout under `(checkout)` with `/carrito` and `/checkout`,
- Admin/CRM under `(admin)`,
- authentication currently presented through the shop account drawer.

Backend authentication endpoints are implemented before any optional migration to a dedicated `(auth)` UI route group.

---

# 90. Frontend Repository Layer

Introduce domain-facing frontend adapters.

Example:

```ts
interface ProductsRepository {
  list(...): Promise<AdminProduct[]>;
  getById(id: string): Promise<AdminProduct>;
  create(...): Promise<AdminProduct>;
}
```

Temporary implementations:

```text
MockProductsRepository
ApiProductsRepository
```

Use this pattern where it materially reduces migration risk.

Do not scatter direct `fetch()` calls through components.

---

# 91. Temporary Mock/API Feature Flag

During migration, a development-only switch may be used:

```text
DATA_SOURCE=mock
DATA_SOURCE=api
```

or equivalent.

This is temporary.

It must be removed when Backend Core migration is complete.

---

# 92. Compatibility / Golden Tests

Create contract tests that compare representative seeded API responses against current frontend expectations.

Examples:

- ProductDetail
- AdminProduct
- Customer
- AdminSale
- Coupon
- ShippingProviderConfig
- PickupPoint

Purpose:

```text
mock contract
      ==
API contract
```

for the fields that existing frontend components consume.

---

# 93. Backend Core Implementation Roadmap

## Phase 0 — Contract Freeze

Before implementing `schema.prisma`:

1. inventory existing frontend types,
2. inventory Zod schemas,
3. inventory Zustand stores/actions,
4. inventory mock files,
5. document enums,
6. document IDs,
7. document state transitions,
8. document DTO shapes,
9. document frontend validation,
10. document cross-domain relationships,
11. identify contradictions,
12. decide compatibility resolutions explicitly.

Deliverables:

```text
openspec/reference/backend/frontend-contracts.md
openspec/reference/backend/domain-map.md
openspec/reference/backend/mock-data-inventory.md
openspec/reference/backend/proposed-er-model.md
openspec/reference/backend/api-contract-map.md
```

No final Prisma model before this phase is complete.

---

# 94. Phase 1 — Backend Foundation

Implement:

- standalone NestJS app under `backend/`
- `backend/package.json` and backend scripts
- config module
- PostgreSQL
- Prisma
- migrations
- Zod validation pipe
- error filter
- logging
- health endpoint
- Swagger
- JWT authentication
- refresh flow
- CUSTOMER/ADMIN roles
- seeded admin
- Docker
- test infrastructure

Acceptance:

```text
API starts
DB migrates
seed works
auth works
Admin routes protected
health endpoint works
backend typecheck passes
backend test command exists and passes a smoke test
prisma generate succeeds
```

---

# 95. Phase 2 — Catalog

Implement:

- Product
- ProductVariant
- ProductVariantProperty as appropriate
- Category tree
- Catalog ordering
- Inventory
- InventoryHistory
- public product DTOs
- CRM product DTOs
- slug handling
- duplicate product
- category visibility
- category deletion semantics

Then migrate:

```text
admin products
admin categories
admin inventory
public catalog
public product detail
```

---

# 96. Phase 3 — Customer Account

Implement:

- User
- account profile
- addresses
- wishlist
- password operations
- `/auth/me`
- account order DTO skeleton

Migrate current persisted browser profile/address data flows to API.

Guest cart remains local.

---

# 97. Phase 4 — Commerce Configuration

Implement:

- payment-provider configuration
- bank-transfer configuration
- shipping-provider configuration
- internal shipping pricing
- pickup points
- coupons
- coupon history
- shipping discounts

Migrate corresponding CRM screens from Zustand to API.

---

# 98. Phase 5 — Checkout

Implement:

- server checkout quote
- stock validation
- current price validation
- coupon validation
- shipping calculation
- pickup availability
- active payment-method exposure
- CheckoutSession
- checkout completion
- creation of persistent order/purchase-order/sale according to flow

At this phase checkout becomes server-authoritative.

This phase MUST replace hardcoded checkout payment methods, shipping providers, pickup points, bank-transfer instructions, coupon behavior, and free-shipping threshold with API-backed quote/configuration data.

---

# 99. Phase 6 — Sales CRM

Implement:

- Sales
- SaleItems
- SaleHistory
- state transition commands
- cancel/reopen
- archive
- payment status
- logistics status
- delivered and pickup command controls missing from the current frontend
- sale-creation inventory deduction and payment no-double-deduction rules
- inventory interaction
- PurchaseOrders
- purchase-order conversion

Migrate:

```text
Listado de Ventas
Ordenes de Compra
Archivados
sale detail
sale edit flows
```

---

# 100. Phase 7 — Customers CRM

Implement/migrate:

- customers list
- customer detail
- customer create/edit
- customer notes
- customer sales summaries
- export
- anonymization

Ensure account/user vs CRM customer relationships are defined explicitly.

---

# 101. Phase 8 — Abandoned Carts

Implement:

- CheckoutSession abandonment
- AbandonedCart projection/domain
- recovery status
- recovery config
- recovery template
- manual recovery state
- simulated send state

No real automated email required.

---

# 102. Phase 9 — Statistics

Replace transaction-derived statistics mocks with backend aggregates.

Implement:

- overview
- sales/customer stats
- product stats
- coupon reports

Visits remain mock/unavailable until tracking exists.

---

# 103. Phase 10 — Mock Removal

For each migrated module:

1. DB model complete,
2. migration exists,
3. seed exists,
4. endpoints complete,
5. backend validation complete,
6. DTO mapper complete,
7. frontend repository switched,
8. loading/error/empty states verified,
9. contract tests passing,
10. persistence verified after restart.

Only then delete the corresponding mock source.

Do not perform a global mock cleanup before all domains are migrated.

---

# 104. Post-Core Phase — External Integrations

Only after Backend Core acceptance.

Recommended order:

```text
1. transactional email infrastructure
2. Mercado Pago
3. Stripe
4. Payway
5. Andreani
6. Correo Argentino
7. automated abandoned-cart recovery
8. product bulk import/export
9. visit analytics/tracking
```

This order may change according to business priority.

---

# 105. Deployment

Recommended production topology:

```text
Frontend
Next.js
Vercel

Backend
NestJS
Docker
VPS
source: backend/

Database
PostgreSQL
Docker / managed PostgreSQL
```

Required backend infrastructure:

```text
backend/Dockerfile
backend/.env.example
production environment variables
migration command
health endpoint
restart policy
reverse proxy / TLS architecture
```

---

# 106. Environment Variables

At minimum:

```text
NODE_ENV
PORT
DATABASE_URL

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET

FRONTEND_URL
CORS_ORIGINS
```

Additional integration variables must not be introduced until their integration phase unless required for infrastructure.

No real secrets in repository.

---

# 107. Testing Strategy

The repository currently has no configured test runner. Phase 1 MUST establish backend test infrastructure before domain implementation.

## Unit tests

Focus on domain rules:

- coupon calculation,
- coupon limits,
- sale transitions,
- category cycle detection,
- shipping range selection,
- stock logic,
- order totals,
- anonymization.

## Integration tests

Use real test PostgreSQL where practical.

Test:

- repository persistence,
- transactions,
- uniqueness,
- concurrency-sensitive mutations.

## E2E tests

Minimum Backend Core scenarios:

```text
auth
create product
checkout quote
create order
sale appears in CRM
sale state transition
customer order appears
coupon application
shipping calculation
anonymization
```

---

# 108. Acceptance Criteria — Compatibility

Backend Core is accepted only if existing frontend behavior remains compatible.

Must continue working:

- current routes,
- current forms,
- current drawers,
- current modals,
- current toasts,
- current filters,
- current tables,
- current empty states,
- current save/dirty behavior,
- current product public URLs,
- current IDs where visible,
- current enum semantics,
- current sale transitions,
- current coupon rules,
- current shipping configuration flows.

---

# 109. Acceptance Criteria — Persistence

After a migrated mutation:

```text
refresh browser
restart frontend
restart backend
```

the data must remain correct.

Examples:

- created product still exists,
- edited price remains,
- stock remains,
- customer remains,
- sale remains,
- coupon remains,
- payment config remains,
- shipping config remains.

---

# 110. Acceptance Criteria — Cross-Domain Consistency

The same data must flow through the system.

Example:

```text
Admin creates/updates Product
        |
public catalog sees Product
        |
customer adds variant
        |
server checkout quote validates Product
        |
order created
        |
inventory updated
        |
customer account sees order
        |
CRM sees corresponding sale/order
        |
fulfillment status changes
        |
customer-facing status changes through mapper
        |
statistics reflect transaction
```

---

# 111. Definition of Done — Backend Core

Backend Core is complete when this flow works end-to-end without mocks as persistent business state:

```text
ADMIN
 |
creates/edits product
 |
PUBLIC SHOP
 |
customer authenticates
 |
local cart
 |
server checkout quote
 |
active shipping/pickup config
 |
active supported payment config
 |
coupon/discount rules
 |
checkout completed
 |
persistent order/purchase order/sale
 |
transactional inventory update
 |
customer account order history
 |
CRM sale/order
 |
payment + shipping progression
 |
sale history
 |
customer sales summary
 |
statistics aggregate transaction
```

A backend restart must not affect persisted state.

---

# 112. Non-Goals

Backend Core must not:

- redesign EntrenAR UI,
- replace Next.js,
- move frontend components into NestJS,
- introduce GraphQL,
- introduce microservices,
- introduce event sourcing,
- introduce CQRS without a proven need,
- rewrite the CRM,
- rebuild forms,
- change domain enum names for style reasons,
- implement carrier APIs,
- implement payment APIs,
- implement real refunds,
- implement visit tracking.

---

# 113. Architecture Constraints for Agents

Agents implementing the backend must follow these rules:

1. **Do not invent new frontend contracts when existing contracts exist.**
2. **Do not use `prisma/layoutschema.prisma` as canonical.**
3. **Do not expose Prisma models directly.**
4. **Do not put business logic inside controllers.**
5. **Do not bypass services for writes.**
6. **Do not trust frontend totals, stock, actor names or statuses.**
7. **Do not change existing enums without documenting a migration.**
8. **Do not replace all Zustand stores in one PR.**
9. **Do not remove mocks before API parity exists.**
10. **Do not implement external integrations during Backend Core.**
11. **Prefer explicit domain commands for state changes.**
12. **Preserve Zod business rules.**
13. **Use transactions for multi-record business operations.**
14. **Use DTO mappers for public vs CRM representations.**
15. **Document every contract conflict found during Phase 0.**

---

# 114. Audited Contract Conflicts and Resolutions

The repository already reveals some areas that must be explicitly consolidated.

## 114.1 Public vs CRM product shapes

They are intentionally different.

Resolution:

```text
one domain
multiple DTOs
```

## 114.2 `slug` vs `publicSlug`

Current CRM contains both.

Resolution: persist `slug` as the Admin/CRM identifier and `publicSlug` as the storefront identifier. Enforce uniqueness in both namespaces and preserve frontend behavior via mappers.

## 114.3 Payway

CRM supports Payway.

Public checkout currently does not.

Resolution for Core:

```text
persist configuration
do not expose in checkout until UI supports it
```

## 114.4 Public order statuses vs CRM statuses

Do not unify.

Use explicit mapper.

## 114.5 Legacy Prisma category model

Discard as canonical.

Use recursive category model.

## 114.6 Mock product inconsistencies

Some CRM mock products currently bridge to public slugs/data inconsistently.

When catalog persistence becomes canonical, seed/mapping must resolve these explicitly rather than preserving accidental mock inconsistencies.

## 114.7 Category projections and deletion

Public navigation is flat; Admin/CRM hierarchy uses `parentId`. Use separate mappers. Backend deletion rejects referenced subtrees with `CATEGORY_IN_USE`.

## 114.8 Checkout configuration split

Checkout currently uses hardcoded data disconnected from Admin payment, shipping, pickup, coupon, and free-shipping configuration. Phase 5 replaces all of these sources together through authoritative quote/configuration APIs.

## 114.9 Sales lifecycle gaps

The current store declares `delivered` and `pickup` but exposes no commands to reach them. Backend Core defines explicit deliver, ready-for-pickup, and complete-pickup transitions; Phase 6 adds the missing CRM controls.

## 114.10 Frontend-only order form option

The current order form uses `unpaid | pending | received` as a UI decision. `unpaid` means create a purchase order, not a sale payment status. API contracts MUST model creation intent separately from `SalePaymentStatus`.

---

# 115. Recommended First Implementation Task

The first coding task is **not** creating Prisma tables.

The first task is:

> Produce a complete backend contract audit from the current repository and propose the canonical domain/database model without modifying frontend behavior.

Required output:

```text
openspec/reference/backend/frontend-contracts.md
openspec/reference/backend/domain-map.md
openspec/reference/backend/mock-data-inventory.md
openspec/reference/backend/proposed-er-model.md
openspec/reference/backend/api-contract-map.md
```

Only after these artifacts are reviewed and approved:

```text
create backend/prisma/schema.prisma
```

---

# 116. Final Technical Decision

EntrenAR Backend Core will use:

```text
NestJS 11
TypeScript
Express adapter
REST
Zod
Prisma
PostgreSQL
Docker
Swagger/OpenAPI
JWT authentication
RBAC
Modular Monolith
Controller -> Service -> Repository -> Prisma
Explicit DTO mappers
```

The frontend remains:

```text
Next.js
React
TypeScript
Tailwind CSS
React Hook Form
Zod
Zustand
```

Zustand remains where it is useful for local/UI state.

Persistent business data progressively migrates to the NestJS API.

The NestJS application, dependencies, Prisma schema, migrations, seed, environment configuration, Docker setup, and backend tests all live under `backend/`. The repository-root `src/` remains the Next.js frontend.

---

# 117. Final Product Decision

The Backend Core must prioritize:

```text
correctness
compatibility
persistence
security
domain consistency
incremental migration
```

over:

```text
premature integrations
microservices
architectural novelty
large frontend rewrites
```

EntrenAR should first become a coherent, persistent ecommerce system.

External providers are layered on top only after that foundation is stable.
