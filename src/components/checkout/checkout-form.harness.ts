import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkoutDestinationKey,
  hasSelection,
  isSelectionRejectionCode,
  selectionAllowed,
  selectionKey,
  toCheckoutDestination,
  withoutSelection,
  withSelectionRemoved,
} from "@/components/checkout/checkout-destination";
import { buildCompletionInput, buildQuoteOptions, getAppliedCouponCode, toSettledQuoteOptions } from "@/components/checkout/checkout-form.builders";
import {
  getCheckoutConfigurationIssue,
  getCouponOperationMessage,
  hasErrors,
  validateDelivery,
  validateDeliveryField,
  validateIdentification,
  validateIdentificationField,
  type DeliveryForm,
  type DeliverySelection,
  type IdentificationForm,
} from "@/components/checkout/checkout-form.validators";
import { formatShippingPrice, getPickupChoices, getShippingChoices } from "@/components/checkout/delivery-options.utils";
import { sanitizeFloorInput, sanitizeNeighborhoodInput, sanitizeStreetInput, sanitizeTextInput } from "@/lib/checkout-validation";
import { CHECKOUT_COUPON_RESULT, CHECKOUT_SHIPPING_MODALITY, type CheckoutQuote, type CheckoutShippingOption } from "@/lib/api/checkout/checkout.repository";
import { toCheckoutCompletePayload } from "@/lib/api/checkout/checkout-api.payloads";
import { resolveMockDelivery, mockPickupPoints, mockShippingOptions } from "@/lib/api/checkout/mock-checkout.rules";
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  CHECKOUT_DRAFT_TTL_MS,
  clearCheckoutDraft,
  createEmptyCheckoutDraftValues,
  getCheckoutDraftEpoch,
  readCheckoutDraft,
  writeCheckoutDraft,
} from "@/lib/checkout-draft";
import { loadProvinceLocalities, searchLocalities } from "@/lib/data/locations/localities";
import { CP4_PROVINCE_TABLE, CP4_PROVINCE_TABLE_STATS } from "@/lib/data/locations/cp4-province-table.generated";
import {
  CPA_LETTER_PROVINCE_IDS,
  getPostalCodeFormat,
  getPostalProvinceConflict,
  recognizeProvinceFromPostalCode,
  sanitizePostalCodeInput,
} from "@/lib/data/locations/postal-code";
import { CHECKOUT_PROVINCES } from "@/lib/data/locations/provinces";

const SNAPSHOT_ROOT = resolve(process.cwd(), "src/lib/data/locations/snapshots");

const identification: IdentificationForm = { dni: "12345678", email: "ana@example.com", firstName: "Ana", lastName: "Perez", phone: "1122334455" };
const delivery: DeliveryForm = {
  city: "Resistencia",
  floor: "",
  localityId: "1",
  localityMode: "",
  neighborhood: "",
  postalCode: "3500",
  provinceId: "22",
  recipient: "",
  street: "Mitre",
  streetNumber: "100",
};

function shippingOption(overrides: Partial<CheckoutShippingOption> & Pick<CheckoutShippingOption, "id" | "providerId">): CheckoutShippingOption {
  return {
    cost: 1000,
    label: "Servicio",
    modality: CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY,
    providerName: overrides.providerId,
    ...overrides,
  };
}

function quoteWith(options: CheckoutShippingOption[], shipping = 0): CheckoutQuote {
  return {
    currency: "ARS",
    discount: 0,
    items: [],
    ok: true,
    paymentMethods: [{
      acceptedMethods: [],
      description: "",
      id: "mercado-pago",
      logoSrc: "",
      name: "Mercado Pago",
      options: [{ fee: "0%", id: "mp", receiveIn: "", salesIn: "" }],
      selectedOptionId: "mp",
    }],
    pickupPoints: [],
    quoteId: "q1",
    shipping,
    shippingOptions: options,
    subtotal: 1000,
    total: 1000 + shipping,
    warnings: [],
  } as unknown as CheckoutQuote;
}

class MemoryStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

function validationSection(): void {
  // Field validators are the same rules used on blur, section Continue and final validation.
  assert.equal(validateIdentificationField("email", { ...identification, email: "ana" }), "Ingresá un correo válido.");
  assert.equal(validateIdentificationField("email", identification), undefined);
  assert.equal(validateDeliveryField("street", { ...delivery, street: "" }, "home"), "Ingresá la calle.");
  assert.equal(validateDeliveryField("street", { ...delivery, street: "" }, "pickup"), undefined, "Street is not required for pickup.");

  // Street names legitimately contain digits: they are neither stripped nor rejected.
  for (const street of ["9 de Julio", "Calle 50", "Ruta 2", "Av. Libertador", "25 de Mayo", "Avenida O'Higgins", "Calle 12 bis"]) {
    assert.equal(sanitizeStreetInput(street), street, `Typing "${street}" keeps digits.`);
    assert.equal(validateDeliveryField("street", { ...delivery, street }, "home"), undefined, `"${street}" is a valid street.`);
  }
  assert.equal(sanitizeStreetInput("Mitre<script>"), "Mitrescript", "Unsafe characters are removed from streets.");
  assert.ok(validateDeliveryField("street", { ...delivery, street: "1234" }, "home"), "A street needs at least one letter.");
  assert.ok(validateDeliveryField("street", { ...delivery, street: "x".repeat(201) }, "home"), "Street length follows the backend limit.");
  assert.equal(sanitizeStreetInput("y".repeat(300)).length, 200);
  assert.equal(sanitizeTextInput("Calle 50"), "Calle ", "Person-name fields still strip digits.");

  // Optional floor: validated against explicit limits, only for home delivery.
  for (const floor of ["", "3", "PB", "3° B", "Dto 4/5", "Piso 2 - Depto A"]) {
    assert.equal(validateDeliveryField("floor", { ...delivery, floor }, "home"), undefined, `Floor "${floor}" is valid.`);
  }
  assert.ok(validateDeliveryField("floor", { ...delivery, floor: "y".repeat(81) }, "home"), "Floor longer than 80 characters is rejected.");
  assert.ok(validateDeliveryField("floor", { ...delivery, floor: "3 <b>" }, "home"), "Floor with unsafe characters is rejected.");
  assert.equal(validateDeliveryField("floor", { ...delivery, floor: "y".repeat(81) }, "pickup"), undefined, "Floor is irrelevant for pickup.");
  assert.equal(sanitizeFloorInput("3 <b>"), "3 b");
  assert.equal(sanitizeFloorInput("z".repeat(120)).length, 80);
  assert.ok(validateDelivery({ ...delivery, floor: "y".repeat(81) }, { deliveryMethod: "home", selectedPickupPointId: null, selectedShippingId: "andreani:home" }).floor, "Final validation includes floor.");

  // Neighborhood is alphanumeric ("Barrio 31", "1-11-14"), optional and bounded; unsafe characters are removed/rejected.
  for (const neighborhood of ["", "Barrio 31", "1-11-14", "Villa Crespo"]) {
    assert.equal(sanitizeNeighborhoodInput(neighborhood), neighborhood, `Typing "${neighborhood}" keeps digits.`);
    assert.equal(validateDeliveryField("neighborhood", { ...delivery, neighborhood }, "home"), undefined, `Neighborhood "${neighborhood}" is valid.`);
  }
  assert.ok(validateDeliveryField("neighborhood", { ...delivery, neighborhood: "n".repeat(121) }, "home"), "Neighborhood longer than 120 characters is rejected.");
  assert.ok(validateDeliveryField("neighborhood", { ...delivery, neighborhood: "Barrio <b>" }, "home"), "Neighborhood with unsafe characters is rejected.");
  assert.equal(sanitizeNeighborhoodInput("n".repeat(200)).length, 120);

  // Floor and neighborhood travel as separate structured fields through completion and the API payload.
  const structured = buildCompletionInput({
    currentQuote: quoteWith([shippingOption({ id: "andreani:home", providerId: "andreani" })]),
    deliveryForm: { ...delivery, floor: " 3° B ", neighborhood: "Barrio 31", street: "9 de Julio" },
    destination: toCheckoutDestination({ city: delivery.city, postalCode: delivery.postalCode, provinceId: delivery.provinceId }, { deliveryMethod: "home", pickupPointId: null, shippingId: "andreani:home", shippingProviderId: "andreani" }),
    identificationForm: identification,
    paymentMethodId: "mercado-pago",
    paymentOptionId: "mp",
    sessionToken: null,
  });
  assert.equal(structured.address?.floor, "3° B");
  assert.equal(structured.address?.neighborhood, "Barrio 31");
  assert.equal(structured.address?.street, "9 de Julio", "Street is not merged with floor or neighborhood.");
  const noExtras = buildCompletionInput({
    currentQuote: quoteWith([shippingOption({ id: "andreani:home", providerId: "andreani" })]),
    deliveryForm: { ...delivery, floor: "", neighborhood: "  " },
    destination: toCheckoutDestination({ city: delivery.city, postalCode: delivery.postalCode, provinceId: delivery.provinceId }, { deliveryMethod: "home", pickupPointId: null, shippingId: "andreani:home", shippingProviderId: "andreani" }),
    identificationForm: identification,
    paymentMethodId: "mercado-pago",
    paymentOptionId: "mp",
    sessionToken: null,
  });
  assert.equal(noExtras.address?.floor, undefined, "Empty floor is omitted.");
  assert.equal(noExtras.address?.neighborhood, undefined, "Blank neighborhood is omitted.");

  const wireBase = { ...structured, idempotencyKey: "harness-key-1", items: [{ productId: "p1", quantity: 1 }], quoteId: undefined, sessionToken: undefined };
  const wire = toCheckoutCompletePayload(wireBase);
  assert.equal(wire.address?.floor, "3° B", "API payload keeps floor.");
  assert.equal(wire.address?.neighborhood, "Barrio 31", "API payload keeps neighborhood.");
  assert.equal(wire.address?.street, "9 de Julio");
  assert.throws(() => toCheckoutCompletePayload({ ...wireBase, address: { ...structured.address!, neighborhood: "<b>" } }), "Unsafe neighborhood is rejected before the request.");

  assert.equal(hasErrors(validateIdentification(identification)), false);
  assert.equal(Object.keys(validateIdentification({ ...identification, email: "", dni: "1" })).sort().join(), "dni,email");

  const home: DeliverySelection = { deliveryMethod: "home", selectedPickupPointId: null, selectedShippingId: "andreani:home" };
  assert.equal(hasErrors(validateDelivery(delivery, home)), false);
  assert.equal(validateDelivery(delivery, { ...home, selectedShippingId: null }).shipping, "Seleccioná una opción de envío.");
  assert.equal(validateDelivery(delivery, { deliveryMethod: null, selectedPickupPointId: null, selectedShippingId: null }).deliveryMethod, "Seleccioná una forma de entrega.");
  assert.equal(validateDelivery(delivery, { deliveryMethod: "pickup", selectedPickupPointId: null, selectedShippingId: null }).pickupPoint, "Seleccioná un punto de retiro.");
  assert.ok(validateDelivery({ ...delivery, city: "", localityMode: "manual" }, home).city?.includes("localidad"));
}

function postalSection(): void {
  assert.equal(sanitizePostalCodeInput("c1406 abc-9"), "C1406ABC");
  assert.equal(getPostalCodeFormat("1406"), "cp4");
  assert.equal(getPostalCodeFormat("C1406ABC"), "cpa");
  assert.equal(getPostalCodeFormat("14"), "invalid");
  assert.equal(getPostalCodeFormat(""), "empty");
  assert.equal(recognizeProvinceFromPostalCode("C1406ABC").provinceId, "02");
  assert.equal(recognizeProvinceFromPostalCode("B1900ABC").provinceId, "06");
  assert.equal(recognizeProvinceFromPostalCode("3400").provinceId, "18");
  assert.equal(recognizeProvinceFromPostalCode("1406").provinceId, "02", "CP4 1406 is CABA, not Buenos Aires province.");
  // Coverage comes from the GeoNames dump (single-province values only) plus explicit entries.
  assert.equal(recognizeProvinceFromPostalCode("5000").provinceId, "14", "Córdoba capital (GeoNames, single province).");
  assert.equal(recognizeProvinceFromPostalCode("5000").source, "cp4-table");
  assert.equal(recognizeProvinceFromPostalCode("4000").provinceId, "90", "San Miguel de Tucumán.");
  assert.equal(recognizeProvinceFromPostalCode("1900").provinceId, "06", "La Plata.");
  assert.equal(recognizeProvinceFromPostalCode("9000").provinceId, "26", "Comodoro Rivadavia.");
  assert.equal(recognizeProvinceFromPostalCode("8300").provinceId, "58", "Neuquén capital.");
  assert.equal(recognizeProvinceFromPostalCode("2000").provinceId, null, "Multi-province CP4 (Santa Fe/Entre Ríos in GeoNames) stays unknown.");
  assert.equal(recognizeProvinceFromPostalCode("4411").provinceId, null, "Multi-province CP4 (Salta/Jujuy) stays unknown.");
  assert.equal(recognizeProvinceFromPostalCode("1001").provinceId, null, "CABA codes absent from the sources are never guessed from ranges.");
  assert.equal(recognizeProvinceFromPostalCode("0000").provinceId, null);
  assert.equal(getPostalProvinceConflict("2000", "06"), null, "Unknown/ambiguous CP4 never blocks.");
  assert.equal(getPostalProvinceConflict("5000", "14"), null);
  assert.ok(getPostalProvinceConflict("5000", "06"), "A recognized CP4 contradicting the selected province is an error.");
  assert.equal(getPostalProvinceConflict("constructor", "06"), null, "Prototype keys are not table entries.");
  assert.equal(CP4_PROVINCE_TABLE_STATS.recognized, Object.keys(CP4_PROVINCE_TABLE).length);
  assert.ok(CP4_PROVINCE_TABLE_STATS.recognized > 1500, "Measured coverage: >1,500 single-province CP4 values.");
  assert.ok(Object.values(CP4_PROVINCE_TABLE).every((provinceId) => CHECKOUT_PROVINCES.some((province) => province.id === provinceId)), "Every table entry maps to a real province.");
  const letterByProvince = new Map(Object.entries(CPA_LETTER_PROVINCE_IDS).map(([letter, provinceId]) => [provinceId, letter]));
  assert.equal(letterByProvince.size, 24, "CPA letters cover all 24 provinces.");
  assert.ok(getPostalProvinceConflict("C1406ABC", "06"), "A CPA contradicting the province is an error.");
  assert.equal(getPostalProvinceConflict("C1406ABC", "02"), null);
  assert.ok(validateDeliveryField("postalCode", { ...delivery, postalCode: "C1406ABC", provinceId: "06" }, "home"));
}

function destinationSection(): void {
  const selection = { deliveryMethod: "home" as const, pickupPointId: null, shippingId: "andreani:home", shippingProviderId: "andreani" };
  const destination = toCheckoutDestination({ city: " Resistencia ", postalCode: "3500", provinceId: "22" }, selection);
  assert.equal(destination.city, "Resistencia");
  // An incomplete postal code is not a committed value.
  assert.equal(toCheckoutDestination({ city: "", postalCode: "35", provinceId: "22" }, selection).postalCode, "");

  const sameWithOtherFields = checkoutDestinationKey(toCheckoutDestination({ city: "Resistencia", postalCode: "3500", provinceId: "22" }, selection));
  assert.equal(checkoutDestinationKey(destination), sameWithOtherFields, "Dedupe key is a canonical projection.");

  const options = buildQuoteOptions([], destination);
  assert.equal(options.shippingMethodId, "andreani:home");
  assert.equal(options.shippingProviderId, "andreani");
  assert.equal(options.deliveryType, "shipping");
  assert.equal(options.province, "Chaco");
  const pickup = toCheckoutDestination({ city: "", postalCode: "3500", provinceId: "22" }, { ...selection, deliveryMethod: "pickup", pickupPointId: "p1" });
  assert.equal(buildQuoteOptions([], pickup).shippingMethodId, undefined, "Pickup never carries a shipping service.");
  assert.equal(buildQuoteOptions([], pickup).pickupPointId, "p1");
}

function couponAndLifecycleSection(): void {
  const selection = { deliveryMethod: "home" as const, pickupPointId: null, shippingId: "andreani:home", shippingProviderId: "andreani" };
  const destination = toCheckoutDestination({ city: "Resistencia", postalCode: "3500", provinceId: "22" }, selection);

  // Coupon requests carry the committed destination and the exact service id; nothing is inferred from costs.
  const couponOptions = buildQuoteOptions([], destination, "TEN");
  assert.equal(couponOptions.couponCode, "TEN");
  assert.equal(couponOptions.province, "Chaco");
  assert.equal(couponOptions.city, "Resistencia");
  assert.equal(couponOptions.postalCode, "3500");
  assert.equal(couponOptions.shippingMethodId, "andreani:home");
  assert.equal(couponOptions.shippingProviderId, "andreani");
  const pickupCoupon = buildQuoteOptions([], toCheckoutDestination({ city: "", postalCode: "3500", provinceId: "22" }, { ...selection, deliveryMethod: "pickup", pickupPointId: "p1" }), "TEN");
  assert.equal(pickupCoupon.pickupPointId, "p1");
  assert.equal(pickupCoupon.shippingMethodId, undefined);
  const cartCoupon = buildQuoteOptions([], toCheckoutDestination({ city: "", postalCode: "", provinceId: "" }, { ...selection, deliveryMethod: null }), "TEN");
  assert.equal(cartCoupon.shippingMethodId, undefined, "A cart-level coupon never invents a service.");
  assert.equal(buildQuoteOptions([], destination).couponCode, undefined);

  const applied = { ...quoteWith([shippingOption({ id: "andreani:home", providerId: "andreani" })]), coupon: { code: "TEN", discountAmount: 100, result: CHECKOUT_COUPON_RESULT.APPLIED } } as CheckoutQuote;
  const rejected = { ...applied, coupon: { discountAmount: 0, message: "No", result: CHECKOUT_COUPON_RESULT.REJECTED } } as CheckoutQuote;
  assert.equal(getAppliedCouponCode(applied), "TEN");
  assert.equal(getAppliedCouponCode(rejected), undefined, "A rejected coupon is never carried forward.");
  assert.equal(getAppliedCouponCode(null), undefined);
  assert.equal(buildCompletionInput({
    currentQuote: applied,
    deliveryForm: delivery,
    destination,
    identificationForm: identification,
    paymentMethodId: "mercado-pago",
    paymentOptionId: "mp",
    sessionToken: null,
  }).couponCode, "TEN", "Completion carries the coupon of the confirmed quote.");

  // A known coupon error code never surfaces the backend's English message; unknown codes keep theirs.
  const englishCouponMessage = "The coupon is not valid for this checkout.";
  const couponMessage = getCouponOperationMessage({ code: "COUPON_NOT_VALID", message: englishCouponMessage });
  assert.equal(couponMessage, "El cupón no es válido para este pedido.");
  assert.notEqual(couponMessage, englishCouponMessage);
  assert.equal(getCouponOperationMessage({ code: "SOMETHING_ELSE", message: "Fallback" }), "Fallback");

  // Settled fingerprint equals what the lifecycle would request next: no redundant follow-up quote.
  const sent = buildQuoteOptions([], destination, "TEN");
  assert.equal(JSON.stringify(toSettledQuoteOptions(sent, applied)), JSON.stringify({ ...buildQuoteOptions([], destination, "TEN"), items: [] }));
  assert.equal(JSON.stringify(toSettledQuoteOptions(sent, rejected)), JSON.stringify({ ...buildQuoteOptions([], destination), items: [] }), "A rejected coupon settles without the coupon.");

  // Restored selection intent travels first; a refused selection falls back once and is not re-sent in a loop.
  assert.equal(hasSelection(buildQuoteOptions([], destination)), true);
  assert.equal(hasSelection(withSelectionRemoved(buildQuoteOptions([], destination))), false);
  assert.equal(JSON.stringify(withSelectionRemoved(buildQuoteOptions([], destination, "TEN"))), JSON.stringify(buildQuoteOptions([], withoutSelection(destination), "TEN")), "Fallback request equals the plain listing request.");
  assert.equal(selectionAllowed(destination, null).shippingId, "andreani:home", "Intent is sent first.");
  const rejectedKey = selectionKey(destination);
  assert.equal(selectionAllowed(destination, rejectedKey).shippingId, null, "A refused selection is not re-sent.");
  const otherLocation = toCheckoutDestination({ city: "Corrientes", postalCode: "3400", provinceId: "18" }, selection);
  assert.equal(selectionAllowed(otherLocation, rejectedKey).shippingId, "andreani:home", "A new location retries the intent.");
  assert.equal(selectionAllowed({ ...destination, shippingId: "andreani:other" }, rejectedKey).shippingId, "andreani:other", "A new selection retries the intent.");
  assert.equal(isSelectionRejectionCode("SHIPPING_OPTION_UNAVAILABLE"), true);
  assert.equal(isSelectionRejectionCode("VALIDATION_ERROR"), false);
  assert.equal(isSelectionRejectionCode(undefined), false);
}

function shippingSection(): void {
  // Only a confirmed quoted zero renders "Gratis"; positive prices keep currency formatting.
  assert.equal(formatShippingPrice(0), "Gratis");
  assert.notEqual(formatShippingPrice(1500), "Gratis");
  assert.ok(formatShippingPrice(1500).includes("1.500") || formatShippingPrice(1500).includes("1500"));
  const zeroQuote = quoteWith([shippingOption({ cost: 0, id: "andreani:free", providerId: "andreani" })]);
  assert.equal(getShippingChoices(zeroQuote)[0]?.price, 0);
  assert.deepEqual(getShippingChoices(null), [], "Without a quote there are no rows, so no fallback zero can show Gratis.");

  const options = [
    shippingOption({ id: "andreani:envio-a-domicilio", modality: CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY, providerId: "andreani", providerName: "Andreani a domicilio" }),
    shippingOption({ id: "correo-argentino:domicilio", providerId: "correo-argentino", providerName: "Correo Argentino" }),
    shippingOption({ id: "correo-argentino:sucursal", modality: CHECKOUT_SHIPPING_MODALITY.BRANCH_DELIVERY, providerId: "correo-argentino" }),
  ];
  const quote = quoteWith(options);
  const choices = getShippingChoices(quote);
  assert.deepEqual(choices.map((choice) => choice.id), ["andreani:envio-a-domicilio", "correo-argentino:domicilio"], "Home delivery lists only home_delivery services.");
  assert.equal(choices[0]?.carrierName, "Andreani");
  assert.equal(choices[1]?.carrierName, "Correo Argentino");
  assert.equal(choices[1]?.logoSrc, "/correoArgentino.svg");
  assert.deepEqual(getShippingChoices(null), [], "No mock carrier fallback without a quote.");
  assert.deepEqual(getPickupChoices(null), []);

  // Identity is the exact service id: a provider id (or a branch service) is not a valid home selection.
  assert.equal(getCheckoutConfigurationIssue(quote, "home", "andreani:envio-a-domicilio", null, "mercado-pago"), null);
  assert.ok(getCheckoutConfigurationIssue(quote, "home", "andreani", null, "mercado-pago"));
  assert.ok(getCheckoutConfigurationIssue(quote, "home", "correo-argentino:sucursal", null, "mercado-pago"));
  assert.ok(getCheckoutConfigurationIssue(quote, "home", null, null, "mercado-pago"));
}

function mockSection(): void {
  const shippingOptions = mockShippingOptions();
  const home = shippingOptions.find((option) => option.modality === CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY);
  const branch = shippingOptions.find((option) => option.modality !== CHECKOUT_SHIPPING_MODALITY.HOME_DELIVERY);
  assert.ok(home && branch);
  assert.deepEqual(getShippingChoices(quoteWith(shippingOptions)).map((choice) => choice.id), [home.id], "Mock mode lists home services only.");
  const pickupPoints = mockPickupPoints({ items: [], postalCode: "1406", province: "Ciudad Autónoma de Buenos Aires" });
  assert.ok(pickupPoints.length > 0, "CP 1406 mock pickup points resolve for CABA.");
  assert.doesNotThrow(() => resolveMockDelivery({ deliveryType: "shipping", items: [], shippingMethodId: home.id }, shippingOptions, pickupPoints));
  assert.throws(() => resolveMockDelivery({ deliveryType: "shipping", items: [], shippingMethodId: branch.id }, shippingOptions, pickupPoints));
  assert.throws(() => resolveMockDelivery({ deliveryType: "shipping", items: [], shippingProviderId: branch.providerId }, shippingOptions, pickupPoints), "Provider-only selection must not resolve a branch service for home delivery.");
}

function draftSection(): void {
  const storage = new MemoryStorage();
  const now = 1_000_000;
  const values = { ...createEmptyCheckoutDraftValues(), email: "ana@example.com", postalCode: "3500" };

  assert.equal(writeCheckoutDraft(createEmptyCheckoutDraftValues(), { now, storage }), false, "Empty values never overwrite a draft.");
  assert.equal(writeCheckoutDraft(values, { now, storage }), true);
  const stored = JSON.parse(storage.getItem(CHECKOUT_DRAFT_STORAGE_KEY) ?? "{}") as { createdAt: number; expiresAt: number; values: Record<string, string>; version: number };
  assert.equal(stored.version, 1);
  assert.equal(stored.expiresAt - stored.createdAt, CHECKOUT_DRAFT_TTL_MS);
  assert.equal(writeCheckoutDraft(createEmptyCheckoutDraftValues(), { now: now + 10, storage }), false);
  assert.equal(readCheckoutDraft(now + 10, storage)?.email, "ana@example.com");

  // Expiry runs from creation and is not extended by later writes.
  writeCheckoutDraft({ ...values, street: "Mitre" }, { now: now + CHECKOUT_DRAFT_TTL_MS - 1, storage });
  assert.equal(readCheckoutDraft(now + CHECKOUT_DRAFT_TTL_MS - 1, storage)?.street, "Mitre");
  assert.equal(readCheckoutDraft(now + CHECKOUT_DRAFT_TTL_MS, storage), null, "Expired drafts are discarded.");
  assert.equal(storage.getItem(CHECKOUT_DRAFT_STORAGE_KEY), null);

  // Allowlist only: unknown keys make the shape unusable instead of being persisted.
  storage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ createdAt: now, expiresAt: now + 1000, values: { ...values, token: "secret" }, version: 1 }));
  const sanitized = readCheckoutDraft(now, storage);
  assert.ok(sanitized && !("token" in sanitized));

  storage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, "{not json");
  assert.equal(readCheckoutDraft(now, storage), null, "Corrupt data degrades safely.");
  assert.equal(storage.getItem(CHECKOUT_DRAFT_STORAGE_KEY), null);
  storage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ createdAt: now, expiresAt: now + 1000, values, version: 99 }));
  assert.equal(readCheckoutDraft(now, storage), null, "Unknown versions are ignored.");

  const failing = { getItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
  assert.equal(readCheckoutDraft(now, failing), null);
  assert.equal(writeCheckoutDraft(values, { now, storage: failing }), false);
  assert.doesNotThrow(() => clearCheckoutDraft(failing));
  assert.equal(writeCheckoutDraft(values, { now, storage: null }), false, "No storage means in-memory only.");

  // A clear invalidates writes scheduled before it, even with no wizard mounted.
  const epoch = getCheckoutDraftEpoch();
  const fresh = new MemoryStorage();
  clearCheckoutDraft(fresh);
  assert.ok(getCheckoutDraftEpoch() > epoch);
  assert.equal(writeCheckoutDraft(values, { epoch, now, storage: fresh }), false, "Delayed writers must not recreate a cleared draft.");
  assert.equal(writeCheckoutDraft(values, { epoch: getCheckoutDraftEpoch(), now, storage: fresh }), true);
}

async function locationSection(): Promise<void> {
  const manifest = JSON.parse(readFileSync(resolve(SNAPSHOT_ROOT, "manifest.json"), "utf8")) as {
    apiVersion: string;
    localityTotal: number;
    provinces: { checksum: string; id: string; localities: number }[];
  };
  assert.equal(manifest.apiVersion, "georef-v2.1");
  assert.equal(CHECKOUT_PROVINCES.length, 24);
  assert.equal(manifest.provinces.length, 24);
  assert.equal(CHECKOUT_PROVINCES.find((province) => province.id === "94")?.name, "Tierra del Fuego");

  let total = 0;
  for (const entry of manifest.provinces) {
    const raw = readFileSync(resolve(SNAPSHOT_ROOT, "localities", `${entry.id}.json`), "utf8").replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(raw).digest("hex"), entry.checksum, `Snapshot ${entry.id} matches its manifest checksum.`);
    const localities = await loadProvinceLocalities(entry.id);
    assert.equal(localities.length, entry.localities, `Snapshot ${entry.id} locality count.`);
    assert.ok(localities.every((locality) => locality.id.startsWith(entry.id)), `Localities of ${entry.id} belong to their province.`);
    total += localities.length;
  }
  assert.equal(total, manifest.localityTotal);

  const caba = await loadProvinceLocalities("02");
  assert.ok(searchLocalities(caba, "caballito").length > 0 || caba.length > 0);
  assert.deepEqual(await loadProvinceLocalities("99"), [], "Unknown provinces yield no localities.");
}

async function run(): Promise<void> {
  validationSection();
  postalSection();
  destinationSection();
  couponAndLifecycleSection();
  shippingSection();
  mockSection();
  draftSection();
  await locationSection();
  console.log("checkout form harness: passed validation, postal, destination, shipping identity, mock rules, draft and geographic snapshots");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
