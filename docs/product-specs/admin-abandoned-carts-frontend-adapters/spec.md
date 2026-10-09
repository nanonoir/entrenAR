# Admin Abandoned Carts Frontend Adapters Specification

## Purpose

Defines the frontend boundary and resilient admin experience for abandoned-cart recovery.

## Requirements

### Requirement: Repository Contract and Data Sources

`AbandonedCartsRepository` MUST define `list()`, `getById()`, `sendRecoveryEmail()`, `markManualRecovery()`, `convertCart()`, `discardCart()`, `getConfig()`, `updateConfig()`, `getTemplate()`, and `updateTemplate()`. `ApiAbandonedCartsRepository` MUST call `/api/v1/admin/abandoned-carts/*`; `MockAbandonedCartsRepository` MUST provide equivalent local-mock behavior. A factory MUST select mocks through `NEXT_PUBLIC_USE_MOCK_ADMIN_ABANDONED_CARTS`.

#### Scenario: Configured mock source
- Given the mock environment flag is enabled
- When the store loads abandoned carts
- Then it uses the mock repository without API requests

#### Scenario: API source
- Given the mock environment flag is disabled
- When the store performs a repository operation
- Then it uses the API repository and controlled transport errors

### Requirement: Synchronized Store and Recovery UI

`useAdminAbandonedCartsStore` MUST expose loading and error states, synchronize list/detail/config/template reads, and apply or reconcile optimistic action updates. The UI MUST provide search, status and date filters, pagination, a detail modal or drawer with line items and recovery timeline, and accessible configuration/template editors.

#### Scenario: Optimistic recovery action
- Given a listed recoverable cart
- When an ADMIN sends its recovery email
- Then the UI shows pending state and reconciles the resulting status or controlled error

#### Scenario: Filtered detail workflow
- Given carts with multiple statuses and dates
- When an ADMIN filters, pages, and opens a cart
- Then the visible result set matches the query and detail shows items and chronological timeline
