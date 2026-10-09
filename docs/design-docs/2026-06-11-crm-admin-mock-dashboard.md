# Design: CRM Admin Mock Dashboard

## Technical Approach

Implement the light CRM admin layout with a collapsible desktop sidebar and a mobile bottom/drawer navigation using React Server Components for the layout shell. Client-side components will handle interaction state (sidebar toggle, mobile drawer). Static mock data structured as backend-like DTOs will be placed in `src/lib/data/admin/` to populate Recharts components (wrapped with `next/dynamic` using `ssr: false`) and Tailwind CSS grids, creating a realistic, responsive dashboard without a real backend.

## Architecture Decisions

### Decision: Mock Data Encapsulation
**Choice**: Centralized static files exporting strict TypeScript interfaces in `src/lib/data/admin/*.ts`.
**Alternatives considered**: Returning mocks from fake API route handlers or defining them inline within page components.
**Rationale**: Mock API handlers add unnecessary HTTP latency and client-side fetching overhead for data that is purely static. Centralized TypeScript files enforce the shape of future backend DTOs seamlessly for Server Components without the overhead of Next.js Route Handlers.

### Decision: Charting Library Integration
**Choice**: Use `recharts` encapsulated in `src/components/admin/charts/*` using `next/dynamic({ ssr: false })`.
**Alternatives considered**: Chart.js, HTML/CSS bar approximations.
**Rationale**: `recharts` provides out-of-the-box React support with clean declarative syntax. Disabling SSR for these chart wrappers guarantees no hydration mismatches (a common issue with Recharts responsive containers) while maintaining the design.

### Decision: Sidebar State Management
**Choice**: Local React state (`useState`) inside a Client Component wrapper (`AdminLayoutShell` or similar) that coordinates the sidebar and content area; no desktop/tablet top header is required in this stage.
**Alternatives considered**: Zustand global store or URL search params.
**Rationale**: The requirement specifically dictates session-only persistence (or no persistence across reload). Simple React state in a client layout wrapper avoids unnecessary global state contamination and immediately satisfies the requirement.

### Decision: Period Filter Behavior
**Choice**: A Client Component `<PeriodFilter />` that holds its own visual selection state without passing parameters up to parents or syncing to URL/search params in this mock stage.
**Alternatives considered**: Updating URL params (`?period=...`).
**Rationale**: Defining URL params now may not fit the later backend/Prisma query model. Keeping the selected period localized and visual-only prevents unnecessary hydration cycles. 
*Implementation Note*: Include small comments in `src/components/admin/stats/PeriodFilter.tsx` and `src/lib/data/admin/periods.ts` indicating period values are display options only until backend contracts are designed.

### Decision: Mobile Drawer State Management
**Choice**: Local React state inside `AdminMobileNav` that closes on link click and/or pathname change (using `usePathname()`).
**Alternatives considered**: Global UI state (e.g., Zustand) or context.
**Rationale**: Only the bottom-nav "Menú" button controls it today. Do not introduce global admin UI state unless multiple admin components later need to control shared panels.

## Data Flow

```text
src/lib/data/admin/dashboard.ts (Mock DTOs)
       │
       ▼
src/app/(admin)/admin/page.tsx (Server Component)
       │
       ▼
src/components/admin/charts/SalesChartWrapper.tsx (Client Component - No SSR)
       │
       ▼
recharts (DOM render on client)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `recharts` dependency. |
| `src/app/(admin)/layout.tsx` | Modify | Refactor to light CRM theme using an interactive shell wrapper. |
| `src/app/(admin)/admin/page.tsx` | Modify | Build "Visión General" dashboard with KPI cards and blocks. |
| `src/app/(admin)/admin/estadisticas/productos/page.tsx` | Create | Product stats view with mock data blocks. |
| `src/app/(admin)/admin/estadisticas/ventas-clientes/page.tsx` | Create | Sales/customers stats view with charts. |
| `src/app/(admin)/admin/estadisticas/visitas/page.tsx` | Create | Visits stats view. |
| `src/app/(admin)/admin/estadisticas/reporte-cupones/page.tsx` | Create | Coupons stats view. |
| `src/app/(admin)/admin/ventas/page.tsx` | Create | Placeholder route (Coming soon). |
| `src/lib/data/admin/dashboard.ts` | Create | Mock data for overview. |
| `src/lib/data/admin/products.ts` | Create | Mock data for products stats. |
| `src/lib/data/admin/sales.ts` | Create | Mock data for sales stats. |
| `src/lib/data/admin/visits.ts` | Create | Mock data for visits stats. |
| `src/lib/data/admin/coupons.ts` | Create | Mock data for coupons stats. |
| `src/lib/data/admin/navigation.ts` | Create | Centralized CRM navigation, static footer actions, and icons (`TicketPercent` for `Reporte de cupones`, `BadgePercent` for `Descuentos`). |
| `src/components/admin/layout/Sidebar.tsx` | Create | Left sidebar component with expand/collapse and static bottom actions (`Configuración`, `Cerrar sesión`) adapting to collapsed mode. |
| `src/components/admin/layout/MobileNav.tsx` | Create | Bottom nav wrapper. |
| `src/components/admin/layout/MobileDrawer.tsx` | Create | Right drawer with remaining CRM links and static footer actions. |
| `src/components/admin/PeriodFilter.tsx` | Create | Visual period selector. |
| `src/components/admin/MetricCard.tsx` | Create | KPI metric card wrapper. |

## Interfaces / Contracts

```typescript
// Example from src/lib/data/admin/dashboard.ts
export interface KPIMetric {
  id: string;
  label: string;
  value: string | number;
  previousValue: string | number;
  variationPct: number;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Components | Ensure UI renders without crashing. Rely on `npm run lint` per current validation reality. |
| Integration | Mocks | Ensure layout imports mock data exclusively from `src/lib/data/admin`. |
| E2E | Hydration | Visually verify no hydration errors occur when `recharts` mount on the dashboard. |

## Migration / Rollout

No data migration required. Only UI restructuring.

## Open Questions

None
