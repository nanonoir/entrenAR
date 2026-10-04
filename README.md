# EntrenAR

Español | [English](#english)

EntrenAR es una plataforma ecommerce de suplementos, indumentaria y accesorios deportivos. Actualmente combina un storefront Next.js, un panel CRM/Admin y un backend NestJS independiente con Prisma y PostgreSQL.

## Estado actual

- Storefront público con home, categorías, listados, detalle de producto, variantes, favoritos mock, carrito, quick-buy y checkout.
- Panel CRM/Admin con productos, categorías, inventario, organización de catálogo, importación/exportación preparada, ventas, clientes, estadísticas, envíos y carritos abandonados.
- Gestión de productos CRM implementada con formularios RHF + Zod, edición inline, constructor de variantes limitado a dos propiedades, presets, ImageDropZone y drag and drop nativo.
- Autenticación de clientes y administradores con sesiones separadas, cookies de refresh independientes, protección de rutas administrativas y errores públicos branded.
- Backend NestJS modular con módulos de auth, catálogo, cuenta, checkout, commerce, clientes, inventario, órdenes de compra, ventas, estadísticas, proveedores, wishlist y carritos abandonados.
- Adaptadores API frontend bajo `src/lib/api`, con límites explícitos entre API y mocks. Los fixtures y previews mock siguen centralizados bajo `src/lib/data`.
- El cambio SDD `crm-products` fue verificado, mergeado y archivado. Sus especificaciones durables están en `openspec/specs/`.

## Stack

- Next.js 16 con App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Zustand
- React Hook Form + Zod
- NestJS 11
- Prisma 7 + PostgreSQL
- Jest, Playwright y harnesses TypeScript

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm run build:backend
npm run build:all
npx tsc --noEmit
npm run verify:frontend-acceptance
npm run test:backend
npm run test:backend:integration
npm run test:backend:e2e
npm run db:migrate
npm run db:seed
```

## Arquitectura

```text
Next.js UI -> frontend API adapter -> NestJS controller -> service -> Prisma -> PostgreSQL
```

- `src/app/(shop)`: storefront público.
- `src/app/(admin)`: superficie protegida del panel administrativo.
- `src/app/(admin-auth)`: login y layout de autenticación administrativa.
- `src/app/(checkout)`: checkout público.
- `src/components/ui`: primitives reutilizables.
- `src/components/shop`: componentes del storefront.
- `src/components/admin`: componentes del CRM/Admin.
- `src/lib/api`: clientes y repositorios frontend para los contratos backend.
- `src/lib/data`: mocks, fixtures y adaptadores de datos locales.
- `src/stores`: estado de interacción y stores administrativos.
- `backend/src/modules`: módulos NestJS y lógica de negocio backend.
- `backend/prisma`: schema, migraciones, fixtures y seed canónico.
- `tests/harnesses`: validaciones de límites, adapters y stores.
- `tests/e2e`: cobertura Playwright de flujos críticos.

## Calidad y alcance

El frontend mantiene compatibilidad mock para desarrollo y harnesses, pero las operaciones autoritativas de negocio pertenecen al backend. No se implementan todavía integraciones completas con MercadoPago, recomendaciones AI, reviews, búsqueda fuzzy avanzada ni soporte multi-moneda.

## English

[Español](#entrenar) | English

EntrenAR is an ecommerce platform for supplements, sportswear, and fitness accessories. It currently combines a Next.js storefront, a CRM/Admin panel, and an independent NestJS backend using Prisma and PostgreSQL.

## Current Status

- Public storefront with home, categories, listings, product detail, variants, mock favorites, cart, quick-buy, and checkout.
- CRM/Admin panel covering products, categories, inventory, catalog organization, prepared import/export, sales, customers, statistics, shipping, and abandoned carts.
- CRM product management implemented with RHF + Zod forms, inline editing, a two-property variant builder, presets, ImageDropZone, and native drag and drop.
- Separate customer and administrator sessions, independent refresh cookies, protected admin routes, and branded public errors.
- Modular NestJS backend with auth, catalog, account, checkout, commerce, customers, inventory, purchase orders, sales, statistics, suppliers, wishlist, and abandoned-cart modules.
- Frontend API adapters live under `src/lib/api`, with explicit API/mock boundaries. Mock fixtures and previews remain centralized under `src/lib/data`.
- The `crm-products` SDD change was verified, merged, and archived. Its durable specifications live under `openspec/specs/`.

## Stack

- Next.js 16 with App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Zustand
- React Hook Form + Zod
- NestJS 11
- Prisma 7 + PostgreSQL
- Jest, Playwright, and TypeScript harnesses

## Architecture

```text
Next.js UI -> frontend API adapter -> NestJS controller -> service -> Prisma -> PostgreSQL
```

- `src/app/(shop)`: public storefront.
- `src/app/(admin)`: protected admin surface.
- `src/app/(admin-auth)`: administrator authentication routes and layout.
- `src/app/(checkout)`: public checkout.
- `src/components/ui`: reusable primitives.
- `src/components/shop`: storefront components.
- `src/components/admin`: CRM/Admin components.
- `src/lib/api`: frontend clients and repositories for backend contracts.
- `src/lib/data`: local mocks, fixtures, and data adapters.
- `src/stores`: interaction state and admin stores.
- `backend/src/modules`: NestJS modules and backend business logic.
- `backend/prisma`: canonical schema, migrations, fixtures, and seed.
- `tests/harnesses`: boundary, adapter, and store validation.
- `tests/e2e`: Playwright coverage for critical flows.

## Scope

The frontend keeps mock compatibility for development and harnesses, while authoritative business operations belong to the backend. Full MercadoPago integration, AI recommendations, reviews, advanced fuzzy search, and multi-currency support are not implemented yet.