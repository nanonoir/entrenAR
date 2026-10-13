# Independent Review Report: Storefront Availability-First

**Date:** 2026-10-10
**Status:** Completed & Re-Reviewed
**Scope:** Storefront availability-first listings, backend comparator ordering across all 5 sorts, public stock projection for TRACKED / INFINITE / OUT_OF_STOCK variants, depleted product card presentation ("Sin stock" disabled gray button without badge), quick-buy isolation, and production build control flow resolution.
**Authority:** [catalog-public-api spec](../../product-specs/catalog-public-api/spec.md), [ExecPlan](./storefront-availability-first.md), [ARCHITECTURE.md](../../../ARCHITECTURE.md), [FRONTEND.md](../../../docs/FRONTEND.md).

---

## 1. Final Verdict

**PASS**

All functional requirements, behavioral specifications, domain invariants, and technical constraints are fully satisfied. The production build blocker identified in the initial review was conclusively diagnosed as Next.js framework control-flow swallowing (`DYNAMIC_SERVER_USAGE` on uncached `fetch`), cleanly resolved using `unstable_rethrow(error)` from `next/navigation` without masking genuine runtime errors or altering domain fallback semantics, and validated via dedicated harness and clean production build (`ƒ /`).

| Review Round | Verdict | Summary |
|---|:---:|---|
| Initial Review | **PASS WITH FINDINGS** | Functional behavior, comparator, and card UI compliant. Finding 1 issued for `next build` prerender failure. |
| Re-Review | **PASS** | Finding 1 verified resolved via `unstable_rethrow`. Build passes cleanly. Zero remaining blockers. |

---

## 2. Requirement & Design Compliance

| Area | Requirement | Status | Evidence / Analysis |
|---|---|:---:|---|
| **Backend Comparator** | Available products precede depleted products before pagination across all 5 sorts | COMPLIANT | `CatalogQueryService.comparePublicProducts` prepends `availability = Number(isCatalogProductAvailable(right)) - Number(isCatalogProductAvailable(left))`. Sits before `page()` slicing. Tested across all 5 sorts in `catalog-query.service.spec.ts`. |
| **Secondary Order & Ties** | Existing sort criteria and canonical tie-breaker preserved within each availability partition | COMPLIANT | If `availability === 0`, falls through to sort criteria. Canonical tie-breaker `left.id.localeCompare(right.id)` present on every branch. |
| **Stock Projection** | `OUT_OF_STOCK` projects 0 regardless of stored quantity; `INFINITE` projects max int; vendible `TRACKED` variants (>0) project quantity | COMPLIANT | `toPublicStockNumber` uses `normalizeInventoryState`, returning 0 for `OUT_OF_STOCK` even with stale positive quantities (e.g. 999). Multi-variant products are available if any variant has positive vendible stock. `aggregateVariantStock` updated to use `toPublicStockNumber`. |
| **Card Action UI** | Replace "Comprar" with disabled native gray button "Sin stock", no hover elevation, no separate badge, WCAG contrast | COMPLIANT | `ProductCard.tsx` and `ProductBuyButton.tsx` render `<Button disabled>` with text "Sin stock", no cart icon, `disabled:bg-gray-200 disabled:text-gray-700` (contrast ratio 8.32:1 > 4.5:1), no hover transform/shadow on depleted cards, and no separate badge. |
| **Detail Link & Images** | Persist image detail link, render persisted media with subtle opacity attenuation | COMPLIANT | `<Link href={getProductHref(product.slug)}>` wraps image with accessible label. Renders persisted `<img>` with `opacity-80` when depleted and `group-hover:scale-[1.02]` when available; fallback to `ProductVisual` retained. |
| **Quick-Buy Isolation** | Quick buy cannot be triggered for depleted items; backend cannot be bypassed | COMPLIANT | `data-quick-buy-*` attributes omitted when `disabled=true`. Backend checkout line resolver rejects depleted items with 409 `OUT_OF_STOCK`. |
| **Persistence Boundaries** | Zero database writes, zero schema migrations, read-only operations | COMPLIANT | No Prisma migrations, no table changes. |
| **Build Prerender Flow** | Production build passes with uncached server-side catalog fetches | COMPLIANT | Next.js `DYNAMIC_SERVER_USAGE` signal propagates via `unstable_rethrow`, correctly classifying `/` as dynamic (`ƒ`) without masking real runtime API failures. |

---

## 3. Resolution of Findings

### Finding 1: Production Prerender Crash on Unhandled Catalog Error (RESOLVED)
- **Initial Classification:** WARNING (Blocked `npm run build`).
- **Diagnosis & Evidence:** The root cause was Next.js App Router framework control flow. Next.js throws an internal error with digest `DYNAMIC_SERVER_USAGE` when evaluating an uncached `fetch` (`cache: "no-store"`) during route prerendering. `FetchCatalogApiClient.get` and `CatalogApiRepository.failureOrEmpty` caught this error and re-wrapped it into `CatalogApiError: The catalog API is unavailable.`, preventing Next.js from detecting that the route should be dynamically rendered on demand.
- **Correction:** Invoked `unstable_rethrow(error)` from `next/navigation` at the entry of both catch blocks in `client.ts` and `catalog-api.repository.ts`. If the error is a Next.js internal control-flow signal, it is immediately re-thrown. Genuine transport errors (e.g. `TypeError` network failures, HTTP 503) are preserved and normalized into `CatalogApiError`, retaining strict error semantics without fake `[]` fallbacks.
- **Verification:**
  1. `npx tsx tests/harnesses/catalog-render-control-flow.harness.ts` confirmed:
     - Synthetic `DYNAMIC_SERVER_USAGE` errors propagate by identity across `FetchCatalogApiClient` and all 5 public repository read methods.
     - Synthetic network failures (`TypeError`) remain normalized into `CATALOG_API_UNAVAILABLE` with status 503 and `status: "error"`.
  2. `NEXT_PUBLIC_CATALOG_API_BASE_URL=http://127.0.0.1:3228/api/v1 npm run build` passed completely with zero errors, generating 23 static pages and designating `/` as dynamic (`ƒ`).
- **Status:** **RESOLVED**.

### Finding 2: Blanket Catch Masks Underlying Fetch Failure Reason (RESOLVED)
- **Initial Classification:** SUGGESTION.
- **Resolution:** Caught error is now analyzed via `unstable_rethrow(error)` before domain normalization, distinguishing framework control flow from real network failures.
- **Status:** **RESOLVED**.

---

## 4. Final Validation Summary

- **Catalog Unit Regressions:** 3 suites / 29 tests passed (`npm --prefix backend run test:unit -- catalog-query.service.spec catalog.mapper.spec public-listing.spec`).
- **Control Flow Harness:** Passed (`npx tsx tests/harnesses/catalog-render-control-flow.harness.ts`).
- **Frontend Acceptance Harnesses:** 16/16 harnesses passed (`npm run verify:frontend-acceptance`).
- **Static Type Check:** Passed with zero errors (`npx tsc --noEmit`).
- **Scoped Linter:** Passed with zero errors and zero warnings across all modified components, mappers, repositories, and harnesses.
- **Production Build:** Passed (`NEXT_PUBLIC_CATALOG_API_BASE_URL=http://127.0.0.1:3228/api/v1 npm run build`).
- **Runtime Readiness:** Active and verified:
  - Backend (`http://127.0.0.1:3228/api/v1/products`): 200 OK (649 products).
  - Storefront (`http://127.0.0.1:3300/`): 200 OK.
  - Admin login (`http://127.0.0.1:3300/admin/login`): 200 OK.
- **Database Safety:** Zero migrations, zero schema alterations, zero database writes.

---

## 5. Remaining Blockers

**NONE**. All functional, architectural, quality, and build criteria are met. The change is approved for delivery.
