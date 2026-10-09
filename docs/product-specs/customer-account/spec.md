# Customer Account Specification

## Purpose

Provide authenticated, server-authoritative account data while retaining reversible mock-mode frontend behavior.

## Requirements

### Requirement: Customer Profile

The system MUST let an authenticated CUSTOMER read and update only their `email`, `firstName`, `lastName`, `dni`, `gender`, `birthDate`, and `phone` profile projection. It MUST derive ownership from the session, enforce the public DNI contract, and omit secrets.

#### Scenario: Update own profile
- GIVEN an authenticated CUSTOMER and valid profile input
- WHEN the customer updates their profile
- THEN the system SHALL return the persisted public projection without secrets

#### Scenario: Unauthorized or foreign profile access
- GIVEN no valid CUSTOMER session or a foreign account identifier
- WHEN profile data is requested or mutated
- THEN the system MUST deny access and expose no other account data

### Requirement: Owned Address CRUD

The system MUST list, create, update, and delete only the authenticated customer's addresses using `id`, `label`, `recipient`, `street`, `city`, `province`, `postalCode`, and `phone`. It MUST enforce a maximum of six addresses.

#### Scenario: Manage an owned address
- GIVEN an authenticated CUSTOMER with fewer than six addresses
- WHEN the customer creates, changes, lists, or deletes an owned address
- THEN the system SHALL return only that customer's resulting address data

#### Scenario: Limit or ownership failure
- GIVEN six addresses or another customer's address
- WHEN a seventh address is created or the foreign address is changed or deleted
- THEN the system MUST return `ADDRESS_LIMIT_REACHED` or a safe not-found/authorization error without mutation

### Requirement: Persistent Wishlist

The system MUST persist each authenticated customer's unique public-product wishlist relations and MUST reject duplicate, unknown, or unavailable product identities. Guest wishlists MAY remain local.

#### Scenario: Manage a valid wishlist item
- GIVEN an authenticated CUSTOMER and a public product
- WHEN the product is added, listed, or removed
- THEN the system SHALL return the compatible public projection or success result

#### Scenario: Invalid wishlist mutation
- GIVEN a duplicate relation or invalid product identity
- WHEN an add or removal is requested
- THEN the system MUST return a controlled error and preserve valid relations

### Requirement: Account Orders Skeleton

The system MUST expose an authenticated account-order collection with a stable projection. Before order persistence exists, it SHALL return an empty collection and MUST NOT invent orders.

#### Scenario: Empty order history
- GIVEN an authenticated CUSTOMER before the Orders phase
- WHEN account orders are requested
- THEN the system SHALL return an empty compatible collection

### Requirement: Repository Migration and Rollback

Migrated account reads and mutations MUST use domain-facing repositories, not component-level API calls. API mode MUST treat server data as authoritative; mock mode MUST remain selectable for rollback, with safe loading, empty, and error states.

#### Scenario: API bootstrap
- GIVEN API mode and a refreshable session
- WHEN the account surface initializes
- THEN it SHALL load `/auth/me` and account projections without trusting stale local data

#### Scenario: API failure rollback
- GIVEN an unavailable or invalid API backend
- WHEN an account operation fails
- THEN the UI SHALL show a safe error and permit mock mode without route changes
