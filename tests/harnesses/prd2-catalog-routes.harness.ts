import { productBelongsToCategory } from "../../src/lib/category-membership";
import { isLegacyShakerRoute } from "../../src/lib/data/shop-routes";
import { getCategoryHref } from "../../src/lib/routes";

const multiCategory = { categorySlug: "proteinas", categorySlugs: ["proteinas", "performance", "control-de-peso"] };
const canonicalMembership = { categorySlug: "legacy-primary", categorySlugs: ["creatina", "performance"] };
const legacyMembership = { categorySlug: "control-de-peso" };
if (getCategoryHref("performance") !== "/suplementos/performance") throw new Error("Performance route mapping failed.");
if (getCategoryHref("control-de-peso") !== "/suplementos/control-de-peso") throw new Error("Control de peso route mapping failed.");
if (!productBelongsToCategory(multiCategory, "performance") || !productBelongsToCategory(multiCategory, "control-de-peso")) throw new Error("Multi-category membership projection failed.");
if (!productBelongsToCategory(canonicalMembership, "performance") || productBelongsToCategory(canonicalMembership, "legacy-primary")) throw new Error("Canonical memberships must take precedence over a stale primary category.");
if (!productBelongsToCategory(legacyMembership, "control-de-peso")) throw new Error("Legacy fixture primary-category fallback failed.");
if (!isLegacyShakerRoute(["suplementos", "proteinas", "shakers-y-botellas"]) || !isLegacyShakerRoute(["shakers-y-botellas"])) throw new Error("Obsolete shaker route detection failed.");
console.log("PRD2 catalog routes: performance, control-de-peso, and multi-category membership passed");
