# Design: Backend Core Phase 8 — Abandoned Carts Recovery

## Technical Approach

We will implement a Unified `CheckoutSession` Lifecycle to manage abandoned carts. Instead of creating a duplicate `AbandonedCart` table, we will leverage the existing `CheckoutSession` and `Cart` models from Phase 5, augmenting them with audit history (`CheckoutSessionHistory`), recovery configurations (`CartRecoverySettings`), and new terminal states (`DISCARDED`). The backend NestJS application will be the single source of truth, enforcing strict state transitions and RBAC access, while the frontend will be upgraded with a dual-mode repository adapter to communicate with the real API or fallback to mock data seamlessly.

## Architecture Decisions

### Decision: Reuse `CheckoutSession` vs Standalone `AbandonedCart` Entity
**Choice**: Extend the existing `CheckoutSession` model.
**Alternatives considered**: Create a decoupled `AbandonedCart` table that clones cart data.
**Rationale**: Reusing `CheckoutSession` avoids data duplication and synchronization lag. The session naturally holds all context (items, customer snapshot, timestamps) created during checkout. Adding a history table and recovery status to the session cleanly fulfills CRM requirements without adding structural complexity.

### Decision: State Machine Enforcement
**Choice**: Use a strict transition matrix in `abandoned-carts.state-machine.ts`.
**Alternatives considered**: Ad-hoc status updates in the repository or controller.
**Rationale**: Recovery actions (email, manual contact, order conversion) must be idempotent and mutually exclusive to terminal states (e.g., cannot send an email to a discarded or recovered cart). Centralizing this in a pure state machine makes it fully testable.

### Decision: Recovery Link Security
**Choice**: Store only the SHA-256 hash of a 32-byte cryptographically secure random token.
**Alternatives considered**: Storing plaintext tokens or predictable UUIDs.
**Rationale**: Recovery links bypass normal authentication to allow a user to resume a session. Cryptographic randomness prevents enumeration attacks, and storing hashes prevents malicious internal actors or database dumps from hijacking active carts.

## Architecture Overview & Context

**System Boundary**: The Next.js frontend acts purely as a presentation layer expressing intent (fetching lists, sending actions). The NestJS backend handles all authoritative rules, RBAC (`ADMIN`), token generation, and database interactions via Prisma.

**Data Flow**:
1. **Sweep**: An active checkout session passes the configured threshold (e.g., 24 hours). A query or idempotent sweep identifies it, updates `status = ABANDONED`, and logs a `SESSION_ABANDONED` event.
2. **Action**: The admin triggers an action via `/api/v1/admin/abandoned-carts/:id/email`.
3. **Execution**: The backend state machine validates the transition, generates a token, updates `recoveryStatus = SENT`, and logs `RECOVERY_EMAIL_SENT`.
4. **Resumption**: The customer clicks the secure link containing the raw token. The backend hashes it, matches `recoveryTokenHash`, ensures it hasn't passed `recoveryExpiresAt`, and restores the cart.

## Database Schema & Migrations

**Location**: `backend/prisma/schema.prisma`

1. **Enums**:
   - Extend `CheckoutRecoveryStatus` with `DISCARDED`.
   - Add `CheckoutSessionHistoryEventType`: `SESSION_CREATED`, `SESSION_ABANDONED`, `RECOVERY_EMAIL_SENT`, `MANUAL_CONTACT_LOGGED`, `SESSION_RECOVERED`, `SESSION_DISCARDED`, `NOTE_ADDED`.

2. **Models**:
   - **`CheckoutSession`**: Add `recoveryTokenHash String? @unique`, `recoveryExpiresAt DateTime?`, `lastEmailSentAt DateTime?`, and `history CheckoutSessionHistory[]`.
   - **`CheckoutSessionHistory`**: 
     `id` (cuid), `checkoutSessionId`, `type`, `title`, `description?`, `actorId?`, `actorRole?`, `metadata` (Json), `createdAt`. Indexes on `[checkoutSessionId, createdAt]`, `[actorId, createdAt]`, and `[type, createdAt]`.
   - **`CartRecoverySettings`**:
     Singleton model with `id @default("singleton")`, `isActive`, `timing` (`24hs`), `emailSubject`, `emailHtmlBody`, `emailPlainBody`, `createdAt`, `updatedAt`.

## NestJS Backend Implementation

Located in `backend/src/modules/abandoned-carts/`:

- `abandoned-carts.module.ts`: Root configuration, providing the repository and service.
- `abandoned-carts.schemas.ts`: Zod schemas for transport validation (queries, params, payloads).
- `dto/abandoned-carts-openapi.dto.ts`: OpenAPI documentation definitions.
- `abandoned-carts.state-machine.ts`: Pure functions determining if a session can transition to a target recovery state.
- `abandoned-carts.repository.ts`: Abstracted Prisma logic. Handles paginated `findMany` with text search and status filters, inserts `CheckoutSessionHistory` via transactions, and fetches full session aggregates (Cart + Items + Products + History).
- `abandoned-carts.service.ts`: Business orchestrator. Calculates thresholds against `CartRecoverySettings.timing`. Uses `crypto.randomBytes(32)` and `crypto.createHash('sha256')` for recovery links. Maps domain events to history logs.
- `admin-abandoned-carts.controller.ts`: Mounts endpoints. Enforces `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(Role.ADMIN)`.

## API Contract Details

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/admin/abandoned-carts` | Paginated listing. Query: `status`, `search`, `from`, `to`, `page`, `limit`. Returns items, pagination, and summary metrics. |
| `GET` | `/api/v1/admin/abandoned-carts/:id` | Returns full cart detail, customer snapshot, items, recovery link, and chronological history timeline. |
| `POST`| `/api/v1/admin/abandoned-carts/:id/email` | Simulates email dispatch, returns secure URL, updates to `SENT`. |
| `POST`| `/api/v1/admin/abandoned-carts/:id/manual`| Payload: `{ note?: string }`. Transitions to `MANUAL`. |
| `POST`| `/api/v1/admin/abandoned-carts/:id/convert`| Payload: `{ notes?: string }`. Converts to Order, updates to `RECOVERED`. |
| `POST`| `/api/v1/admin/abandoned-carts/:id/discard`| Payload: `{ reason: string }`. Transitions to `DISCARDED`. |
| `GET`/`PUT` | `/api/v1/admin/abandoned-carts/config` | Reads/updates `CartRecoverySettings` boolean and timing values. |
| `GET`/`PUT` | `/api/v1/admin/abandoned-carts/template` | Reads/updates email strings containing mustache templates `{{nombre}}`. |

## Frontend Architecture & Repositories

**Location**: `src/lib/api/admin/abandoned-carts/`

The frontend adopts a dual-mode adapter architecture:
- `contracts.ts`: Exported Zod schemas matching the backend contracts.
- `repository.ts`: Base `AbandonedCartsRepository` interface.
- `api-abandoned-carts-repository.ts`: Uses Next.js `fetch()` passing authenticated JWTs to interact with NestJS.
- `mock-abandoned-carts-repository.ts`: Full in-memory replacement with simulated latency, storing events and carts locally.
- **Zustand Store Refactor**: `src/stores/admin-abandoned-carts-store.ts` will shift from synchronous pure-state to asynchronous `async loadCarts()` style, handling optimistic updates and error states (graceful fallback to mock repository on 5xx or offline).
- **UI Integrations**:
  - `src/app/(admin)/admin/ventas/carritos/page.tsx`: Bind listing with URL search params. Implement the Detail Modal/Drawer, rendering the interactive history timeline and action buttons.
  - `RecoveryConfigModal.tsx` & `email/page.tsx`: Apply `react-hook-form` and `@hookform/resolvers/zod` matching the `build-form` skill, plus an unsaved changes interceptor.

## Delivery & Stacked Slices (PR Breakdown)

Plan to merge changes to `main` via small stacked feature branches (`feature-branch-chain`), keeping each under 600 lines.

| PR | Scope | Description |
|---|---|---|
| 1 | **Prisma & Domain Models** | DB migrations for `CheckoutRecoveryStatus.DISCARDED`, `CheckoutSessionHistory`, `CartRecoverySettings`. Update Prisma client. |
| 2 | **Backend State Machine & Schemas** | Implement Zod schemas, state transition logic, and unit tests. |
| 3 | **Backend Repository Layer** | Implement `AbandonedCartsRepository` with Prisma filters, pagination, and transactional history logging. |
| 4 | **Backend Service & Controller** | Implement `AbandonedCartsService` (crypto, sweeps, settings) and `AdminAbandonedCartsController` (RBAC, OpenAPI). |
| 5 | **Frontend Adapters & Mocks** | Implement `src/lib/api/admin/abandoned-carts` interfaces, API adapter, and robust mock repository. |
| 6 | **Frontend Store Refactoring** | Upgrade Zustand store to async actions handling loading/errors and fallback logic. |
| 7 | **Admin UI: List & Timeline** | Update listing page (filters/search) and add Detail Modal with the history timeline component. |
| 8 | **Admin UI: Settings & Actions** | Add RHF+Zod to the config modal and email template editor; integrate action buttons (Email, Convert, Discard) into the Detail Modal. |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | State Machine | Validate illegal transitions (e.g. `RECOVERED` -> `SENT`) throw appropriate domain errors. |
| Unit | Token Generation | Assert `crypto.randomBytes` generates proper length and matches stored SHA-256 hash. |
| Integration | Repository Logs | Test that performing an action (e.g., `discard`) transactionally creates exactly one `CheckoutSessionHistory` record. |
| E2E | Backend Endpoints | NestJS test using Supertest. Assert RBAC (403 for non-admins) and correct 200/400 envelope responses. |
| Unit | Frontend Forms | React Testing Library checking `build-form` constraints (accessible labels, validation messages). |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Run Prisma migrations before deploying the new backend module. The `CartRecoverySettings` singleton should be seeded via Prisma `upsert` in `seed.ts` or during backend startup. The Next.js frontend will toggle to using the real API via an environment variable `NEXT_PUBLIC_USE_MOCK_ADMIN_ABANDONED_CARTS=false`.

## Open Questions

- [ ] Does order conversion require capturing payment immediately within the admin panel, or does it generate a payment link for manual completion? (Assuming it creates a standard unpaid Order for now).
- [ ] Should automated background sweeps run via a Cronjob inside NestJS (`@nestjs/schedule`), or just rely on passive query-time evaluation for the MVP?
