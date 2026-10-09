# Frontend Guidelines & Conventions

This document establishes the durable frontend architecture, component conventions, form patterns, and client-side state guidelines for EntrenAR.

---

## 1. UI & Component Architecture

### 1.1 Composition & Modularity
- Build with composition over monolithic components.
- Primitives live in `src/components/ui/` (`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Badge`, `Card`, `Container`, `Section`).
- Domain-specific shop components live under `src/components/shop/`, organized by subdomain:
  - `layout/`: Horizontal navigation, header, footer, top bar.
  - `home/`: Hero, category grids, promo highlights.
  - `products/`: Product gallery, pricing, specs, variants.
  - `products/listing/`: Filter bars, sorting, product grids.
  - `quick-buy/`: Drawer previews and fast-add flows.
  - `cart/`: Slide-over cart, line items, cart actions.
  - `account/`: Customer profile and order tabs.

### 1.2 Component Separation Rules
- **Listing vs. Detail**: `ProductCard` is exclusively for catalog cards, search listings, and promo carousels. It must never be overloaded or reused as the product detail layout (`ProductDetailCard`).
- **Client vs. Server Components**: Default to React Server Components (RSC) for page structures, static layouts, and initial server reads. Mark interactive elements explicitly with `"use client"`.
- **Accessibility & Variants**: UI primitives expose controlled variants (`variant`, `size`, `loading`, `disabled`) and must preserve keyboard focus rings, semantic labels, and ARIA attributes.

---

## 2. Form Architecture (React Hook Form + Zod)

### 2.1 Standard for Complex Forms
- All complex or administrative forms (e.g., Admin CRM products, customer edit, sales entry, shipping settings) must use **React Hook Form (RHF)** + **Zod** + **`@hookform/resolvers`**.
- Do not maintain large forms using scattered manual React `useState` hooks.

### 2.2 Form Hygiene Rules
- Use `setValue(fieldName, value, { shouldValidate: true, shouldDirty: true })` when setting programmatic values.
- Never directly mutate `event.target.value` or form state outside RHF's registration system.
- Schemas must be defined with Zod and provide localized, descriptive validation messages.
- *Legacy note*: Historical shop forms (Checkout, Account) that still use manual state are tracked in `docs/exec-plans/tech-debt-tracker.md` and should be migrated during dedicated refactor phases, not opportunistic edits.

---

## 3. Client State Management (Zustand)

Zustand represents fast client-side interaction state. It does not replace the data layer or authoritative backend persistence.

### 3.1 Store Responsibilities
- `useCartStore`: Fast cart interaction state.
  - Guest cart persists in `localStorage` under key `entrenar-cart-preview`.
  - Logged-in cart uses local state for instantaneous UX while synchronizing with the NestJS backend as the authoritative source of truth.
  - Before checkout, active cart state must be synchronized and revalidated with the backend.
- `useUIStore`: Ephemeral UI state (drawers, mega-menu open/close, modal visibility). Never persisted.
- `useAuthStore`: Client-safe authentication session state (`entrenar-auth-preview`).
- `useAdminSalesStore` & `useAdminAbandonedCartsStore`: Administrative CRM operational state. Operates **strictly in-memory** (no `localStorage` or `persist` middleware), executing domain commands (`createSale`, `cancelSale`) mimicking backend workflows.

### 3.2 Hydration Guardrails
- Persisted client stores configure `skipHydration: true` to prevent SSR hydration mismatches. Components that depend on persisted store state must defer rendering of storage-dependent branches until mounted on the client.
