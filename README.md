# EntrenAR

Español | [English](#english)

EntrenAR es una tienda ecommerce de suplementos, indumentaria y accesorios deportivos construida con Next.js App Router. El objetivo actual del repositorio es consolidar primero la experiencia visual publica, con mocks curados y una arquitectura preparada para reemplazar datos estaticos por backend real sin reescribir la interfaz.

## Estado actual

- MVP visual del storefront publico.
- Home con hero carousel, categorias principales, productos destacados y beneficios comerciales.
- Listados y detalle de producto con breadcrumbs, galeria de imagenes, variantes, zoom, favoritos mock y productos relacionados.
- Flujo quick-buy con modales reutilizables, productos sugeridos y submodal de configuracion.
- Drawer de carrito con totales, descuentos, progreso de envio gratis y sugerencias.
- Checkout estatico para fijar la experiencia antes de integrar pagos.

## Stack

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand para estado cliente
- Lucide React para iconografia

## Arquitectura

El proyecto separa responsabilidades por dominio:

- `src/app/(shop)`: rutas publicas del ecommerce.
- `src/components/ui`: primitives reutilizables.
- `src/components/shop`: componentes de layout, home, productos, carrito y quick-buy.
- `src/hooks`: estado e interacciones reutilizables de cliente.
- `src/lib`: helpers puros, reglas comerciales y adaptadores temporales.
- `src/lib/data`: mocks de datos por dominio.
- `src/types`: tipos compartidos por dominio.
- `src/stores`: stores cliente con Zustand.

## English

[Español](#entrenar) | English

EntrenAR is an ecommerce store for supplements, sportswear, and fitness accessories built with Next.js App Router. The current goal of the repository is to first consolidate the public visual experience, with curated mocks and an architecture prepared to replace static data with a real backend without rewriting the interface.

## Current Status

- Visual MVP of the public storefront.
- Home with hero carousel, main categories, featured products, and commercial benefits.
- Product listings and product detail with breadcrumbs, image gallery, variants, zoom, mock favorites, and related products.
- Quick-buy flow with reusable modals, suggested products, and configuration submodal.
- Cart drawer with totals, discounts, free-shipping progress, and suggestions.
- Static checkout to define the experience before integrating payments.

## Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Zustand for client state
- Lucide React for iconography

## Architecture

The project separates responsibilities by domain:

- `src/app/(shop)`: public ecommerce routes.
- `src/components/ui`: reusable primitives.
- `src/components/shop`: layout, home, product, cart, and quick-buy components.
- `src/hooks`: reusable client state and interactions.
- `src/lib`: pure helpers, business rules, and temporary adapters.
- `src/lib/data`: domain data mocks.
- `src/types`: shared domain types.
- `src/stores`: client stores with Zustand.
