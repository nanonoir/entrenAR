# Technical Debt Tracker

Concrete unresolved technical debt items tracked across the EntrenAR repository.

## Active Items

### 1. Unified CRM Form Architecture Migration (RHF + Zod)
- **Context**: The Admin CRM product and catalog drawers were migrated to React Hook Form + Zod, but shop forms (Checkout, Account Profile) still use manual React state validation.
- **Impact**: Inconsistent validation patterns between public storefront forms and back-office CRM forms.
- **Reference**: Established in earlier phases (`crm-products`, `sales-flow-manual-fixes`). Dedicated refactor phase needed.

### 2. Mock Boundary Simplification and Full Showcase Live Transition
- **Context**: While the real catalog (649 products, 1,119 variants) and core backend modules are operational, fallback mock adapters still exist under `src/lib/data` for selected preview/standalone surfaces.
- **Impact**: Maintenance overhead for duplicate mock structures alongside production REST adapters under `src/lib/api`.
- **Reference**: `src/lib/data/` fallback harnesses.

### 3. Payment Gateway Integration (MercadoPago / Direct Acquirers)
- **Context**: The checkout contract, order generation, and transactional inventory ledger are implemented, but real payment gateway processing (e.g. MercadoPago webhook processing and hosted checkout) remains mocked or pending.
- **Impact**: Orders cannot complete automated online payment verification without manual intervention or test mocks.

### 4. Media Asset Pipeline & Showcase Visuals
- **Context**: While real catalog data and Cloudflare R2 handoff exist, certain product visuals still rely on fallback static SVGs and mock image tones rather than fully uploaded and optimized assets.
- **Impact**: Product cards display placeholder visuals in select categories during offline or preview runs.
- **Reference**: `docs/references/prds/realistic-showcase-seeder-and-media.md`.

### 5. Automated Showcase CRM Reset Simulator
- **Context**: The hourly showcase data reset mechanism for public demo environments is specified but remains pending full implementation and cron scheduling.
- **Impact**: Showcase demo modifications accumulate until manual database re-seeding occurs.
- **Reference**: `docs/design-docs/2026-09-24-showcase-crm-data-reset-hourly.md`.

## Resolved Items

### 6. CRM Showcase Runtime Verification (Resolved: 2026-10-09)
- **Context**: The initial isolated runtime verification was blocked due to pre-existing administrative authentication rows and unconfigured commerce prerequisites.
- **Resolution**: Trusted owner explicitly authorized local execution on `127.0.0.1:5432/entrenar`. Verified with private backup (40 tables restored and validated on isolated port 55439), manual demo commerce options configured, real checkout (2/2) and persistence test suites (9/9) passed on isolated copies. Single-shot generation succeeded (80 orders, 20 customers, 3 suppliers, 4 purchases, 6 coupons, 8 abandoned carts) and rerun proved idempotent (`already-generated` with identical full-state digest). Preserved 42 ADMIN users and 127 refresh tokens. 21 real HTTP endpoints passed with 200 OK. Independent review concluded with PASS WITH FINDINGS (code and runtime accepted).
- **Reference**: `docs/exec-plans/completed/crm-showcase-simulator.md`, `docs/exec-plans/completed/crm-showcase-simulator/local-owner-evidence.md`, `docs/exec-plans/completed/crm-showcase-simulator/backend-operator-guide.md`.
