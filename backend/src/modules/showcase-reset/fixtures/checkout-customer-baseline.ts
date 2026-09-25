import { createHash } from "node:crypto";

const CHECKOUT_PASSWORD_SALT_ROUNDS = 12;

interface CustomerAddressFixture {
  city: string;
  country: string;
  floorOrApartment?: string;
  neighborhood?: string;
  number: string;
  postalCode: string;
  provinceOrState: string;
  street: string;
}

interface CustomerFixture {
  address?: CustomerAddressFixture;
  dniOrCuil?: string;
  email: string;
  firstInteractionDate: Date;
  fullName: string;
  id: string;
  notes?: string;
  phone?: string;
  tags: readonly string[];
  userId?: string;
}

const CHECKOUT_FIXTURE_PASSWORD = process.env["CHECKOUT_FIXTURE_PASSWORD"] ?? "checkout_fixture_password_123";

const CHECKOUT_FIXTURE = {
  cartId: "checkout-seed-cart",
  cartItemId: "checkout-seed-cart-item",
  couponCode: "CHECKOUT-SEED-10",
  couponId: "checkout-seed-coupon",
  customerEmail: "checkout-customer@entrenar.test",
  customerId: "checkout-seed-customer",
  idempotencyId: "checkout-seed-idempotency",
  idempotencyKey: "checkout-seed-key",
  orderId: "checkout-seed-order",
  orderItemId: "checkout-seed-order-item",
  orderNumber: "EN-CHK-000001",
  paymentId: "checkout-seed-payment",
  sessionId: "checkout-seed-session",
  sessionToken: "checkout-seed-session-token",
} as const;

const CHECKOUT_PREREQUISITES = {
  cart: { id: CHECKOUT_FIXTURE.cartId, status: "ACTIVE" as const, userId: CHECKOUT_FIXTURE.customerId },
  cartItem: { cartId: CHECKOUT_FIXTURE.cartId, id: CHECKOUT_FIXTURE.cartItemId, productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" },
  session: {
    cartId: CHECKOUT_FIXTURE.cartId,
    id: CHECKOUT_FIXTURE.sessionId,
    recoveryStatus: "PENDING" as const,
    snapshotData: { items: [{ productId: "p-creatine", quantity: 1, variantId: "sin-sabor-300" }], total: 31200 },
    status: "ACTIVE" as const,
    tokenHash: hashShowcaseFixtureToken(CHECKOUT_FIXTURE.sessionToken),
    userId: CHECKOUT_FIXTURE.customerId,
  },
  user: { email: CHECKOUT_FIXTURE.customerEmail, firstName: "Checkout", id: CHECKOUT_FIXTURE.customerId, lastName: "Fixture", role: "CUSTOMER" as const },
} as const;

const INDEPENDENT_COUPON = {
  canCombineWithPromotions: false,
  code: CHECKOUT_FIXTURE.couponCode,
  customerLimitType: "UNLIMITED" as const,
  customerUsageLimit: null,
  dateLimitType: "UNLIMITED" as const,
  deletedAt: null,
  discountType: "PERCENTAGE" as const,
  discountValue: "10.00",
  endDate: null,
  id: CHECKOUT_FIXTURE.couponId,
  includeShippingCost: false,
  maxDiscountAmount: null,
  maxDiscountType: "NONE" as const,
  minimumCartAmount: "0.00",
  startDate: null,
  status: "ACTIVE" as const,
  targetType: "ALL_STORE" as const,
  totalUsageLimit: null,
  totalUsageLimitType: "UNLIMITED" as const,
  usageCount: 1,
} as const;

const CUSTOMER_SEEDS: readonly CustomerFixture[] = [
  { address: { city: "Buenos Aires", country: "Argentina", floorOrApartment: "3 B", number: "2845", postalCode: "1425", provinceOrState: "Buenos Aires", street: "Av. Santa Fe" }, dniOrCuil: "30123456", email: "camila.perez@example.com", firstInteractionDate: new Date("2026-06-10T00:00:00.000Z"), fullName: "Camila Pérez", id: "cus_001", notes: "Prefiere coordinar entregas por la tarde.", phone: "+54 11 4567-8901", tags: [] },
  { address: { city: "Córdoba", country: "Argentina", number: "450", postalCode: "5000", provinceOrState: "Córdoba", street: "Colón" }, email: "martin.suarez@example.com", firstInteractionDate: new Date("2026-06-11T00:00:00.000Z"), fullName: "Martín Suárez", id: "cus_002", notes: "Consulta promociones antes de cada compra.", phone: "+54 351 678-9012", tags: [] },
  { email: "sofia.ledesma@example.com", firstInteractionDate: new Date("2026-06-12T00:00:00.000Z"), fullName: "Sofía Ledesma", id: "cus_003", notes: "Cliente online, sin teléfono informado.", tags: [] },
  { address: { city: "Rosario", country: "Argentina", number: "1200", postalCode: "2000", provinceOrState: "Santa Fe", street: "San Martín" }, email: "valentina.acosta@example.com", firstInteractionDate: new Date("2026-05-30T00:00:00.000Z"), fullName: "Valentina Acosta", id: "cus_004", tags: [] },
  { email: "agustin.moreno@example.com", firstInteractionDate: new Date("2026-06-01T00:00:00.000Z"), fullName: "Agustín Moreno", id: "cus_005", phone: "+54 261 555-0120", tags: [] },
  { email: "rocio.fernandez@example.com", firstInteractionDate: new Date("2026-06-03T00:00:00.000Z"), fullName: "Rocío Fernández", id: "cus_006", tags: [] },
  { dniOrCuil: "30123456", email: "bounce@mock.com", firstInteractionDate: new Date("2026-06-13T00:00:00.000Z"), fullName: "Bounced Email", id: "cus_007", phone: "+54 379 522-3411", tags: [] },
  { address: { city: "Buenos Aires", country: "Argentina", number: "123", postalCode: "C1000", provinceOrState: "Buenos Aires", street: "Fixture Street" }, email: CHECKOUT_FIXTURE.customerEmail, firstInteractionDate: new Date("2026-08-31T00:00:00.000Z"), fullName: "Checkout Fixture", id: "cus_checkout_fixture", notes: "Repeatable customer fixture linked to the checkout seed order.", phone: "+54 11 5555-5555", tags: [], userId: CHECKOUT_FIXTURE.customerId },
] as const;

function hashShowcaseFixtureToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export {
  CHECKOUT_FIXTURE,
  CHECKOUT_FIXTURE_PASSWORD,
  CHECKOUT_PASSWORD_SALT_ROUNDS,
  CHECKOUT_PREREQUISITES,
  CUSTOMER_SEEDS,
  INDEPENDENT_COUPON,
  hashShowcaseFixtureToken,
};
export type { CustomerFixture };
