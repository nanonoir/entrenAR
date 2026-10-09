# Design: Catalog Import Readiness

## Technical Approach

Add a backend-only `catalog-import` module that converts a validated manifest into a normalized plan. All preflights finish before one exclusive Prisma transaction. Migrate consumers additively, then remove legacy columns.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Import boundary | Nest context command plus injectable use case | HTTP; seed script | Reuses `showcase-reset.command.ts` without public exposure or Prisma coupling. |
| R2 check | `ObjectExistencePort`; S3 `HeadObject` adapter with bounded workers | URLs; inline SDK calls | Testable, read-only R2 access; distinguish missing objects from operational failures. |
| HTML safety | Backend `sanitize-html` allowlist and server-rendered formatted-content component | Client sanitization; raw HTML | One authoritative write boundary prevents unsafe persistence. |
| Atomicity | External preflight, then `MutationGate.runExclusive`, repeated conflict check, chunked writes | Long transaction; per-product commits | Avoids external I/O under locks, closes races, remains atomic. |
| Historical IDs | Preserve nullable legacy ledger/snapshots; require variants on new writes | Rewrite history | New-insert validation/triggers establish cutover without mutation. |

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/catalog-import/*` | command, manifest, plan, report | scraping, uploads, HTTP, UI mapping |
| `catalog-import/manifest-validator.ts` | pure shape/business/cross-manifest normalization | Prisma or R2 calls |
| `catalog-import/catalog-import.service.ts` | category/conflict/R2 preflight and transaction orchestration | SQL or SDK details |
| `catalog-import/catalog-import.repository.ts` | recheck and atomic catalog writes | sanitization or transformation |
| `catalog-import/ports/object-existence.port.ts` + `adapters/r2-*` | existence contract and R2 HEAD implementation | URL generation or object mutation |
| `backend/src/modules/catalog/{catalog.mapper,catalog-query.service}.ts` | canonical read projections | compatibility fixture synthesis for persisted imports |
| `backend/src/modules/catalog/product.service.ts` | normal admin edits with identity-preserving variant upsert/diff | variant `deleteMany`, import orchestration |

### Dependency Direction and Reuse

`command → CatalogImportService → validator/ports → repositories → Prisma/R2`. Frontend remains `UI → src/lib/api → Nest REST`; Prisma never enters Next.js. Reuse `MutationGate`, catalog mappers, pricing helpers, and error envelope. Consumers cannot derive price from variants, inventory from Product, or collapse galleries/categories. New cart, checkout, inventory, and sales operations require an explicit `variantId`; no default-variant fallback remains.

### Canonical Projection Contract

Product owns prices, sanitized description, ordered images/keys, and all categories. Variant owns SKU, attributes, stock, and same-product `primaryImageId`. Availability aggregates variants; savings use Product prices. Public URLs join validated keys to `ASSETS_BASE_URL`.

## Data Flow

```text
JSON path → parse/Zod → normalize+sanitize → categories/conflicts → bounded R2 HEAD
                                                        ↓ success
MutationGate exclusive → recheck clean target → Product → Images → Variants → Categories → commit/report
```

```text
Add columns/tables → backfill prices/variants/cart/images → deploy dual-read/new-write consumers
→ assert no unresolved carts/media/legacy writers → add constraints/triggers → drop legacy fields
```

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modules/catalog-import/**`, command | Create | Use case, schemas, ports/adapters, report. |
| `backend/prisma/schema.prisma`, `backend/prisma/migrations/*catalog_import_readiness*/migration.sql` | Modify/Create | Canonical ownership, ProductImage, phased backfill/constraints. |
| `backend/src/modules/{catalog,inventory,checkout,sales,purchase-orders,statistics,abandoned-carts}/**` | Modify | Variant-only writes and canonical projections. |
| `src/types/**`, `src/lib/api/catalog/**`, product/cart/admin components and schemas | Modify | Galleries, all categories, Product pricing, variant inventory, safe description. |
| `backend/prisma/seed.ts`, showcase fixtures, `src/lib/data/**`, tests | Modify | Canonical fixtures and coverage. |

## Interfaces / Errors

`importCatalog(path)` returns success counts/runId or `{code, issues[{productSlug?,field?,key?,code,message}]}`. The command reads one JSON file as data, emits one JSON report/stable exit code, and redacts payloads, credentials, and stacks.

## Testing Strategy

| Layer | Coverage |
|---|---|
| Unit | Conditionals, sparse combinations, traversal, sanitizer, projections, redaction. |
| Integration | R2 fakes, categories, second import, rollback, variant trigger, safe admin updates, legacy nulls, cart backfill. |
| E2E/acceptance | Command exit/report; listing/detail/cart/checkout/admin galleries, savings, categories, availability, safe HTML. |

## Threat Matrix

| Boundary | Applicability | Design response | RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: manifest is parsed as JSON data, never classified/executed | Reject unreadable/non-JSON input | N/A |
| Git repository selection | N/A: no Git integration | None | N/A |
| Commit state | N/A | None | N/A |
| Push state | N/A | None | N/A |
| PR commands | N/A | None | N/A |

## Migration / Rollout

Migration 1 adds canonical fields/images and backfills prices and simple variants. The non-production showcase does not preserve active cart fixtures; any reset clears them before the canonical schema is applied. Immutable `OrderItem` and append-only `InventoryHistory` remain untouched; new writes require variants. Migration 2 deploys canonical consumers and identity-preserving variant reconciliation; referenced variants cannot be deleted and may be disabled. Migration 3 verifies no unresolved legacy writers, makes CartItem variant non-null, adds checks/deferred universal-variant enforcement, then drops Product SKU/stock/image/legacy prices, variant prices, and `isDefault`. Before cleanup, roll back application; afterward restore the pre-migration database backup. R2 is never mutated.

## Open Questions

None.
