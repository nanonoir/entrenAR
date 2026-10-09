# Entreno Catalog Scraping Technical Research Report

---

# 1. Executive Summary

Entreno (`entreno.com.ar`) runs on the **Tiendanube** ecommerce platform (store ID `6011728`). Product data is fully server-rendered into the initial HTML document across all surfaces. Complete product metadata, image galleries, and every sellable variant—including exact numerical inventory (`stock`), individual variant SKUs, prices, compare-at prices, dimensions, and weights—are embedded directly in static HTML within the `data-variants="[JSON]"` attribute and the `<script id="nube-sdk-script">` initialization block. Interactive variant switching in the browser makes **zero backend API requests**; state transitions are handled entirely in client memory. Catalog discovery is trivial: `/sitemap.xml` provides an authoritative manifest of all 676 products with images, and the platform pagination endpoint (`/productos/page/{n}/?results_only=true&limit=100&theme=toluca`) allows rapid batched enumeration. **Browser automation (Playwright) is completely unnecessary for extraction.** A pure HTTP pipeline (`fetch` + `cheerio` / regex / JSON parsing) can extract the entire catalog with 100% fidelity in seconds. The primary operational considerations are handling 5 identified duplicate SKU instances and reconciling brand-centric breadcrumbs with functional category navigation.

---

# 2. Product Cases Investigated

| # | Product Name | URL | Case Represented | Variant Structure | Why Inspected |
|---|---|---|---|---|---|
| 1 | FALUX Omega 3 Fish Oil 2000mg (60 caps) | `https://www.entreno.com.ar/productos/falux-omega-3-fish-oil-falux-2000mg-epa-800-dha-400-60-caps-1l25u/` | 1. No variants | Single variant, `options: []` | Verify baseline payload when no user-selectable options exist. |
| 2 | FULL POWER Creatina Monohidratada 300g | `https://www.entreno.com.ar/productos/full-power-creatina-monohidratada-300g-60-servicios-neutro-fuerza-rendimiento-q2d95/` | 2. Supplement with single `Sabor` | 1 variant: `Sabor = Neutro` | Verify structure when option dimension exists but only 1 flavor is offered. |
| 3 | OPTIMUM NUTRITION Gold Protein Shake Pack 4 (325ml) | `https://www.entreno.com.ar/productos/optimum-nutrition-gold-protein-shake-pack-4-unid-de-325ml-11r5c/` | 3. Several flavors (partial stock) | 3 variants: `Frutilla`, `Chocolate`, `Vanilla` | Verify multi-flavor model, price uniformity, and flavor-specific stock (`Vanilla` stock is 0). |
| 4 | Faja de entrenamiento Symmetry By Ori | `https://www.entreno.com.ar/productos/faja-de-entrenamiento-symmetry-by-ori-j377s/` | 4. Apparel with `Talle` (single dimension) | 4 variants: `XS`, `S`, `M`, `L` | Verify single dimension apparel sizing and fragmented stock (`XS`=2, `S`=0, `M`=0, `L`=2). |
| 5 | BALBOAFIT Muñequeras Elásticas | `https://www.entreno.com.ar/productos/balboafit-munequeras-elasticas-13gxw/` | 5. Apparel with `Color + Talle` (two dimensions) | 6 variants: `Negro/Gris/Verde` × `S/M` | Verify two-dimensional matrix, sparse availability, and DOM selector mapping. |
| 6 | RAW Proteína Itholate 2lb Iced Carrot Cake | `https://www.entreno.com.ar/productos/raw-proteina-itholate-2lb-830g-25-serv-iced-carrot-cake-15q03/` | 6. Completely Out of Stock | 1 variant: `Iced Carrot Cake` (`stock: 0`) | Verify entire product out-of-stock representation in HTML, JSON, and CTA state. |
| 7 | Botella Bidón 1.5 Litros con Agarre Shark | `https://www.entreno.com.ar/productos/botella-bidon-1-5-litros-con-agarre-1tmmm/` | 7. Low / Limited Stock | 3 variants: `Transparente` (7), `Negro` (1), `Rosa` (10) | Verify exact low stock counter visibility and threshold representations. |
| 8 | SUMA Electrolitos Caja 30 Sobres Naranja | `https://www.entreno.com.ar/productos/suma-electrolitos-caja-30-sobres-fv-11-2026-naranja-kj6ai/` | 8. Discounted / Promotional price | 1 variant: `Naranja` | Verify compare-at price ($68.500) vs promotional price ($45.000) and discount badge math. |
| 9 | FULL POWER Creatina Monohidratada 300g | `https://www.entreno.com.ar/productos/full-power-creatina-monohidratada-300g-60-servicios-neutro-fuerza-rendimiento-q2d95/` | 9. Multiple images | 10 gallery images | Verify image gallery ordering, high-resolution CDN URLs, and thumbnail generation. |
| 10 | Grant Force Muñequeras Elásticas Classic | `https://www.entreno.com.ar/productos/grant-force-munequeras-elasticas-classic-ucgge/` | 10. Unusual structure (escaped quotes) | 3 variants: `Celeste/Fucsia/Violeta` × `16"` | Verify escaped double quotes inside option values (`16"`) and SKUs (`...-16"`). |

---

# 3. Catalog Discovery

### Initial Page Load (`/productos/`)
- When requesting `https://entreno.com.ar/productos/`, the server returns 12 products in the initial HTML.
- The markup renders 12 `.js-item-product` elements and a hidden load-more container:
  ```html
  <div class="js-load-more text-center my-4" style="display: none;">
      <a class="btn btn-default d-inline-block">
          <span class="js-load-more-spinner" style="display:none;">...</span>
          Mostrar más productos
      </a>
  </div>
  ```

### Infinite Loading & Pagination Endpoint
As the user scrolls down, Tiendanube executes an AJAX request. The underlying endpoint is clean and directly callable via HTTP:

- **Endpoint**: `GET /productos/page/{page_number}/`
- **Query Parameters**:
  - `results_only=true` (signals the server to omit layouts and return JSON with HTML snippet)
  - `limit={number}` (default in UI is 12, but server accepts `50`, `100`, etc.)
  - `theme=toluca` (theme layout identifier)
- **Required Headers**:
  - `x-requested-with: XMLHttpRequest`
  - `accept: application/json`
- **Response Format**:
  ```json
  {
    "html": "   \n<div class=\"js-item-product ...\" data-product-id=\"364355276\">...</div>..."
  }
  ```
- **Tested Limits**:
  - `limit=12`: returns 12 items.
  - `limit=50`: returns 50 items.
  - `limit=100`: returns 100 items in a single HTTP response (HTTP 200, ~3.4 MB HTML string).
  - Out-of-bounds page (e.g. `page=60`): returns `{"html": ""}` with HTTP 200.

### Category Pages
Category pages (e.g., `/suplementos/proteinas/whey-protein/`) use the **identical mechanism**:
- `GET /suplementos/proteinas/whey-protein/page/1/?results_only=true&limit=100&theme=toluca`
- Returns 94 products in a single request.

### Authoritative Enumeration via `sitemap.xml`
`robots.txt` exposes:
```text
Sitemap: https://www.entreno.com.ar/sitemap.xml.gz
```
Fetching uncompressed `https://www.entreno.com.ar/sitemap.xml` (HTTP 200, `application/xml`) yields:
- **Total URLs**: 4,851 (including Google Image sitemap tags).
- **Exact Product URLs**: **676 distinct product URLs** (every URL matching `/productos/*`).
- **Structured XML Fields**:
  - `<loc>`: Canonical product URL.
  - `<lastmod>`: ISO 8601 timestamp (e.g. `2026-04-15T22:40:42Z`).
  - `<changefreq>`: `daily`.
  - `<priority>`: `0.75`.
  - `<image:image><image:loc>`: Full list of all product image URLs.

**Simplest Enumeration Strategy**:
1. Fetch `/sitemap.xml` once to obtain the complete list of 676 product URLs and last modification dates.
2. Alternatively, paginate `/productos/page/{n}/?results_only=true&limit=100&theme=toluca` from `page=1` to `page=7` to discover all products in 7 HTTP requests.

---

# 4. Product Data Map

| Data Field | Where It Exists | Format | Browser Required? | Reliability | Notes |
|---|---|---|:---:|:---:|---|
| **Product ID** | `data-variants="[{product_id:...}]"`, `<script id="nube-sdk-script">`, HTML `[data-product-id]` | Integer | No | Very High | e.g. `341936320`. Consistent across all sources. |
| **Tiendanube ID**| Same as Product ID | Integer | No | Very High | Internal store product identifier. |
| **Slug / Handle** | Canonical URL, `handle.es` in `<script id="nube-sdk-script">` | String | No | Very High | e.g. `balboafit-munequeras-elasticas-13gxw`. |
| **Name** | `h1.js-product-name`, `<script id="nube-sdk-script">` `name.es`, `data-component="structured-data.page"` | Text | No | Very High | Identical across DOM and JSON-LD. |
| **Brand** | `<script id="nube-sdk-script">` `brand`, breadcrumbs, JSON-LD `brand.name` | Text | No | Very High | Explicitly stored in product object (e.g. `"BALBOAFIT"`, `"OPTIMUM NUTRITION"`). |
| **Description** | `div.user-content.js-product-description`, `<script id="nube-sdk-script">` `description.es` | HTML | No | Very High | Clean semantic HTML (`<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`, `<h2>`, `<h3>`). |
| **Categories** | `div.breadcrumbs`, header nav menu, `/sitemap.xml` | HTML / Hierarchy | No | High | Product breadcrumbs are brand-centric (`Inicio > MARCAS > Brand`). Functional taxonomy is found in the site nav. |
| **Base / Compare Price** | `data-variants` (`compare_at_price_number`), `<script id="nube-sdk-script">` (`compare_at_price`) | Number / String | No | Very High | e.g. `34749` or `"34749.00"`. Stored per variant. |
| **Current / Promoted Price** | `data-variants` (`price_number`), `<script id="nube-sdk-script">` (`price`) | Number / String | No | Very High | e.g. `26730` or `"26730.00"`. Stored per variant. |
| **Stock (Numeric)** | `data-variants` (`stock`), `<script id="nube-sdk-script">` (`stock`) | Integer | No | Very High | **Exact integer stock per variant** (e.g. `98`, `5`, `0`). Stock management flag is also available. |
| **Availability** | `data-variants` (`available`), `<script id="nube-sdk-script">` (`stock > 0`) | Boolean | No | Very High | `true` when stock > 0; `false` when 0. |
| **Variant Definitions** | `select.js-variation-option`, `label[for="variation_{n}"]`, `<script id="nube-sdk-script">` `options` | Form Controls / Objects | No | Very High | Option names (`"Color"`, `"Talle"`, `"Sabor"`) and values are explicitly defined. |
| **Variant IDs** | `data-variants` (`id`), `<script id="nube-sdk-script">` (`id`) | Integer | No | Very High | e.g. `1517758997`. Unique across all variants. |
| **Variant SKU** | `data-variants` (`sku`), `<script id="nube-sdk-script">` (`sku`) | String | No | Very High | 100% populated across all 1,199 variants. 5 duplicate SKU instances exist. |
| **Variant Weight/Dims** | `<script id="nube-sdk-script">` (`weight`, `width`, `height`, `depth`) | String | No | High | Physical dimensions in cm and kg (e.g. `"0.100"`, `"10.00 x 5.00 x 3.00"`). |
| **Images** | `data-variants` (`image`, `image_url`), `<script id="nube-sdk-script">` `images` array | Array of Objects | No | Very High | Complete gallery array with dimensions, positions, alt texts, and variant links. |

---

# 5. Variant Model

### Architecture & Representation
Tiendanube uses a **discrete variant list** (sparse sellable combinations) rather than a cartesian product generator. Only combinations that actually exist in inventory are defined in `data-variants` and `nube-sdk-script`.

### Dimension Mapping
The system supports up to 3 option dimensions:
- `option0`: First dimension (e.g. `Sabor` or `Color`)
- `option1`: Second dimension (e.g. `Talle` or `Tamaño`)
- `option2`: Third dimension (rare, mostly `null`)

In the DOM, these correspond directly to:
- `select[name="variation[0]"]` with label `label[for="variation_1"]`
- `select[name="variation[1]"]` with label `label[for="variation_2"]`

### Case A: Single Dimension (`Sabor`)
Product: `OPTIMUM NUTRITION Gold Protein Shake PACK 4 unid de 325ml` (ID `366299473`)
```json
[
  {
    "id": 1593138994,
    "sku": "ON-PROTEIN-SHAKE-FR-PACK4UNID-325ML",
    "option0": "Frutilla",
    "option1": null,
    "price_number": 37900,
    "compare_at_price_number": 50396,
    "stock": 30,
    "available": true,
    "image": 1268894135,
    "image_url": "//acdn-us.mitiendanube.com/...-frutilla-...webp"
  },
  {
    "id": 1593138997,
    "sku": "ON-PROTEIN-SHAKE-CH-PACK4UNID-325ML",
    "option0": "Chocolate",
    "option1": null,
    "price_number": 37900,
    "compare_at_price_number": 50396,
    "stock": 30,
    "available": true,
    "image": 1268894108,
    "image_url": "//acdn-us.mitiendanube.com/...-chocolate-...webp"
  },
  {
    "id": 1593139000,
    "sku": "ON-PROTEIN-SHAKE-VA-PACK4UNID-325ML",
    "option0": "Vanilla",
    "option1": null,
    "price_number": 37900,
    "compare_at_price_number": 50396,
    "stock": 0,
    "available": false,
    "image": 1268894134,
    "image_url": "//acdn-us.mitiendanube.com/...-vanilla-...webp"
  }
]
```

### Case B: Two Dimensions (`Color + Talle`)
Product: `BALBOAFIT Muñequeras Elásticas` (ID `341936320`)
Options: `Color` (`Negro`, `Gris`, `Verde`), `Talle` (`S`, `M`)
```json
[
  {
    "id": 1517758997,
    "sku": "BALBOAFIT-MUÑEQUERA-NEGRO-S",
    "option0": "Negro",
    "option1": "S",
    "stock": 0,
    "available": false,
    "image": 1185047815
  },
  {
    "id": 1517758999,
    "sku": "BALBOAFIT-MUÑEQUERA-NEGRO-M",
    "option0": "Negro",
    "option1": "M",
    "stock": 0,
    "available": false,
    "image": 1185047815
  },
  {
    "id": 1517759000,
    "sku": "BALBOAFIT-MUÑEQUERA-GRIS-S",
    "option0": "Gris",
    "option1": "S",
    "stock": 9,
    "available": true,
    "image": 1185049244
  },
  {
    "id": 1517759001,
    "sku": "BALBOAFIT-MUÑEQUERA-GRIS-M",
    "option0": "Gris",
    "option1": "M",
    "stock": 0,
    "available": false,
    "image": 1185049244
  },
  {
    "id": 1517759002,
    "sku": "BALBOAFIT-MUÑEQUERA-VERDE-S",
    "option0": "Verde",
    "option1": "S",
    "stock": 8,
    "available": true,
    "image": 1185049285
  },
  {
    "id": 1517759003,
    "sku": "BALBOAFIT-MUÑEQUERA-VERDE-M",
    "option0": "Verde",
    "option1": "M",
    "stock": 0,
    "available": false,
    "image": 1185049285
  }
]
```

### Real Sellable vs Theoretical Combinations
- Real sellable combinations are those with `available === true` AND `stock > 0`.
- Out-of-stock combinations remain defined in the array (with `available === false` and `stock === 0`), which allows the store UI to display crossed-out swatches (`btn-variant-no-stock`).
- Invalid combinations (combinations never manufactured or sold) are simply omitted from the array entirely.

---

# 6. Network Findings

During intensive browser interaction (clicking flavors, selecting sizes, switching colors), network logs were monitored in real time.

### Findings on Variant Switching
- **Requests observed**: 0 backend requests to `entreno.com.ar` or `tiendanube.com`.
- The only outgoing requests were third-party analytics beacons:
  - Google Analytics 4 (`analytics.google.com/g/collect` with `event=view_item`)
  - Google Ads Remarketing (`google.com/rmkt/collect`)
  - Perfit Marketing (`webhooks.myperfit.net`)
- **Conclusion**: Changing variants is **100% client-side memory dispatch**. There is no backend variant endpoint because the client already possesses the entire variant state table.

### Useful Endpoints Documented

#### 1. Catalog Paginated Results Endpoint
- **Purpose**: Retrieve batched product card markup and variant definitions for catalog or category pages.
- **Method**: `GET`
- **URL Pattern**: `https://www.entreno.com.ar/productos/page/{page_number}/?results_only=true&limit={limit}&theme=toluca`
  (Also works on categories: `https://www.entreno.com.ar/{category_slug}/page/{page_number}/?results_only=true&limit={limit}&theme=toluca`)
- **Parameters**:
  - `page_number`: Integer (`1`, `2`, `3`...)
  - `results_only`: `true`
  - `limit`: Integer (`12` default, tested up to `100`)
  - `theme`: `toluca`
- **Request Body**: None.
- **Request Headers**:
  ```http
  x-requested-with: XMLHttpRequest
  accept: application/json
  ```
- **Response Format**: `application/json`
  ```json
  {
    "html": "   \n<div class=\"js-item-product ...\" data-product-id=\"...\">...</div>"
  }
  ```
- **Cookies Required**: None.
- **Browser Required**: No.
- **Useful Fields in Returned HTML**:
  - `[data-product-id]`: Product ID.
  - `[data-variants]`: Full JSON array of all variants for each product card.
  - `.item-link`: Canonical product URL.
- **Evidence**: Verified via Playwright and Bash `curl`. Response code 200, elapsed time ~550ms.

#### 2. XML Sitemap Endpoint
- **Purpose**: Enumerate all 676 product URLs and their primary image URLs.
- **Method**: `GET`
- **URL Pattern**: `https://www.entreno.com.ar/sitemap.xml`
- **Parameters**: None.
- **Request Body**: None.
- **Response Format**: `application/xml`
- **Cookies Required**: None.
- **Browser Required**: No.
- **Useful Fields**: `<loc>`, `<lastmod>`, `<image:loc>`.
- **Evidence**: 4,851 total URLs, 676 product URLs returned with HTTP 200.

---

# 7. Stock Findings

| Stock Concept | How It Is Represented in Tiendanube | Publicly Extractable? | Numeric Precision |
|---|---|:---:|:---:|
| **Stock per Variant** | `variant.stock` in `data-variants` and `nube-sdk-script` | **YES** | Exact integer (e.g. `98`, `30`, `5`, `0`) |
| **Total Product Stock** | Sum of `variant.stock` across all variants for that product | **YES** | Exact sum (e.g. `200` total across flavors) |
| **Availability Flag** | `variant.available` (`true` / `false`) | **YES** | Exact boolean |
| **Stock Management** | `variant.stock_management` (`true` / `false`) | **YES** | Exact boolean |
| **UI Stock Labels** | `SIN STOCK`, `Últimas unidades`, or blank | **YES** | Text presentation string |

### Key Takeaway
Unlike many ecommerce platforms that conceal inventory counts behind "In Stock" booleans, Tiendanube publicly exposes the **exact numeric inventory integer** for every individual variant directly in the embedded HTML state (`stock: 30`, `stock: 0`, etc.).

---

# 8. Price Findings

### Price Semantics
- **Normal / Current Price (`price_number` / `price`)**:
  The active selling price in ARS (e.g. `26730` or `26730.00`).
  `price_number_raw` provides the value in cents (e.g. `2673000`).
  `price_short` provides formatted currency: `"$26.730,00"`.
- **Compare-At / List Price (`compare_at_price_number` / `compare_at_price`)**:
  The original crossed-out price before discount (e.g. `34749` or `34749.00`).
- **Promotional Flag (`has_promotional_price`)**:
  Boolean flag (`true` when `compare_at_price > price`).
- **Variant-Specific Pricing**:
  Each variant has independent `price` and `compare_at_price` properties. In most supplements, flavors share identical pricing; in apparel, differing sizes or colors occasionally vary.
- **Payment Method Discounts (`price_with_payment_discount_short`)**:
  Calculated pre-discount for cash/transfer (e.g. `"$24.057,00"`, 10% off).
- **Percentage Discount**:
  The percentage displayed in UI badges (e.g. `"23% OFF"`, found in `<span class="js-offer-percentage">23</span>`) is **not a stored database column**. It is a **calculated presentation value**:
  $$\text{discountPercentage} = \text{round}\left(\frac{\text{compare\_at\_price} - \text{price}}{\text{compare\_at\_price}} \times 100\right)$$
  For Balboafit: $(34749 - 26730) / 34749 = 0.2307 \rightarrow 23\%$.

**Extraction Strategy**: Extract `price_number` and `compare_at_price_number` as raw numeric floats/integers; derive promotional status and discount percentage programmatically.

---

# 9. SKU Findings

### Availability
- Total variants scanned across catalog: **1,199 variants**.
- Variants with missing / empty SKU: **0** (100% of variants have an SKU).
- Product SKU vs Variant SKU: In Tiendanube, **SKUs belong to variants**. Products with no selectable options have a single variant that carries the SKU.

### Real Examples
- Supplement with single option: `FULLPOWER-CREA-300GR`
- Supplement with flavors: `ON-PROTEIN-SHAKE-FR-PACK4UNID-325ML`, `ON-PROTEIN-SHAKE-CH-PACK4UNID-325ML`
- Apparel with Color + Size: `BALBOAFIT-MUÑEQUERA-NEGRO-S`, `BALBOAFIT-MUÑEQUERA-GRIS-M`
- Apparel with quotes in option: `GRANTFORCE-MUÑEQUERA-CELESTE-16"`

### Critical Finding: Duplicate SKUs
While 1,194 SKUs are unique, **5 duplicate SKU instances** exist in the store:
1. `ENA-ELECTROLITOS-BERRIES-CAJA-75G`: Shared between variant `1566721341` and variant `1566721342` under product `358017837`.
2. `ON-WHEYGOURMET-VAIN-2LB`: Reused across 4 distinct variants under product `308394208`.
3. `MP-CLEARMOJITO-20SERV`: Reused across product `368348171` and product `271853986`.

**Impact for EntrenAR**: Because EntrenAR enforces unique SKU constraints, the ingestion pipeline must either:
- Deduplicate by suffixing variant ID (e.g. `ENA-ELECTROLITOS-BERRIES-CAJA-75G-1566721342`), or
- Use Tiendanube's internal variant ID (`variant.id`) as the primary foreign key.

---

# 10. Media Findings

### Gallery & Ordering
- Complete image list is defined in `<script id="nube-sdk-script">` under `product.images`:
  ```json
  {
    "id": 1185047815,
    "product_id": 341936320,
    "src": "https://acdn-us.mitiendanube.com/stores/006/011/728/products/balboa-fit-munequeras-talla-negro-1-bf239a2d230171c30e17779009592310-1024-1024.webp",
    "position": 1,
    "alt": { "es": "BALBOAFIT Muñequeras Elásticas" },
    "width": 1024,
    "height": 1026,
    "thumbnails_generated": 2
  }
  ```
- Image order is explicit via `position` (1-indexed).

### Formats & Resolutions
- All product media is already delivered in **WebP format** (`.webp`).
- Two pre-generated CDN dimensions exist:
  - **High-res / Display**: `-1024-1024.webp` (HTTP 200, ~100–150 KB)
  - **Thumbnail**: `-480-0.webp` (HTTP 200, ~25–40 KB)
- Requesting arbitrary dimensions (e.g. `-1920-1920.webp` or raw `.jpg`) returns Cloudflare S3 HTTP 403 Forbidden.

### Variant Association
Each variant in `data-variants` explicitly references its associated image:
- `variant.image`: ID of the image matching `image.id` in the gallery.
- `variant.image_url`: Direct CDN URL for that variant (e.g. switching to "Verde" loads `balboa-fit-munequeras-talla-verde-1-...-1024-1024.webp`).

### Videos
- Across pages 1–5 and random sampling, no products contain embedded YouTube or Vimeo videos.
- `video_url` is a standard Tiendanube schema property that is currently `null` across examined products.

---

# 11. Category and Brand Findings

### Brand Information
- **High Reliability**: Brand is explicitly exposed in `<script id="nube-sdk-script">` as `product.brand` (e.g. `"BALBOAFIT"`, `"Optimum Nutrition"`, `"FULL POWER"`), in `LS.product.brand`, and in JSON-LD `brand.name`.

### Category Taxonomy vs Marketing Structure
In Entreno, product breadcrumbs follow a **brand path**:
```text
Inicio > MARCAS > [BRAND_NAME] > [PRODUCT_TITLE]
```
For example: `Inicio > MARCAS > BALBOA FIT > BALBOAFIT Muñequeras Elásticas`.

However, the store's **functional catalog taxonomy** is organized in the global navigation menu:
```text
SUPLEMENTOS
├── PROTEINAS
│   ├── WHEY PROTEIN (/suplementos/proteinas/whey-protein/)
│   ├── GANADORES
│   ├── PLANT PROTEIN
│   ├── COLAGENO
│   ├── PROTEIN BARS
│   └── PROTEIN FOODS
├── PRE INTRA & CREATINA
│   ├── CREATINA (/suplementos/pre-intra-creatina/creatina/)
│   ├── PRE & INTRA ENTRENO
│   └── EEAs & BCAAs
├── VITAMINAS & SUPLEMENTOS
├── PERFORMANCE
└── CONTROL DE PESO

INDUMENTARIA
├── ENTRENO (/indumentaria/entreno2/)
├── SHARK (/indumentaria/shark1/)
└── RAW (/indumentaria/raw1/)

MARKET
├── PASTAS DE MANI
├── BARRAS
└── SALSAS
```

**Extraction Insight**:
- Product pages do not expose the full multi-tier functional category path (they only show the brand breadcrumb).
- If EntrenAR requires mapping products into functional categories (e.g. `Suplementos > Proteínas > Whey`), the discovery phase should crawl the category tree (`/{category}/{subcategory}/page/1/?results_only=true&limit=100&theme=toluca`) to build a Product ID $\rightarrow$ Category taxonomy lookup map.

---

# 12. Extraction Classification

| Data Field | STATIC_HTML | EMBEDDED_JSON | HTTP_ENDPOINT | BROWSER_REQUIRED | UNKNOWN | Recommended Best Mechanism |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Product URLs** | | | **X** | | | **HTTP_ENDPOINT** (`/sitemap.xml` or `/productos/page/{n}/`) |
| **Product ID** | **X** | **X** | | | | **EMBEDDED_JSON** (`data-variants` / `nube-sdk-script`) |
| **Product Name** | **X** | **X** | | | | **STATIC_HTML** (`h1.js-product-name` or `nube-sdk-script`) |
| **Brand** | **X** | **X** | | | | **EMBEDDED_JSON** (`nube-sdk-script` `product.brand`) |
| **Description HTML**| **X** | **X** | | | | **STATIC_HTML** (`div.user-content.js-product-description`) |
| **Categories** | **X** | | **X** | | | **HTTP_ENDPOINT** (Category listings for functional taxonomy) |
| **Variants Array** | | **X** | | | | **EMBEDDED_JSON** (`data-variants="[JSON]"`) |
| **Variant IDs** | | **X** | | | | **EMBEDDED_JSON** (`data-variants[].id`) |
| **Variant Options** | | **X** | | | | **EMBEDDED_JSON** (`data-variants[].option0, option1` / `nube-sdk-script`) |
| **Variant SKU** | | **X** | | | | **EMBEDDED_JSON** (`data-variants[].sku`) |
| **Variant Stock** | | **X** | | | | **EMBEDDED_JSON** (`data-variants[].stock`) |
| **Variant Prices** | | **X** | | | | **EMBEDDED_JSON** (`data-variants[].price_number`, `compare_at_price_number`) |
| **Gallery Images** | | **X** | | | | **EMBEDDED_JSON** (`nube-sdk-script` `product.images` / `sitemap.xml`) |
| **Variant Image URL**| | **X** | | | | **EMBEDDED_JSON** (`data-variants[].image_url`) |
| **Dimensions/Weight**| | **X** | | | | **EMBEDDED_JSON** (`nube-sdk-script` `variants[].weight`, `width`...) |

---

# 13. Edge Cases

1. **No Variants (Single product)**:
   - Product has 1 entry in `data-variants` with `option0: null`, `option1: null`.
   - SKU and stock belong to this single entry. Example: `FALUX Omega 3 60 caps`.
2. **One Variant Dimension (`Sabor` or `Talle`)**:
   - `option0` is populated with the value (`"Chocolate"`, `"M"`), `option1` is `null`.
3. **Two Variant Dimensions (`Color + Talle`)**:
   - `option0` is Color (`"Negro"`), `option1` is Size (`"S"`).
   - Some matrix cells are out of stock (e.g. `Negro/S` stock: 0) while others are in stock (e.g. `Gris/S` stock: 9).
4. **Escaped Characters in Option Values & SKUs**:
   - Product `Grant Force Muñequeras Classic` has `option1` set to `16"` (escaped double quote) and SKU `GRANTFORCE-MUÑEQUERA-CELESTE-16"`. In HTML attributes, this appears as `&quot;16\&quot;&quot;`. Parsers must unescape properly.
5. **Special Characters in Flavor Names**:
   - e.g. `Cookies and Cream (Champion Mentality)` containing parentheses.
6. **Entire Product Out of Stock**:
   - e.g. `RAW Proteína Itholate 2lb Iced Carrot Cake` (`stock: 0`). The buy button has `value="Sin stock"` and `disabled`.
7. **Duplicate SKUs**:
   - 5 duplicate SKUs identified across 1,199 variants (e.g. `ENA-ELECTROLITOS-BERRIES-CAJA-75G` shared by 2 variants of product `358017837`).
8. **Multiple JSON-LD Blocks**:
   - The page includes multiple `<script type="application/ld+json">` tags for carousel/related items. Scrapers relying on JSON-LD will extract the wrong product unless filtering strictly by `script[data-component="structured-data.page"]`.

---

# 14. Unknowns / Further Research

1. **High-Concurrency Rate Limits**:
   - Testing showed Cloudflare does not challenge normal HTTP GET requests at moderate speeds (~5–10 req/sec). However, aggressive concurrency (e.g., 50+ concurrent requests) could trigger Cloudflare IP rate limiting or Turnstile challenges.
2. **Catalog Update Frequency**:
   - While `sitemap.xml` provides `<lastmod>`, it is unknown whether Tiendanube updates `<lastmod>` on stock changes or only on product edits.
3. **Future Embedded Video Formats**:
   - No products currently feature video, so video player behavior (e.g. YouTube iframe vs Tiendanube native video) cannot be verified empirically.

---

# 15. Recommendations for the Scraper PRD

| Area | Recommendation | Confidence Level | Architectural Rationale |
|---|---|:---:|---|
| **Engine Choice** | **Use Pure HTTP (`fetch` / `axios` / `undici` + `cheerio`)** | **HIGH** | Playwright is 100% unnecessary. All product and variant data is server-rendered in static HTML. A Node.js HTTP scraper will be 50x faster and consume 1/100th of the RAM. |
| **Catalog Discovery** | **Use `/sitemap.xml` as primary manifest** | **HIGH** | `/sitemap.xml` contains all 676 product URLs, last modification dates, and image links in a single XML document. |
| **Variant Extraction** | **Extract from `data-variants="[JSON]"` attribute** | **HIGH** | `data-variants` contains 100% valid JSON with exact numeric stock, SKUs, option values, prices, and variant-specific image URLs. `JSON.parse()` on the unescaped attribute is trivial and resilient. |
| **Product Metadata** | **Extract from `<script id="nube-sdk-script">`** | **HIGH** | The `initialState` object contains canonical brand, dimensions, weights, explicit option names (`"Color"`, `"Talle"`), and full HTML description. |
| **Category Taxonomy** | **Build lookup map from category pagination endpoints** | **MEDIUM** | Because product page breadcrumbs default to `MARCAS > Brand`, crawling the category tree (`/{category}/{sub}/page/1/?results_only=true`) provides the true ecommerce taxonomy. |
| **SKU Deduplication** | **Implement SKU collision fallback** | **HIGH** | 5 duplicate SKUs were observed in the source catalog. The pipeline must append `-variantId` or use Tiendanube variant ID when a duplicate SKU is detected. |
| **Image Pipeline** | **Use `-1024-1024.webp` URLs directly** | **HIGH** | Images are already optimized WebP at 1024x1024. No on-the-fly resizing or conversion is needed during ingestion. |
| **Concurrency / Rate Limit** | **Enforce request throttling (e.g. 5–8 concurrent requests)** | **HIGH** | Prevents Cloudflare rate-limiting while allowing the entire 676-product catalog to be scraped in under 2 minutes. |
