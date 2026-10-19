# Design: Admin Correction Flow — Envíos Auth, Pagination Contracts and Statistics Sources

## Technical Approach

Keep admin authority in the browser session model already defined by the admin auth design: the access token is in memory only and every protected read happens after client bootstrap. Fix correctness issues at the layer that owns them (schema, backend DTO, page) without widening contracts.

## Architecture Decisions

### Decision: Envíos pages read through the client store

**Choice**: `/admin/envios` and `/admin/envios/detalle/[envioId]` are thin server wrappers around `ShipmentTrackingPageClient` / `ShipmentDetailPageClient`, which load through `useAdminSalesStore`.
**Alternatives considered**: Forwarding the admin cookie to the backend from the RSC (creates a server-side admin token path, forbidden by the auth design).
**Rationale**: The RSC called `salesRepo` without a session and failed with a 500. The store already authenticates, retries and handles errors.

### Decision: Strict sales/customer contracts with one targeted widening

**Choice**: Add `customerId` (optional) to the sales summary schema. Customer route ids are decoded once by `decodeRouteParam`; adapters encode once.
**Alternatives considered**: Relaxing schemas to `passthrough`; double decoding.
**Rationale**: Strict schemas catch contract drift. `variantName` and `weightGrams` were already accepted; they are covered by a regression test.

### Decision: Customer list carries `summary`

**Choice**: `CustomersService.listCustomers` adds `summary` (paid, non-cancelled orders) to each item using the already loaded `orders`.
**Alternatives considered**: Frontend computing from the sales store (the previous behaviour, which produced 0 purchases).
**Rationale**: One authoritative metric, same rule as detail and export.

### Decision: Inventory pagination is client-side

**Choice**: Load the full catalog through the store and apply search, stock/category filters and 25-per-page pagination in `inventory-view.ts`; state is kept in the URL (`history.replaceState`).
**Alternatives considered**: Server pagination.
**Rationale**: Inline stock edits and optimistic updates depend on the full store. Server pagination would require a store refactor and is a recorded limitation (650-item loads remain).

### Decision: Statistics only show real sources

**Choice**: Pages render loading/error/empty states instead of fixtures. Sources: `GET /admin/statistics/{overview,sales,products,customers,coupons}`. The fixtures remain only behind the mock repository. Visits and visitor behavior have no source and are shown as unavailable. The out-of-stock list shows 10 items plus `+N más` with the real total and item-id keys.
**Rationale**: Never present simulated numbers as real.

### Decision: Opaque ids as short references

**Choice**: `shortReference` (first 6 + last 4) with `CopyReference` to copy the full id. Order numbering is not invented.

### Decision: Dirty state from normalized values

**Choice**: `hasFormChanges` compares current values to the initial baseline treating `""`, `null`, `undefined`, `NaN` as empty; the guard is armed only if RHF `isDirty` and the comparison both report changes.
**Rationale**: Native number/radio inputs made untouched forms dirty and armed `beforeunload`.

## Limitations

- No traffic/visits source exists.
- Inventory and `/admin/productos` load the whole catalog (client-side pagination over full in-memory store).
- Note: The customer list OpenAPI DTO (`CustomerResponseDto`) was aligned to declare optional `summary` matching the backend service mapper during review remediation.
