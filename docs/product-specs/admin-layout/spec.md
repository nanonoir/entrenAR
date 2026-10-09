# Admin Layout Specification

## Purpose

Defines the structural shell and navigation behavior of the CRM/Admin panel for desktop, tablet, and mobile breakpoints.

## Requirements

### Requirement: Desktop/Tablet Layout Shell

The system MUST render a left sidebar and a main content area on screens ≥ tablet width, without requiring a desktop/tablet top header in this stage.

#### Scenario: Admin page loads on desktop

- GIVEN a user navigates to any `/admin` route on a desktop viewport
- WHEN the page renders
- THEN a fixed left sidebar is visible and the main content fills the remaining space

#### Scenario: Admin page loads on tablet

- GIVEN a user navigates to any `/admin` route on a tablet viewport
- WHEN the page renders
- THEN the same sidebar + content shell is shown (not the mobile bottom nav)

---

### Requirement: Sidebar Expand/Collapse (Session-Only)

The admin sidebar MUST support two states — expanded (icon + label) and collapsed (icon only) — and MUST persist the chosen state for the current browser session only.

#### Scenario: Sidebar collapses on toggle

- GIVEN the sidebar is expanded
- WHEN the user clicks the collapse toggle
- THEN the sidebar shows icons only, labels are hidden, and the content area expands to fill the freed space

#### Scenario: Sidebar expands on toggle

- GIVEN the sidebar is collapsed
- WHEN the user clicks the expand toggle
- THEN the sidebar shows icons and labels, the active route remains visually marked

#### Scenario: Collapse state resets after page reload

- GIVEN the user has collapsed the sidebar in the current session
- WHEN the user reloads the page
- THEN the sidebar state MAY reset to the default (expanded); cross-session persistence is NOT required

---

### Requirement: Sidebar Navigation Content

The sidebar MUST include only the sections defined in CRM.md — no additional sections allowed. The `Ventas` entry MUST be implemented as a grouped accordion with children instead of a flat link. Section group titles (e.g. "Inicio", "Estadísticas", "Gestión") MUST NOT be rendered as visible `<p>` or heading elements; groups are implied by structure only. The `Estadísticas` section MUST render as a collapsible accordion group (not flat links). The `Inicio: Visión General` item MUST use that exact label. The `Listado de Ventas` active state MUST use exact path matching — routes that share `/admin/ventas` as a prefix (e.g. `/admin/ventas/ordenes`, `/admin/ventas/archivados`) MUST NOT trigger the active state on `Listado de Ventas`.
(Previously: Section group `<p>` titles were rendered visibly; `Estadísticas` items were flat links without accordion; `Inicio` item label was "Visión general"; `Listado de Ventas` active state used prefix matching causing false positives on child routes.)

| Section group | Items |
|---|---|
| Inicio | Inicio: Visión General (direct link → `/admin`) |
| Estadísticas | accordion → Productos, Ventas y Clientes, Visitas, Reporte de cupones |
| Gestión | Ventas (accordion → Listado de Ventas, Órdenes de Compra, Archivados), Productos, Medios de Pago, Envíos, Clientes, Descuentos, Marketing |

`Reporte de cupones` MUST use the `TicketPercent` icon, and `Descuentos` MUST use the `BadgePercent` icon.

#### Scenario: Active route is marked in sidebar

- GIVEN the user is on `/admin/estadisticas/productos`
- WHEN the sidebar renders
- THEN the "Productos" item under Estadísticas is visually marked as active

#### Scenario: Undefined section not present

- GIVEN the sidebar renders
- WHEN the list of items is inspected
- THEN no section outside the CRM.md list (e.g., Punto de venta, Aplicaciones) is present

#### Scenario: Ventas accordion child active state

- GIVEN the user is on `/admin/ventas`
- WHEN the sidebar renders
- THEN the Ventas accordion is expanded and Listado de Ventas is marked active

#### Scenario: No false active on child route

- GIVEN the user is on `/admin/ventas/ordenes`
- WHEN the sidebar renders
- THEN Listado de Ventas is NOT marked active; Órdenes de Compra IS marked active

#### Scenario: Section group titles not rendered

- GIVEN the sidebar renders on desktop
- WHEN the navigation markup is inspected
- THEN no visible `<p>` or heading text for "Inicio", "Estadísticas", or "Gestión" labels is present

#### Scenario: Estadísticas accordion expands and collapses

- GIVEN the sidebar is expanded and Estadísticas group is collapsed
- WHEN the user clicks the Estadísticas accordion chevron
- THEN the accordion opens showing Productos, Ventas y Clientes, Visitas, and Reporte de cupones

#### Scenario: Inicio label shows correct text

- GIVEN the sidebar renders
- WHEN the Inicio direct link is inspected
- THEN its visible label reads "Inicio: Visión General"

---

### Requirement: Grouped Accordion Sidebar Navigation

The sidebar MUST support grouped navigation entries where groups with 2 or more children render as an accordion. Groups with a single child render as a direct link. The accordion MUST follow these rules:

- Parent label + icon navigate to the primary route of the group; clicking the chevron (►/▼) independently toggles the accordion.
- The active child's group MUST auto-expand on page load.
- In collapsed sidebar mode (icon-only), only parent icons are shown; accordions are not rendered — navigating happens via parent icon click.
- Footer actions (`Configuración`, `Cerrar sesión`) MUST NOT be wrapped in an accordion.

The `Ventas` group MUST have three children:

| Child label | Route |
|-------------|-------|
| Listado de Ventas | `/admin/ventas` |
| Órdenes de Compra | `/admin/ventas/ordenes` |
| Archivados | `/admin/ventas/archivados` |

#### Scenario: Ventas accordion expands on chevron click

- GIVEN the sidebar is expanded and the Ventas group is collapsed
- WHEN the user clicks the chevron icon next to Ventas
- THEN the accordion opens, showing Listado de Ventas, Órdenes de Compra, and Archivados children
- AND the chevron icon rotates to indicate open state

#### Scenario: Active child auto-expands its group

- GIVEN the user is on `/admin/ventas/ordenes`
- WHEN the sidebar renders
- THEN the Ventas accordion is auto-expanded and Órdenes de Compra is visually marked active

#### Scenario: Collapsed sidebar shows parent icon only

- GIVEN the sidebar is in collapsed (icon-only) mode
- WHEN inspected for the Ventas group
- THEN only the Ventas parent icon is visible; no accordion children or chevron are rendered

#### Scenario: Parent label navigates to primary route

- GIVEN the Ventas accordion group is visible
- WHEN the user clicks the Ventas label (not the chevron)
- THEN the user navigates to `/admin/ventas`

#### Scenario: Inicio renders as direct link

- GIVEN the sidebar renders
- WHEN the Inicio group entry is inspected
- THEN it renders as a direct link to `/admin` without accordion wrapper

---

### Requirement: Top Header

The admin layout MUST NOT require a desktop/tablet top header for this stage.

#### Scenario: Header is omitted on desktop

- GIVEN a desktop viewport
- WHEN any admin page loads
- THEN the sidebar + content shell is usable without a layout-level top header

#### Scenario: Header is omitted on mobile

- GIVEN a mobile viewport
- WHEN an admin page loads
- THEN the top header is NOT rendered and mobile navigation uses the bottom nav plus drawer

---

### Requirement: Static Footer Actions

The system MUST render static footer actions for `Configuración` and `Cerrar sesión` with appropriate icons, without implementing settings routing or logout/auth behavior.

#### Scenario: Footer actions render in desktop sidebar

- GIVEN a desktop or tablet viewport
- WHEN the sidebar renders expanded or collapsed
- THEN `Configuración` and `Cerrar sesión` appear at the sidebar bottom and adapt to icon-only collapsed mode

#### Scenario: Footer actions render in mobile drawer

- GIVEN the mobile Menú drawer is open
- WHEN the drawer renders
- THEN `Configuración` and `Cerrar sesión` appear after the navigation links as static actions

---

### Requirement: Mobile Bottom Navigation

On mobile viewports the system MUST render a fixed bottom navigation bar with exactly four tabs: Inicio, Ventas, Productos, Menú.

#### Scenario: Bottom nav renders on mobile

- GIVEN a mobile viewport
- WHEN an admin page loads
- THEN a fixed bottom bar with Inicio, Ventas, Productos, and Menú tabs is visible; the sidebar is NOT visible

#### Scenario: Inicio tab navigates to overview

- GIVEN the mobile bottom nav is visible
- WHEN the user taps Inicio
- THEN the user is taken to `/admin`

#### Scenario: Ventas and Productos tabs navigate to placeholder

- GIVEN the mobile bottom nav is visible
- WHEN the user taps Ventas or Productos
- THEN the user is taken to the corresponding placeholder route (`/admin/ventas` or `/admin/productos`)

---

### Requirement: Mobile Menú Drawer

Tapping the Menú tab MUST open a right-side drawer containing links to all remaining CRM sections not shown as direct tabs, with Ventas rendered as an accordion group. Section group `<p>` titles MUST NOT be rendered as visible elements in the drawer. The `Estadísticas` group MUST render as a collapsible accordion in the drawer, matching desktop sidebar behavior.
(Previously: Section group titles were rendered as visible `<p>` elements; `Estadísticas` items were flat links in the drawer.)

#### Scenario: Menú opens the right-side drawer

- GIVEN the mobile bottom nav is visible
- WHEN the user taps Menú
- THEN a right-side drawer opens listing: Estadísticas (accordion), Ventas (accordion with Listado de Ventas, Órdenes de Compra, Archivados), Productos, Medios de Pago, Envíos, Clientes, Descuentos, Marketing, followed by static footer actions — with no visible group title separators

#### Scenario: Drawer closes on navigation

- GIVEN the Menú drawer is open
- WHEN the user taps any link inside the drawer
- THEN the drawer closes and the selected route loads

---

### Requirement: Grouped Accordion in Mobile Drawer

The mobile Menú drawer MUST apply the same accordion grouping logic as the desktop sidebar. Ventas MUST show its three children in an accordion within the drawer.

#### Scenario: Mobile drawer Ventas accordion works

- GIVEN the mobile Menú drawer is open
- WHEN the Ventas group is tapped
- THEN the accordion expands to show Listado de Ventas, Órdenes de Compra, and Archivados

#### Scenario: Drawer child navigation closes drawer

- GIVEN the Ventas accordion is open in the mobile drawer
- WHEN the user taps Órdenes de Compra
- THEN the drawer closes and the user navigates to `/admin/ventas/ordenes`

---

### Requirement: Placeholder Route Screen

Any CRM route not yet implemented MUST render a placeholder screen inside the admin layout.

#### Scenario: Unimplemented route shows placeholder

- GIVEN a user navigates to `/admin/ventas/archivados` (deferred/documented scope)
- WHEN the page renders
- THEN the admin layout shell is intact and a "Próximamente" placeholder message is displayed

#### Scenario: Placeholder does not break layout

- GIVEN the placeholder screen renders
- WHEN inspected on any viewport
- THEN no layout shift, overflow, or broken shell occurs

---

### Requirement: Ventas Abandoned Carts Navigation

The admin navigation MUST add `Carritos Abandonados` under the Ventas accordion, routed to `/admin/ventas/carritos`. Active-state matching MUST mark only the exact cart section or its email child route, without marking `Listado de Ventas`.

#### Scenario: Desktop navigation shows abandoned carts

- GIVEN the desktop sidebar is expanded
- WHEN the Ventas accordion is open
- THEN `Carritos Abandonados` appears with route `/admin/ventas/carritos`

#### Scenario: Mobile drawer shows abandoned carts

- GIVEN the mobile Menú drawer is open
- WHEN the Ventas accordion expands
- THEN `Carritos Abandonados` appears and navigates to `/admin/ventas/carritos`

#### Scenario: Cart email route keeps section active

- GIVEN the admin is on `/admin/ventas/carritos/email`
- WHEN navigation renders
- THEN the Ventas accordion is expanded and `Carritos Abandonados` is active

