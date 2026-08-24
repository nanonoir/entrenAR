# Backend Domain Map

This document outlines the bounded contexts and domain boundaries for the standalone NestJS backend (Phase 0). It defines module ownership, aggregates, commands, and dependencies based on the existing frontend contract.

## 1. Modular Monolith Architecture

The backend will be structured as a modular monolith inside `backend/src/`.

- `backend/src/modules/` - Bounded business domains.
- `backend/src/common/` - Cross-cutting infrastructure (Auth Guards, Zod Pipes, Prisma Service, Errors).

## 2. Bounded Contexts & Ownership

### 2.1 Catalog Module (`backend/src/modules/catalog/`)
**Ownership:** Products, Categories, Variants, Catalog Organization.
**Aggregates & Entities:**
- `Product` (Aggregate Root): Owns its variants, properties, and image representations.
- `Category` (Entity): Hierarchical tree (recursive `parentId`).
**Value Objects:** `ProductSlug`, `PublicSlug`, `Money` (Decimal).
**Invariants:**
- Products must have at least one Category.
- Promotional price must be strictly lower than sale price.
- `slug` (Admin) and `publicSlug` (Public) must be globally unique.
- A Category cannot be its own ancestor/descendant (cycle prevention).
- Category deletion fails (`CATEGORY_IN_USE`) if any product references it or its descendants.
**Cross-Domain Dependencies:**
- Used by Checkout (Quote validation) and Inventory.

### 2.2 Inventory Module (`backend/src/modules/inventory/`)
**Ownership:** Stock levels and Stock History.
**Aggregates:**
- `InventoryRecord` (Aggregate Root): Tied to a Product or Variant.
- `InventoryHistory` (Entity): Immutable audit log of stock changes.
**Invariants:**
- `stockMode` is `limited` (>= 0) or `infinite`.
- Deductions must be atomic and produce a history record simultaneously.
**Cross-Domain Dependencies:**
- Called by Orders (Sale creation deducts stock) and Catalog.

### 2.3 Users Module (`backend/src/modules/users/`)
**Ownership:** Accounts, Addresses, Wishlist, Authentication.
**Aggregates:**
- `User` (Aggregate Root): Identity, credentials, and roles.
- `Address` (Entity): Limit 6 per user.
- `Wishlist` (Entity): Unique per user/product.
**Invariants:**
- Email must be unique.
- Passwords must be hashed.
**Cross-Domain Dependencies:**
- Provides identity (Auth) for all protected routes.

### 2.4 Checkout Module (`backend/src/modules/checkout/`)
**Ownership:** Checkout Quote, Checkout Session.
**Aggregates:**
- `CheckoutSession` (Aggregate Root): Tracks the active cart state toward order creation.
**Invariants:**
- Checkout calculations (Quote) are entirely server-authoritative. Browser totals are ignored.
- Validates current product price, stock, active coupons, and valid shipping configuration.
**Cross-Domain Dependencies:**
- Reads from Catalog, Inventory, Commerce Config. Writes to Orders upon conversion.

### 2.5 Orders Module (`backend/src/modules/orders/`)
**Ownership:** Sales, Purchase Orders, Order History.
**Aggregates:**
- `Sale` (Aggregate Root): Represents a confirmed transaction. Owns `SaleItem` (snapshots) and `SaleHistory`.
- `PurchaseOrder` (Aggregate Root): Unpaid intent. Can be converted to a `Sale`.
**Invariants:**
- `SaleItem` is a hard snapshot; changes to the catalog do not alter historical orders.
- Sale creation MUST deduct stock (replaces frontend `stock_reserved` mock behavior).
- Purchase Order conversion must be idempotent.
- Payment received state does not re-deduct stock.
**Cross-Domain Dependencies:**
- Writes to CRM Customers (updates totals), Inventory (deductions).

### 2.6 CRM Customers Module (`backend/src/modules/customers/`)
**Ownership:** CRM Customer profiles, aggregated statistics.
**Aggregates:**
- `CrmCustomer` (Aggregate Root): CRM representation of buyers.
**Invariants:**
- Active customer emails must be unique.
- Customer deletion is an **anonymization** (soft delete retaining non-PII transaction history).
**Cross-Domain Dependencies:**
- Read by Orders (links sales).

### 2.7 Commerce Configuration Module (`backend/src/modules/commerce/`)
**Ownership:** Payment Providers, Shipping Providers, Pickup Points, Coupons, Shipping Discounts.
**Aggregates:**
- `Coupon`, `ShippingProvider`, `PickupPoint`.
**Invariants:**
- `Coupon` codes must be globally unique (among active/non-deleted).
- `Coupon` redemption is tracked transactionally.
- `PickupPoint` can only have one `isMain = true` record globally.
**Cross-Domain Dependencies:**
- Read by Checkout.

### 2.8 Statistics Module (`backend/src/modules/statistics/`)
**Ownership:** Aggregation of transactional data.
**Aggregates:** Derived views/metrics.
**Invariants:** Revenue/Sales aggregates only count payment-received, non-cancelled, non-refunded sales.
**Prohibited Coupling:** Visit tracking is out of scope and must not be mocked from order data.

## 3. Frontend Evidence & Mappers

**Evidence Source:**
- Types: `src/types/product.ts`, `src/lib/data/admin/sales-flow/types.ts`.
- Schemas: `src/schemas/admin/product-schemas.ts`, `src/schemas/admin/order-schema.ts`.

**Mapper Directives (Database != API Contract):**
- **Products:** Database entity maps to `ProductSummary`, `ProductDetail` (Public), and `AdminProduct` (CRM).
- **Categories:** Database adjacency list maps to a flat list for Public navigation, and a nested tree for CRM.
- **Order Status:** Internal `SaleShippingStatus` maps to public `preparacion`, `en-camino`, `entregado`, `listo-para-retirar` (pickup), `cancelado`.
- **Inventory:** Internal numeric limits map to frontend `stockMode` (`infinite` or quantity).

## 4. Prohibited Coupling
- Do not couple the database Schema directly to the REST API responses (No raw Prisma exposure).
- Do not rely on frontend-provided calculated totals or status values.
- Do not merge `Sale` and `PurchaseOrder` into a single frontend UI type; they maintain conceptual separation.
- Carrier integrations (MercadoPago, Andreani, Emails) are POST-CORE. Do not couple domain logic to external APIs yet.
