# Admin Shipping Tracking Specification

## Purpose

Defines the Admin/CRM shipment tracking experience for read-only shipment and pickup records associated with existing sales.

## Requirements

### Requirement: Admin shipping tracking list

The system MUST expose `/admin/envios` as a read-only, unified list of home deliveries, branch deliveries, pickup orders, and manual orders derived from mock/admin sales data.

#### Scenario: View unified records

- GIVEN an admin opens `/admin/envios`
- WHEN shipment records exist
- THEN the page shows one combined list without delivery-type tabs
- AND each row can navigate to its shipment detail.

#### Scenario: Empty source data

- GIVEN no shipment records exist
- WHEN the admin opens the tracking page
- THEN the page shows an empty state equivalent to `Todavía no hay envíos para mostrar.`

### Requirement: Search and filter tracking records

The tracking page MUST provide functional search by shipment/sale ID, recipient, or tracking code, and a drawer-based status filter over mock data without mutating records.

#### Scenario: Search by supported fields

- GIVEN shipment records are visible
- WHEN the admin searches by ID, recipient, or tracking code
- THEN the list shows only matching records
- AND source records remain unchanged.

#### Scenario: Filter by multiple statuses

- GIVEN the filter drawer is open
- WHEN the admin selects one or more shipment statuses and applies filters
- THEN only records with selected statuses are shown
- AND clearing filters restores all records.

#### Scenario: No matching results

- GIVEN search or filters exclude every record
- WHEN the list refreshes
- THEN the page shows an empty state equivalent to `No encontramos envíos con esos criterios.`

### Requirement: Shipment detail

The system MUST expose `/admin/envios/detalle/[envioId]` as a read-only detail where `envioId` equals the associated `ventaId`; it MUST include `Ver pedido`, MUST NOT include `Más opciones`, and MUST show an informative label block without real label generation.

#### Scenario: Open detail and view sale link

- GIVEN shipment `103` exists for sale `103`
- WHEN the admin opens `/admin/envios/detalle/103`
- THEN the detail shows read-only shipment, recipient, customer, cost, timing, and logistics fields
- AND `Ver pedido` navigates to the existing sale detail for `103`.

#### Scenario: Label action is non-mutating

- GIVEN the admin views a shipment detail
- WHEN the label block is displayed
- THEN it explains future tracking-label behavior
- AND no real label generation, tracking API call, or shipment mutation occurs.

### Requirement: Tracking MVP boundaries

The tracking feature MUST NOT create shipments, mutate shipment statuses, expose backend/API integration, or show visible mock/demo disclaimers in the UI.

#### Scenario: Manual creation stays absent

- GIVEN the admin opens tracking or detail pages
- WHEN the page renders actions
- THEN no `Agregar envío manual` or shipment mutation action is available.
