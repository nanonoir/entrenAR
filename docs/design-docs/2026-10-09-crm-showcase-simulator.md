# Design: Isolated CRM Showcase Simulator

Build a one-shot backend CLI that inserts a historical commercial scenario in one transaction over an explicitly authorized, isolated copy of the imported catalog. Reuse domain calculations and inventory primitives, not live command entrypoints. Storefront discovery uses small read-time selectors over the existing public catalog adapter; no recommendation engine or new persistence models.

**Requirements:** [approved PRD](../exec-plans/completed/crm-showcase-simulator/prd.md). This document defines implementation choices, not additional product behavior. Related boundaries: [architecture](../../ARCHITECTURE.md), [checkout](./2026-09-03-backend-core-phase-5-checkout.md), [inventory/snapshot stabilization](./2026-09-23-backend-core-p0-stabilization.md), [taxonomy/listing](./2026-10-04-catalog-listing-taxonomy-alignment.md), [legacy reset](./2026-09-24-showcase-crm-data-reset-hourly.md).

## Ownership and reuse

`backend/src/modules/crm-showcase/` owns destination validation, deterministic scenario assembly, historical inserts, verification and reporting. It is a CLI-only composition root, not imported by `AppModule`; do not bootstrap the normal application, seed, reset restorers, message senders or storage clients. Direction: command → scenario service → domain calculations/repositories → transaction client. Prisma remains backend-only.

| Existing responsibility | Reuse / narrow extension |
|---|---|
| `CheckoutQuoteService.calculateQuote(tx, cart, input, actor, now, requireCompletion)` | Read/calculation path with explicit event time and the existing line/delivery/payment/discount rules. Do not call `quote()`/`complete()`: they create sessions, random identifiers and independent transactions. Replace the incidental generated `quoteId` with a deterministic ID before serialization; no random value enters persisted snapshots. |
| `sales/sales.service.ts`, `sales/sales.repository.ts`, `sales/sales.state-machine.ts` | Extract its private `calculateManualSale` into a focused shared calculation helper; reuse money utilities, `manualSaleRecord` and `transitionSale(..., { now })` to assemble valid timelines. Payment changes remain explicit: `transitionSale` does not itself set `PAID`/`REFUNDED`. Historical insert adapter owns final IDs/timestamps. |
| `purchase-orders/purchase-orders.service.ts` | Extract only its private `recalculate` into a focused shared calculation helper, consumed by service and generator; reuse `transitionPurchaseOrder` with event time. No live `receive()` inside the generator transaction. |
| `InventoryRepository` | Use `deductStockForItems`, `restoreUncompensatedDeductions`, and `incrementStockForItems` on the supplied transaction. Extend ledger inputs with optional explicit movement ID/time and receipt reference/context; preserve defaults for ordinary callers. Derive a distinct movement ID per operation/variant/kind, not one ID reused across lines. Propagate historical context to `createHistory` at INSERT, never update history afterward. |

The current receipt helper omits structured purchase references, and `createHistory` supplies neither ID nor historical time. Those are targeted contract extensions, not permission to replace inventory logic or refactor all command services. No nested transactions, global clock mocking, trigger disabling, per-order commits or post-insert snapshot backdating.

## Destination boundary and isolated baseline

### Approved exact local-owner exception — 2026-10-09

The owner supersedes the isolated-only restriction exclusively for `127.0.0.1:5432/entrenar`, public schema, non-production. A separate explicit trusted-owner manifest must bind the exact credential-free fingerprint, fresh private backup SHA-256, and successful isolated restore evidence before local writes. No implicit connection fallback, other habitual targets, or production are authorized. Default isolated policy and destructive test isolation remain unchanged. Preserved ADMIN users and their linked authentication tokens are legitimate baseline data; never sanitize/delete them. Preserve catalog structure/media and all preexisting auth data. Only existing manual demonstration commerce configuration and the approved atomic seed may write locally. Configuration changes require capturing the new baseline digest. Restore verification and real checkout/persistence tests run on disposable isolated copies; never restore over the authorized local source. Existing completion marker still means immediate no-op, never cleanup/regeneration. This exception supersedes conflicting source-personal-data/configuration prohibitions below; synthetic commercial identities remain reserved examples and no outbound integration is permitted.

Local implementation adaptations proven by runtime: optional address/bank snapshots use SQL NULL (`Prisma.DbNull`) rather than JSON null to satisfy existing object-snapshot constraints; restore original catalog timestamps with parameterized raw timestamp text to retain PostgreSQL precision beyond JS milliseconds; customer contracts accept the exact `crm-showcase:<64 lowercase hex>` reserved namespace alongside ordinary IDs, rather than broadening arbitrary punctuation. These are compatibility fixes for existing approved invariants, not new schema or behavior. Explicit `configureManualDemoCommerce(tx, preparedAt)` is operator preparation only and is never called implicitly by the generator; real checkout and destructive tests reject the local-owner database.

The proposed CLI contract is `npm run seed:crm-showcase -- --seed <value> --reference-date <ISO instant> --authorization <private manifest path>`. Root script forwards to a compiled backend command under `dist/src/modules/crm-showcase/`; secrets come only from `CRM_SHOWCASE_DATABASE_URL`, never a URL argument. There is no fallback to `DATABASE_URL` or `DATABASE_URL_E2E`.

The external, private authorization manifest binds `purpose=crm-showcase-demo`, the credential-free destination fingerprint, source identity, baseline dump SHA-256, canonical baseline digest, and evidence that scheduled reset is disabled. It contains no credentials and is not a database model. Validate before creating a writable client:

- Require explicit inputs and valid reference instant; reject runtime production. Accept only literal loopback hosts, `public` schema, no host/port/dbname overrides, socket/hostaddr/options/search-path overrides or unknown connection parameters. Destination database names are restricted to `entrenar_crm_demo_<run>` (safe identifier characters), excluding the habitual `entrenar`, template/system names and any source database identity. A name or `NODE_ENV` alone is not authorization.
- Use the existing `identifyDatabaseTarget(explicitUrl)` normalization/fingerprint helper, **always with its argument**. Verify the connected database/schema/loopback server identity against the manifest, then read the baseline and constraint/trigger prerequisites. Reject mismatches, namespace collisions or incomplete evidence without writes. Never log connection strings, passwords, tokens or raw database exceptions.
- After validation, the CLI can bind its process-local `DATABASE_URL` to the explicit destination before constructing the existing `PrismaService`; do not alter the provider's global fallback contract. No other client is instantiated before this binding. Close the client and bound execution on success/failure.

**Concrete validation copy:** take a consistent `pg_dump --format=custom` of the explicitly identified source using read-only credentials; keep the dump private, hash it and record source/destination identities. Restore with `pg_restore --exit-on-error --no-owner --no-privileges` into a new database in a separate loopback-only PostgreSQL instance/container on a different port. Use a new destination-only role; the source application credentials and source network endpoint are not supplied to the writer. Restore existing schema/migrations/triggers, not `seed`, reset or mock catalog fixtures. Compare canonical catalog/commercial baseline digests after restoration. Copy A, copy B and disposable rollback/concurrency copies all originate from this same dump.

The baseline must have imported catalog data, usable public variants, active payment/delivery/pickup configuration sufficient for both delivery types, no prior simulated namespace, and no unrelated commercial data that makes the requested scenario misleading. Reject insufficient prerequisites; do not fix commerce configuration or clean legacy rows automatically. Exact catalog counts are evidence, not hardcoded generation inputs. Personal-data contamination in the source is a provisioning failure; do not clone it into showcase infrastructure.

Generation copies have no running application/jobs. Before CRM validation, run dedicated backend/frontend processes pointing only to the demo, with production credentials/integrations absent. Verify the `entrenar-showcase-reset.timer`/service, cron/container schedules and Windows scheduled tasks as applicable are disabled/not installed for that destination; record this outside the CLI (database inspection cannot prove scheduler state). The manifest is an explicit operator attestation, not automatic proof. Do not modify legacy reset code. Preserve the pre-generation dump for reconstruction; restore into a fresh authorized demo, never delete/reconcile selected rows or restore over the source.

## Transaction, namespace and durable completion

Use `MutationGate.runExclusive` and its existing key `847291643`, `lock_timeout=10s`, on one Prisma interactive transaction. Use READ COMMITTED: acquire the gate **before** baseline/marker reads so a waiting second writer sees the first commit. Set explicit finite transaction/statement limits (initial ceiling 120s, validated by timing) and process/test limits; timeout rolls back without cancelling another lock holder. Ordinary CRM writes using the shared gate wait; unrelated raw SQL writers are excluded operationally while generation runs.

Reserve the namespace `crm-showcase:` independent of seed/date/version. Every synthetic entity ID derives from scenario version + seed + reference instant + entity role/index using a stable hash with that prefix; movement/operation/effect IDs use the same scheme. Human identifiers use `CRM-DEMO-` prefixes (`Order.number`, supplier code, purchase number, coupon code); customer emails use `crm-demo-<index>@example.invalid`, with a simulation tag/notes. No fake `User`/login credentials are needed: guest checkout sessions and `Customer`/`CustomerAddress` provide the CRM graph. All child rows remain traceable by ID/parent; product IDs are always the existing imported identities.

**Completion marker:** reserve fixed `OrderHistory.id=crm-showcase:completion` on an ordinary generated order, event `NOTE_ADDED`, title identifying the simulation. Insert it last, within the same transaction, only after invariant checks. Metadata records `complete=true`, generator version, seed, reference instant, baseline digest, immutable generated manifest digest/counts and initial affected variant balances. Its `createdAt` is the reference instant. This preserves evidence in commercial history and avoids abusing checkout idempotency rows as global migration state.

Under the gate: valid marker → report `already-generated` and return without any writes, even for another seed/date and after legitimate admin mutations. Do not compare mutable statuses, quantities, coupon counters or current catalog digest to the original manifest on rerun. Missing marker + any reserved namespace row, malformed marker or identifier collision → fail without repair. The first run checks all generated unique keys (coupon code case-insensitively too, despite its non-unique schema index) before insertion. Atomic commit makes a partial legitimate CLI run impossible; missing evidence is not permission to regenerate.

The marker is not database-immutable against arbitrary SQL deletion; existing CRM commands only append history. Out-of-band deletion/tampering is unsupported and must stop rather than be reconciled. Seed/date/version changes do not create a second scenario in the same demo.

## Historical graph and inventory

Use a seeded PRNG and stable ID ordering for baseline selection, not query order, `Date.now`, random UUIDs or locale-dependent ties. Assemble a finite scenario, then persist commercial inserts and apply inventory events in chronological order `(event time, deterministic ID)`. Explicitly supply all generated `createdAt`/`updatedAt` and lifecycle times at insertion. Use the statistics module's existing period/time-zone semantics when placing paid orders relative to the reference; reserve an event at the reference instant for today's activity, never future dates.

Parents precede children: customers/addresses, suppliers/coupons/history, carts/items/sessions, purchases/items, orders/items/payment/history, redemptions and movements. Final order state/snapshots are assembled in memory from validated transitions and inserted once. Completed carts match checkout completion semantics (no active items); sessions retain the historical quote/customer/item snapshot. Manual orders have no invented checkout session. Abandoned carts retain live items and `ABANDONED` sessions, no order, no stock deduction, recovery status `PENDING`/`MANUAL`, deterministic SHA-256 token hashes and no `lastEmailSentAt` claiming a message was sent.

Destination, baseline, namespace and persistence prerequisite checks remain read-only in the gated service before historical writes. Within that same transaction, insert parents and purchases and apply their early historical receipts **before** validating shipping/pickup completion quotes: imported TRACKED quantities may be zero and legitimately funded by those receipts. Do not exclude zero-stock variants or require positive imported stock merely for quote preflight. Quote or downstream invariant failures roll back parents, receipts and all other scenario writes together; later receipts still cannot fund earlier deductions.

Session snapshots use the real `abandoned-carts.mapper.ts` reader fields: customer names/email/contact; items with product/variant IDs, names, SKU, quantity, unitPrice and lineSubtotal; totals/delivery/discount compatible with checkout. Verify via mapper/service, not merely JSON shape. Do not persist or log usable recovery plaintext tokens. Completion links are one session ↔ one order; nullable guest `userId`/redemption `userId` stay null. Customer identity hashes follow checkout's normalization. Create redemptions and increment counts when checkout consumes the coupon; cancellation does not invent a reversal of usage. Calculate validity at the usage instant and enforce limits against prior generated redemptions.

`OrderItem`/`PurchaseOrderItem` product/variant IDs, payment configuration IDs, and `InventoryHistory.referenceId` are not all protected by real foreign keys. Explicitly validate product/variant ownership and each polymorphic reference, in addition to database FK/unique/checks. Insert snapshots with effective server prices and normalized monetary rules; exclude catalog rows incompatible with immutable line constraints rather than alter catalog prices.

| Event | Effect and ownership |
|---|---|
| Imported balance | Read as initial quantity. No synthetic baseline receipt, `REPLACE`, or retrospective deduction. |
| Received purchase | On tracked variants, increment with `PURCHASE_ORDER_RECEIPT`, `referenceType=PURCHASE_ORDER`, actual purchase ID, operation ID and historical receipt time. DRAFT/ORDERED create no movement. Select tracked variants only for simulated purchases; avoid OUT_OF_STOCK-to-TRACKED mode conversion. |
| Checkout order placement, including pending | Deduct once with `CHECKOUT_DEDUCTION`. Manual sale creation uses `SALE_DEDUCTION`. Set `LEDGER_MANAGED` plus unique effect ID iff numeric movements exist; all-INFINITE orders use `NOT_APPLICABLE` and null effect. |
| Confirmation | Payment/state/history only, no inventory effect. |
| Cancel with restoration | Append `SALE_CANCELLATION_RESTORATION` referencing the original movement via `compensatesMovementId`, same effect ownership; keep original deduction unchanged. Save previous state/payment/logistics for operability. Cancel without restoration keeps the deduction. |
| INFINITE | Quantity stays null, no numeric movements for either sale or restoration. Mixed orders own only their tracked movements. |

Chronological planning must keep every intermediate tracked balance nonnegative, not just the final total. Reuse guarded deltas, and independently verify each movement's resulting quantity and the PRD balance equation against the saved imported balance. No arbitrary adjustment is needed. If there is insufficient stock, deterministically select another eligible line or fail before mutating; real receipts may fund later sales but cannot justify earlier deductions. Retain stock modes, all preexisting history, prices/relations/media and `salesCount`; catalog writes are limited to quantities and flags. Preserve baseline catalog `updatedAt` explicitly within the transaction (including restoring the original value after inventory primitives' automatic timestamp updates); this does not update any historical ledger or commercial snapshot.

After inventory events, rank available public products by units from this namespace's PAID, non-cancelled orders (not preexisting `salesCount`), tie by product ID; choose flags within PRD ranges. Featured selection covers available categories/brands deterministically. Only flags are changed; insufficient qualifying products fails the transaction. Completion evidence follows all graph/balance/catalog checks.

## Storefront: read-time selectors, not a new engine

Reuse `CatalogRepository.getPublicProducts()` (already traverses bounded pages) and the no-store HTTP adapter. A small pure `src/lib/product-discovery.ts` selector serves Home and `src/lib/data/shop-routes.ts`; it operates on the **complete public** read, never the current global featured page of four. This keeps the existing backend public visibility/taxonomy boundary and requires no new endpoint. Keep error and genuinely empty results distinct in touched routes.

Availability is existential across variants: `INFINITE` or `TRACKED quantity > 0`; OUT_OF_STOCK is never available. Existing API mapping converts infinite stock to `Number.MAX_SAFE_INTEGER`; use mapped variant availability for detail selectors and the corresponding backend-derived aggregate `ProductSummary.stock` for the card badge. Verify these projections agree; do not infer stock from flags, sum nullable quantities, or hide unavailable products from general catalog/detail.

- Home selects `isBestSeller && available` on each fresh read. Adapter mapping must preserve explicit server `false` flags (`??`, not current `||` mock fallback), otherwise imported products matching fixture slugs can acquire unintended flags.
- Related products exclude current ID, deduplicate, filter availability, then rank same category first and same brand second, tie by ID, take up to four. Category match means **intersection of directly assigned, visible canonical ProductCategory category IDs**; do not expand through parents (a shared broad supplement ancestor would erase useful affinity). Legacy mock products without canonical memberships may fall back to exact category slugs only; an explicitly empty canonical membership never falls back. Brand matching is trim + Unicode normalization + case-fold of nonempty real brand values, without fuzzy synonyms. Preserve a missing API brand as empty for affinity rather than treating presentation fallback `EntrenAR` as genuine shared brand. No featured requirement or arbitrary fill.
- `ProductCard` shows visible text “Sin stock” with sufficient contrast when aggregate availability is false; no color-only cue or live-region announcement on static cards. Keep detail links usable and existing buying/backend stock validation boundaries intact. Position badges without overlapping shipping/promotion labels at both densities.

No persistent result cache or store snapshot is added. A fresh catalog read after stock changes re-evaluates eligibility; concurrent checkout still relies on backend stock authority. Test membership matches beyond page one and multi-variant/infinite cases.

## Target areas and validation contracts

| Target | Responsibility |
|---|---|
| New `backend/src/modules/crm-showcase/{crm-showcase.main.ts,crm-showcase.command.ts,crm-showcase.service.ts,scenario.ts,historical-writer.ts,target-policy.ts}` and focused `*.spec.ts` | CLI-only wiring, deterministic data, guarded persistence and evidence; split only by these concrete responsibilities. |
| `backend/src/modules/inventory/inventory.repository.ts` and its input types/tests | Historical ledger ID/time and structured receipt context, preserving live defaults. |
| `backend/src/modules/purchase-orders/` calculation helper/service/tests | Share existing calculation without importing a live command for side effects. |
| `backend/src/modules/sales/` calculation helper/service/tests | Share the current private manual-sale calculator; retain live service transaction/command behavior. |
| Root/backend `package.json` | Independent command forwarding/compiled entrypoint, no seed/reset edits. |
| `src/lib/product-discovery.ts`, `src/lib/data/shop-routes.ts`, `src/app/(shop)/page.tsx`, `src/components/shop/products/ProductCard.tsx`, `src/lib/api/catalog/catalog-api.repository.ts` | Affinity, current availability, accessible badge, truthful flags/brand mapping. |
| `backend/test/crm-showcase.integration-spec.ts`, catalog adapter/discovery harness and `tests/e2e/crm-showcase.spec.ts` | Persistence proof and real CRM/storefront consumers. Operational backup/CLI instructions belong with the active delivery record. |

Validation must not inherit the existing integration setup's fallback to the habitual `DATABASE_URL`. A dedicated fixture explicitly requires `CRM_SHOWCASE_DATABASE_URL` plus authorization, checks identity **before** constructing any client, and binds `DATABASE_URL_E2E`/`DATABASE_URL` to that same disposable demo in its child process. Do not run broad destructive integration suites against an operator demo.

| Proof | Concrete assertion |
|---|---|
| Rollback | Inject failure after ledger writes and after flags but before marker; canonical whole-state digest equals the pre-run baseline, including history, counters and timestamps. Test FK/check/trigger failures without disabling constraints. |
| Concurrency | Two independent CLI processes/connections against one empty copy: one commit, second no-op or bounded lock-timeout with no writes; rerun after timeout no-ops. Also hold shared gate to prove bounded wait/rollback and no lock upgrade/nested transaction. |
| Idempotence | Run again after real service confirmation, cancellation/restoration and purchase receipt; whole-state digest before/after rerun equal. Namespace partial/collision/malformed marker fail unchanged. |
| Reproducibility | Copies A/B of same dump, seed/reference produce identical generated graph, timestamps, monetary values, movements, flags and final balances. Compare canonical sorted JSON/decimal values, not target identities/report durations. |
| Operability | On an additional disposable generated copy use real services/endpoints: confirm pending (no deduction), cancel eligible (one compensation; repeated request no further increase), receive ORDERED purchase (one increment); inspect unchanged immutable snapshots. |
| Read consumers | Real authenticated CRM lists/details/statistics/coupon/abandonment endpoints and browser routes from PRD; assert meaningful figures, names/items, state coverage, no 500s and no outbound integrations. Read selectors test depleted flagged products, one remaining variant, infinite, category vs brand ordering, fewer than four and no duplicates. |

Available commands after the implementation supplies the proposed tests/scripts (all with explicit bounded tool timeouts):

```bash
npm run build:backend
npm run test:backend -- --runTestsByPath src/modules/inventory/inventory.repository.spec.ts src/modules/sales/sales.state-machine.spec.ts
npm run test:backend -- --testPathPatterns=crm-showcase
npm run test:backend:integration -- --runTestsByPath test/crm-showcase.integration-spec.ts
npm run verify:frontend-acceptance
npx tsc --noEmit
npm run lint
npx playwright test tests/e2e/crm-showcase.spec.ts
```

The integration/browser commands require isolated destinations and dedicated application configuration; the planned new files are not yet runnable. Record dump/restore hashes, redacted identity, scenario summary and test outcomes, not credentials or full synthetic contact exports. This design changes documentation only; it does not claim database or runtime acceptance has been executed.

## Pending decisions / scope limits

No unresolved technical decisions. Runtime prerequisites (authorized dump/destination, adequate commerce configuration, scheduler evidence and local PostgreSQL tooling) are validation gates, not assumptions of completion. If satisfying them requires catalog/configuration repair, real personal-data handling, schema changes or changes to legacy seed/reset, stop and report the scope conflict instead of expanding this design.
