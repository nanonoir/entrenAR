# Product Requirements Document (PRD)

## Title: Realistic Showcase Data Seeding, Media Assets & Operational CRM Simulator
**Status:** Draft / Proposed  
**Author:** Software Architecture Team  
**Target Release:** Portfolio Showcase & Production Readiness  
**Target Systems:** PostgreSQL 16 (via Prisma ORM 7) & Next.js 16 (App Router)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Context
EntrenAR is engineered both as a reusable commercial foundation and as an elite, production-grade full-stack portfolio showcase. To convincingly demonstrate its capabilities to clients, recruiters, and stakeholders, the platform cannot look like an empty template with 4-5 dummy placeholders. It must feel like an established, high-volume sports nutrition and fitness ecommerce that processes hundreds of orders across Argentina.

### 1.2 The Problem
1. **Underpopulated Catalog:** The existing database seeder (`backend/prisma/seed.ts`) contains only a handful of basic products with minimal variant coverage and generic descriptions.
2. **Flat / Barren Dashboards:** The admin CRM statistics and sales screens (`/admin/estadisticas`, `/admin/ventas`) require historical data across multiple weeks to render meaningful curves, trend variations, average ticket metrics, and customer lifetime values. Without historical data, analytics charts look broken or flat.
3. **Missing Visual Merchandising Assets:** The storefront needs high-impact promotional banners for the home carousel, illustrated category headers, and crisp, consistent product imagery to deliver a premium shopping experience.
4. **Environment Portability:** Data seeding must run deterministically via a single command (`npm run db:seed`) both in local Docker development and on remote cloud databases (Render, Railway, Neon, AWS RDS) without conflicts or duplicate records.

### 1.3 The Solution
Build an extensive, idempotent, production-grade showcase seeder that populates:
- **100+ Authentic Fitness Products Scraped from entreno.com.ar:** Extracted from the real Argentine ecommerce `entreno.com.ar`, featuring authentic titles, official brand names, real descriptions, variant combinations (flavors/sizes), high-res CDN images, and actual market prices in ARS.
- **High-Impact Merchandising Media:** Home hero carousel banners (desktop and mobile), category cards, and clean product image URLs.
- **Temporal CRM Simulation (Last 8 Weeks):** Distributed orders, realistic customer identities, varied order lifecycle stages, abandoned carts with recovery workflows, and active supplier purchase orders to bring all admin dashboards to life.

---

## 2. Personas & Showcase Demonstration Journeys

### Persona A: Technical Recruiter / Potential Client (Public Storefront)
- **Journey 1: Category Browsing & Filtering:**  
  Lands on the home page, views dynamic promotional banners in the hero carousel, clicks "Proteínas", filters by brand ("Star Nutrition"), selects a flavor ("Chocolate Suizo") and size ("2kg"), and sees live stock feedback and formatted ARS pricing.
- **Journey 2: Realistic Cart & Checkout Experience:**  
  Adds multiple items (protein powder, shaker, lifting straps), inputs a promo coupon (`VOLUMEN10`), chooses a delivery method (Andreani / Punto de Retiro), and completes checkout seeing authoritative quotes and discounts.

### Persona B: Operations Manager / Business Evaluator (Admin CRM)
- **Journey 1: Executive Dashboard & Performance Trends:**  
  Enters `/admin`, selects "Últimos 30 días", and inspects dynamic revenue charts, cart conversion rates, and average ticket KPIs generated from real database aggregations.
- **Journey 2: Order Fulfillment & Stock Lifecycle:**  
  Navigates to `/admin/ventas`, filters orders by "Por empaquetar", updates a sale to "Enviado" with an Andreani tracking code, or cancels an order with automatic stock replenishment.
- **Journey 3: Abandoned Cart Recovery:**  
  Views `/admin/ventas/carritos`, identifies a cart abandoned 4 hours ago by a customer in Rosario, and previews an incentive recovery email with an automatically attached discount coupon.

---

## 3. Product Catalog & Media Specifications

### 3.1 Category Hierarchy
The catalog must populate 6 primary categories and subcategories:
1. **Proteínas & Aminoácidos:**
   - Whey Protein Concentrada (80%)
   - Whey Protein Isolate & Hydrolyzed
   - Proteína Vegana (Arveja & Soja)
   - BCAA & Glutamina
2. **Fuerza, Energía & Creatinas:**
   - Creatina Monohidrato Micronizada
   - Creatina Creapure®
   - Pre-Entrenos (Pre-Workouts con cafeína / beta-alanina)
   - Intra-Entrenos & Electrolitos
3. **Salud, Vitaminas & Bienestar:**
   - Multivitamínicos Deportivos
   - Omega 3 Puro (Aceite de pescado EPA/DHA)
   - Magnesio Quelado & Zinc
   - Colágeno Hidrolizado con Vitamina C
4. **Accesorios & Equipamiento de Gimnasio:**
   - Shakers deportivos (500ml y 700ml con compartimentos)
   - Cinturones de fuerza de cuero 10mm (Powerlifting)
   - Straps de levantamiento (algodón reforzado y figura 8)
   - Rodilleras de neoprene 7mm
   - Magnesio en tiza y líquido
   - Bandas de resistencia y elásticos
5. **Market Fit & Alimentos Funcionales:**
   - Mantequillas de maní naturales (Crema y Crunchy)
   - Barras proteicas (20g de proteína por barra)
   - Avena instantánea ultrafina
   - Harina de almendras y semillas
6. **Indumentaria & Ropa Técnica:**
   - Remeras Oversized Heavy Weight de algodón
   - Shorts de entrenamiento con calza interna
   - Musculosas stringer de entrenamiento
   - Gorras deportivas trucker y dri-fit

### 3.2 Brands & Data Provenance
- **Primary Source:** Extracted directly from `entreno.com.ar` via an offline scraper/ETL pipeline to guarantee authentic market data, official SKUs, and genuine Argentine product imagery.
- **Leading Brands Represented:**
  - Star Nutrition
  - ENA Sport
  - Body Advance
  - Optimum Nutrition (ON)
  - Dymatize
  - Universal Nutrition
  - Mutant
  - Gentech
  - Mervick Lab
  - EntrenAR Gear (Private Label for select accessories & apparel)

### 3.3 Variant & Stock Distribution Matrix
- **Variants per Product:**
  - Powders: Flavors (Chocolate, Vainilla, Frutilla, Cookies & Cream, Banana, Sin Sabor) × Sizes (300g, 500g, 900g, 1kg, 2kg, 3kg, 5kg).
  - Accessories & Apparel: Sizes (S, M, L, XL) × Colors (Negro Mate, Verde Militar, Gris Melange, Blanco).
- **Realistic Stock Distribution:**
  - 70% of products: Healthy stock (15 - 80 units).
  - 20% of products: Low stock alert (<5 units) to trigger admin restock alerts.
  - 10% of products: Out of stock (0 units) to validate storefront badge handling and back-ordering rules.

### 3.4 Visual Merchandising Media
1. **Hero Carousel Banners (`/public/banners/`):**
   - Banner 1: *Mega Promo Proteínas* (Focus: Volumen & Masa Muscular) - Desktop 1920x600 & Mobile 750x600.
   - Banner 2: *Creatina Creapure 100% Pura* (Focus: Máxima Fuerza & Potencia).
   - Banner 3: *Accesorios de Fuerza Heavy Duty* (Focus: Cinturones & Straps).
   - Banner 4: *Envíos Gratis a Todo el País* (Promotional threshold $75.000+).
2. **Category Banners & Icons:**
   - Illustrated banners and high-resolution icons for each of the 6 core categories.
3. **Product Imagery:**
   - Clean, high-resolution WebP/SVG assets hosted locally or on persistent, high-uptime CDN endpoints (Unsplash Sports/Fitness collection or curated product renders).

---

## 4. CRM & Operational Simulation Specifications

### 4.1 Temporal Distribution (Last 60 Days)
To feed `/admin/estadisticas` with authentic charts, records must be backdated using a realistic distribution curve:
- **Total Orders Seeded:** 75 to 120 completed and in-progress orders.
- **Time Window:** Spread over the preceding 8 weeks with higher weekend volume.
- **Order Lifecycle Status Distribution:**
  - `DELIVERED` (60%): Orders completed in previous weeks.
  - `SHIPPED` (15%): Orders in transit with carriers (Andreani / Correo Argentino).
  - `TO_PACK` (10%): Recently paid orders awaiting warehouse packing.
  - `PENDING` (10%): Awaiting bank transfer confirmation or payment processing.
  - `CANCELLED` (5%): Order cancelled with restocked items recorded in history.

### 4.2 Customer Database Simulation
- **Volume:** 40+ unique customer accounts.
- **Geographic Representation:** Addresses and postal codes spread across key Argentine provinces:
  - CABA (Palermo, Belgrano, Caballito)
  - Provincia de Buenos Aires (La Plata, Mar del Plata, San Isidro)
  - Córdoba Capital
  - Rosario (Santa Fe)
  - Mendoza Capital
  - San Miguel de Tucumán
  - Neuquén
  - Salta
- **Customer Metrics:** Varied lifetime spend ($25.000 ARS to $450.000 ARS) to demonstrate high-value customer segmentation in `/admin/clientes`.

### 4.3 Abandoned Carts Radar
- **Volume:** 15 to 25 abandoned carts.
- **Aging:** Ranging from 2 hours ago to 5 days ago.
- **Payload:** Each cart contains 1-3 high-intent items (e.g., Whey Protein + Creatine), customer email, calculated subtotals, and recovery status (`PENDING`, `NOTIFIED`, `CONVERTED`).

### 4.4 B2B Suppliers & Purchase Orders
- **Suppliers:** 4 official distributors (e.g., *Distribuidora Fitness Argentina*, *Star Nutrition Lab Direct*, *Imports Nutrition SA*, *Fuerza Textil SRL*).
- **Purchase Orders:** 6+ purchase orders with status transitions (`PENDING`, `SUBMITTED`, `RECEIVED`) verifying inventory re-stocking workflows in `/admin/ventas/ordenes`.

### 4.5 Commercial Coupons & Promotions
- 8 active coupons with diverse business logic:
  - `BIENVENIDO10`: 10% off for first-time buyers.
  - `VOLUMENMAX`: Fixed $5.000 ARS off on orders above $60.000 ARS.
  - `ENVIOGRATISFIT`: Free shipping coupon for purchases above $50.000 ARS.
  - `EXPIRED2025`: Expired coupon for testing validation rejection.
  - `MAXUSAGE`: Coupon with usage count reached for limit testing.

---

## 5. Technical Architecture & Invariants

### 5.1 Idempotency Guarantee
- The script MUST execute `prisma.$transaction` or chained `upsert` operations.
- Identifiers:
  - Categories: matched by `slug`.
  - Products: matched by `slug` and `sku`.
  - Variants: matched by `sku`.
  - Settings: matched by singleton `id`.
  - Customers: matched by `email`.
- **Invariant:** Running `npm run db:seed` multiple times in succession must produce 0 duplicate records and 0 database integrity violations.

### 5.2 Performance & Memory Constraints
- Total seed execution time must remain under **20 seconds** on local PostgreSQL and under **30 seconds** on cloud databases.
- Batch operations (`createMany` where applicable, or parallel chunked transactions) must prevent pool exhaustion.

### 5.3 Offline Scraping & Fixture Ingestion Pipeline (ETL)
- **Zero Runtime Dependencies:** To protect platform reliability and build speed, scraping `entreno.com.ar` is strictly an **offline build-time/development ETL tool**, NOT a runtime request.
- **Workflow:**
  1. A standalone scraper script targets `entreno.com.ar` to crawl product pages, variant selectors, CDN images, and prices.
  2. The output is sanitized and saved into `backend/prisma/fixtures/entreno-catalog.json`.
  3. `backend/prisma/seed.ts` imports and ingests this static fixture deterministically into PostgreSQL.
  4. This guarantees that production deployments and local seeding run completely self-contained without needing internet access or depending on `entreno.com.ar` being online.

---

## 6. Out of Scope (Non-Goals)
- Scraping third-party sites at runtime during visitor browsing (all data is pre-ingested into fixture files).
- Processing real financial transactions (all payments are mock/simulated states).
- Implementing user-submitted reviews or ratings in this phase.

---

## 7. Acceptance Criteria

- [ ] Scraper script successfully extracts 100+ products with variants, images, and prices from `entreno.com.ar` into `entreno-catalog.json`.
- [ ] Executing `npm run db:seed` completes without errors on an empty database and on a previously seeded database (idempotent).
- [ ] Catalog contains 100+ active products across all 6 core categories with valid prices, brands, descriptions, and variants sourced from `entreno.com.ar`.
- [ ] All products display working image URLs and appropriate visual fallback tones.
- [ ] Home page hero carousel renders all promotional banners with smooth touch/drag and autoplay capabilities.
- [ ] Category pages display illustrated headers and relevant products.
- [ ] Admin dashboard (`/admin`) displays populated KPI cards, revenue charts, and visitor trends calculated from real database orders.
- [ ] Admin sales list (`/admin/ventas`) lists 70+ orders distributed across all statuses with working customer details.
- [ ] Abandoned carts radar (`/admin/ventas/carritos`) displays active carts with recovery email workflows.
- [ ] Suppliers and purchase orders (`/admin/ventas/ordenes`) display active operational stock intake records.
