# System Architecture

EntrenAR is an ecommerce platform for sports supplements, apparel, and fitness accessories. It operates as a full-stack system consisting of a Next.js frontend, an administrative CRM panel, and a standalone NestJS backend with PostgreSQL and Prisma ORM.

## Architectural Boundaries

```text
Next.js Frontend (Shop / Admin / Checkout)
       │
       ▼ (REST / HTTP)
Domain-Facing API Adapters (`src/lib/api`)
       │
       ▼ (JSON / OpenAPI)
NestJS Backend Application (`backend/src/modules/*`)
       │
       ▼
Prisma ORM Client (`@prisma/client` + `@prisma/adapter-pg`)
       │
       ▼
PostgreSQL Database (`127.0.0.1:5432/entrenar`)
```

### 1. Frontend Surfaces (`src/app`)
- `(shop)`: Public storefront routes (`/`, `/[...segments]`, `/productos/[slug]`). Structured with horizontal ecommerce navigation, server-side data fetching, and progressive hydration.
- `(admin)`: Management CRM surface (`/admin`, `/admin/productos`, `/admin/ventas`, `/admin/clientes`, `/admin/inventario`, `/admin/estadisticas`). Uses a responsive sidebar and header layout.
- `(admin-auth)`: Dedicated administrator login flow (`/admin/login`). Independent session handling and cookie management.
- `(checkout)`: Multi-step checkout experience (`/checkout`).

### 2. Frontend Data Access & State
- `src/lib/api`: Authoritative frontend repositories and HTTP adapters communicating with NestJS REST endpoints.
- `src/lib/data`: Local fixtures, mock boundaries, and fallback datasets used for development and headless acceptance harnesses.
- `src/stores`: Client-side interaction state managed with Zustand:
  - `useCartStore`: Shopping cart state with localStorage persistence for guests.
  - `useUIStore`: Drawer, mega-menu, and modal states.
  - `useAuthStore`: Client auth session state.
  - `useAdminSalesStore`, `useAdminAbandonedCartsStore`: In-memory administrative operational state.

### 3. Backend Architecture (`backend/src`)
- Monolithic modular architecture using NestJS 11:
  - `modules/auth`: Customer and admin authentication, JWT tokens, and RBAC guards.
  - `modules/catalog`: Public and administrative catalog queries, taxonomy, category trees, and product indexing.
  - `modules/inventory`: Stock tracking, warehouse management, and transactional balance.
  - `modules/orders`: Order creation, historical order snapshots, and order status transitions.
  - `modules/checkout`: Checkout session validation, price calculations, stock reservation, and idempotency.
  - `modules/customers`: CRM customer management, address tracking, and metrics.
  - `modules/sales`: Administrative sales pipeline, payment reconciliation, and dispatch tracking.
  - `modules/statistics`: Real-time and aggregated commercial metrics for the CRM dashboard.
  - `modules/catalog-scraper`: Automated scrapers, taxonomy synchronization, and Cloudflare R2 asset handoff.
  - `modules/catalog-import`: Batch import pipeline with strict preflight verification.
  - `modules/showcase-reset`: Scheduled database reset service for public demonstration environments.

### 4. Persistence & Storage
- **PostgreSQL**: Primary transactional datastore accessed through Prisma 7.
- **Append-Only Ledger**: The `InventoryHistory` table is guarded by a PostgreSQL database trigger (`InventoryHistory_append_only`) enforcing an immutable append-only ledger for all inventory mutations.
- **Cloudflare R2**: Object storage for product media assets (`https://assets.entrenar.shop/...`).

### 5. Architectural Invariants
- **Backend Authority**: The frontend expresses intent only; the NestJS backend authenticates, authorizes, validates calculations with Zod, and performs transactional mutations. Client-provided prices, totals, stock levels, or roles are never trusted.
- **Prisma Isolation**: Prisma Client is strictly confined to `backend/`; it is never imported, referenced, or accessed in the Next.js frontend tree.
- **Layered Flow**: Controllers validate transport input with Zod/DTOs -> Services execute business domain logic and coordinate transactions -> Repositories/Prisma interact with PostgreSQL.
- **Direct API Adapters**: Storefront and admin client access REST through domain-facing frontend repositories/adapters under `src/lib/api`. Next.js Route Handlers are not used as redundant proxies for the NestJS API, and Server Actions do not act as a secondary business backend.

### 6. Authentication & Session Architecture
- **Token Model**: Short-lived JWT Access Tokens containing `userId` and `role`, paired with persistent Refresh Tokens stored server-side and transmitted via secure `HttpOnly` cookies.
- **Session Isolation**: Storefront customer authentication and back-office administrative authentication are strictly separated across distinct cookie and session boundaries.
- **Access Control**: Administrative endpoints (`/api/v1/admin/*`) require backend RBAC verification (`ADMIN` role). Frontend middleware and route cloaking provide UX navigation defense only; the NestJS backend remains the sole security authority.

### 7. Transport Contract & Error Handling
- **Consistent Response Envelope**: Expected business responses and controlled operational errors follow a normalized contract:
  ```ts
  {
    ok: boolean;
    code: string;
    message: string;
    issues?: unknown;
  }
  ```
- **Error Boundaries**: Expected business errors return controlled error objects. Uncaught system exceptions trigger Next.js route boundaries (`error.tsx`, `global-error.tsx`), while missing resources trigger `not-found.tsx`. Internal stack traces and sensitive database errors are never exposed over the wire.
