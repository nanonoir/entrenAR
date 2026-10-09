# Entreno Catalog Category Reconciliation Report

- **Generated At**: `2026-09-27T02:40:00.000Z`
- **Target URL**: `https://entreno.com.ar/`
- **Source Manifest**: `https://www.entreno.com.ar/sitemap.xml`
- **Total Discovered Products**: **676**
- **Catalog Categorization Coverage**: **100.00%** (676/676)
- **Total Categories Evaluated**: **65**
- **Proposed Active Categories**: **61** (7 Roots, 5 Subcategories L1, 49 Leaves L2/L1)
- **Rejected Categories**: **4** (Promotional/Brand collections)
- **Reconciliation Status**: **COMPLETE**
- **Ready for PRD Refinement**: **YES**

---

## 1. Executive Summary

This report delivers the read-only category and taxonomy reconciliation between the live **Entreno** ecommerce store (`entreno.com.ar`) and the **EntrenAR** platform.

Every one of the **676 discovered products** was queried across all category endpoints. Categorization coverage is **100.00%** (0 uncategorized products). The analysis established that Tiendanube's product pages display only brand breadcrumbs (`Inicio > MARCAS > Brand > Title`), requiring category membership to be extracted directly from category pagination endpoints.

The reconciliation resolves EntrenAR's current 9-category showcase baseline against Entreno's 65 taxonomy nodes. It proposes a clean, deterministic, acyclic **61-category hierarchy** with 0 slug collisions, resolves 7 critical frontend route gaps (including 404s and empty listings on `/suplementos/control-de-peso` and `/suplementos/performance`), and highlights an architectural mismatch between Prisma `ProductCategory` relations and frontend `Product.subcategorySlugs` filtering.

---

## 2. Invariants & Mathematical Validation

The proposed category snapshot was validated against strict relational invariants:

| Invariant | Status | Proof & Evidence |
|---|:---:|---|
| **Unique Slugs** | **PASS** | 61 active categories have 61 globally unique normalized slugs (`slugSet.size === activeCategories.length`). |
| **Valid Parents** | **PASS** | Every category with a non-null `parent` references an existing, active normalized slug in the snapshot. |
| **Acyclic Hierarchy** | **PASS** | Strict DAG/Tree traversal confirms 0 cycles, 0 self-ancestor loops. Maximum depth is 3 levels. |
| **Deterministic Ordering** | **PASS** | Categorized deterministically: Root nodes in fixed priority order $\rightarrow$ Level 1 children $\rightarrow$ Level 2 children $\rightarrow$ Rejected collections. |
| **Product Coverage** | **PASS** | 676 of 676 products belong to at least 1 category (0 uncategorized products). |

---

## 3. Action Breakdown & Category Counts

| Action | Count | % of Evaluated | Scope & Description |
|---|:---:|:---:|---|
| **KEEP** | **6** | 9.2% | Retained from EntrenAR baseline without slug change (`suplementos`, `market`, `indumentaria`, `accesorios`, `proteinas`, `entrenamiento`). |
| **MAP** | **14** | 21.5% | Mapped from source URLs to normalized EntrenAR slugs (e.g. `shaker` $\rightarrow$ `shakers`, `citrulina` $\rightarrow$ `pump-vasodilatadores`, stripping Tiendanube collision suffixes). |
| **CREATE** | **41** | 63.1% | Newly proposed categories required to accommodate the real catalog and navigation hierarchy. |
| **REJECT** | **4** | 6.2% | Promotional or non-category collections (`liquidacion`, `hot-entreno`, `objetivos`, `marcas`). |
| **TOTAL EVALUATED** | **65** | **100.0%** | |

---

## 4. Reconciled Category Snapshot

The table below defines the proposed category structure, mapped actions, affected product counts, and architectural rationale.

### 4.1. Root Categories (Level 0)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `SUPLEMENTOS` | `/suplementos/` | `suplementos` | Suplementos | *None* | 575 | `suplementos` (`cat-supplements`) | `keep` | Primary sports nutrition and performance root category. |
| `MARKET` | `/market/` | `market` | Market | *None* | 101 | `market` (`cat-market`) | `keep` | Healthy food, nut butters, protein snacks, and pantry essentials. |
| `INDUMENTARIA` | `/indumentaria/` | `indumentaria` | Indumentaria | *None* | 24 | `indumentaria` (`cat-clothing`) | `keep` | Fitness apparel and workout clothing. |
| `SHAKER` | `/shaker/` | `shakers` | Shakers | *None* | 20 | `shakers` (`cat-shakers`) | `map` | Map singular source URL slug `shaker` to EntrenAR plural baseline `shakers`. |
| `ACCESORIOS` | `/accesorios/` | `accesorios` | Accesorios | *None* | 7 | `accesorios` (`cat-accessories`) | `keep` | Existing baseline category; update visibility from `HIDDEN` to `VISIBLE`. |
| `COMBOS` | `/combos/` | `combos` | Combos | *None* | 4 | *None* | `create` | Bundle packs (e.g. Whey + Creatine + Shaker); distinct root category in store. |
| `ENTRENAMIENTO` | *None* | `entrenamiento` | Entrenamiento | *None* | 0 | `entrenamiento` (`cat-training`) | `keep` | Retained showcase baseline category for local fixture compatibility. |

### 4.2. Subcategories under Suplementos (Level 1)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `PROTEINAS` | `/suplementos/proteinas/` | `proteinas` | Proteínas | `suplementos` | 237 | `proteinas` (`cat-protein`) | `keep` | Core protein powder and protein foods subcategory. |
| `PRE INTRA & CREATINA` | `/suplementos/pre-intra-creatina/` | `creatina-y-pre` | Creatina y pre | `suplementos` | 124 | `creatina-y-pre` (`cat-creatine-pre`) | `map` | Map source slug `pre-intra-creatina` to EntrenAR baseline slug `creatina-y-pre`. |
| `VITAMINAS & SUPLEMENTOS` | `/suplementos/vitaminas-suplementos/` | `vitaminas` | Vitaminas | `suplementos` | 148 | `vitaminas` (`cat-vitamins`) | `map` | Map source slug `vitaminas-suplementos` to EntrenAR baseline slug `vitaminas`. |
| `PERFORMANCE` | `/suplementos/performance/` | `performance` | Performance | `suplementos` | 82 | *Missing in DB* | `create` | Dedicated branch for hydration, endurance, and glutamine; fixes empty listings. |
| `CONTROL DE PESO` | `/suplementos/control-de-peso/` | `control-de-peso` | Control de peso | `suplementos` | 45 | *Missing in DB* | `create` | Fat burners, CLA, and carnitine; fixes 404 in frontend routing. |

### 4.3. Leaves under Proteínas (Level 2)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `WHEY PROTEIN` | `/suplementos/proteinas/whey-protein/` | `whey-protein` | Whey Protein | `proteinas` | 94 | *None* | `create` | Concentrates, isolates, and blends; matches `/suplementos/proteinas/whey-protein`. |
| `GANADORES` | `/suplementos/proteinas/ganadores/` | `ganadores` | Ganadores de Peso | `proteinas` | 20 | *None* | `create` | Mass gainers; matches `/suplementos/proteinas/ganadores`. |
| `PLANT PROTEIN` | `/suplementos/proteinas/plant-protein/` | `plant-protein` | Plant Protein | `proteinas` | 11 | *None* | `create` | Vegan/plant protein powders; matches `/suplementos/proteinas/plant-protein`. |
| `COLAGENO` | `/suplementos/proteinas/colageno/` | `colageno` | Colágeno | `proteinas` | 37 | *None* | `create` | Collagen powders and capsules; matches `/suplementos/proteinas/colageno`. |
| `PROTEIN BARS` | `/suplementos/proteinas/protein-bars/` | `protein-bars` | Protein Bars | `proteinas` | 45 | *None* | `create` | Protein snack bars; matches `/suplementos/proteinas/protein-bars`. |
| `PROTEIN FOODS` | `/suplementos/proteinas/protein-foods/` | `protein-foods` | Protein Foods | `proteinas` | 29 | *None* | `create` | Functional meals, puddings, mixes; matches `/suplementos/proteinas/protein-foods`. |
| `SHAKERS Y BOTELLAS` | `/suplementos/proteinas/shakers-y-botellas/` | `shakers-y-botellas` | Shakers y Botellas | `proteinas` | 24 | *None* | `create` | Drinkware subcategory inside Proteínas; matches navigation link. |

### 4.4. Leaves under Creatina y Pre (Level 2)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `CREATINA` | `/suplementos/pre-intra-creatina/creatina/` | `creatina` | Creatina | `creatina-y-pre` | 61 | *None* | `create` | Micronized and monohydrate creatines; matches `/suplementos/pre-intra-creatina/creatina`. |
| `PRE & INTRA ENTRENO` | `/suplementos/pre-intra-creatina/pre-intra-entreno/` | `pre-intra-entreno` | Pre & Intra Entreno | `creatina-y-pre` | 29 | *None* | `create` | Pre-workouts and intra carbs; matches navigation link. |
| `EEAs & BCAAs` | `/suplementos/pre-intra-creatina/eeas-bcaas/` | `eeas-bcaas` | EEAs & BCAAs | `creatina-y-pre` | 27 | *None* | `create` | Branched-chain and essential amino acids; matches navigation link. |
| `PUMP & VASODILATADORES` | `/suplementos/pre-intra-creatina/citrulina/` | `pump-vasodilatadores` | Pump & Vasodilatadores | `creatina-y-pre` | 6 | *None* | `map` | Map source URL `citrulina` to navigation-defined slug `pump-vasodilatadores`. |

### 4.5. Leaves under Vitaminas (Level 2)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `MULTIVITAMINICOS` | `/suplementos/vitaminas-suplementos/multivitaminicos/` | `multivitaminicos` | Multivitamínicos | `vitaminas` | 22 | *None* | `create` | Comprehensive vitamin complexes; matches navigation link. |
| `FISH OIL & OMEGAS` | `/suplementos/vitaminas-suplementos/fish-oil-omegas/` | `fish-oil-omegas` | Fish Oil & Omegas | `vitaminas` | 18 | *None* | `create` | Essential fatty acids and omega softgels; matches navigation link. |
| `HUESOS Y ARTICULACIONES` | `/suplementos/vitaminas-suplementos/huesos-y-articulaciones/` | `huesos-articulaciones` | Huesos y Articulaciones | `vitaminas` | 21 | *None* | `map` | Map source URL `huesos-y-articulaciones` to navigation slug `huesos-articulaciones`. |
| `ANTIOXIDANTES` | `/suplementos/vitaminas-suplementos/antioxidantes/` | `antioxidantes` | Antioxidantes | `vitaminas` | 18 | *None* | `create` | Cellular antioxidant extracts; matches navigation link. |
| `NOOTROPICOS & CONCENTRACION` | `/suplementos/vitaminas-suplementos/nootropicos-concentracion/` | `nootropicos-concentracion` | Nootrópicos & Concentración | `vitaminas` | 4 | *None* | `create` | Cognitive enhancement and memory; matches navigation link. |
| `STRESS & SUEÑO` | `/suplementos/vitaminas-suplementos/stress-sueno/` | `stress-sueno` | Stress & Sueño | `vitaminas` | 8 | *None* | `create` | Sleep and relaxation aids (melatonin, ashwagandha); matches navigation link. |
| `VERDES Y SUPERALIMENTOS` | `/suplementos/vitaminas-suplementos/verdes-y-superalimentos/` | `verdes-superalimentos` | Verdes y Superalimentos | `vitaminas` | 9 | *None* | `map` | Map source URL `verdes-y-superalimentos` to navigation slug `verdes-superalimentos`. |
| `ADAPTOGENOS Y HIERBAS` | `/suplementos/vitaminas-suplementos/adaptogenos-y-hierbas/` | `adaptogenos-hierbas` | Adaptógenos y Hierbas | `vitaminas` | 23 | *None* | `map` | Map source URL `adaptogenos-y-hierbas` to navigation slug `adaptogenos-hierbas`. |
| `VITAMINAS A-Z` | `/suplementos/vitaminas-suplementos/vitaminas-a-z/` | `vitaminas-a-z` | Vitaminas A-Z | `vitaminas` | 41 | *None* | `create` | Isolated vitamins and minerals (C, D3, Zinc, Magnesium); matches navigation link. |
| `PROBIOTICOS Y DIGESTIVOS` | `/suplementos/vitaminas-suplementos/probioticos-y-digestivos/` | `probioticos-digestivos` | Probióticos y Digestivos | `vitaminas` | 15 | *None* | `map` | Map source URL `probioticos-y-digestivos` to normalized slug `probioticos-digestivos`. |

### 4.6. Leaves under Performance (Level 2)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `HIDRATACION Y RESISTENCIA` | `/suplementos/performance/hidratacion-y-resistencia/` | `hidratacion-resistencia` | Hidratación y Resistencia | `performance` | 57 | *None* | `map` | Map source URL `hidratacion-y-resistencia` to navigation slug `hidratacion-resistencia`. |
| `GLUTAMINA` | `/suplementos/performance/glutamina/` | `glutamina` | Glutamina | `performance` | 15 | *None* | `create` | Pure L-glutamine powders; matches navigation link. |

### 4.7. Leaves under Control de Peso (Level 2)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `QUEMADORES DE GRASA` | `/suplementos/control-de-peso/quemadores-de-grasa/` | `quemadores-de-grasa` | Quemadores de Grasa | `control-de-peso` | 18 | *None* | `create` | Thermogenics and fat loss formulas; matches navigation link. |
| `CONTROL DE APETITO` | `/suplementos/control-de-peso/control-de-apetito/` | `control-de-apetito` | Control de Apetito | `control-de-peso` | 8 | *None* | `create` | Appetite management capsules; matches navigation link. |
| `CLA` | `/suplementos/control-de-peso/cla/` | `cla` | CLA | `control-de-peso` | 4 | *None* | `create` | Conjugated linoleic acid softgels; matches navigation link. |
| `L-CARNITINA` | `/suplementos/control-de-peso/l-carnitina/` | `l-carnitina` | L-Carnitina | `control-de-peso` | 7 | *None* | `create` | Liquid and capsule L-carnitine; matches navigation link. |
| `CAFEINA` | `/suplementos/control-de-peso/cafeina/` | `cafeina` | Cafeína | `control-de-peso` | 6 | *None* | `create` | Anhydrous caffeine tablets; matches navigation link. |

### 4.8. Leaves under Market (Level 1)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `PASTAS DE MANI` | `/market/pastas-de-mani/` | `pastas-de-mani` | Pastas de Maní | `market` | 12 | *None* | `create` | Peanut and almond butters; matches navigation link. |
| `BARRAS` | `/market/barras/` | `barras` | Barras | `market` | 25 | *None* | `create` | General snack and cereal bars; matches navigation link. |
| `SALSAS` | `/market/salsas/` | `salsas` | Salsas | `market` | 19 | *None* | `create` | Zero-calorie savory dressings and sauces; matches navigation link. |
| `POLVOS & MEZCLAS` | `/market/panqueques-mezclas/` | `polvos-mezclas` | Polvos & Mezclas | `market` | 16 | *None* | `map` | Map source URL `panqueques-mezclas` to navigation slug `polvos-mezclas`. |
| `FRUTOS SECOS` | `/market/frutos-secos/` | `frutos-secos` | Frutos Secos | `market` | 4 | *None* | `create` | Raw and roasted nuts and seeds; matches navigation link. |
| `JERKY` | `/market/jerky/` | `jerky` | Jerky | `market` | 1 | *None* | `create` | Beef jerky protein snacks; matches navigation link. |
| `ENDULZANTES` | `/market/endulzantes/` | `endulzantes` | Endulzantes | `market` | 7 | *None* | `create` | Stevia and non-caloric drops; matches navigation link. |
| `ALFAJOR` | `/market/alfajor/` | `alfajor` | Alfajores Proteicos | `market` | 9 | *None* | `create` | Protein alfajores; matches navigation link. |
| `HIERBA MATE` | `/market/hierba-mate/` | `hierba-mate` | Hierba Mate | `market` | 2 | *None* | `create` | Functional organic yerba mate; matches navigation link. |
| `ENLATADO` | `/market/enlatado/` | `enlatado` | Enlatados | `market` | 4 | *None* | `create` | Canned protein staples (tuna, chicken); matches navigation link. |
| `CAFE` | `/market/cafe/` | `cafe` | Café Funcional | `market` | 1 | *None* | `create` | Nootropic and functional coffee beans/blends. |

### 4.9. Leaves under Indumentaria (Level 1)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `ENTRENO` | `/indumentaria/entreno2/` | `entreno` | Entreno | `indumentaria` | 5 | *None* | `map` | Map Tiendanube collision slug `entreno2` to navigation slug `entreno`. |
| `SHARK` | `/indumentaria/shark1/` | `shark` | Shark | `indumentaria` | 16 | *None* | `map` | Map Tiendanube collision slug `shark1` to navigation slug `shark`. |
| `XBELT` | `/indumentaria/xbelt1/` | `xbelt` | Xbelt | `indumentaria` | 1 | *None* | `map` | Map Tiendanube collision slug `xbelt1` to navigation slug `xbelt`. |
| `SYMMETRY` | `/indumentaria/symmetry1/` | `symmetry` | Symmetry | `indumentaria` | 1 | *None* | `map` | Map Tiendanube collision slug `symmetry1` to navigation slug `symmetry`. |
| `RAW` | `/indumentaria/raw1/` | `raw` | Raw | `indumentaria` | 1 | *None* | `map` | Map Tiendanube collision slug `raw1` to navigation slug `raw`. |

### 4.10. Leaves under Accesorios (Level 1)

| Source Category | Source URL Path | Normalized Slug | Name | Parent | Affected Products | EntrenAR Mapping | Action | Rationale |
|---|---|---|---|:---:|:---:|---|:---:|---|
| `CINTURONES` | `/accesorios/cinturones/` | `cinturones` | Cinturones | `accesorios` | 1 | *None* | `create` | Powerlifting and gym belts. |
| `MUÑEQUERAS` | `/accesorios/munequeras/` | `munequeras` | Muñequeras | `accesorios` | 3 | *None* | `create` | Wrist wraps and joint support. |
| `VENDAS` | `/accesorios/vendas/` | `vendas` | Vendas | `accesorios` | 1 | *None* | `create` | Knee wraps and compression straps. |
| `STRAPS` | `/accesorios/straps/` | `straps` | Straps | `accesorios` | 1 | *None* | `create` | Deadlift and heavy pull straps. |
| `TINTA DE COMPETICION` | `/accesorios/tinta-de-competicion/` | `tinta-de-competicion` | Tinta de Competición | `accesorios` | 1 | *None* | `create` | Bodybuilding competition tanning creams. |

### 4.11. Rejected Taxonomy Nodes

| Source Category | Source URL Path | Normalized Slug | Action | Reason & Rationale |
|---|---|:---:|:---:|---|
| `LIQUIDACION` | `/liquidacion/` | *None* | `reject` | Outlet and sale items are dynamically calculated in EntrenAR via `compareAtPrice > price` at route `/ofertas`. Not a persistent database category entity. |
| `HOT ENTRENO` | `/hot-entreno/` | *None* | `reject` | Temporary promotional campaign collection; redundant with `/ofertas` and functional categories. |
| `OBJETIVOS` | `/objetivos/` | *None* | `reject` | Static marketing landing page cluster; contains 0 standard catalog products in paginated endpoints. |
| `MARCAS` | `/marcas/` | *None* | `reject` | Brand taxonomy is natively modeled in EntrenAR via `Product.brand` string and `/marcas/[slug]` route, not as database categories. |

---

## 5. Product Membership & Multi-Category Analysis

### 5.1. Membership Distribution

Analysis across all 676 discovered products:

- **Total products with $\ge 1$ category**: **676** (100.00%)
- **Uncategorized products**: **0** (0.00%)
- **Products in at least 1 leaf category**: **663** (98.08%)
- **Products in intermediate/root categories only**: **13** (1.92%)
- **Products in multiple functional leaf categories**: **132** (19.53%)

### 5.2. Multi-Leaf Overlap Patterns

Merchants in Tiendanube frequently cross-tag products across multiple categories. The most prevalent combinations:

1. **`SHAKER` + `SHAKERS Y BOTELLAS` (20 products)**: Every product in root `/shaker/` is simultaneously categorized in `/suplementos/proteinas/shakers-y-botellas/`.
2. **`BARRAS` + `PROTEIN BARS` (19 products)**: Protein bars cross-listed in functional food (`Market`) and sports nutrition (`Proteínas`).
3. **`POLVOS & MEZCLAS` + `PROTEIN FOODS` (9 products)**: Protein oatmeal and pancake mixes cross-listed in `Market` and `Proteínas`.
4. **`GANADORES` + `WHEY PROTEIN` (8 products)**: Caloric gainer blends tagged in both protein categories.
5. **`COLAGENO` + `HUESOS Y ARTICULACIONES` (5 products)**: Joint-support collagen products cross-listed in `Proteínas` and `Vitaminas`.
6. **`ADAPTOGENOS Y HIERBAS` + `ENDULZANTES` + `PROBIOTICOS Y DIGESTIVOS` + `VERDES Y SUPERALIMENTOS` (7 products)**: Multi-ingredient superfood greens powders.

### 5.3. The 13 Mid-Level-Only Products

The 13 products below are associated only with root or Level 1 categories and have **zero leaf subcategories** in the source store:

| ID | Product Name | Slug | Assigned Categories | Why No Leaf Exists |
|---|---|---|---|---|
| `369791666` | INTEGRALMEDICA Beef Protein 900g | `integralmedica-beef-protein-900g-30g-proteina-carne-zerolac-1iqgc` | `SUPLEMENTOS`, `PROTEINAS` | Beef protein does not fit whey-protein or plant-protein leaves. |
| `354315913` | NATUSVITA Vitamina C Liposomal 500 mg | `natusvita-vitamina-c-liposomal-500-mg-zinc-bisglicinato-softgel-60caps-gyxoy` | `SUPLEMENTOS`, `VITAMINAS & SUPLEMENTOS` | Assigned only to parent Vitaminas & Suplementos. |
| `349704507` | FLINT Citrato de magnesio en polvo 300g | `flint-citrato-de-magnesio-en-polvo-300g-sin-tacc-s6lcy` | `VITAMINAS & SUPLEMENTOS` | Assigned only to parent Vitaminas & Suplementos. |
| `349887384` | FLINT Citrato de Magnesio 60 Cápsulas | `flint-citrato-de-magnesio-60-capsulas-maxima-absorcion-jdvzl` | `VITAMINAS & SUPLEMENTOS` | Assigned only to parent Vitaminas & Suplementos. |
| `345079678` | Gold Nutrition NAD Precursor 30 cápsulas | `gold-nutrition-nad-precursor-30-capsulas-1vf1k` | `VITAMINAS & SUPLEMENTOS` | Longevity supplement not assigned to subcategory. |
| `334184029` | RAW Beta Alanina en polvo 312g | `raw-beta-alanina-en-polvo-312g-cws1i` | `PRE INTRA & CREATINA` | Pure beta-alanine does not fit creatina, pre-entreno, or BCAAs. |
| `336730609` | AMPK Batido proteico listo para tomar 330ml | `ampk-batido-proteico-listo-para-tomar-330ml-1l7fb` | `SUPLEMENTOS`, `PROTEINAS` | Ready-to-drink shake assigned only to parent Proteínas. |
| `318346878` | GAT SPORT Suplemento Testrol Gold ES 60 caps | `gat-sport-suplemento-testrol-gold-es-60-caps-83g1g` | `SUPLEMENTOS`, `VITAMINAS & SUPLEMENTOS` | Testosterone booster assigned only to parent. |
| `280222867` | GRAVITON Protein 20 Sobres | `graviton-protein-20-sobres` | `SUPLEMENTOS`, `PROTEINAS` | Protein powder sachets assigned only to parent. |
| `271854186` | MRS TASTE Salsa de Soja Reducida en Sodio 160 ml | `mrs-taste-salsa-de-soja-reducida-en-sodio-160-ml` | `MARKET` | Merchant omitted Salsas subcategory checkbox. |
| `271853711` | GOLD NUTRITION Hair Complex Skin & Nails | `gold-nutrition-hair-complex-skin-nails-60-capsulas` | `SUPLEMENTOS`, `VITAMINAS & SUPLEMENTOS` | Beauty complex assigned only to parent. |
| `271853674` | GOLD NUTRITION ZMA 60 Cápsulas | `gold-nutrition-zma-60-capsulas` | `SUPLEMENTOS`, `HOT ENTRENO`, `VITAMINAS & SUPLEMENTOS` | ZMA formula assigned only to parent. |
| `271853641` | GOLD NUTRITION HMB Ultra Concentrated | `gold-nutrition-hmb-ultra-concentrated-60-capsulas` | `SUPLEMENTOS`, `HOT ENTRENO`, `PERFORMANCE` | HMB formula assigned only to parent Performance. |

**Crucial Implication**: In EntrenAR, products MUST be allowed to belong to Level 1 parent categories directly (e.g. `proteinas`, `vitaminas`, `creatina-y-pre`, `market`, `performance`). Forcing every product to map into a leaf subcategory would corrupt product taxonomy or cause these 13 products to fail import.

---

## 6. Frontend Route Compatibility & Gap Analysis

Our analysis of `src/lib/data/shop-routes.ts`, `src/lib/product-listing.ts`, and `src/lib/data/navigation.ts` revealed **7 critical architectural gaps** that currently produce 404 errors, empty listings, or biased catalog views.

### Gap 1: `/suplementos/control-de-peso` 404 Error
- **Location**: `src/lib/data/shop-routes.ts` (line 24)
- **Problem**: `supplementCategoryBySlug` omits `"control-de-peso"`. When a user clicks "CONTROL DE PESO" from the navigation menu (`/suplementos/control-de-peso`), `resolveShopRoute` returns `{ type: "not-found" }` (HTTP 404).
- **Secondary Problem**: In `src/lib/product-listing.ts` (line 39), `supplementListingGroupsBySegment["control-de-peso"]` has `productCategorySlug: undefined`, resulting in `baseProducts: []` (0 products).
- **Affected Products**: **45 products** (thermogenics, CLA, carnitines).
- **Resolution**: Add `control-de-peso` to `supplementCategoryBySlug` in `shop-routes.ts` and set `productCategorySlug: "control-de-peso"` in `product-listing.ts`.

### Gap 2: `/suplementos/performance` Empty Listing
- **Location**: `src/lib/product-listing.ts` (line 38)
- **Problem**: In `product-listing.ts`, `supplementListingGroupsBySegment["performance"]` has NO `productCategorySlug`. Consequently, `baseProducts` is `[]`, rendering an empty listing. In `shop-routes.ts`, `performance` is aliased as a fallback to `creatina-y-pre`.
- **Affected Products**: **82 products** (hydration, endurance, glutamine).
- **Resolution**: Create `performance` as a first-class category under `suplementos` in the database, add it to `supplementListingGroupsBySegment` with `productCategorySlug: "performance"`, and update `shop-routes.ts`.

### Gap 3: Importer Omission of `Product.subcategorySlugs` (Empty Subcategory Listings)
- **Location**: `backend/src/modules/catalog-import/catalog-import.repository.ts` (lines 57–71) & `src/lib/product-listing.ts` (lines 206, 230)
- **Problem**: `product-listing.ts` filters subcategory listings (e.g. `/suplementos/proteinas/whey-protein`, `/market/barras`) by checking:
  `baseProducts.filter((product) => product.subcategorySlugs?.includes(slug))`
  However, the PRD1 catalog importer persists category memberships exclusively in the `ProductCategory` relational join table and **leaves `Product.subcategorySlugs` as an empty array `[]`**!
  As a result, navigating to ANY subcategory route displays **0 products** or triggers `notFound()`.
- **Affected Products**: **663 products** across all subcategories.
- **Resolution**: During catalog ingestion or in the public catalog mapper, populate `Product.subcategorySlugs` with the slugs of all assigned leaf categories.

### Gap 4: Suffix Collisions in `Indumentaria` (`shark1`, `entreno2`, etc.)
- **Location**: `src/lib/data/navigation.ts` (lines 146–152) vs Tiendanube source URLs
- **Problem**: Entreno suffixed category slugs (`entreno2`, `shark1`, `xbelt1`, `symmetry1`, `raw1`) because the brand slugs (`/marcas/shark/`) already existed in Tiendanube's flat slug namespace. EntrenAR's `navigation.ts` links to `/indumentaria/shark`, `/indumentaria/entreno`, etc. If raw source slugs are imported, all five indumentaria links return 404.
- **Affected Products**: **24 products**.
- **Resolution**: Map the suffixed source slugs to clean unsuffixed slugs (`shark`, `entreno`, `xbelt`, `symmetry`, `raw`) under parent `indumentaria`.

### Gap 5: Market Slug Mismatch (`panqueques-mezclas` vs `polvos-mezclas`)
- **Location**: `src/lib/data/navigation.ts` (line 127) vs Entreno source URL
- **Problem**: Entreno's URL is `/market/panqueques-mezclas/`, but its visual menu label is `POLVOS & MEZCLAS` and EntrenAR's `navigation.ts` links to `/market/polvos-mezclas`.
- **Affected Products**: **16 products**.
- **Resolution**: Map source slug `panqueques-mezclas` to normalized slug `polvos-mezclas`.

### Gap 6: Creatina Slug Mismatch (`citrulina` vs `pump-vasodilatadores`)
- **Location**: `src/lib/data/navigation.ts` (line 76) vs Entreno source URL
- **Problem**: Entreno's URL is `/suplementos/pre-intra-creatina/citrulina/`, but its visual menu label is `PUMP & VASODILATADORES` and EntrenAR's `navigation.ts` links to `/suplementos/pre-intra-creatina/pump-vasodilatadores`.
- **Affected Products**: **6 products**.
- **Resolution**: Map source slug `citrulina` to normalized slug `pump-vasodilatadores`.

### Gap 7: Primary Category CUID Alphabetical Sort Bias
- **Location**: `backend/src/modules/catalog/catalog.mapper.ts` (lines 225, 274)
- **Problem**: `toPublicCatalogProduct` and `toAdminCatalogProduct` pick `primaryCategory` by sorting `product.categories` alphabetically by `category.id` (`left.category.id.localeCompare(right.category.id)`). Because `id` is a random CUID, the category that becomes `product.categorySlug` is completely non-deterministic. If a product belongs to `shakers` and `proteinas`, and `shakers` has a lexicographically smaller ID, it will have `categorySlug: "shakers"` and disappear from `/suplementos/proteinas/`.
- **Affected Products**: **132 multi-category products**.
- **Resolution**: Implement deterministic primary category selection in `catalog.mapper.ts` (e.g. prioritizing Level 1 parents, or respecting a primary category flag).

---

## 7. Recommended PRD2 Refinement Decisions

1. **Adopt the 61-Category Target Taxonomy**:
   Pre-seed or synchronize all 61 active categories into EntrenAR before catalog import using a dedicated `catalog:sync-categories` command.
2. **Deterministic Category Slugs in Manifest**:
   The scraper transformation pipeline must map raw source slugs to the normalized slugs approved in this report (mapping `shaker` $\rightarrow$ `shakers`, `panqueques-mezclas` $\rightarrow$ `polvos-mezclas`, `citrulina` $\rightarrow$ `pump-vasodilatadores`, and stripping brand suffixes from indumentaria).
3. **Populate `subcategorySlugs`**:
   The ingestion manifest or importer repository must populate `Product.subcategorySlugs` with the assigned leaf category slugs to restore frontend subcategory filtering.
4. **Fix Frontend Route Maps**:
   Update `shop-routes.ts` and `product-listing.ts` to register `control-de-peso` and `performance` as first-class categories.
5. **Support Multi-Level Assignment**:
   Ensure products can belong to Level 1 parent categories directly without requiring artificial leaf assignment (safeguarding the 13 mid-level products).
