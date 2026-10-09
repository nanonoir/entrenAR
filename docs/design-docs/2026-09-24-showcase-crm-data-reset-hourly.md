# Design: Hourly CRM Showcase Data Reset

## Technical Approach

Add a compiled one-shot Nest application-context command. It consumes a typed canonical manifest shared with seed helpers, acquires PostgreSQL advisory locks, and delegates ordered fixture families to focused restorers inside one Prisma transaction. Systemd invokes the command in the existing backend container. No auth module, HTTP, UI, or full-seed path participates.

## Architecture Decisions

| Choice | Alternatives | Rationale |
|---|---|---|
| Compile the manifest under `src/modules/showcase-reset/fixtures/`; import it from seed and reset | Invoke `seed.ts`; keep manifest under excluded `prisma/` | Production image contains only `dist`; shared typed data avoids seed-only admin/password behavior. |
| Retain the existing Nest build layout and invoke `dist/src/modules/showcase-reset/showcase-reset.command.js` | Add a second production tsconfig, change `rootDir`, or otherwise flatten `dist` | The current build emits the command under `dist/src`; using that output avoids a divergent production build configuration solely for this command. |
| Dedicated `pg.Client` session mutex plus Prisma transaction advisory gate | `flock`; row locks | The mutex owns one connection for the process lifetime; shared/exclusive transaction locks coordinate all containers. |
| Family restorers behind one orchestrator/transaction | God service; per-family commits | Keeps domain mapping reviewable while preserving all-or-nothing restoration and reconciliation. |

## Architecture Contract

- **Identity:** only manifest identities are writable. Upsert canonical rows in place; upsert required composite relationships. Unknown/ambiguous rows and extra relationships are preserved. No heuristic selection, broad delete, `TRUNCATE`, ID replacement, or migrate reset. One-to-one `CustomerAddress` is scoped by an explicit canonical customer and updated by `customerId`; absence in the manifest authorizes removal only for that canonical parent.
- **Resettable map:** `Category`, `Product`, `ProductVariant`, required `ProductCategory`, `CatalogSettings`; `PaymentMethodConfig`, `ShippingProvider`, `WeightBand`, `PickupPoint`; checkout-fixture `User`, `Cart`, `CartItem`, `CheckoutSession`, `Coupon`, `Order`, `OrderItem`, `OrderPayment`, `CouponRedemption`, `CheckoutIdempotencyKey`; manifest `Customer`/`CustomerAddress`; abandoned-fixture carts/items/sessions/history plus `CartRecoverySettings`; `Supplier`; fixture `OrderHistory`. IDs come exactly from current `CATEGORIES`, product/variant arrays, payment/provider/band/pickup constants, `CHECKOUT_FIXTURE` plus `checkout-seed-redemption`, `CUSTOMER_SEEDS`, `ABANDONED_CART_FIXTURES`, `SUPPLIERS`, singletons, and `sales-crm-seed-order-created`.
- **Preserved map:** all `RefreshToken` rows (ADMIN and CUSTOMER), unknown rows in every model, `UserAddress`, `WishlistItem`, `PasswordResetToken`, prior `InventoryHistory`, `PickupPointSchedule`, `CouponCategory`, `CouponProduct`, `CouponHistory`, `ShippingDiscount*`, and all `PurchaseOrder*` (no current fixtures). Historical visitor snapshots are never rewritten.
- **FK order:** parent categories → products → required category pairs → variants excluding stock → commerce parents/bands/pickup → checkout user/customer/address → carts/items/sessions/history → coupon → order/items/payment/redemption/idempotency/order-history → abandoned fixtures/settings → suppliers → inventory reconciliation.
- **Locks/transaction:** acquire `pg_try_advisory_lock(RUN_KEY)` on a dedicated client or exit `20`; then one Prisma transaction executes `SET LOCAL lock_timeout='10s'`, takes `pg_advisory_xact_lock(MUTATION_KEY)`, restores, and reconciles. Checkout/admin mutation transaction entrypoints in catalog, commerce, inventory, checkout, sales, abandoned-carts, customers, suppliers, and purchase-orders take `pg_advisory_xact_lock_shared(MUTATION_KEY)`. Timeout exits `21`; other failure exits `1`; rollback is complete and holders are never cancelled.
- **Inventory:** for each manifest product/variant, compare baseline, replace stock state, and append `InventoryHistory` only on difference: `operation=REPLACE`, `origin=showcase-reset`, `referenceType=RECONCILIATION`, run ID, signed delta when quantities are defined. Retain all history.
- **Sessions/observability:** reset never reads, updates, revokes, or validates refresh sessions. Emit one bounded JSON report with run/timing/outcome/family created-updated-preserved counts, lock state, and failure category; exclude secrets and raw PII.

## Data Flow

`systemd/manual → docker compose exec → compiled command → run mutex → exclusive mutation gate → ordered restorers + reconciliation → commit → JSON/exit`

## File Changes

| File | Action | Description |
|---|---|---|
| `backend/src/modules/showcase-reset/{fixtures,restorers}/*`, `showcase-reset.{module,service,repository,command}.ts` | Create | Manifest, family writers, orchestration, report. |
| `backend/prisma/seed.ts`, `backend/prisma/fixtures/*.ts` | Modify | Consume shared manifest; retain full seed entrypoint. |
| `backend/src/common/prisma/mutation-gate.ts` and affected domain repositories | Create/Modify | Shared/exclusive advisory coordination. |
| `backend/package.json`, `backend/test/showcase-reset.integration-spec.ts` | Modify/Create | Compiled command and tests. |
| `deploy/systemd/entrenar-showcase-reset.{service,timer}` | Create | Hourly non-catch-up execution. |

## Interfaces / Contracts

`ShowcaseFixtureManifest` is readonly; `FixtureRestorer.restore(tx, report)` is family-scoped. `ShowcaseResetReport` is bounded and secret-free. Package script: `node dist/src/modules/showcase-reset/showcase-reset.command.js`.

## Testing Strategy

| Layer | RED coverage |
|---|---|
| Unit | Manifest uniqueness/completeness, report redaction/bounds, reconciliation delta/no-op. |
| Integration | Exact restore/preservation including both session types; FK order; 100-run convergence; injected rollback; mutex rejection; shared-lock wait/success and >10s rollback; retained history/snapshots. |
| Operations | Production-image command, exact systemd unit/timer, manual parity, no catch-up, journald/exit propagation, <30s VPS run. |

## Threat Matrix

| Boundary | Applicability / response | Planned RED tests |
|---|---|---|
| Documentation-like paths | N/A — no executable classification or user-selected path. | None |
| Git repository selection | N/A — no Git process. | None |
| Commit state | N/A — no VCS mutation. | None |
| Push state | N/A — no push/ref resolution. | None |
| PR commands | N/A — no PR automation. | None |
| Shell/Docker/systemd process | Applicable — tokenized fixed `ExecStart`, absolute project directory, no shell/interpolation; propagate container/command failure. | Reject altered/interpolated unit; backend unavailable and command failure remain non-zero; assert `-T`, `OnCalendar=hourly`, `Persistent=false`. |

## Migration / Rollout

Build/test image, run manually, observe one successful report, then install/enable units. `ExecStart=/usr/bin/docker compose --project-directory /opt/entrenar exec -T backend npm run showcase:reset`; timer uses `OnCalendar=hourly`, `Persistent=false`. Roll back by disabling units and reverting image/code; never alter the PostgreSQL volume.

## Open Questions

None.
