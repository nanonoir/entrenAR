import assert from "node:assert/strict";
import {
  getAppliedCouponCode,
  buildQuoteOptions,
  toSettledQuoteOptions,
} from "@/components/checkout/checkout-form.builders";
import { EMPTY_CHECKOUT_DESTINATION, type CheckoutDestination } from "@/components/checkout/checkout-destination";
import { CHECKOUT_COUPON_RESULT, type CheckoutQuote } from "@/lib/api/checkout/checkout.repository";

const exactDestination: CheckoutDestination = {
  ...EMPTY_CHECKOUT_DESTINATION,
  deliveryMethod: "home",
  shippingId: "andreani:home-standard",
  shippingProviderId: "andreani",
};
const exactOptions = buildQuoteOptions([], exactDestination);
assert.equal(exactOptions.shippingMethodId, "andreani:home-standard");
assert.equal(exactOptions.shippingProviderId, "andreani");

// The pre-migration provider card uses provider id in both fields. Keep this provider-only, never mislabel it as a service.
const legacyDestination: CheckoutDestination = {
  ...exactDestination,
  shippingId: "andreani",
};
const legacyOptions = buildQuoteOptions([], legacyDestination);
assert.equal(legacyOptions.shippingMethodId, undefined);
assert.equal(legacyOptions.shippingProviderId, "andreani");

const applied = { items: [], coupon: { code: "SAVE10", result: CHECKOUT_COUPON_RESULT.APPLIED } } as unknown as CheckoutQuote;
assert.equal(getAppliedCouponCode(applied), "SAVE10");
const settled = toSettledQuoteOptions({ ...exactOptions, couponCode: "SAVE10" }, applied);
assert.equal(settled.couponCode, "SAVE10");

const rejected = { items: [], coupon: { code: "BAD", result: CHECKOUT_COUPON_RESULT.REJECTED } } as unknown as CheckoutQuote;
assert.equal(getAppliedCouponCode(rejected), undefined);

console.log("checkout form builders harness: exact service identity, legacy provider adapter and applied coupon continuity passed");
