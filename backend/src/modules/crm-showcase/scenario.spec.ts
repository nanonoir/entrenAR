import { OrderDeliveryType, OrderShippingStatus, OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import { buildTimeline, catalogStructure, customerInput } from "./historical-writer";
import { assembleScenario, digest, SHOWCASE_COUNTS, SHOWCASE_NAMESPACE } from "./scenario";
import { assertBaselinePrerequisites, assertCompletionMarker, type Baseline } from "./crm-showcase.service";
import { resolveStatisticsWindows } from "../statistics/statistics.service";
import { STATISTICS_PERIOD } from "../statistics/statistics.schemas";

const input = { seed: "review-demo", referenceDate: new Date("2026-10-09T15:00:00.000Z") };
describe("CRM showcase deterministic historical scenario", () => {
  it("reproduces IDs, distribution and money-independent structure without wall clock/query order", () => {
    const a = assembleScenario(input), b = assembleScenario({ ...input, referenceDate: new Date(input.referenceDate) });
    expect(digest(a.orders)).toBe(digest(b.orders));
    expect(a.id("order", 1)).toBe(b.id("order", 1));
    expect(a.id("order", 1)).not.toBe(a.id("movement", 1));
    expect(a.id("order", 1)).not.toBe(assembleScenario({ ...input, seed: "other" }).id("order", 1));
    expect(a.id("order", 1)).toMatch(/^crm-showcase:[a-f0-9]{64}$/);
    expect(new Set(a.orders.map((order) => a.id("order", order.index))).size).toBe(SHOWCASE_COUNTS.orders);
    expect(a.orders.every((order) => order.createdAt <= input.referenceDate && order.createdAt.getTime() >= input.referenceDate.getTime() - 60 * 86_400_000)).toBe(true);
    expect(a.orders.find((order) => order.index === 0)?.createdAt).toEqual(input.referenceDate);
    expect(digest({ b: 2, a: 1 })).toBe(digest({ a: 1, b: 2 }));
  });
  it("covers only state-machine-valid states, explicit paid/refunded payments and compensations", () => {
    const scenario = assembleScenario(input);
    const timelines = scenario.orders.map((order) => buildTimeline(scenario, order, order.index % 7 === 0 ? OrderDeliveryType.PICKUP : OrderDeliveryType.SHIPPING));
    expect(new Set(timelines.map((item) => item.state.status))).toEqual(new Set(Object.values(OrderStatus)));
    expect(new Set(timelines.map((item) => item.paymentStatus))).toEqual(new Set(Object.values(PaymentStatus)));
    expect(new Set(timelines.map((item) => item.state.shippingStatus))).toEqual(new Set(Object.values(OrderShippingStatus)));
    expect(timelines.filter((item) => item.restore).every((item) => item.state.status === OrderStatus.CANCELLED && item.paymentStatus === PaymentStatus.REFUNDED)).toBe(true);
    expect(timelines.flatMap((item) => item.history).every((event) => event.createdAt instanceof Date && event.createdAt <= input.referenceDate)).toBe(true);
    const today = timelines[scenario.orders.findIndex((order) => order.index === 0)]!;
    expect(today.paymentStatus).toBe(PaymentStatus.PAID);
    expect(today.state.status).toBe(OrderStatus.CONFIRMED);
    for (let index = 0; index < SHOWCASE_COUNTS.customers; index++) {
      expect(scenario.orders.some((order, position) => order.customerIndex === index && timelines[position]!.paymentStatus === PaymentStatus.PAID && timelines[position]!.state.status !== OrderStatus.CANCELLED)).toBe(true);
    }
  });
  it("uses clearly synthetic contacts that pass real checkout customer schemas", () => {
    for (let index = 0; index < SHOWCASE_COUNTS.customers; index++) {
      const customer = customerInput(index);
      expect(customer.email).toMatch(/@example.invalid$/);
      expect(customer.phone).toMatch(/^000-000-/);
      expect(customer.dni).toMatch(/^000000\d{2}$/);
    }
  });
  it("qualifies paid non-cancelled activity in the existing today/week/30-day windows", () => {
    const scenario = assembleScenario(input);
    for (const period of [STATISTICS_PERIOD.TODAY, STATISTICS_PERIOD.CURRENT_WEEK, STATISTICS_PERIOD.LAST_30_DAYS]) {
      const window = resolveStatisticsWindows({ period }, input.referenceDate).current;
      expect(scenario.orders.some((order) => {
        const timeline = buildTimeline(scenario, order, OrderDeliveryType.SHIPPING);
        return order.createdAt >= window.from && order.createdAt <= window.to && timeline.paymentStatus === PaymentStatus.PAID && timeline.state.status !== OrderStatus.CANCELLED;
      })).toBe(true);
    }
  });
  it("catalog comparison permits only flags and quantities, not modes, timestamps or prices", () => {
    const baseline = { Product: [{ id: "p", price: 10, updatedAt: "time", isFeatured: false, isBestSeller: false }], ProductVariant: [{ id: "v", quantity: 2, stockMode: "TRACKED" }] };
    const allowed = { Product: [{ ...baseline.Product[0], isFeatured: true }], ProductVariant: [{ ...baseline.ProductVariant[0], quantity: 1 }] };
    expect(digest(catalogStructure(baseline))).toBe(digest(catalogStructure(allowed)));
    expect(digest(catalogStructure(baseline))).not.toBe(digest(catalogStructure({ ...allowed, ProductVariant: [{ ...allowed.ProductVariant[0], stockMode: "INFINITE" }] })));
  });
});

describe("CRM showcase durable marker and prerequisites", () => {
  const marker = { orderId: assembleScenario(input).id("order", 0), type: "NOTE_ADDED", title: "CRM showcase simulation complete", createdAt: input.referenceDate, metadata: { complete: true, version: "1", seed: input.seed, referenceInstant: input.referenceDate.toISOString(), baselineDigest: "a".repeat(64), manifestDigest: "b".repeat(64), counts: SHOWCASE_COUNTS, initialBalances: { variant: 20 } } };
  it("accepts completion evidence independently of current stock/status/counters", () => { expect(() => assertCompletionMarker(marker)).not.toThrow(); });
  it.each([{ ...marker, metadata: {} }, { ...marker, type: "ORDER_CREATED" }, { ...marker, orderId: "ordinary-order" }, { ...marker, metadata: { ...marker.metadata, complete: false } }, { ...marker, metadata: { ...marker.metadata, counts: {} } }])("rejects malformed completion evidence without repair", (value) => { expect(() => assertCompletionMarker(value)).toThrow("Malformed"); });
  const baseline: Baseline = { Product: [{ id: "imported" }], ProductVariant: [{ id: "variant" }], ProductImage: [{ id: "image" }], ProductCategory: [{ productId: "imported" }], PaymentMethodConfig: [{ status: "ACTIVE" }], ShippingProvider: [{ status: "ACTIVE" }], PickupPoint: [{ status: "ACTIVE" }] };
  it("accepts an empty commercial baseline with imported catalog and active config", () => { expect(() => assertBaselinePrerequisites(baseline)).not.toThrow(); });
  it("rejects partial namespace, case-insensitive human identifiers, unrelated commerce and personal data", () => {
    const patches: Baseline[] = [{ Customer: [{ id: `${SHOWCASE_NAMESPACE}partial` }] }, { Coupon: [{ code: "crm-demo-coupon-1" }] }, { Order: [{ id: "ordinary" }] }, { User: [{ role: "ADMIN", email: "person@real.invalid" }] }, { RefreshToken: [{ id: "session" }] }];
    for (const patch of patches) expect(() => assertBaselinePrerequisites({ ...baseline, ...patch })).toThrow();
  });
  it("does not repair inadequate payment or delivery configuration", () => { expect(() => assertBaselinePrerequisites({ ...baseline, PaymentMethodConfig: [{ status: "INACTIVE" }] })).toThrow("outside scope"); });
});
