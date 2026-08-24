# EntrenAR Backend Core Phase 0: Frontend Contracts

This document formalizes the consumed DTO shapes, enums, validation rules, state transitions, and expected backend behaviors already established by the Next.js frontend, combined with the explicit resolutions from the refined PRD (Backend Core SSOT).

## 1. Public vs. Admin Projections

The frontend expects different shapes for public consumers versus admin CRM consumers. The backend must provide distinct endpoints or mapped projections for these domains.

### 1.1 Products

| Projection | Contract File | Key Identifiers | Consumer |
|---|---|---|---|
| **Public Summary** | `src/types/product.ts` (`ProductSummary`) | `id`, `slug` | Public Grid, Catalog |
| **Public Detail** | `src/types/product.ts` (`ProductDetail`) | `id`, `slug` | Public Product Page |
| **Admin Product** | `src/schemas/admin/product-schemas.ts` | `id`, `slug`, `publicSlug`, `sku` | Admin CRM |

*Note:* `publicSlug` drives the storefront URL `/productos/[publicSlug]`. `slug` is the canonical CRM identifier.

### 1.2 Categories

| Projection | Structure | Identifier / Relation | Consumer |
|---|---|---|---|
| **Public Category** | Flat Array | `slug` | Public Storefront Navigation |
| **Admin Category** | Recursive Tree | `id`, `parentId`, `slug` | Admin CRM Catalog |

---

## 2. Validation Constraints (Zod Enforced)

The backend MUST enforce these constraints, which are currently defined in the frontend Zod schemas (e.g., `src/schemas/admin/product-schemas.ts`) and the PRD.

### Products
- **Name:** Minimum 3 characters.
- **Description:** Minimum 10 characters.
- **Categories:** Must belong to at least one category.
- **Prices:** `salePrice > 0`. If provided, `promotionalPrice > 0` and `promotionalPrice < salePrice`.
- **SEO Metadata:** Title ≤ 70 characters, Description ≤ 160 characters.
- **Variant Properties:** Maximum 2 levels. No duplicate property names.
- **Variant Combinations:** Submitted combinations must exactly match the Cartesian product of active variant properties.

### Shipping Configuration
- **Free Shipping Threshold:** Must be strictly `> 0` if enabled.
- **Weight Ranges:** Ranges cannot overlap. `maxWeight > minWeight`. The maximum bound for the `"10kg+"` band must be nullable internally (no `999999` placeholders).

### Identity Numbers
- **Public account `dni`:** Digits only, **6–9 digits**.
- **CRM `dniOrCuil`:** Normalized identity number, **7–11 digits**.
- These are separate contracts and MUST NOT share one validator. **PRD override/source:** PRD §13 explicitly preserves the two ranges despite any broader mock-data assumption.

### Pickup Points
- **Schedule:** A configured/active pickup point has at least one schedule range. Ranges are returned and edited in canonical `dayOfWeek`, then opening-time order; each closing time must be later than its opening time, and ranges on the same day must not overlap.
- **Cost:** `fixedCost` is required when `costType = fixed`.
- **Coverage:** At least one province is required when `coverageType = provinces`. The frontend must use this canonical Argentina list of 24 jurisdictions: `Buenos Aires`, `Ciudad Autónoma de Buenos Aires`, `Catamarca`, `Chaco`, `Chubut`, `Córdoba`, `Corrientes`, `Entre Ríos`, `Formosa`, `Jujuy`, `La Pampa`, `La Rioja`, `Mendoza`, `Misiones`, `Neuquén`, `Río Negro`, `Salta`, `San Juan`, `San Luis`, `Santa Cruz`, `Santa Fe`, `Santiago del Estero`, `Tierra del Fuego`, `Tucumán`.
- **Main point:** At most one pickup point can have `isMain = true`. Assigning a new main point must unset the previous main point transactionally.
- **PRD override/source:** PRD §§39–40 defines the pickup DTO, validation, canonical 24-province editing list, and compatibility rule; the unconfigured `retiro-principal` seed in §41 is the only initial schedule exception.

### Bank Transfer
- **CBU / CVU:** Exactly 22 digits.
- **CUIT / CUIL:** Exactly 11 digits (internal normalization; frontend may format as `XX-XXXXXXXX-X`).

### Coupon Codes
- Must be globally unique (among active/non-deleted).
- Trimmed, uppercase, no spaces, only alphanumeric and hyphens.

---

## 3. Enumerations & Status Cycles

Backend Core must adopt the following existing enumerations to remain compatible with frontend state stores.

### 3.1 Sale Shipping Status
`SaleShippingStatus` (`src/lib/data/admin/sales-flow/types.ts`)
- `to_pack` → `to_ship` → `shipped` → `delivered`
- `to_pack` → `pickup` → `delivered` *(Note: `delivered` represents completed pickup in CRM)*
- `cancelled`

### 3.2 Sale Payment Status
`SalePaymentStatus` (`src/lib/data/admin/sales-flow/types.ts`)
- `pending`
- `received`
- `cancelled`
- `refunded`

### 3.3 Purchase Order Status
`PurchaseOrderStatus`
- `pending`
- `converted`
- `cancelled`

### 3.4 Sale History Events
`SaleHistoryEventType`
- `sale_created`, `sale_updated`, `sale_cancelled`, `sale_reopened`, `sale_archived`
- `payment_received`
- `package_packed`, `package_unpacked`, `package_shipped`, `package_delivered`
- `pickup_ready`, `pickup_completed`
- `stock_reserved` *(legacy mock)*, `stock_deducted`, `stock_restored`
- `email_sent`, `email_failed`

### 3.5 Inventory Types
- `limited(quantity)` (Quantity must be integer ≥ 0)
- `infinite`

---

## 4. DTO Shapes (Core Interfaces)

### 4.1 Admin Sale DTO (`AdminSale`)
```typescript
{
  id: string;
  number: string; // User-visible (e.g. "#101")
  customerId?: string;
  createdAt: string; // ISO 8601
  source?: string;
  customer: { firstName: string, lastName: string, email?: string, phone?: string, dniOrCuil?: string };
  shippingAddress?: { street: string, number: string, city: string, province: string, postalCode: string, ... };
  products: { productId: string, variantId?: string, name: string, quantity: number, unitPrice: number }[]; // Snapshot
  paymentStatus: SalePaymentStatus;
  shippingStatus: SaleShippingStatus;
  subtotal: number;
  shippingCost: number;
  total: number;
  archived: boolean;
  history: SaleHistoryEvent[];
}
```

### 4.2 Checkout Quote Response (Expected Target)
```typescript
{
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  availableShippingOptions: ShippingOption[];
  applicablePickupPoints: PickupPoint[];
  couponResult?: CouponEvaluation;
  warnings?: string[];
}
```

---

## 5. Explicit PRD Overrides vs. Mock Behavior

To ensure a safe migration, the following behaviors described in the PRD **override** the currently implemented local mock behavior:

- **Sale Stock Deduction:** Creating a sale MUST deduct limited inventory atomically. The mock frontend merely appends a `stock_reserved` event without altering a central counter. The backend will actively use `stock_deducted` and prevent overselling.
- **Stock Representation:** The frontend displays large integers for infinite stock in some places. The backend MUST model this cleanly as `limited(number) | infinite`.
- **Sale Lifecycle Commands:** The `delivered` (for shipping) and `pickup_ready` / `pickup_completed` commands are defined in the domain but missing from the local UI. The backend MUST implement these state transitions; the frontend will add the missing CRM buttons in a subsequent phase.
- **Sale Visible Number Generation:** Mock IDs are hardcoded or random. The backend MUST allocate new visible sale numbers sequentially via a concurrency-safe database sequence.
- **Payment Receiving:** Receiving payment appends `payment_received` but MUST NOT deduct inventory a second time (inventory is deducted on creation).
- **Category Deletion:** Mock category deletion cascades entirely on the client. The backend MUST block category deletion with `CATEGORY_IN_USE` if products reference the category or its descendants.
- **Checkout Validation:** The backend MUST re-read prices, stock, and configs during checkout. Frontend-provided totals MUST NEVER be trusted, even though the current mock relies on them.

---

## 6. Local Persistence & Hydration Expectations

The frontend currently uses Zustand's `persist` middleware with `localStorage` for customer-facing stores.

**Contract Requirements:**
- **Hydration Risk:** Stores use `skipHydration: true`. UI components check `isHydrated` before rendering cart counts or auth states.
- **Auth Store:** On logout, the client clears local state. In target architecture, backend handles HttpOnly session cookies, but the frontend still relies on the `/auth/me` return value to populate `auth-store`.
- **Cart Syncing:** The `cart-store` persists locally. Upon login, the guest cart should become the active cart, while preserving any previous backend cart as a snapshot. The frontend expects an endpoint to sync/revalidate cart state before checkout.
