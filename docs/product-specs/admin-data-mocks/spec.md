# Admin Data Mocks Specification

## Purpose

Defines the structure, location, and constraints of the centralized mock data layer that feeds all CRM admin views in the absence of a real backend.

## Requirements

### Requirement: Centralized Mock Data Location

All admin mock data MUST reside under `src/lib/data/admin/` using a two-tier structure: statistics data under `src/lib/data/admin/statistics/` and operational sales-flow data under `src/lib/data/admin/sales-flow/`. Data MUST NOT be co-located in page or component files.

| File | Domain |
|------|--------|
| `src/lib/data/admin/statistics/dashboard.ts` | Overview KPIs and visitor behavior |
| `src/lib/data/admin/statistics/products.ts` | Product stats, top-10, inventory alerts |
| `src/lib/data/admin/statistics/sales.ts` | Orders, billing, customers, payment methods, provinces |
| `src/lib/data/admin/statistics/visits.ts` | Traffic totals, unique visitors, device breakdown, product visits |
| `src/lib/data/admin/statistics/coupons.ts` | Coupon usage, with/without coupon comparison |
| `src/lib/data/admin/sales-flow/sales.ts` | `AdminSale[]` seed data |
| `src/lib/data/admin/sales-flow/purchaseOrders.ts` | `AdminPurchaseOrder[]` seed data |
| `src/lib/data/admin/sales-flow/types.ts` | Admin-specific DTO types |

#### Scenario: Admin stats page imports from statistics subfolder

- GIVEN any admin statistics page component
- WHEN its data imports are inspected
- THEN mock data is imported from `src/lib/data/admin/statistics/*`, not from the old flat `src/lib/data/admin/*.ts` paths

#### Scenario: No mock data appears in component or page files

- GIVEN any file under `src/app/(admin)/` or `src/components/admin/`
- WHEN static data literals are searched
- THEN no inline mock datasets exist; only imports from `src/lib/data/admin/` subdirectories are present

---

### Requirement: TypeScript-Typed Mock Structures

Every mock data export MUST be strictly typed with TypeScript interfaces or types that reflect the shape of the future backend DTO.

#### Scenario: Mock dashboard data is typed

- GIVEN `src/lib/data/admin/dashboard.ts`
- WHEN imported into a page
- THEN TypeScript resolves all field access without `any` — KPI cards have `label`, `value`, `previousValue`, `variationPct` fields (or equivalent)

#### Scenario: Mock product data matches top-10 table columns

- GIVEN `src/lib/data/admin/products.ts`
- WHEN the top-10 table component uses the exported data
- THEN fields for producto, categoría, unidades vendidas, ventas en bruto, stock actual, and stock reservado are accessible and typed

---

### Requirement: Realistic Argentine E-commerce Mock Content

Mock data MUST use realistic Argentine e-commerce content aligned with CRM.md section 11 examples (products, provinces, payment methods, coupons).

#### Scenario: Product mock uses EntrenAR product names

- GIVEN `src/lib/data/admin/products.ts`
- WHEN the top products list is rendered
- THEN product names include entries such as "Whey Protein ENA", "Creatina Star Nutrition", or equivalent realistic supplements

#### Scenario: Sales mock includes multiple payment methods

- GIVEN `src/lib/data/admin/sales.ts`
- WHEN the payment-method chart is rendered
- THEN at least 3 payment methods from the defined list (Transferencia bancaria, Tarjeta de débito, Tarjeta de crédito, MercadoPago, Payway, Billetera virtual) appear in the data

#### Scenario: Coupons mock includes named coupon codes

- GIVEN `src/lib/data/admin/coupons.ts`
- WHEN the top coupons chart is rendered
- THEN coupon codes such as NANO10, CREATINA15, ENVIOGRATIS appear in the data

---

### Requirement: Mock Data Does Not Respond to Period Filter

Mock data exports MUST be static — they MUST NOT contain logic that filters or transforms based on a selected period.

#### Scenario: Changing period filter does not alter exported mock values

- GIVEN the period filter on any stats page
- WHEN the user changes the selected period
- THEN the values displayed come from the same static mock export; no data transformation occurs

---

### Requirement: No Backend Services, API Routes, or Prisma Usage

The `src/lib/data/admin/` files MUST NOT import Prisma, call API routes, or introduce server-side service dependencies.

#### Scenario: Admin data files contain no Prisma import

- GIVEN any file under `src/lib/data/admin/`
- WHEN its imports are inspected
- THEN no import from `@prisma/client`, `prisma/`, or any DB client is present

#### Scenario: Admin data files contain no fetch or API call

- GIVEN any file under `src/lib/data/admin/`
- WHEN its source is inspected
- THEN no `fetch()`, `axios`, or HTTP client call is present — data is exported as plain TypeScript literals

---

### Requirement: Sales-Flow Operational Mock Data

The system MUST add operational sales-flow mock data under `src/lib/data/admin/sales-flow/`, separate from statistics mocks. All new files MUST export plain TypeScript literals with no Prisma, fetch, or API dependencies.

| File | Contents |
|------|----------|
| `src/lib/data/admin/sales-flow/sales.ts` | `AdminSale[]` seed with 2–3 realistic mock sales |
| `src/lib/data/admin/sales-flow/purchaseOrders.ts` | `AdminPurchaseOrder[]` seed with 1–2 mock orders |
| `src/lib/data/admin/sales-flow/types.ts` | `AdminSale`, `AdminPurchaseOrder`, `SaleHistoryEvent`, `SaleCustomer`, `SaleProduct`, `SaleAddress` TypeScript types |

#### Scenario: Sales-flow mocks importable

- GIVEN any admin Ventas page component
- WHEN its data imports are inspected
- THEN mock sales and purchase orders are imported from `src/lib/data/admin/sales-flow/`, not from inline constants

#### Scenario: AdminSale type has all required fields

- GIVEN `src/lib/data/admin/sales-flow/types.ts`
- WHEN `AdminSale` is imported
- THEN all fields are accessible: `id`, `number`, `createdAt`, `source`, `customer`, `products`, `paymentStatus`, `shippingStatus`, `subtotal`, `discountType?`, `discountValue?`, `shippingCost`, `total`, `archived`, `cancellationReason?`, `previousPaymentStatus?`, `previousShippingStatus?`, `notes?`, `history`, `sourceOrderId?`

---

### Requirement: Distinct Admin DTOs vs Customer-Facing DTOs

`AdminSale` and `AdminPurchaseOrder` MUST be defined as distinct TypeScript types in `src/lib/data/admin/sales-flow/types.ts`. They MUST NOT extend or alias the customer-facing `accountOrders` types. The customer-facing `accountOrders` MUST remain unchanged.

#### Scenario: Admin and customer types are independent

- GIVEN `src/lib/data/admin/sales-flow/types.ts` and the existing customer order types
- WHEN type compatibility is checked
- THEN `AdminSale` and `AdminPurchaseOrder` are self-contained and do not import from customer-facing DTO files

---

### Requirement: Product Selector Uses Catalog Mocks

The product selector drawer (used in create/edit forms) MUST source its product list from the existing ecommerce product catalog mocks (`src/lib/data/products.ts`), adapted to `SaleProduct` shape (mapping `id`, `name`, `imageUrl`, `unitPrice`). No separate product mock file for the sales flow is required.

#### Scenario: Product drawer shows catalog products

- GIVEN the admin opens the product selector drawer in the create form
- WHEN the drawer renders
- THEN products from the existing catalog mock (e.g. Whey Protein ENA) appear in the list with name, image placeholder, and unit price

---

### Requirement: Abandoned Cart Mock Data

The system MUST provide typed abandoned-cart mock data under the admin sales-flow mock data layer. Records MUST include customer/contact data, abandoned timestamp, item summary, total, and recovery status.

#### Scenario: Abandoned-cart data is centralized

- GIVEN the abandoned-carts admin route renders
- WHEN its imports are inspected
- THEN cart records come from `src/lib/data/admin/sales-flow/`, not inline page constants

#### Scenario: Cart records support list fields

- GIVEN an abandoned-cart record is imported
- WHEN the list renders
- THEN customer, date, item count, total, and recovery status are available

---

### Requirement: Recovery Email Mock Configuration

The system MUST provide local/mock recovery email configuration and template data for timing mode, HTML draft, plain-text draft, and preview content. It MUST NOT import Prisma, fetch, API routes, or email services.

#### Scenario: Template drafts are available

- GIVEN the email editor loads
- WHEN it reads initial state
- THEN HTML and plain-text drafts are populated from mock/local data

#### Scenario: No backend dependencies

- GIVEN admin sales-flow mock files are inspected
- WHEN imports are checked
- THEN no Prisma, HTTP client, API route, or email service dependency exists

