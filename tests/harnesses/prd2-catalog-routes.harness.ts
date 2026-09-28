import { productBelongsToCategory } from "../../src/lib/category-membership";
import { getCategoryHref } from "../../src/lib/routes";

const multiCategory = { categorySlug: "proteinas", categorySlugs: ["proteinas", "performance", "control-de-peso"] };
if (getCategoryHref("performance") !== "/suplementos/performance") throw new Error("Performance route mapping failed.");
if (getCategoryHref("control-de-peso") !== "/suplementos/control-de-peso") throw new Error("Control de peso route mapping failed.");
if (!productBelongsToCategory(multiCategory, "performance") || !productBelongsToCategory(multiCategory, "control-de-peso")) throw new Error("Multi-category membership projection failed.");
console.log("PRD2 catalog routes: performance, control-de-peso, and multi-category membership passed");
