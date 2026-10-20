import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutSummary } from "../../src/components/checkout/CheckoutSummary";
import { getSummaryShippingDisplay } from "../../src/components/checkout/checkout-summary.shipping";

// Cart page (no checkout action, no quote): shipping is never derived from the subtotal, so it is never "Gratis".
const cartPage = renderToStaticMarkup(<CheckoutSummary subtotal={999999} />);
assert.ok(cartPage.includes("A calcular"), "Unresolved shipping must read 'A calcular'.");
assert.ok(!cartPage.includes("Gratis"), "Unresolved shipping must never read 'Gratis'.");
assert.ok(cartPage.includes("Total provisorio"), "The total is provisional while shipping is unresolved.");

// A zero-cost quote without a selected, valid service is pending, not free.
const unselected = getSummaryShippingDisplay({ quotedShipping: 0, refreshing: false, resolved: false });
assert.deepEqual(unselected, { final: false, label: "A calcular" });
assert.equal(getSummaryShippingDisplay({ quotedShipping: null, refreshing: false, resolved: true }).label, "A calcular");

// Only a selected valid service quoted at zero reads "Gratis".
assert.deepEqual(getSummaryShippingDisplay({ quotedShipping: 0, refreshing: false, resolved: true }), { final: true, label: "Gratis" });
const paid = getSummaryShippingDisplay({ quotedShipping: 12487, refreshing: false, resolved: true });
assert.ok(paid.final && paid.label !== "Gratis" && paid.label.includes("12.487"));

// A refreshing quote is neutral: never a stale price and never "Gratis".
const refreshing = getSummaryShippingDisplay({ quotedShipping: 0, refreshing: true, resolved: true });
assert.deepEqual(refreshing, { final: false, label: "Calculando…" });

console.log("checkout summary harness: passed pending, selected-free, unselected-free and refreshing shipping states");
