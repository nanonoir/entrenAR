# Design: Backend Core Phase 3 Customer Account

## Technical Approach

Extend the standalone NestJS modular monolith under `backend/` to provide authenticated, server-authoritative profile, address, wishlist, and password lifecycle operations. We map the requirements from the specs by mutating the Prisma schema for customer-owned records and exposing thin REST controllers with Zod validation. The Next.js frontend will migrate to these endpoints via the `src/lib/api/account/` domain repositories, preserving safe local mock fallbacks. Ownership is derived exclusively from JWT tokens.

## Architecture Decisions

### Decision: Account ownership comes exclusively from JWT
**Choice**: Account controllers accept no authoritative `userId` in routes or payloads; services use `request.user.userId`.
**Alternatives considered**: Client-provided email, user ID, or admin-style `/users/:id` resource paths.
**Rationale**: Enforces a strict backend security boundary and prevents horizontal data access.

### Decision: Separate Account and Wishlist modules
**Choice**: Create `AccountModule` for profile, addresses, and order skeletons, and `WishlistModule` for product relations. Keep `UsersModule` strictly for identity and auth concerns.
**Alternatives considered**: Placing all operations inside a monolithic `UsersModule` or `AuthModule`.
**Rationale**: Keeps controllers thin, adheres to domain-driven module boundaries, and prevents the identity service from bloating with storefront logic.

### Decision: Reversible API mode with fallback to Mocks
**Choice**: Implement API repositories and async Zustand actions that treat server data as authoritative in API mode, but maintain fully functioning local mock data and `NEXT_PUBLIC_DATA_SOURCE=mock` default.
**Alternatives considered**: Delete legacy local snapshots completely, or constantly merge local and server state.
**Rationale**: Allows for incremental frontend rollout and guarantees a safe rollback strategy if the API fails, while avoiding silent overwriting of server-truth data.

### Decision: Explicit login/register to prevent enumeration
**Choice**: Do not expose a public email-existence check. Use explicit "Login" and "Register" actions on the frontend.
**Alternatives considered**: Infer registration from login errors or an `/auth/check` endpoint.
**Rationale**: Avoids account enumeration vulnerabilities and leaves identity authority entirely in the backend.

### Decision: Reset delivery is an adapter boundary
**Choice**: Persist hashed, expiring, one-time reset tokens in Prisma and trigger a generic delivery port (no-op/console log for now). The `forgot-password` endpoint always returns a generic success response.
**Alternatives considered**: Return the raw reset token in the response or couple directly to an email library.
**Rationale**: Safely fulfills the API contract without leaking credentials or coupling the Core to a specific email infrastructure at this stage.

## Data Flow

    Browser (UI)
         │
         ▼
    Frontend Repository / Zustand Store (API Mode)
         │  (Sends JWT Access Token)
         ▼
    NestJS Controller (AuthGuard + Zod Validation)
         │
         ▼
    Account / Wishlist Service (Ownership Check & Business Logic)
         │
         ▼
    Prisma Client
         │
         ▼
    PostgreSQL Database

* Flow initialized with refresh cookie exchange on load. Legacy local state reconciles only if the server returns empty.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `User` profile fields, `UserAddress`, `WishlistItem`, and `PasswordResetToken` models. |
| `backend/src/modules/account/*` | Create | Modules, controllers, services, and DTOs for profile and address CRUD. |
| `backend/src/modules/wishlist/*` | Create | Modules, controllers, services, and DTOs for wishlist. |
| `backend/src/modules/auth/*` | Modify | Add forgot, reset, and change password endpoints; expand `/auth/me`. |
| `backend/src/modules/users/*` | Modify | Helpers for profile updates and password validations. |
| `src/lib/api/account/*` | Create | Frontend domain repositories, schemas, and client fetch implementations. |
| `src/stores/{auth,account-profile,wishlist}-store.ts` | Modify | Add API operations, bootstrap logic, and mock fallbacks. |
| `src/app/(shop)/account/*` | Modify | Update UX flows for explicit login/register and error states. |

## Interfaces / Contracts

```typescript
// Backend DTOs
export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  dni: string;
  gender: string;
  birthDate: string;
  phone: string;
}

export interface AddressDto {
  label: string;
  recipient: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

// Frontend Repository Contract
export interface AccountRepository {
  login(input: LoginRequest): Promise<AuthSession>;
  register(input: RegisterRequest): Promise<AuthSession>;
  refresh(): Promise<AuthSession>;
  getProfile(): Promise<AccountProfile>;
  updateProfile(input: UpdateProfileDto): Promise<AccountProfile>;
  listAddresses(): Promise<AccountAddress[]>;
  createAddress(input: AddressDto): Promise<AccountAddress>;
  updateAddress(id: string, input: AddressDto): Promise<AccountAddress>;
  deleteAddress(id: string): Promise<void>;
  listOrders(): Promise<AccountOrder[]>; // Empty array skeleton
  listWishlist(): Promise<ProductSummary[]>;
  addToWishlist(productId: string): Promise<void>;
  removeFromWishlist(productId: string): Promise<void>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod schemas, mappers, password reset logic, ownership validations. | Jest with mocked Prisma and reset-delivery port. |
| Integration | Six-address limit, foreign-resource rejection, token consumption. | Jest with PostgreSQL and Prisma repositories. |
| E2E | Auth bootstrap, complete CRUD endpoints, safe error responses. | Supertest against NestJS app with mocked users. |
| Frontend | API/mock selector behavior, DTO mapping, and legacy reconciliation. | Adapter harness pattern tests. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: No document execution boundaries. | N/A | N/A |
| Git repository selection | `git -C`, relative paths, absolute paths | N/A: No git manipulation involved. | N/A | N/A |
| Commit state | staged, `commit -a`, empty index | N/A: Does not interact with VCS commit state. | N/A | N/A |
| Push state | tracking branch, first push, explicit refspec | N/A: Does not interact with VCS push state. | N/A | N/A |
| PR commands | explicit `--head`, environment prefix, composed commands | N/A: No GitHub CLI or PR automation invoked. | N/A | N/A |

*Application authentication and horizontal data ownership threats are covered by standard unit, integration, and e2e boundaries rather than shell/VCS execution matrices.*

## Migration / Rollout

Create a single additive Prisma migration for the new tables and fields without migrating PII. Maintain `NEXT_PUBLIC_DATA_SOURCE=mock` as the safe default. Only switch to API mode once all backend tests and adapter harnesses pass. Retain mock functionality until the final backend transition gate (Phase 10).

## Open Questions

- [ ] Select the delivery strategy for high-risk reviews: stacked PRs, feature-branch chain, or explicit size exception.
- [ ] Determine the actual production email delivery provider for password resets (currently no-op/adapter boundary).