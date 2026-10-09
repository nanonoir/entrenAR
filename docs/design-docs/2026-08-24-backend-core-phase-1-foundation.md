# Design: Backend Core Phase 1 Foundation

## Technical Approach

Bootstrap the standalone NestJS 11 backend under `backend/`. This phase establishes the strict process boundary, PostgreSQL + Prisma 7.6 infrastructure via Docker Compose, and foundational cross-cutting concerns (global Zod validation, structured error filter, logging/request IDs, Swagger, and health checks). We will implement a minimal `User` model, an authentication module using JWT access tokens with HttpOnly refresh cookies, and RBAC guards to secure `/api/v1` routes.

## Architecture Decisions

### Decision: NestJS 11 Standalone Workspace
**Choice**: Create a separate `package.json` in `backend/` running NestJS 11.
**Alternatives considered**: Next.js API Routes, Next.js Server Actions, integrated monorepo workspace.
**Rationale**: Adheres to the PRD mandate to isolate authoritative business logic in a modular monolith. Prevents accidental imports of Prisma into the Next.js frontend tree.

### Decision: Prisma 7.6 with `prisma.config.ts` and `@prisma/adapter-pg`
**Choice**: Use Prisma 7.6 patterns: configuration in `prisma.config.ts`, generated output, and native PG adapter `@prisma/adapter-pg`.
**Alternatives considered**: Legacy Prisma schema with embedded `datasource` URL and default query engine.
**Rationale**: Modernizes the persistence layer by separating environment configuration from the schema. Prevents legacy `layoutschema.prisma` leakage and improves connection pool performance via the runtime PG adapter.

### Decision: Auth & Session Management
**Choice**: Short-lived JWT Bearer access tokens + long-lived, rotation-enabled, HttpOnly refresh cookies.
**Alternatives considered**: Session-based auth, local storage for refresh tokens.
**Rationale**: Mitigates XSS vulnerabilities for refresh tokens while supporting stateless, scalable REST access. Rotation and revocation handle reuse defense.

### Decision: Validation Layer
**Choice**: Global Zod validation pipe.
**Alternatives considered**: `class-validator` and `class-transformer`.
**Rationale**: PRD explicitly requires Zod. It allows sharing contract definitions seamlessly with the frontend and keeps validation strictly aligned with Next.js/RHF Zod models.

## Data Flow

    Client (Browser) 
         │ (REST / JSON)
         ▼
    NestJS Global Middleware (Helmet, CORS, Rate Limit, ReqID)
         │
         ▼
    RBAC / JWT Auth Guard (validates token/role)
         │
         ▼
    Global Zod Pipe (validates DTO)
         │
         ▼
    Controller ──→ Service (Business Logic)
         │
         ▼
    Prisma Client (via @prisma/adapter-pg) 
         │
         ▼
    PostgreSQL (Docker)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/package.json` | Create | NestJS 11, Prisma 7.6, Zod, Passport, Jest. |
| `docker-compose.yml` | Create | PostgreSQL database and necessary dependencies. |
| `backend/prisma/schema.prisma` | Create | Initial `User` model (email, passwordHash, role) and AuthSession. |
| `backend/prisma/prisma.config.ts` | Create | Prisma 7.6 configuration. |
| `backend/src/main.ts` | Create | Bootstrap `/api/v1`, CORS, filters, Zod pipe, Swagger. |
| `backend/src/common/filters/global-exception.filter.ts` | Create | Formats errors to `{ok, code, message, issues}`. |
| `backend/src/common/validation/zod.pipe.ts` | Create | Custom Zod validation pipe. |
| `backend/src/modules/auth/*` | Create | Auth controller, service, strategies, guards, and decorators. |
| `backend/src/modules/users/*` | Create | Users module for admin seeding. |

## Interfaces / Contracts

```typescript
// Error Envelope
export interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
  field?: string;
  issues?: unknown[];
}

// Minimal User Model (Phase 1)
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(CUSTOMER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Role {
  CUSTOMER
  ADMIN
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zod Pipe, Exception Filter, Auth Service (Token logic, rotation). | Jest, mocked Prisma/Config modules. |
| E2E | `POST /api/v1/auth/login`, Request ID injection, Error envelope structure, RBAC guards. | Supertest with an isolated test DB. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: No doc-execution boundary. | - | - |
| Git repository selection | `git -C`, relative paths, absolute paths | N/A: Does not execute Git. | - | - |
| Commit state | staged, `commit -a`, empty index | N/A: Does not integrate with Git index. | - | - |
| Push state | tracking branch, first push, explicit refspec | N/A: Does not execute pushes. | - | - |
| PR commands | explicit `--head`, environment prefix, composed commands | N/A: Does not integrate with GH CLI. | - | - |

*(Note: Process boundaries are introduced via Docker and `/api/v1` routes, but the specific tool-automation boundaries checked by this matrix do not apply to this phase).*

## Migration / Rollout

No frontend migration is required. Standalone backend and database are established natively. Rollback involves deleting `backend/` and `docker-compose.yml`.

## Open Questions

- None.
