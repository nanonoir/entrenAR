# Design Correction Evidence — Revision 4

## Current Owner Direction — Supersedes Role-Provisioning Blockers

The canonical PRD now includes Trusted Local Maintenance Scope and Execution Authorization (Engram 2022). The owner explicitly authorizes bounded local commercial cleanup and frozen-catalog import while preserving admins, 61 categories, configuration and R2. This is trusted privileged-owner maintenance; defending against a hostile PostgreSQL superuser and separating runtime/migration roles are outside scope and must not block the operation.

Earlier statements in this evidence file that local cleanup/import remain unapproved or that cluster-wide role provisioning is required are historical, not current routing instructions. No cluster roles or runtime credential changes are authorized. The existing append-only trigger conflict, dependency scheduling defect, CUSTOMER eligibility defect, failing scratch tests, and backup-restoration prerequisites remain concrete technical issues; they have not been fixed by this document correction.

The user explicitly requested direct micro-adjustments to documents rather than repeated full-cycle SDD delegation. Preserve prior work and approvals. This note records decisions and corrects stale metadata; it is not a completed replacement technical design or a claim of verification success.

## Authorization and Runtime Evidence

Read-only design investigation; no test runner, DB, source, migration, Git or R2 writes. Orchestrator reports scratch integration 1 passed/3 failed and focused unit 21 passed/1 failed; these are supplied runtime results, not executor reruns. Prior completion remains 17/25. Real cleanup/import remain unauthorized.

## Ledger Policy Blocker

- `backend/prisma/migrations/20260824182000_catalog_persistence_constraints/migration.sql:45–57` creates `prevent_inventory_history_mutation()` with unconditional exception and `InventoryHistory_append_only`, BEFORE UPDATE OR DELETE, FOR EACH ROW. There is no transaction-local maintenance condition.
- `20260824181601_catalog_persistence_foundation/migration.sql:184–187` gives inventory product/variant FKs ON DELETE RESTRICT. Retaining ledger rows therefore cannot satisfy empty Product; compensation adds history rather than enabling removal.
- `20260909193000_backend_core_p0_stabilization/migration.sql:52–55` adds compensation RESTRICT, not a cleanup exception. Searches of all repository migrations found no subsequent trigger replacement or scoped maintenance path.
- `backend/src/common/prisma/mutation-gate.ts:34–46` coordinates transaction locks; it grants no trigger exemption. Showcase catalog restorer upserts; `showcase-reset/inventory-reconciler.ts:29–47` replaces stock and appends history. Neither permits ledger deletion.
- Scratch test `TRUNCATE ... CASCADE` and scraper benchmark truncation are not approved-row deletion mechanisms and cannot be reused for real cleanup.

**Decision:** fail closed before deleting ledger rows, with a sanitized `APPEND_ONLY_POLICY_BLOCKS_CLEANUP` blocker. Bind relevant trigger definitions, function bodies and enabled state into schema evidence and recheck under locks; FK-only digest is insufficient. Existing trigger remains active; no DROP/DISABLE, replication-role change, unrestricted GUC exemption or fabricated privileged bypass.

## Dependency-Cycle Diagnosis

The catalog FKs are acyclic: Product→Image, Product→Variant, Image→Variant (impact direction). `20260925000000_catalog_import_readiness_foundation:21–27` requires deletion Variant→Image→Product. `20260926010000_catalog_import_readiness_constraints` adds deferred AFTER INSERT Product presence validation, not a DELETE cycle; seed Product+Variant together as already implemented.

Actual false cycle: `fixture-provenance.ts:279–289` orders `operationId` peers lexically by HMAC; `:339–361` and repository `:251–277` treat every impact edge as precedence. Original→compensation FK can oppose compensation→original group edge. Read-only deterministic HMAC calculation with the test key confirms opposite orientation for `movement-a` (`ff77…` original / `4775…` compensation) and `movement-disconnected` (`882d…` / `8764…`). Audited/rollback movement pairs have the other orientation.

Extract shared `deletion-plan.ts`: preserve all impact/group coverage, exclude membership edges from precedence, order referencing dependencies first, reject actual precedence/compensation cycles. Never omit primaryImageId RESTRICT, null references, or delete a Product and trust unspecified cascade order. Test both HMAC orientations and actual cycles.

## Administrator-Session Semantics

`CANDIDATE_MODELS` omits `User` although `isCandidate()` and `POPULATION_ROOTS` specify CUSTOMER users. Consequently the role check is unreachable and the new regression sees preserved rather than mock. **Correct implementation, not expectation:** include User with CUSTOMER-only eligibility. CUSTOMER owner stays attested mock; ADMIN RefreshToken stays preserved. Add `OUT_OF_SCOPE_DELETE_EFFECT` to both; cleanup rejects and leaves both unchanged. The initial auth migration's RefreshToken.userId Cascade validates collateral risk. Do not reassign/delete sessions or silently exempt owners from classification.

## Exact Amendment and Routing

Minimum recommended request: authorize designing a new local-only, transaction-bound, exact-approved-ledger-row deletion exception while ordinary ledger UPDATE/DELETE remains prohibited. This changes append-only architecture, not merely test fixtures. It requires an explicit PRD policy clause, proposal capability delta, spec scenarios for ordinary denial/approved exception/wrong target or row/rollback/preserved-state, then design review of a DB-enforced authorization boundary. A prospective new migration under `backend/prisma/migrations/<new>_scoped_fixture_ledger_cleanup/migration.sql` and cutover adapter/tests would be new scope; do not edit historical migrations. Its concrete privilege mechanism is unresolved and MUST NOT be invented during apply.

Tradeoff: a tightly guarded exception enables the requested same-database cleanup but expands the trusted maintenance surface. Retaining unconditional append-only avoids that expansion but blocks this cutover; keeping products or switching databases would change approved empty-Product/target requirements. Full reset, trigger disabling and compensation generation are not alternatives within scope.

**Next:** orchestrator asks one user decision; if accepted, route `prd-refine → proposal/spec reconciliation → design → sdd-tasks → sdd-apply`. Otherwise keep blocked. Task refresh is limited to schema-policy evidence, shared planner, User eligibility and WU5 scratch proof; do not erase completed work or present ledger-free success as full cleanup verification.

## Revision 5 Reconciliation — Privilege-Scope Decision

The revision-4 policy question is resolved by #2018 and the amended PRD/proposal/both specs. Dedicated frontend revalidation #2004 resolves `not_required`. The remaining blocker is **principal provisioning**, not whether the ledger exception is desired.

### Read-Only Evidence and Limits

- CodeGraph was consulted first; pending-source warnings were followed by direct reads. No executor DB connection, test runner, Git write, R2 operation or implementation edit occurred.
- `backend/prisma.config.ts:11–13` and `backend/src/common/prisma/prisma.service.ts:8–17` both use `DATABASE_URL`; no migration/runtime credential separation is established there.
- `docker-compose.yml` uses the configured PostgreSQL bootstrap username for the backend connection. This is unsafe evidence for assuming a restricted runtime principal; it is not a live privilege audit. Do not print connection strings or credentials.
- All repository migrations were searched for role grants/revocations/security-definer setup; none establish the required maintenance/issuer/owner boundary. The historical trigger/FK findings above remain valid.
- Actual deployed role attributes, ownership, memberships, defaults, PUBLIC grants and role-changing privileges were **not** inspected through a database connection. Future read-only preflight must verify them; absence of evidence is not permission to proceed.
- PostgreSQL roles are cluster-wide. Creating role fixtures on the existing server is not isolated to `entrenar_catalog_cutover_scratch`; #2014 approves scratch provisioning/migrations/testing, not cluster-wide principal creation or changing application credentials. Database owners/superusers can bypass policy; trigger checks do not turn them into restricted normal callers.

### Proposed Defensible Boundary, Conditional on Scope Approval

`design.md` revision 5 specifies separated principals, protected approval/scope records, trusted target enrollment, a durable single-use reservation and per-call exact-row permits. It is a proposed design, not evidence that these controls exist. Private SQL objects are intentionally outside Prisma models; no `backend/prisma/schema.prisma` change is essential.

The migration creates database-local private objects and replaces `public.prevent_inventory_history_mutation()` with CREATE OR REPLACE; the existing `InventoryHistory_append_only` trigger stays enabled and attached. Target enrollment remains disabled until a separately authorized trusted installer pins the cluster system identifier (checked server-side via narrowly granted `pg_control_system()`), database OID/name/schema and approved external local fingerprint. Restored copies are not automatically enrolled. Production and unenrolled destinations fail closed. Host/DB administration is trusted: SQL cannot prove an external network destination from a caller's URL or protect itself from its own superuser.

An issuer-only registration function persists exact ledger IDs/complete JSONB baseline rows, approved all-model baseline/deletion/preservation sets, evidence digests and expiry after backup/restore/scope approval. It cannot accept a boolean bypass; ordinary/maintenance callers cannot execute registration or edit protected tables. Human backup validity is an issuer trust responsibility, not a fact a ledger trigger can independently infer.

Use a fixed enumerated model list for database snapshot comparison and sorted table locking; canonical JSONB equality is separate from public HMAC evidence. Recheck trigger/function definitions, enabled state, ownership, privileges and memberships against approved policy evidence. Internal guard bookkeeping is not commercial population: hash definitions/enrollment in policy evidence; keep authorization state separately auditable without including self-mutating reservations in commercial drift comparisons.

Reservation occurs **after** the cleanup connection acquires the exclusive advisory/table locks and obtains a full transaction ID. A separate autocommit executor connection may reserve only an issuer-approved ticket; it verifies `pg_stat_activity` identity/backend-start/backend transaction ID for the supplied cleanup backend and same executor login, then permanently records consumption. Full transaction ID and backend-start avoid wraparound/PID reuse. No locks on guard records may be held by cleanup before reservation. If reservation commits but cleanup fails, the ticket is burned; a new approved ticket is required. If reservation outcome is uncertain, reconcile read-only rather than retry.

Only the bound cleanup connection can call begin/delete/finalize. Private permits are per invocation and exact row; the trigger checks operation DELETE, actual session/backend/transaction, target enrollment, reservation, expiry, OLD equality and permit. UPDATE always fails. Executor has no direct ledger DELETE/UPDATE/TRUNCATE; function owner has only needed private-object and ledger privileges, not app-wide ownership. All SECURITY DEFINER functions qualify objects, fix search_path with no writable schema precedence, revoke PUBLIC EXECUTE, and forbid arbitrary SQL/table identifiers. Owners/issuer/migration credentials must not be available to the app or executor; verify transitive membership and SET ROLE privileges, not just role flags.

Begin records a transaction-local private context. A deferred constraint trigger on that context rejects commit unless finalization has validated the complete approved deletion set, empty Product, the canonical category set and unchanged preserved rows. Finalization rejects missing ledger deletions, partial cleanup, stale policy or leaked permits. Setting constraints immediate early fails rather than skipping validation. All data/context/permits roll back together; only the durable audit reservation remains consumed. Revoke capability and restore unconditional append-only prospectively for policy rollback; retain reservation tombstones. Never drop/disable the ledger trigger, change replication role, null RESTRICT references or rewrite historical migrations.

### Exact Prospective Scope and Work-Unit Handoff

**Not implementation authorization.** Tasks must reconcile this proposal only after the privilege decision; do not edit old checkboxes or infer new task totals here.

| Proposed unit | Paths / change | Budget target |
|---|---|---:|
| WU1-R | `backend/src/modules/catalog-cutover/catalog-cutover.repository.ts`, `cutover-contracts.ts`, `catalog-cutover.spec.ts`: actual destination/policy/privilege evidence, versioned evidence and trigger drift | <=400 additions |
| WU2-R | `backend/src/modules/catalog-cutover/deletion-plan.ts`, `deletion-plan.spec.ts`, `fixture-provenance.ts`, existing `catalog-cutover.spec.ts`: shared ordering/closure tests, CUSTOMER eligibility and collateral guards | <=400 |
| WU-L1 | `backend/prisma/migrations/20261002000000_scoped_fixture_ledger_cleanup/migration.sql`: private objects, grants, scoped functions, trigger function replacement, deferred finalization; no CREATE ROLE or enrollment inside generic migration | <=400; split before >600 |
| WU-L2 | `backend/src/modules/catalog-cutover/ledger-cleanup.adapter.ts`, `catalog-cutover.repository.ts`, `catalog-cutover.service.ts`, `catalog-cutover.command.ts`, `cutover-contracts.ts`, `catalog-cutover.command.spec.ts`: separate credential injection, server binding, reservation/reconciliation and function calls | <=400 |
| WU-L3 | `backend/test/catalog-cutover-ledger.integration-spec.ts`: independent ordinary/maintenance/issuer sessions and all boundary denial/rollback/finalization proofs | <=400; split before >600 |
| WU5-R | `backend/test/catalog-cutover.integration-spec.ts`: approved real ledger rows, compensation, complete cleanup/late failure, preserved state and writer isolation | <=400 |
| WU6-R | change-local `cutover-runbook.md`: privileged setup receipts, migration rollback, burned approvals and three real-target gates | documentation |

Conditional operator provisioning artifact: change-local `ledger-privilege-setup.md` (created by tasks/apply only after approval), documenting explicit principal creation/grant/runtime credential scope and corresponding rollback. No root Docker/config/.env edits are included in the currently approved scope. A separately approved deployment plan must name any runtime connection changes; never persist secrets in artifacts. Scratch tests must use pre-provisioned approved restricted principals or a separately approved isolated PostgreSQL cluster, not silently create cluster-wide roles through the existing helper. Additional process setup would need its own threat-matrix/task reconciliation.

Historical WU1/2/4/5 work is retained; refresh validations with new unchecked tasks. WU3 restore coverage must include new private policy objects without restoring enrollment/active permissions. WU7 remains read-only real-local evidence after implementation/proofs. WU8/9 remain independently gated. The real-target migration/enrollment gate precedes fresh audit/cleanup approval; migrating invalidates old policy evidence and requires a fresh/restorable backup. No existing permission authorizes real deployment, deletion or import.

### Required Decision and Tradeoffs

1. **Authorize narrowly specified principal provisioning and runtime-role separation planning**, including an explicit isolated testing strategy. Benefit: a credible DB boundary; cost: operational/security scope beyond one database-local migration and adapter. Route through PRD/proposal/spec reconciliation if product/scope changes, then finish design and tasks before apply.
2. **Retain current provisioning scope and unconditional append-only policy.** Benefit: no privilege/configuration expansion; cost: requested same-database empty-Product cutover remains blocked by RESTRICT. No full reset, database switch, bypass flag or retaining ledger while deleting referenced products is an approved substitute.

The executor does not choose this additional scope on the user's behalf. `nextRecommended: resolve-blockers`; design remains partial. No tasks/apply runner is ready. No new implementation/DB/Git/R2/review authorization was issued.
