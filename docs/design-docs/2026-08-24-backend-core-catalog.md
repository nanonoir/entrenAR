# Design: Backend Core Phase 2 Catalog

## Technical Approach

Implement the foundational Catalog and Inventory capabilities in NestJS using Prisma, taking a schema-first/read-first approach. We will introduce `CatalogModule` and `InventoryModule`, map the canonical persisted schema to the existing frontend mock structures using strict DTOs, and progressively deploy Next.js frontend adapters (`src/lib/api/catalog/`) gated by a `DATA_SOURCE` environment variable.

## Architecture Decisions

### Decision: Variant Normalization vs JSON

**Choice**: Use a normalized `Variant` model with JSON `attributes` for dynamic variant properties (e.g., color, size).
**Alternatives considered**: Fully normalized EAV (Entity-Attribute-Value) tables for variant properties.
**Rationale**: JSON allows flexible variant combinations (e.g., `{"color": "red", "size": "M"}`) without excessive relational joins. Strict Cartesian validation will be enforced in the NestJS application layer on creation.

### Decision: Inventory Stock Management

**Choice**: Explicit `StockMode` enum (`TRACKED`, `INFINITE`, `OUT_OF_STOCK`) with a nullable `quantity` integer.
**Alternatives considered**: Negative quantities or magic numbers (e.g., `-1`) for infinite stock.
**Rationale**: Magic numbers are error-prone. Explicit enums make application intent and UI mapping unambiguous.

### Decision: Category Hierarchy & Deletion Protection

**Choice**: Adjacency list (`parentId`) in the database. `CATEGORY_IN_USE` error returned if deleting a category containing products. Public API returns a flat projection; Admin API returns recursive trees.
**Alternatives considered**: Materialized paths or nested sets; cascading deletes.
**Rationale**: Adjacency list is simple to query for typical e-commerce depths. Cascading deletes on categories risk accidental mass product unlinking or deletion.

### Decision: URL Slug Preservation

**Choice**: Define `publicSlug` as unique in Prisma. Public endpoints expose it as `slug` in DTOs.
**Alternatives considered**: Refactor frontend `/productos/:slug` routes to use UUIDs.
**Rationale**: The prompt explicitly requires preserving the `/productos/:slug` frontend experience without redesigning the UI.

## Data Flow

    Frontend UI
         │ (Next.js components)
         ▼
    Frontend Repository (src/lib/api/catalog)
         │ [Checks DATA_SOURCE feature flag]
         ├──→ (If 'mock') → src/lib/data/* (Current Static)
         └──→ (If 'api')  → NestJS REST API
                                │
                        NestJS Controllers
                                │ (Zod validation & DTO mapping)
                        NestJS Services
                                │
                          Prisma Client
                                │
                         PostgreSQL DB

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `Category`, `Product`, `ProductCategory`, `Variant`, `Inventory`, `CatalogSettings`. |
| `backend/prisma/seed.ts` | Modify | Add deterministic seeding and ID reconciliation for catalog. |
| `backend/src/modules/catalog/*` | Create | NestJS `CatalogModule`, controllers, services, Zod DTOs. |
| `backend/src/modules/inventory/*` | Create | NestJS `InventoryModule`, services for transactional locking. |
| `src/lib/api/catalog/product.repository.ts` | Create | Frontend adapter fetching products (flagged). |
| `src/lib/api/catalog/category.repository.ts` | Create | Frontend adapter fetching categories (flagged). |
| `src/lib/api/catalog/client.ts` | Create | HTTP fetch client with token handling and decimal parsing. |

## Interfaces / Contracts

```ts
// Prisma Schema Additions (abbreviated)
model Category {
  id         String     @id @default(cuid())
  name       String
  publicSlug String     @unique
  parentId   String?
  parent     Category?  @relation("Adjacency", fields: [parentId], references: [id], onDelete: Restrict)
  children   Category[] @relation("Adjacency")
  products   ProductCategory[]
}

model Product {
  id          String   @id @default(cuid())
  name        String
  publicSlug  String   @unique
  brand       String?
  basePrice   Decimal  @db.Decimal(10, 2)
  categories  ProductCategory[]
  variants    Variant[]
}

model Variant {
  id         String    @id @default(cuid())
  productId  String
  sku        String    @unique // Server-generated if empty
  attributes Json
  inventory  Inventory?
}

enum StockMode { TRACKED, INFINITE, OUT_OF_STOCK }

model Inventory {
  variantId String    @id
  stockMode StockMode @default(TRACKED)
  quantity  Int?
}

model CatalogSettings {
  id                  String  @id @default("singleton")
  persistOrder        Boolean @default(true)
  showOutOfStockAtEnd Boolean @default(true)
}
```

```ts
// Frontend API Adapter Contract
export interface CatalogRepository {
  getProducts(filters: ProductFilters): Promise<ProductSummary[]>;
  getProductBySlug(slug: string): Promise<ProductDetail>;
  getCategories(): Promise<Category[]>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod DTO validation & Mapping | Test NestJS pipes reject invalid payloads. Test Decimal to string/number serialization. |
| Integration | Transactional Inventory | Prisma transactions ensure stock updates are safe and categories block deletion if in use. |
| E2E | Catalog Retrieval Flow | Public API returns exact DTO shapes required by the frontend API adapters. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, etc | N/A: No OS/Doc file execution introduced. | Change creates REST HTTP routes, not OS paths. | None |
| Git repository selection | `git -C`, paths | N/A: No git commands invoked. | REST API does not touch VCS. | None |
| Commit state | staged, `commit -a` | N/A: No local git manipulation. | REST API does not touch VCS. | None |
| Push state | tracking branch, etc | N/A: No push behaviors added. | REST API does not touch VCS. | None |
| PR commands | explicit `--head`, etc | N/A: No PR automation involved. | REST API does not touch VCS. | None |

*Reason for N/A:* This change strictly introduces HTTP/REST APIs and database schemas for catalog data. It does not introduce any shell commands, subprocesses, executable-file parsing, or version-control automation.

## Migration / Rollout

1. Run Prisma migrations and seed the database.
2. Deploy NestJS backend APIs.
3. Deploy Next.js frontend with `NEXT_PUBLIC_DATA_SOURCE=mock`.
4. QA verification.
5. Switch `NEXT_PUBLIC_DATA_SOURCE=api` to enable real backend reads. Mock data serves as a safe rollback.

## Open Questions

None.
