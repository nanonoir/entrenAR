# Entreno Catalog Source Anomaly Census Report

- **Generated At**: `2026-09-27T02:15:39.539Z`
- **Target URL**: `https://entreno.com.ar/`
- **Source Manifest**: `https://www.entreno.com.ar/sitemap.xml`
- **Total Discovered URLs**: **676**
- **Coverage**: **100.00%** (676/676)
- **Census Status**: **COMPLETE**
- **Ready for PRD Refinement**: **YES**

---

## 1. Executive Summary & Classification Overview

Every discovered product from the authoritative sitemap (`676` products) was evaluated against EntrenAR and PRD2 ingestion contracts. Each product is classified into exactly one mutually exclusive status bucket.

| Classification Status | Product Count | % of Catalog | Variant Count | Notes |
|---|:---:|:---:|:---:|---|
| **ACCEPTED** | **657** | **97.2%** | **1131** | Fully conformant to EntrenAR import constraints |
| **EXCLUDED** | **19** | **2.8%** | **68** | Blocked by hard contract violation (duplicate SKU, price variance, etc.) |
| **EXTRACTION_FAILED** | **0** | **0.0%** | **0** | Network/parser errors |
| **TOTAL** | **676** | **100.0%** | **1199** | 100% of discovered products accounted for |

---

## 2. Exclusions by Reason

Under PRD2 Core Decisions, products with irreconcilable domain violations are strictly excluded rather than guessed or mutated:

| Exclusion Reason Code | Affected Products | % of Exclusions | Rule & Rationale |
|---|:---:|:---:|---|
| `DUPLICATE_SKU` | **4** | **21.1%** | All products participating in a SKU collision are excluded (Core Decision 6). |
| `PRICE_VARIANCE_UNSUPPORTED` | **12** | **63.2%** | Variants have different selling prices; EntrenAR uses product-level pricing (Core Decision 4). |
| `COMPARE_AT_INCOMPATIBLE` | **3** | **15.8%** | Compare-at pricing varies across variants or is <= current price. |
| `TOO_MANY_VARIANT_PROPERTIES` | **0** | **0.0%** | Product has > 2 option dimensions (Core Decision 5). |
| `EMPTY_SKU` | **0** | **0.0%** | Variant has empty or missing SKU. |
| `NO_VARIANTS` | **0** | **0.0%** | Product has 0 variants in payload. |
| `NO_IMAGES` | **0** | **0.0%** | Product has 0 gallery images. |
| `SLUG_COLLISION` | **0** | **0.0%** | Normalized product slug collides with another product. |
| **TOTAL EXCLUDED** | **19** | **100.0%** | |

### Inventory of All Excluded Products (19)

| # | Product Name | Primary Reason | Variants | URL |
|---|---|---|:---:|---|
| 1 | B3ST Barras Proteicas 60g Alta Fibra Pack x10 unid 20G PROTEINA | `COMPARE_AT_INCOMPATIBLE` | 5 | [`b3st-barras-proteicas-60g-alta-fibra-pack-x10-unid-20g-proteina-1ptsh`](https://www.entreno.com.ar/productos/b3st-barras-proteicas-60g-alta-fibra-pack-x10-unid-20g-proteina-1ptsh/) |
| 2 | BODY ADVANCE Whey Protein 3kg | `PRICE_VARIANCE_UNSUPPORTED` | 4 | [`body-advance-whey-protein-3kg`](https://www.entreno.com.ar/productos/body-advance-whey-protein-3kg/) |
| 3 | SHARK Botella bidón 1.5 litros con agarre | `COMPARE_AT_INCOMPATIBLE` | 3 | [`botella-bidon-1-5-litros-con-agarre-1tmmm`](https://www.entreno.com.ar/productos/botella-bidon-1-5-litros-con-agarre-1tmmm/) |
| 4 | BSN Syntha 6 Clasico 5LB/2.27KG (48 Servicios) | `COMPARE_AT_INCOMPATIBLE` | 4 | [`bsn-syntha-6-clasico-5lb`](https://www.entreno.com.ar/productos/bsn-syntha-6-clasico-5lb/) |
| 5 | ENA Electrolitos Hidratacion Y Recuperacion Muscular 15 sobres 5g c/u | `DUPLICATE_SKU` | 2 | [`ena-electrolitos-hidratacion-y-recuperacion-muscular-15-sobres-5g-c-u-8nsao`](https://www.entreno.com.ar/productos/ena-electrolitos-hidratacion-y-recuperacion-muscular-15-sobres-5g-c-u-8nsao/) |
| 6 | ENA Starter Protein 400 GRS | `PRICE_VARIANCE_UNSUPPORTED` | 2 | [`ena-starter-protein-400-grs`](https://www.entreno.com.ar/productos/ena-starter-protein-400-grs/) |
| 7 | ENA Whey Protein TrueMade 1 LB | `PRICE_VARIANCE_UNSUPPORTED` | 6 | [`ena-whey-protein-truemade-1-lb`](https://www.entreno.com.ar/productos/ena-whey-protein-truemade-1-lb/) |
| 8 | EVOGEN Carnigen Premium Liquid L-Carnitina 16 FL OZ | `PRICE_VARIANCE_UNSUPPORTED` | 3 | [`evogen-carnigen-liquid-16-fl-oz`](https://www.entreno.com.ar/productos/evogen-carnigen-liquid-16-fl-oz/) |
| 9 | EVOGEN Glicerol líquido EVP AQ 473 ml | `PRICE_VARIANCE_UNSUPPORTED` | 6 | [`evogen-glicerol-liquido-evp-aq-473-ml-1pzjx`](https://www.entreno.com.ar/productos/evogen-glicerol-liquido-evp-aq-473-ml-1pzjx/) |
| 10 | Extra Life Boost de Hidratación Electrolitos Pack 20 Sobres | `PRICE_VARIANCE_UNSUPPORTED` | 5 | [`extra-life-boost-de-hidratacion-electroitos-pack-20-sobres-1ixar`](https://www.entreno.com.ar/productos/extra-life-boost-de-hidratacion-electroitos-pack-20-sobres-1ixar/) |
| 11 | MuscleTech Nitro Tech 1 KG | `PRICE_VARIANCE_UNSUPPORTED` | 3 | [`muscletech-nitro-tech-1-kg`](https://www.entreno.com.ar/productos/muscletech-nitro-tech-1-kg/) |
| 12 | MuscleTech Nitro Tech 100% Whey Gold 907 GS | `PRICE_VARIANCE_UNSUPPORTED` | 3 | [`muscletech-nitro-tech-100-whey-gold-907-gs`](https://www.entreno.com.ar/productos/muscletech-nitro-tech-100-whey-gold-907-gs/) |
| 13 | MYPROTEIN Clear Whey Isolate 20 Servings - FV OCT 2026 | `DUPLICATE_SKU` | 1 | [`myprotein-clear-whey-isolate-20-servings-fv-oct-2026-wo0xz`](https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings-fv-oct-2026-wo0xz/) |
| 14 | MYPROTEIN Clear Whey Isolate 20 Servings | `DUPLICATE_SKU` | 4 | [`myprotein-clear-whey-isolate-20-servings`](https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings/) |
| 15 | MYPROTEIN Impact Whey Protein 1kg | `PRICE_VARIANCE_UNSUPPORTED` | 4 | [`myprotein-impact-whey-protein-1kg`](https://www.entreno.com.ar/productos/myprotein-impact-whey-protein-1kg/) |
| 16 | OPTIMUM NUTRITION Gourmet Whey 2 LB | `DUPLICATE_SKU` | 4 | [`optimum-nutrition-gourmet-whey-2-lb-sd3sg`](https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/) |
| 17 | STAR NUTRITION NITRO WHEY 2LBS | `PRICE_VARIANCE_UNSUPPORTED` | 3 | [`star-nutrition-nitro-whey-2lbs`](https://www.entreno.com.ar/productos/star-nutrition-nitro-whey-2lbs/) |
| 18 | STAR NUTRITION PUMP 3D EVOLUTION RIPPED 315 GRS | `PRICE_VARIANCE_UNSUPPORTED` | 2 | [`star-nutrition-pump-3d-evolution-ripped-315-grs`](https://www.entreno.com.ar/productos/star-nutrition-pump-3d-evolution-ripped-315-grs/) |
| 19 | STAR NUTRITION PUMP V8 285 GRS | `PRICE_VARIANCE_UNSUPPORTED` | 4 | [`star-nutrition-pump-v8-285-grs`](https://www.entreno.com.ar/productos/star-nutrition-pump-v8-285-grs/) |

---

## 3. Duplicate SKU Anomaly Deep Dive

- **Total Colliding SKUs**: **3**
- **Total Products Excluded due to Collisions**: **4**

### Colliding SKU Inventory

  #### 1. SKU: `ENA-ELECTROLITOS-BERRIES-CAJA-75G`
- **Occurrences**: 2 variants
- **Collision Scope**: **Intra-Product** (duplicate within same product)
- **Affected Products (1)**:
  - `https://www.entreno.com.ar/productos/ena-electrolitos-hidratacion-y-recuperacion-muscular-15-sobres-5g-c-u-8nsao/`
- **Variant Details**:
  - Product ID `358017837` | Variant ID `1566721341` | URL: `https://www.entreno.com.ar/productos/ena-electrolitos-hidratacion-y-recuperacion-muscular-15-sobres-5g-c-u-8nsao/`
  - Product ID `358017837` | Variant ID `1566721342` | URL: `https://www.entreno.com.ar/productos/ena-electrolitos-hidratacion-y-recuperacion-muscular-15-sobres-5g-c-u-8nsao/`

#### 2. SKU: `MP-CLEARMOJITO-20SERV`
- **Occurrences**: 2 variants
- **Collision Scope**: **Inter-Product** (cross-product collision)
- **Affected Products (2)**:
  - `https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings-fv-oct-2026-wo0xz/`
  - `https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings/`
- **Variant Details**:
  - Product ID `368348171` | Variant ID `1599990212` | URL: `https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings-fv-oct-2026-wo0xz/`
  - Product ID `271853986` | Variant ID `1404606017` | URL: `https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings/`

#### 3. SKU: `ON-WHEYGOURMET-VAIN-2LB`
- **Occurrences**: 4 variants
- **Collision Scope**: **Intra-Product** (duplicate within same product)
- **Affected Products (1)**:
  - `https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/`
- **Variant Details**:
  - Product ID `308394208` | Variant ID `1370231722` | URL: `https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/`
  - Product ID `308394208` | Variant ID `1384397873` | URL: `https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/`
  - Product ID `308394208` | Variant ID `1384397882` | URL: `https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/`
  - Product ID `308394208` | Variant ID `1384397887` | URL: `https://www.entreno.com.ar/productos/optimum-nutrition-gourmet-whey-2-lb-sd3sg/`


---

## 4. Price & Compare-At Incompatibility Deep Dive

- **Price Variance across Variants**: **13 products**
- **Compare-At Incompatible Products**: **12 products**

### Products with Variance in Variant Selling Prices (13)

#### 1. BODY ADVANCE Whey Protein 3kg
- **URL**: `https://www.entreno.com.ar/productos/body-advance-whey-protein-3kg/`
- **Selling Prices Observed**: [106370, 106370, 90747, 90747]
- **Price Span**: Min **$90747** to Max **$106370**

#### 2. ENA Starter Protein 400 GRS
- **URL**: `https://www.entreno.com.ar/productos/ena-starter-protein-400-grs/`
- **Selling Prices Observed**: [44100, 43200]
- **Price Span**: Min **$43200** to Max **$44100**

#### 3. ENA Whey Protein TrueMade 1 LB
- **URL**: `https://www.entreno.com.ar/productos/ena-whey-protein-truemade-1-lb/`
- **Selling Prices Observed**: [52700, 52700, 52700, 52700, 52700, 49300]
- **Price Span**: Min **$49300** to Max **$52700**

#### 4. EVOGEN Carnigen Premium Liquid L-Carnitina 16 FL OZ
- **URL**: `https://www.entreno.com.ar/productos/evogen-carnigen-liquid-16-fl-oz/`
- **Selling Prices Observed**: [74900, 74999, 74900]
- **Price Span**: Min **$74900** to Max **$74999**

#### 5. EVOGEN Glicerol líquido EVP AQ 473 ml
- **URL**: `https://www.entreno.com.ar/productos/evogen-glicerol-liquido-evp-aq-473-ml-1pzjx/`
- **Selling Prices Observed**: [114999, 114999, 76899, 76899, 76899, 76899]
- **Price Span**: Min **$76899** to Max **$114999**

#### 6. Extra Life Boost de Hidratación Electrolitos Pack 20 Sobres
- **URL**: `https://www.entreno.com.ar/productos/extra-life-boost-de-hidratacion-electroitos-pack-20-sobres-1ixar/`
- **Selling Prices Observed**: [53990, 53990, 53990, 53990, 45000]
- **Price Span**: Min **$45000** to Max **$53990**

#### 7. MuscleTech Nitro Tech 1 KG
- **URL**: `https://www.entreno.com.ar/productos/muscletech-nitro-tech-1-kg/`
- **Selling Prices Observed**: [99999, 79999, 99999]
- **Price Span**: Min **$79999** to Max **$99999**

#### 8. MuscleTech Nitro Tech 100% Whey Gold 907 GS
- **URL**: `https://www.entreno.com.ar/productos/muscletech-nitro-tech-100-whey-gold-907-gs/`
- **Selling Prices Observed**: [99999, 79999, 79999]
- **Price Span**: Min **$79999** to Max **$99999**

#### 9. MYPROTEIN Clear Whey Isolate 20 Servings
- **URL**: `https://www.entreno.com.ar/productos/myprotein-clear-whey-isolate-20-servings/`
- **Selling Prices Observed**: [749990, 749990, 74999, 749990]
- **Price Span**: Min **$74999** to Max **$749990**

#### 10. MYPROTEIN Impact Whey Protein 1kg
- **URL**: `https://www.entreno.com.ar/productos/myprotein-impact-whey-protein-1kg/`
- **Selling Prices Observed**: [99999, 109999, 109999, 109999]
- **Price Span**: Min **$99999** to Max **$109999**

#### 11. STAR NUTRITION NITRO WHEY 2LBS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-nitro-whey-2lbs/`
- **Selling Prices Observed**: [106522, 106522, 114915]
- **Price Span**: Min **$106522** to Max **$114915**

#### 12. STAR NUTRITION PUMP 3D EVOLUTION RIPPED 315 GRS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-pump-3d-evolution-ripped-315-grs/`
- **Selling Prices Observed**: [50263, 49069]
- **Price Span**: Min **$49069** to Max **$50263**

#### 13. STAR NUTRITION PUMP V8 285 GRS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-pump-v8-285-grs/`
- **Selling Prices Observed**: [43742, 43742, 43742, 41647]
- **Price Span**: Min **$41647** to Max **$43742**

### Products with Incompatible Compare-At Pricing (12)

#### 1. B3ST Barras Proteicas 60g Alta Fibra Pack x10 unid 20G PROTEINA
- **URL**: `https://www.entreno.com.ar/productos/b3st-barras-proteicas-60g-alta-fibra-pack-x10-unid-20g-proteina-1ptsh/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 5/5 variants, values: [31250, 31250, 31250, 31250, 28688]

#### 2. BODY ADVANCE Whey Protein 3kg
- **URL**: `https://www.entreno.com.ar/productos/body-advance-whey-protein-3kg/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 4/4 variants, values: [132963, 132963, 113434, 113434]

#### 3. SHARK Botella bidón 1.5 litros con agarre
- **URL**: `https://www.entreno.com.ar/productos/botella-bidon-1-5-litros-con-agarre-1tmmm/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 3/3 variants, values: [31249, 31249, 29999]

#### 4. BSN Syntha 6 Clasico 5LB/2.27KG (48 Servicios)
- **URL**: `https://www.entreno.com.ar/productos/bsn-syntha-6-clasico-5lb/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 4/4 variants, values: [230438, 373538, 373538, 373538]

#### 5. ENA Starter Protein 400 GRS
- **URL**: `https://www.entreno.com.ar/productos/ena-starter-protein-400-grs/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 2/2 variants, values: [55125, 54000]

#### 6. ENA Whey Protein TrueMade 1 LB
- **URL**: `https://www.entreno.com.ar/productos/ena-whey-protein-truemade-1-lb/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 6/6 variants, values: [65875, 65875, 65875, 65875, 65875, 61625]

#### 7. EVOGEN Carnigen Premium Liquid L-Carnitina 16 FL OZ
- **URL**: `https://www.entreno.com.ar/productos/evogen-carnigen-liquid-16-fl-oz/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 3/3 variants, values: [84688.75, 93749, 84688.75]

#### 8. EVOGEN Glicerol líquido EVP AQ 473 ml
- **URL**: `https://www.entreno.com.ar/productos/evogen-glicerol-liquido-evp-aq-473-ml-1pzjx/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 6/6 variants, values: [137999, 137999, 96124, 96124, 96124, 96124]

#### 9. Extra Life Boost de Hidratación Electrolitos Pack 20 Sobres
- **URL**: `https://www.entreno.com.ar/productos/extra-life-boost-de-hidratacion-electroitos-pack-20-sobres-1ixar/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 5/5 variants, values: [67488, 67488, 67488, 67488, 56250]

#### 10. STAR NUTRITION NITRO WHEY 2LBS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-nitro-whey-2lbs/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 3/3 variants, values: [133153, 133153, 143644]

#### 11. STAR NUTRITION PUMP 3D EVOLUTION RIPPED 315 GRS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-pump-3d-evolution-ripped-315-grs/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 2/2 variants, values: [62829, 61336]

#### 12. STAR NUTRITION PUMP V8 285 GRS
- **URL**: `https://www.entreno.com.ar/productos/star-nutrition-pump-v8-285-grs/`
- **Issue**: `INCONSISTENT_COMPARE_AT`
- **Details**: Populated on 4/4 variants, values: [54678, 54678, 54678, 52059]

---

## 5. Slug and Property Collision Analysis

- **Product Slug Collisions**: **0**
  - All **676** product URL handles strictly follow `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
  - Zero collisions detected across all 676 canonical product slugs.
- **Option Value Slug Collisions**: **0**
  - *(None detected)*

---

## 6. Variant Model & Shape Distribution

| Variant Shape | Product Count | % of Catalog | Typical Domain |
|---|:---:|:---:|---|
| **0 Options (Simple Product)** | **84** | **12.4%** | Capsules, single-size supplements, bottles |
| **1 Option Dimension** | **564** | **83.4%** | Flavors (`Sabor`) or Sizes (`Talle`) |
| **2 Option Dimensions** | **28** | **4.1%** | Apparel (`Color` + `Talle`) |
| **>2 Option Dimensions** | **0** | **0.0%** | *(Unsupported by EntrenAR - none exist)* |

- **Empty / Missing SKU Count**: **0** (100% of variants carry an explicit SKU).
- **Zero-Variant Products**: **0** (100% of products have at least 1 defined variant).

---

## 7. Media & Image Findings

- **Products with 0 Images**: **0** (All products have galleries).
- **Unlinked Variant Images**: **0 products** have variants referencing image IDs not found in the product's primary gallery (these safely fall back to the primary gallery image).

---

## 8. Logistics (Weight & Dimensions) Analysis

Tiendanube exposes physical packaging metrics per variant in `nube-sdk-script`.

| Logistics Metric | Products Count | % of Catalog | Assessment |
|---|:---:|:---:|---|
| **Complete Logistics** (Weight > 0 AND Dimensions > 0) | **672** | **99.4%** | Production-ready packaging data |
| **Missing / Zero Weight** | **0** | **0.0%** | Weight is null, empty string, or 0.000 |
| **Missing / Zero Dimensions** (`W×H×D`) | **4** | **0.6%** | Dimensions null or 0.00 |
| **Logistics Variance across Variants** | **2** | **0.3%** | Sizing/weights vary across apparel variants |

### Products with Missing / Zero Dimensions (4)
- **BULL BAR 60GR Barra de Whey Protein - 1 Unid**: `https://www.entreno.com.ar/productos/bull-bar-60gr-barra-de-whey-protein-1-unid-pmhh8/`
- **BULL BAR Whey Protein 60g - Caja x10 | 18g Proteína Premium**: `https://www.entreno.com.ar/productos/bull-bar-60gr-barra-de-whey-protein-caja-x10-1gnlt/`
- **BULL BAR 60GR Barra de Whey Protein - Caja x12**: `https://www.entreno.com.ar/productos/bull-bar-60gr-barra-de-whey-protein-caja-x12-8nag7/`
- **Gu Electrolitos Cápsulas 50 Caps**: `https://www.entreno.com.ar/productos/gu-electrolitos-capsulas-50-caps/`

### Products with Logistics Variance across Variants (2)
- **OPTIMUM NUTRITION 100% Whey Gold 1.5 LB** (`https://www.entreno.com.ar/productos/optimum-nutrition-100-whey-gold-1-5lb/`)
  - Variant weights: [0.680, 0.670] kg
  - Variant dimensions: [12.00x20.00x12.00] cm
- **OPTIMUM NUTRITION 100% Whey Gold ISOLATE 1.5 LB** (`https://www.entreno.com.ar/productos/optimum-nutrition-100-whey-gold-isolate-1-5lb/`)
  - Variant weights: [0.740, 0.710] kg
  - Variant dimensions: [12.00x25.00x12.00] cm

---

## 9. Extraction Failures & Limitations

- **Total Extraction Failures**: **0**
- **Rate-Limiting / Cloudflare Blocks Encountered**: **0**
- **Limitations**:
  - The census extracted public store HTML via bounded HTTP concurrency (concurrency=3).
  - Public product pages display brand breadcrumbs (`Inicio > MARCAS > Brand`); functional category assignment requires querying category listing routes during transformation preparation.

---

## 10. Conclusion & PRD Refinement Readiness

The source anomaly census is **100% complete** across all **676** products in the Entreno catalog.

- **Acceptance Yield**: **657 products (97.2%)** and **1131 variants** can be cleanly ingested into EntrenAR with zero domain mutations.
- **Exclusion Yield**: **19 products (2.8%)** are excluded according to PRD2 Core Decisions (exact list of SKUs and URLs captured in `prd2-source-anomaly-census.json`).
- **Prerequisite Validation**: Evidence is comprehensive, deterministic, and complete. PRD refinement can proceed without guesswork.
