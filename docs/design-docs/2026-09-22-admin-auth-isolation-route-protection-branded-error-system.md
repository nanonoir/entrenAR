# Design: Admin Authentication Isolation, Operational Route Cloaking & Branded Error System

## Technical Approach

Implement dedicated administrator authentication endpoints in NestJS (`/api/v1/auth/admin/*`) and a distinct Next.js `admin-session` gateway (`login`, `refresh`, `logout`). Isolate the admin access token in an in-memory client store (`adminAccessToken`), ensuring protected administrative reads execute strictly post-client-bootstrap. Enforce operational route cloaking using the native Next.js 16 contract via `src/proxy.ts` (exporting `proxy(request)` and `config.matcher = ['/admin/:path*']`), making local gate decisions before route rendering to cloak routes functionally. Coordinate true human idle time and multi-tab refresh via `BroadcastChannel` paired with backend tolerance for concurrent refresh requests. Centralize state reset (`resetAdminState()`) across all 11 admin Zustand stores.

## Architecture Decisions

### Decision: Admin Route Cloaking without `middleware.ts`

**Choice**: Use the native Next.js 16 proxy pattern in `src/proxy.ts` exporting `proxy(request: NextRequest)` and `config.matcher = ['/admin/:path*']`.
**Alternatives considered**: Manual layout invocation via `executeAdminProxy()` (violates Next.js contract), Edge Middleware (explicitly forbidden by PRD).
**Rationale**: Adheres to the PRD invariant and Next.js native contracts. The Proxy performs local gate decisions before route rendering, allowing operational routes to be functionally cloaked (as 404s) for untrusted visitors for both document and RSC payload requests, without unsupported helper invocations.

### Decision: Backend Admin Auth Controller Structure

**Choice**: Create a new `AdminAuthLifecycleController` mapped to `auth/admin` within the NestJS `auth` module, exposing endpoints `POST /api/v1/auth/admin/*`.
**Alternatives considered**: Overloading the existing `AuthController` or placing the controller inside the `admin` module.
**Rationale**: Keeps customer and admin authentication contexts physically separate, bypasses the broad `RolesGuard` on `/api/v1/admin/*`, prevents auth-triggered mock fallbacks, and enables safe reuse of `AuthService` cryptographic primitives.

### Decision: Multi-Tab Refresh Race Tolerance

**Choice**: Implement a configurable, short grace window (tolerance) in `AuthService.refresh`. If a recently rotated token is presented again within the window, return the successor token. Replays outside this window fail closed and optionally revoke the `ADMIN` session lineage.
**Alternatives considered**: Strict rotation with instant revocation, requiring purely frontend locks.
**Rationale**: Satisfies the PRD requirement to safely handle legitimate near-simultaneous multi-tab refreshes without destroying the newly rotated session, while properly isolating and revoking suspicious replays.

### Decision: State Reset Execution

**Choice**: Create a central `resetAdminState()` utility which clears the 11 Zustand stores, purges `adminAccessToken`, and cancels pending `admin-client` requests.
**Alternatives considered**: Resetting stores individually on a per-component or per-hook basis.
**Rationale**: Centralized invalidation guarantees no stale, late in-flight responses can repopulate stores after logout or idle expiration, meeting the PRD's reset and anti-pollution invariants.

## Architecture Contract

### Responsibility Map

| Module / File | Owns | Must NOT own |
|---|---|---|
| `backend/src/modules/auth/admin-auth-lifecycle.controller.ts` | Admin auth endpoints (`login`, `refresh`, `logout`) | Customer auth endpoints, business logic |
| `src/proxy.ts` | Optimistic local validation of the signed gate before rendering | Backend authorization, Prisma access, JWT reading |
| `src/app/api/admin-session/login/route.ts` (also `refresh`, `logout`) | Next.js auth-only gateways for cookie lifecycle & gate creation | Business API proxying, direct Prisma access |
| `src/lib/api/admin/client.ts` | Admin token attachment, 401 coordinated retry | Customer tokens (`accountAccessToken`) |
| `src/stores/admin-auth-store.ts` | Multi-tab sync, human activity tracking, idle expiry | Backend authorization decisions |

### Dependency Direction

    Boundary / UI / Route
             ↓
    src/lib/api/admin/client.ts (Admin Transport)
             ↓
    Next.js Gateway (for Auth) / NestJS APIs (for Business)

### Structural Constraints

- `src/proxy.ts` MUST NOT perform Prisma lookups or fetch backend session state.
- `src/proxy.ts` DOES NOT authorize APIs. It only provides operational route privacy.
- `src/lib/api/admin/client.ts` MUST NOT import `getAccountAccessToken()`.
- Customer auth logic MUST NOT be altered to accept `sessionType = ADMIN`.
- `CATALOG_API_ADMIN_ACCESS_TOKEN` MUST be fully removed from production catalog reads. No server-side admin token strategy will be implemented.
- `/admin/login` remains public and non-secret.
- No auth-triggered mock fallback is permitted.

## Data Flow

    [Tab A] & [Tab B] 
         │ (BroadcastChannel syncs activity & refresh locks)
         ↓
    Zustand AdminAuthStore
         │ (401 triggers refresh)
         ↓
    Next.js Gateway (`/api/admin-session/refresh`)
         │ (Passes HttpOnly `entrenar_admin_refresh` cookie)
         ↓
    NestJS AdminAuthLifecycleController
         │ (Validates ADMIN sessionType, handles race tolerance, rotates token)
         ↓
    Prisma Database (Updates RefreshToken)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `RefreshSessionType` and `sessionType` to `RefreshToken`. |
| `backend/src/modules/auth/admin-auth-lifecycle.controller.ts` | Create | NestJS endpoints for admin login, refresh, logout. |
| `backend/src/modules/auth/auth.service.ts` | Modify | Add `sessionType` isolation and concurrency tolerance. |
| `src/proxy.ts` | Create | Export `proxy(request)` and `config.matcher` for gate verification. |
| `src/app/api/admin-session/login/route.ts` | Create | Next.js HTTP-only cookie gateway for login. |
| `src/app/api/admin-session/refresh/route.ts` | Create | Next.js HTTP-only cookie gateway for refresh. |
| `src/app/api/admin-session/logout/route.ts` | Create | Next.js HTTP-only cookie gateway for logout. |
| `src/lib/api/admin/auth/admin-access-token.ts` | Create | In-memory admin token storage. |
| `src/lib/api/admin/client.ts` | Create | Base admin fetch client (for all 6 transports) with 401 retry logic. |
| `src/stores/admin-auth-store.ts` | Create | Cross-tab session lifecycle and true human activity tracker. |
| `src/stores/admin-reset.ts` | Create | Centralized `resetAdminState()`. |
| `src/components/ui/ErrorLayout.tsx` | Create | Stable, branded full-page error component. |
| `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` | Create | Next.js root error boundaries. |

## Interfaces / Contracts

```typescript
// backend/prisma/schema.prisma
enum RefreshSessionType {
  CUSTOMER
  ADMIN
}

// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin/:path*'],
};

export async function proxy(request: NextRequest) {
  // Verifies 'entrenar_admin_gate' signature via HMAC-SHA-256 and constant-time safe comparison.
  // Performs local gate decisions before route rendering.
  // Cloaks routes returning 404 (document/RSC) or redirects to login?expired=true.
}

// src/stores/admin-auth-store.ts
interface AdminAuthState {
  isAuthenticated: boolean;
  isExpired: boolean;
  lastActivityAt: number;
  login: (token: string) => void;
  logout: () => Promise<void>;
  recordActivity: () => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `AuthService` rotation & race tolerance | Ensure valid successor is returned within tolerance, fail/revoke outside. |
| Integration | NestJS `/api/v1/auth/admin/*` | Verify `ADMIN` session isolation and 401 on `CUSTOMER` credentials. |
| E2E | Route cloaking & Multi-tab | Playwright: Verify unauthenticated `/admin` document and RSC navigation returns 404; test double-tab refresh race. |

## Threat Matrix

| Threat | Applicable | Expected Behavior | RED Test Plan |
|---|---|---|---|
| Forged/modified gate | Yes | Rejected by Proxy. Gate uses HMAC-SHA-256 and constant-time safe comparison. Gate DOES NOT authorize APIs. | Tamper gate cookie payload/signature. Verify proxy cloaks as 404 without mounting shell or hitting backend. |
| Concurrent refresh / replay | Yes | Backend tolerates immediate duplicates within short window. Replays outside tolerance fail closed. | Fire two refreshes within tolerance (both succeed). Fire replay outside tolerance (fails). |
| Cross-context credential injection | Yes | `CUSTOMER` tokens rejected by Admin endpoints. `ADMIN` tokens rejected by Customer endpoints. | Submit CUSTOMER token to admin refresh. Ensure generic 401 response. |
| Stale response / state pollution | Yes | Centralized `resetAdminState()` aborts in-flight requests and clears all 11 admin stores on logout/expiry. | Trigger slow API call, logout, resolve call. Verify stores remain empty and unpolluted. |

## Migration / Rollout

A Prisma schema migration is required to add `sessionType` to `RefreshToken`. To satisfy the safety requirement, safely classify existing rows to `CUSTOMER` before enforcing the non-null invariant. Production administrative catalog reads will shift from static tokens in RSC to dynamic client fetching strictly post-client-bootstrap.

## Open Questions

- None.
