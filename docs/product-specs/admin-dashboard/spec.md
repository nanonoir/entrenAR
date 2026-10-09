# Admin Dashboard Specification

## Purpose

Defines content, metrics, chart behavior, UI states, and route structure for the mock-driven CRM overview and statistics views.

## Requirements

### Requirement: Overview Route Content (`/admin`)

The system MUST render the Visión general page at `/admin` containing a period filter, 5 KPI metric cards, and lower visitor-behavior blocks.

| KPI card | Key fields |
|---|---|
| Visitas únicas | value, previous period value, % variation |
| Ventas | value, previous period value, % variation |
| Facturación | value, previous period value, % variation |
| Ticket promedio | value, previous period value, % variation |
| Conversión del carrito | value, previous period value, % variation |

#### Scenario: Overview page renders KPI cards

- GIVEN a user navigates to `/admin`
- WHEN the page loads
- THEN 5 KPI cards are visible, each showing the metric name, a current value, the previous-period value, and a percentage variation

#### Scenario: Visitor-behavior blocks render below KPIs

- GIVEN the overview page is loaded
- WHEN the page renders
- THEN blocks for "Comportamiento del visitante", "Visitas a pedidos pagos", and "Visitas a carritos creados" are visible below the KPI grid

---

### Requirement: Period Filter — Visual Only

Every Estadísticas and overview page MUST include a period filter selector. In this mock stage the filter MUST be visual only — it MUST NOT mutate or re-fetch mock data.

Options: Hoy, Semana actual (default), Este mes / últimos 30 días, Trimestre / últimos 90 días, Año / últimos 12 meses, Siempre / histórico.

#### Scenario: Period filter is visible on overview and stats pages

- GIVEN any `/admin` or `/admin/estadisticas/*` page
- WHEN the page renders
- THEN a period filter control is visible above the content, showing "Semana actual" as the default selection

#### Scenario: Selecting a period does not change displayed data

- GIVEN the period filter is visible
- WHEN the user selects a different period option
- THEN the UI reflects the new selection but mock data values remain unchanged

---

### Requirement: Statistics Routes Exist and Render

The system MUST provide the following routes, each rendering inside the admin layout with mock data:

| Route | View name |
|---|---|
| `/admin/estadisticas/productos` | Estadísticas › Productos |
| `/admin/estadisticas/ventas-clientes` | Estadísticas › Ventas y Clientes |
| `/admin/estadisticas/visitas` | Estadísticas › Visitas |
| `/admin/estadisticas/reporte-cupones` | Estadísticas › Reporte de cupones |

#### Scenario: Each statistics route is reachable

- GIVEN the admin layout is rendered
- WHEN the user navigates to any of the four statistics routes
- THEN the correct view title is shown and mock data blocks are visible without errors

---

### Requirement: Products Statistics Blocks

The `/admin/estadisticas/productos` view MUST render 6 blocks: units sold, gross sales per product, reserved stock, top-10 table, top-10 visual ranking, and inventory alerts.

#### Scenario: Products stats page renders all blocks

- GIVEN a user navigates to `/admin/estadisticas/productos`
- WHEN the page loads
- THEN all 6 blocks are visible using mock data, with no broken layout

#### Scenario: Inventory alerts show actionable categories

- GIVEN the products stats page is rendered
- WHEN the inventory alerts block is visible
- THEN items are grouped into: sin stock, bajo stock, muy vendidos con bajo stock, stock reservado alto

---

### Requirement: Sales & Customers Statistics Blocks

The `/admin/estadisticas/ventas-clientes` view MUST render 8 blocks: pedidos creados, facturación bruta, ticket promedio, pedidos por estado de pago (donut chart), clientes principales (table), ingresos por medio de pago (bar chart), ventas con/sin envío, top provincias.

#### Scenario: Sales stats page renders donut and bar charts

- GIVEN a user navigates to `/admin/estadisticas/ventas-clientes`
- WHEN the page loads
- THEN a donut chart for pedidos por estado de pago and a bar chart for ingresos por medio de pago are visible using mock data

#### Scenario: Customers table shows real-buyer columns only

- GIVEN the sales stats page is rendered
- WHEN the clientes principales table is visible
- THEN it shows Nombre, Mail, Total gastado, Pedidos — no guest or zero-purchase users are listed

---

### Requirement: Visits Statistics Blocks

The `/admin/estadisticas/visitas` view MUST render 5 blocks: visitas totales, visitantes únicos, productos más visitados (table), acceso por dispositivo, and a "Próximamente" placeholder for visitas por origen.

#### Scenario: Visits stats page renders traffic blocks

- GIVEN a user navigates to `/admin/estadisticas/visitas`
- WHEN the page loads
- THEN blocks for visitas totales, visitantes únicos, productos más visitados, and device breakdown are visible with mock data

#### Scenario: Visitas por origen block shows placeholder

- GIVEN the visits stats page is rendered
- WHEN inspecting the last block
- THEN it shows a "Próximamente" placeholder, not real data

---

### Requirement: Coupons Report Blocks

The `/admin/estadisticas/reporte-cupones` view MUST render 2 blocks: cupones más usados (horizontal bar chart, top 5–10) and ventas con/sin cupón comparison.

#### Scenario: Coupons page renders usage chart and comparison

- GIVEN a user navigates to `/admin/estadisticas/reporte-cupones`
- WHEN the page loads
- THEN a horizontal bar chart of top coupons by usage and a comparison of orders with vs without coupons are visible

---

### Requirement: Chart Rendering Constraints

Recharts MUST be used only for the approved chart classes. All Recharts components MUST be client-only (no SSR). Simple visual representations MAY use CSS/HTML instead.

| Approved Recharts chart | View |
|---|---|
| Payment-status donut (PieChart) | ventas-clientes |
| Daily sales / payment-method bars (BarChart) | ventas-clientes |
| Visits / unique visitors / daily revenue lines (LineChart) | visitas, productos |

#### Scenario: Recharts chart renders without hydration error

- GIVEN any page with a Recharts component
- WHEN the page loads in a browser
- THEN no React hydration mismatch error is produced and the chart is visible

#### Scenario: Non-Recharts visual (CSS bar) renders correctly

- GIVEN a block using CSS/HTML horizontal bars (e.g., top-10 ranking)
- WHEN the page renders
- THEN bars display proportionally to mock values without JS errors

---

### Requirement: Reusable UI States

The system MUST provide Loading, Empty, Error, and Coming-Soon states as reusable components usable in any admin view.

| State | Trigger condition | Required copy (Spanish) |
|---|---|---|
| Loading | Data fetch pending | Skeleton or spinner |
| Empty | No data for the period | "Todavía no hay datos para este período." |
| Error | Load failure | "No pudimos cargar las estadísticas. Intentá nuevamente." |
| Coming Soon | Deferred block or route | "Próximamente" |

#### Scenario: Empty state displays correct message

- GIVEN a stats view where mock data returns an empty array
- WHEN the view renders
- THEN the empty state component is shown with the expected copy

#### Scenario: Error state is shown on load failure

- GIVEN a stats view where data loading throws
- WHEN the view renders
- THEN the error state component is shown (not a blank page or unhandled crash)
