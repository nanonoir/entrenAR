# Admin Statistics UI Integration Specification

## Purpose

Make supported administrative reports reactive to a shared statistics data source while retaining visit analytics as mock-only.

## Requirements

### Requirement: Shared Statistics Store

`useAdminStatisticsStore` MUST manage the selected period, custom date range, per-report cached data, loading state, and controlled error state. Changing a period or range MUST refresh affected reports using the repository query.

#### Scenario: Period selection refreshes reports

- GIVEN statistics reports are displayed for one period
- WHEN the store changes to another valid period
- THEN it requests and caches reports for the new period and updates subscribers
- 
#### Scenario: Custom range is incomplete

- GIVEN `custom` is selected without both valid date bounds
- WHEN a report refresh is requested
- THEN the store exposes a controlled validation error and does not request a report

### Requirement: Controlled Period Filter

`PeriodFilter.tsx` MUST be a controlled component bound to the statistics store's selected period and custom range. It MUST notify the store of valid user changes and reflect the current store state.

#### Scenario: Filter state is shared

- GIVEN two statistics views use the filter
- WHEN a user selects `90d` in one view
- THEN both views observe `90d` as the active period

### Requirement: Reactive Report Views

The admin overview, sales/customers, products, and coupon-report views MUST render their store-backed reports, show loading skeletons while data is pending, and show a graceful fallback or controlled error state when data cannot be loaded. `visitas/page.tsx` MUST retain its mock-only behavior.

#### Scenario: Report view loads

- GIVEN a supported report view mounts without cached data
- WHEN its report is loading
- THEN the view renders a skeleton and replaces it with report data when available

#### Scenario: Visits remain outside statistics API scope

- GIVEN the visits analytics page is opened
- WHEN statistics integration is active
- THEN the page continues to use its existing mock telemetry data
