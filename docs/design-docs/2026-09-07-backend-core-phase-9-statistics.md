# Design: Backend Core Phase 9 — Statistics

## Technical Approach

The implementation migrates the admin dashboard and reporting views from static mock data to an authoritative PostgreSQL-backed calculation engine. A new NestJS `StatisticsModule` handles secure, optimized aggregations of qualifying sales, product stock, customer spend, and coupon performance, driven by dynamic period boundaries. On the frontend, a dual-mode repository layer (`ApiStatisticsRepository` with a fallback to `MockStatisticsRepository`) acts as a resilient data provider, while a unified Zustand store (`useAdminStatisticsStore`) broadcasts period filter changes to all statistics UI views. Visits analytics intentionally remain mocked as per PRD constraints.

### Context and Requirements Mapping
- **Aggregation Engine Spec**: Implemented via `statistics.repository.ts` (Prisma/SQL aggregations) and `statistics.service.ts` (business math, period boundaries, trend calculations).
- **API Spec**: Addressed in `admin-statistics.controller.ts`, secured by `JwtAuthGuard` and `RolesGuard` for `ADMIN` access. Query params validated via `statistics.schemas.ts`.
- **Frontend Adapters Spec**: Satisfied by `src/lib/api/admin/statistics/` repository pattern, enforcing strict Zod contracts and employing `recover()` to gracefully degrade to mocks.
- **UI Integration Spec**: Powered by `useAdminStatisticsStore` providing global period reactivity, with updates to all dashboard pages except `visitas/page.tsx` (which remains static).

## Architecture Decisions

### Decision: Dedicated Modular Statistics Service

**Choice**: Build a separate `StatisticsModule` in the backend instead of augmenting the existing `SalesModule` or `ProductModule`.
**Alternatives considered**: Monolithic extension of `SalesModule`, or client-side heavy aggregation by fetching all raw orders.
**Rationale**: Adheres to the Single Responsibility Principle. Statistics require cross-domain joins (Orders, Customers, Products, Coupons) and specialized time-series aggregations that would pollute transactional modules. Client-side aggregation is unscalable and poses a severe security risk by exposing raw PII.

### Decision: Dual-Mode Frontend Repository with `recover()`

**Choice**: Wrap `ApiStatisticsRepository` HTTP calls with a `.catch(recover(MockStatisticsRepository))` pattern.
**Alternatives considered**: Strict failure (showing generic error screens) or loading data directly inside components using `useSWR`/`React Query` without an adapter.
**Rationale**: Guarantees zero downtime for the UI during local development or backend unavailability. By enforcing shared Zod contracts and adapter harness parity tests, the UI behaves identically whether backed by PostgreSQL or local static mocks.

### Decision: Zustand Store for Global Period State

**Choice**: Use `useAdminStatisticsStore` to manage the active period (`today`, `7d`, `30d`, `90d`, `12m`, `all-time`, `custom`) and cache the latest report payloads.
**Alternatives considered**: URL search parameters (`?period=30d`) or React Context.
**Rationale**: Zustand decouples the period filter component from deep page views without triggering full tree re-renders, provides a convenient place to dispatch concurrent fetch actions, and simplifies maintaining isolated caches per view (Overview, Sales, Products).

## Data Flow

```text
  [PeriodFilter.tsx] 
         │ (select period)
         ▼
 [useAdminStatisticsStore] ─── (broadcast state) ───► UI Views (Dashboard, Sales, Products, Coupons)
         │                                                      │ (render skeletons or data)
         ▼                                                      ▼
 [StatisticsRepository] ◄──── (enforce Zod contracts) ──────────┘
         │
         ├─ (success) ──► [NestJS /api/v1/admin/statistics/*] (JwtAuthGuard + RolesGuard)
         │                         │
         │                         ▼
         │                 [StatisticsService] ─── (resolve current vs prior period bounds)
         │                         │
         │                         ▼
         │                 [StatisticsRepository] ─── (aggregate, sum, count, date_trunc)
         │                         │
         │                         ▼
         │                 [PostgreSQL] (Order, OrderItem, Product, CouponRedemption)
         │
         └─ (HTTP 500 / Network Error)
                   │
                   ▼
          [MockStatisticsRepository] (fallback)
```

## Data Layer & Query Strategy

1. **Date Range Boundary Resolution**: The backend translates period presets (`today`, `7d`, `30d`, `90d`, `12m`, `all-time`, `custom`) into precise UTC ISO date ranges for the current window and an equivalent prior window for percentage change comparisons.
2. **Revenue Qualification**: Hardcoded across all aggregations: `Order.status NOT IN ('CANCELLED', 'REFUNDED') AND OrderPayment.status == 'PAID'`.
3. **Query Efficiency**:
   - Uses Prisma `aggregate` and `groupBy` where possible.
   - Uses parameterized `$queryRaw` for time-series bucketing (`date_trunc`) and JSON extraction (`shippingAddressSnapshot->>'province'`).
4. **Stock Alerts**: Derived by joining `Product` and `ProductVariant`, filtering where `stockMode = 'TRACKED'`, and evaluating quantity against hard thresholds (e.g., `<= 5` for low stock).
5. **Coupons**: Group `CouponRedemption` by `couponCode` and compare order totals for carts with coupons versus those without.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/modules/statistics/statistics.module.ts` | Create | Register controller and providers for the new module. |
| `backend/src/modules/statistics/admin-statistics.controller.ts` | Create | Mount REST endpoints under `/api/v1/admin/statistics`. Apply Guards. |
| `backend/src/modules/statistics/statistics.service.ts` | Create | Date resolution, math utilities, and variation logic. |
| `backend/src/modules/statistics/statistics.repository.ts` | Create | Prisma aggregations and parameterized SQL queries. |
| `backend/src/modules/statistics/statistics.mapper.ts` | Create | Map DB results to standard DTOs. |
| `backend/src/modules/statistics/statistics.schemas.ts` | Create | Zod validation for query params (period, dates, limit). |
| `backend/src/modules/statistics/dto/statistics-openapi.dto.ts` | Create | OpenAPI/Swagger definitions for the endpoints. |
| `backend/src/app.module.ts` | Modify | Import `StatisticsModule`. |
| `src/lib/api/admin/statistics/repository.ts` | Create | Define `StatisticsRepository` interface. |
| `src/lib/api/admin/statistics/api-statistics-repository.ts` | Create | Implement HTTP client calls with `recover()` logic. |
| `src/lib/api/admin/statistics/mock-statistics-repository.ts` | Create | Implement mock fallback using static data. |
| `src/lib/api/admin/statistics/contracts.ts` | Create | Shared Zod schemas for UI type safety and validation. |
| `src/lib/api/config.ts` | Modify | Wire up the active statistics repository. |
| `src/stores/admin-statistics-store.ts` | Create | Zustand store for period state, loading flags, and data cache. |
| `src/components/admin/stats/PeriodFilter.tsx` | Modify | Bind to `useAdminStatisticsStore` to trigger reactive fetches. |
| `src/app/(admin)/admin/page.tsx` | Modify | Consume overview data from store. |
| `src/app/(admin)/admin/estadisticas/ventas-clientes/page.tsx` | Modify | Consume sales and customers data from store. |
| `src/app/(admin)/admin/estadisticas/productos/page.tsx` | Modify | Consume product and alert data from store. |
| `src/app/(admin)/admin/estadisticas/reporte-cupones/page.tsx` | Modify | Consume coupon performance data from store. |

*(Note: `visitas/page.tsx` remains strictly mock-only).*

## Interfaces / Contracts

```typescript
// Shared Zod schemas and derived types
export const StatisticsQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', '90d', '12m', 'all-time', 'custom']),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().positive().optional(),
});
export type StatisticsQuery = z.infer<typeof StatisticsQuerySchema>;

export interface StatisticsRepository {
  getOverview(query: StatisticsQuery): Promise<AdminStatisticsOverviewResult>;
  getSales(query: StatisticsQuery): Promise<AdminStatisticsSalesResult>;
  getProducts(query: StatisticsQuery): Promise<AdminStatisticsProductsResult>;
  getCustomers(query: StatisticsQuery): Promise<AdminStatisticsCustomersResult>;
  getCoupons(query: StatisticsQuery): Promise<AdminStatisticsCouponsResult>;
}

// Backend Math Utility signature
export function calculateVariation(current: number, prior: number): { variationPct: number, trend: 'up' | 'down' | 'flat' };
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Math helpers, period calculators | Test `calculateVariation` with zero-prior, zero-current, and normal cases. Test date resolution bounds. |
| Unit | Zod Schemas & Mappers | Verify validation rejects invalid ISO dates and custom queries missing bounds. Verify DTO structure. |
| Integration | DB Aggregation Queries | Run against PostgreSQL with seed data to ensure `date_trunc` and JSON extraction (`province`) work securely without syntax errors. |
| E2E | Controller endpoints | Use Supertest to verify HTTP 200 on valid requests and 401/403/400 for unauthenticated/unauthorized/invalid requests. |
| Frontend | Adapter parity | Harness tests to assert `ApiStatisticsRepository` and `MockStatisticsRepository` return identical schema-compliant shapes. |

## Security, Threat Matrix & Edge Cases

- **Division by Zero**: Average ticket returns `0` if sales count is `0`. Variation percentage returns `100` (up) or `0` (flat) gracefully when prior period values are zero.
- **Access Control**: All new endpoints enforce authentication and authorization (`JwtAuthGuard`, `RolesGuard` with `Role.ADMIN`).
- **SQL Injection**: All raw SQL queries use parameterized templates (`Prisma.sql` / `$queryRaw`) completely eliminating injection vectors on date boundaries or JSON path evaluations.
- **Custom Date Validation**: Zod strictly validates custom `from` and `to` ISO strings.

**Threat Matrix**: N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. The feature toggles transparently through `NEXT_PUBLIC_USE_MOCK_ADMIN_STATISTICS` and `recover()` logic, ensuring smooth rollback if the backend experiences issues. Existing `Order` and `OrderPayment` data will automatically populate reports.

## Open Questions

- [ ] None
