# Design: backend-core-phase-10-hardening

## Technical Approach

Phase 10 standardizes the codebase into an API-first configuration while preserving offline development resilience. We will decouple the frontend from statically imported entity mock fixtures, centralize domain types, and re-orient the frontend environment to use the NestJS backend as its default data source. The NestJS backend will receive production hardening—including graceful shutdown hooks, HTTP timeouts, health checks, multi-origin CORS, rate limiting, and 500-error logging—and will be fully containerized.

## Architecture Decisions

### Decision: Domain Type Extraction
**Choice**: Extract entity types (e.g., `AdminProduct`, `Customer`) from `src/lib/data/` to `src/types/` and leave backward-compatible re-exports in the original data files.
**Alternatives considered**: Change all imports simultaneously across the codebase.
**Rationale**: Re-exports prevent widespread import churn and protect existing components while enabling new code to reference clean canonical types.

### Decision: Repository Consumption for Leaked UI
**Choice**: Eliminate direct mock imports in `ProductSelectorDrawer`, `discounts/options.ts`, `mi-cuenta/page.tsx`, `OrderTrackingForm`, and `admin/envios/*`, injecting data via React Server Components (for pages) or fetching via the repository layer (for client components).
**Alternatives considered**: Hard delete the mock files altogether.
**Rationale**: Hard deletion breaks offline test harnesses and development resilience. Decoupling fixes the architectural leak while retaining the test fixtures.

### Decision: Backend Error Logging
**Choice**: Update `HttpExceptionFilter` to call `Logger.error()` and capture stack traces specifically for 500 Internal Server Errors, while keeping the client response sanitized.
**Alternatives considered**: Use an external APM or rely on NestJS default handlers.
**Rationale**: Capturing the stack trace natively in the filter ensures visibility in container stdout without adding third-party dependencies during this phase.

### Decision: CORS and Environment Parsing
**Choice**: Use Zod in `app.config.ts` to parse a comma-separated `CORS_ORIGINS` string into an array of allowed origins.
**Alternatives considered**: Keep a single string or permit all (`*`).
**Rationale**: Production often requires multiple origins (preview environments, production domains) without sacrificing credential security.

## Data Flow

    [Frontend Environment: NEXT_PUBLIC_DATA_SOURCE=api]
         │
    [Client/Server Component] ──→ [Repository (e.g. catalogRepository)]
         │                              │
         └─ (Direct leaks removed) ─────┘
                                        │ (HTTP)
    [NestJS API (CORS, Throttling)] ────┘
         │
    [PostgreSQL (via Prisma)]

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types/admin-product.ts`, `src/types/customer.ts`, etc. | Create | Centralize domain types. |
| `src/lib/data/admin/sales-flow/mock-products.ts` | Modify | Re-export types; keep array for fallback. |
| `src/components/admin/sales-flow/ProductSelectorDrawer.tsx` | Modify | Use `catalogRepository.getAdminProducts()`. |
| `src/lib/data/admin/discounts/options.ts` | Modify | Use `catalogRepository` to resolve product options. |
| `src/app/(shop)/mi-cuenta/page.tsx` | Modify | Fetch via `accountRepository` and `catalogRepository`. |
| `src/components/shop/support/OrderTrackingForm.tsx` | Modify | Fetch via `accountRepository` (or dedicated lookup). |
| `src/app/(admin)/admin/envios/page.tsx` | Modify | Fetch via `salesRepository.listSales()`. |
| `src/lib/data/admin/shipping/tracking.ts` | Modify | Remove `mockSales` import; derive tracking from input. |
| `src/stores/cart-store.ts` | Modify | Initialize cart items to `[]`. |
| `src/lib/api/config.ts` | Modify | Default to `api` if `DATA_SOURCE` is unset. |
| `.env.example` | Modify | Set `NEXT_PUBLIC_DATA_SOURCE=api`. |
| `backend/src/config/app.config.ts` | Modify | Add `CORS_ORIGINS` array support and `FRONTEND_URL`. |
| `backend/src/main.ts` | Modify | Add `app.enableShutdownHooks()`, `server.keepAliveTimeout`, `server.headersTimeout`. |
| `backend/src/modules/health/health.controller.ts` | Modify | Add root `@Get()` health aggregator. |
| `backend/src/common/filters/http-exception.filter.ts` | Modify | Log stack trace for 500 errors via `Logger.error`. |
| `backend/src/modules/auth/auth.controller.ts` | Modify | Add `@Throttle()` to login, register, forgot-password. |
| `backend/.env.example` | Create | Provide backend environment template. |
| `backend/Dockerfile` | Create | Multi-stage build for production. |
| `docker-compose.yml` | Create | Orchestrate Postgres and API at the root. |
| `package.json` | Modify | Add root scripts for backend tests, DB seed, and Docker operations. |

## Interfaces / Contracts

```typescript
// Example Zod parsing for multi-origin CORS in backend/src/config/app.config.ts
corsOrigins: z.string().transform((val) => val.split(',').map(s => s.trim())),
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Integration (Harnesses) | Repository dual-mode capability | Run `npm run test:harness` to ensure `API` and `Mock` modes both function correctly after decouple. |
| E2E | Container Boot | Run `docker-compose up` and verify the `/api/v1/health` endpoint responds with a 200 OK. |
| Unit | Exception Filter | Verify 500 exceptions trigger the Logger. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No data migration required. The frontend environment will switch to `api` mode seamlessly for new deployments.

## Open Questions

- [ ] Will the `CORS_ORIGINS` change require immediate updates to Vercel environment variables? (Yes, should be documented).