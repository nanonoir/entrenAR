# Design: Backend Core Phase 7 — Customers CRM

## Technical Approach

This phase introduces the foundational `Customer` and `CustomerAddress` models into the backend architecture, seamlessly integrating them with the existing `Order` and `User` entities. The implementation uses a NestJS modular monolith with Prisma, exposing a secured REST API for the admin panel. The frontend utilizes a Repository/Adapter pattern, preserving a mock data fallback toggle to ensure continuous development and testing capabilities before the backend reaches full maturity. Key workflows, such as GDPR-compliant anonymization and secure CSV exports, are handled strictly on the backend to guarantee data integrity and security.

## Architecture Decisions

### Decision: Customer Anonymization Strategy
**Choice**: Transactional PII stripping (Anonymization) with relational preservation.
**Alternatives considered**: Hard deletion of records, or soft deletion using a `deletedAt` flag.
**Rationale**: Hard deletion would break financial and order historical reporting constraints. A `deletedAt` flag leaves PII in the database, failing compliance requirements. Atomic anonymization purges sensitive data (`fullName`, `email`, `phone`, `dniOrCuil`) while retaining the generic shell and relational integrity for analytics (orders count, total spent).

### Decision: Secure CSV Export Generation
**Choice**: Backend-generated CSV with formula injection guards and UTF-8 BOM.
**Alternatives considered**: Frontend CSV generation from JSON, or raw unescaped backend generation.
**Rationale**: Generating on the frontend exposes large datasets to the client and bypasses pagination. Unescaped CSVs are vulnerable to CSV Injection (Formula Injection). The backend will stream/buffer the export, prepending a single quote (`'`) to any cell starting with `=`, `+`, `-`, or `@`, and including `\uFEFF` to ensure Excel renders special characters correctly.

### Decision: Frontend-Backend Integration Layer
**Choice**: Repository/Adapter pattern with environment variable toggle (`NEXT_PUBLIC_ADMIN_DATA_SOURCE`).
**Alternatives considered**: Direct `fetch` calls inside Next.js UI components.
**Rationale**: Protects UI components from backend instability during development. Allows immediate fallback to mock data, keeping the `entrenar-data-layer` guideline intact while gracefully migrating from Phase 10's perspective.

## Data Flow

    [Frontend Admin CRM]
           │ (REST API via api-customers.repository.ts)
           ▼
    [AdminCustomersController]
           │ (Zod Validation & AuthGuard)
           ▼
    [CustomersService] ────→ [CustomerMapper] (DTO formatting)
           │
           ▼
    [CustomersRepository]
           │ (Prisma Query & Transactions)
           ▼
    [PostgreSQL Database] (Customer, CustomerAddress, Order)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Modify | Add `Customer`, `CustomerAddress`, modify `Order` to include `customerId`. Add indexes. |
| `backend/src/modules/customers/customers.module.ts` | Create | NestJS module wiring. |
| `backend/src/modules/customers/admin-customers.controller.ts` | Create | Secured endpoints (`@Roles(Role.ADMIN)`). |
| `backend/src/modules/customers/customers.service.ts` | Create | Business logic (anonymization, stats aggregation, secure CSV). |
| `backend/src/modules/customers/customers.repository.ts` | Create | Database interactions and Prisma transactions. |
| `backend/src/modules/customers/customer.mapper.ts` | Create | Transforms DB models to frontend DTOs. |
| `backend/src/modules/customers/customers.schemas.ts` | Create | Zod schemas for payload validation. |
| `backend/src/modules/customers/dto/customers-openapi.dto.ts` | Create | OpenAPI/Swagger definitions. |
| `src/lib/api/admin/customers/types.ts` | Create | Shared domain types for frontend. |
| `src/lib/api/admin/customers/contracts.ts` | Create | Zod validation on the frontend client. |
| `src/lib/api/admin/customers/repository.ts` | Create | Interface defining `CustomerRepository`. |
| `src/lib/api/admin/customers/api-customers.repository.ts` | Create | Live REST implementation. |
| `src/lib/api/admin/customers/mock-customers.repository.ts` | Create | Fallback mock implementation. |
| `src/lib/api/admin/customers/index.ts` | Create | Factory exporting the active repository. |
| `src/stores/admin-customers-store.ts` | Modify | Integrate API factory, handle grace mock fallback. |

## Interfaces / Contracts

```prisma
// Prisma Schema Additions
model Customer {
  id                   String            @id @default(cuid())
  fullName             String
  email                String?
  phone                String?
  dniOrCuil            String?
  firstInteractionDate DateTime          @default(now())
  notes                String?
  tags                 Json?
  isAnonymized         Boolean           @default(false)
  userId               String?           @unique
  user                 User?             @relation(fields: [userId], references: [id])
  addresses            CustomerAddress[]
  orders               Order[]
  createdAt            DateTime          @default(now())
  updatedAt            DateTime          @updatedAt

  @@index([isAnonymized, createdAt])
  @@index([userId])
}

// Partial index raw SQL equivalent needed for lowercase email:
// CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"(lower("email")) WHERE "isAnonymized" = false;

model CustomerAddress {
  id               String   @id @default(cuid())
  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  street           String
  number           String
  floorOrApartment String?
  postalCode       String
  neighborhood     String?
  city             String
  provinceOrState  String
  country          String   @default("Argentina")
}

// Added to Order model:
// customerId String?
// customer   Customer? @relation(fields: [customerId], references: [id])
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Anonymization Logic | Mock Prisma transaction, assert PII fields are overwritten and `isAnonymized` is true. |
| Unit | CSV Export Security | Mock data with `=CMD()` and `@VAR`, assert output prepends `'`. |
| Integration | API Endpoints | Supertest over `/api/v1/admin/customers`, assert RBAC (403 for non-admins), search filtering, and pagination. |
| E2E | Mock Fallback | Test Next.js UI using `NEXT_PUBLIC_ADMIN_DATA_SOURCE=mock` to ensure tables render from fallback gracefully. |

## Traceability Matrix

| Spec | Component | Tests |
|------|-----------|-------|
| 1. Customer Management Base | `schema.prisma`, `CustomersModule` | Unit: DTOs & Validation; Integration: CRUD endpoints. |
| 2. Customer Aggregation | `CustomersRepository`, `CustomerMapper` | Unit: aggregation calculations (only paid/non-cancelled orders). |
| 3. Search & Filtering | `AdminCustomersController`, `CustomersRepository` | Integration: Query params for `q`, `tags`, `hasAccount`, pagination. |
| 4. Export to CSV | `CustomersService` | Unit: CSV Formula Guard, `\uFEFF` BOM inclusion. |
| 5. Anonymization Flow | `CustomersService` (transactional flow) | Unit/Integration: atomic commit, related order snapshot sanitation. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No complex rollout required. The database migration will add `Customer` and `CustomerAddress` tables. Existing `Order` records will remain unlinked to a `Customer` until backfilled manually or upon their next purchase. The frontend adapter seamlessly toggles via env vars.

## Open Questions

- [ ] Will historical guest orders be retroactively migrated/linked to new `Customer` records based on matching emails, or only forward-looking orders?
