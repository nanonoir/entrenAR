import {
  CatalogVisibility,
  CouponDiscountType,
  OrderDeliveryType,
  OrderStatus,
  PaymentStatus,
  Role,
  StockMode,
} from "../../generated/prisma/enums";
import type { CheckoutBankTransferProjection, CheckoutPaymentMethodProjection } from "./checkout.mapper";
import {
  CHECKOUT_COUPON_RESULT,
  CHECKOUT_DELIVERY_TYPE,
} from "./checkout.constants";
import {
  CheckoutRepository,
  type CheckoutCartResolution,
  type CheckoutSessionRecord,
  type TransactionClient,
} from "./checkout.repository";
import { checkoutCompleteRequestSchema } from "./checkout.schemas";
import { CheckoutPaymentRules, type SelectedPayment } from "./checkout-payment.rules";
import { CheckoutSnapshotBuilder } from "./checkout-snapshot.builder";
import type { CheckoutCatalogProduct } from "../catalog/catalog.mapper";
import type { CouponRecord } from "../commerce/commerce.mapper";
import type { CommerceRepository } from "../commerce/commerce.repository";
import type { CheckoutActorContext, QuoteCalculation } from "./checkout-quote.service";
import type { ResolvedCheckoutLine } from "./checkout-line-resolver";

describe("CheckoutSnapshotBuilder", () => {
  it("builds exact JSON-safe historical customer, delivery, discount, item, and payment snapshots", async () => {
    const { builder, checkoutRepository } = createHarness();
    const transaction = {} as TransactionClient;
    const input = checkoutCompleteRequestSchema.parse({
      addressId: "address-1",
      customer: {
        dni: "20111111111",
        email: "input@example.test",
        firstName: "Checkout",
        lastName: "Buyer",
        phone: "+54 11 4000-0000",
      },
      idempotencyKey: "snapshot-key",
      items: [{ productId: "product-1", quantity: 2, variantId: "variant-1" }],
      paymentMethodId: "bank-transfer",
      paymentOptionId: "direct-transfer",
      shippingMethodId: "andreani:envío-a-domicilio",
    });
    const actor: CheckoutActorContext = { role: Role.CUSTOMER, userId: "customer-1" };
    const now = new Date("2026-09-01T12:34:56.000Z");

    const orderInput = await builder.createOrderInput(
      transaction,
      calculation(),
      resolution(),
      input,
      actor,
      now,
    );

    expect(orderInput).toEqual(expect.objectContaining({
      cartId: "cart-1",
      checkoutSessionId: "session-1",
      couponCode: "TEN-PERCENT",
      currency: "ARS",
      customerDni: "20999999999",
      customerEmail: "stored@example.test",
      customerFirstName: "Checkout",
      customerLastName: "Buyer",
      customerPhone: "+54 11 4999-9999",
      customerSnapshot: {
        dni: "20999999999",
        email: "stored@example.test",
        firstName: "Checkout",
        lastName: "Buyer",
        phone: "+54 11 4999-9999",
      },
      deliverySnapshot: {
        baseCost: 100,
        label: "Andreani home delivery",
        methodId: "andreani:envío-a-domicilio",
        modality: "home_delivery",
        providerId: "andreani",
        providerName: "Andreani",
        type: CHECKOUT_DELIVERY_TYPE.SHIPPING,
      },
      deliveryType: OrderDeliveryType.SHIPPING,
      discountAmount: 20,
      discountSnapshot: {
        automaticShippingDiscount: 10,
        couponCode: "TEN-PERCENT",
        couponDiscount: 25,
        couponId: "coupon-1",
        couponType: CouponDiscountType.PERCENTAGE,
        couponValue: 10,
        productDiscount: 20,
        shippingDiscount: 15,
      },
      shippingAddressSnapshot: {
        city: "Santa Fe",
        label: "Home",
        phone: "+54 342 400-0000",
        postalCode: "S2000",
        province: "Santa Fe",
        recipient: "Stored Buyer",
        street: "Stored Street",
      },
      shippingCost: 95,
      status: OrderStatus.PENDING,
      subtotal: 400,
      total: 475,
      userId: "customer-1",
    }));
    expect(orderInput.number).toMatch(/^EN-20260901-[A-F0-9]{8}$/);
    expect(orderInput.items).toEqual([{
      attributes: { flavor: "chocolate" },
      compareAtPrice: 220,
      lineSubtotal: 400,
      productId: "product-1",
      productName: "Snapshot product",
      quantity: 2,
      sku: "VARIANT-SKU",
      snapshot: {
        brand: "EntrenAR",
        effectivePrice: 200,
        name: "Snapshot product",
        variantId: "variant-1",
        variantName: "Chocolate",
        weightGrams: 300,
      },
      unitPrice: 200,
      variantId: "variant-1",
      variantName: "Chocolate",
      weightGrams: 300,
    }]);
    expect(orderInput.payment).toEqual({
      amount: 475,
      bankTransferSnapshot: {
        alias: "ENTRENAR.TEST",
        bankName: "Banco Test",
        cbuCvu: "0000000000000000000000",
        cuitCuil: "20-00000000-0",
        holderName: "EntrenAR Test",
      },
      currency: "ARS",
      paymentMethodId: "bank-transfer",
      paymentMethodSnapshot: {
        id: "bank-transfer",
        name: "Transferencia Bancaria",
        option: { fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" },
      },
      paymentOptionId: "direct-transfer",
      status: PaymentStatus.PENDING,
    });
    expect(orderInput.payment.bankTransferSnapshot).not.toHaveProperty("internalSecret");
    expect(JSON.parse(JSON.stringify(orderInput)) as unknown).toEqual(orderInput);
    expect(JSON.stringify(orderInput)).not.toContain("internal-secret");
    expect(checkoutRepository.userForCheckout).toHaveBeenCalledWith(transaction, "customer-1");
    expect(checkoutRepository.addressByOwner).toHaveBeenCalledWith(transaction, "customer-1", "address-1");
  });
});

interface SnapshotHarness {
  builder: CheckoutSnapshotBuilder;
  checkoutRepository: jest.Mocked<CheckoutRepository>;
}

function createHarness(): SnapshotHarness {
  const checkoutRepository = {
    addressByOwner: jest.fn().mockResolvedValue({
      city: "Santa Fe",
      id: "address-1",
      label: "Home",
      phone: "+54 342 400-0000",
      postalCode: "S2000",
      province: "Santa Fe",
      recipient: "Stored Buyer",
      street: "Stored Street",
    }),
    userForCheckout: jest.fn().mockResolvedValue({
      dni: "20999999999",
      email: "stored@example.test",
      firstName: "Stored",
      id: "customer-1",
      lastName: "Customer",
      phone: "+54 11 4999-9999",
      role: Role.CUSTOMER,
    }),
  } as unknown as jest.Mocked<CheckoutRepository>;
  const paymentRules = new CheckoutPaymentRules({} as CommerceRepository);

  return {
    builder: new CheckoutSnapshotBuilder(checkoutRepository, paymentRules),
    checkoutRepository,
  };
}

function calculation(): QuoteCalculation {
  const selectedPayment = payment();
  const line = resolvedLine();

  return {
    baseShipping: 100,
    coupon: {
      code: "TEN-PERCENT",
      discountAmount: 25,
      result: CHECKOUT_COUPON_RESULT.APPLIED,
    },
    couponCalculation: {
      productDiscount: 20,
      projection: {
        code: "TEN-PERCENT",
        discountAmount: 25,
        result: CHECKOUT_COUPON_RESULT.APPLIED,
      },
      record: {
        code: "TEN-PERCENT",
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: "10.00",
        id: "coupon-1",
      } as unknown as CouponRecord,
      shippingDiscount: 5,
      totalDiscount: 25,
    },
    currency: "ARS",
    delivery: {
      baseCost: 100,
      cost: 95,
      shippingOption: {
        cost: 100,
        id: "andreani:envío-a-domicilio",
        label: "Andreani home delivery",
        modality: "home_delivery",
        providerId: "andreani",
        providerName: "Andreani",
      },
      snapshot: {
        baseCost: 100,
        label: "Andreani home delivery",
        methodId: "andreani:envío-a-domicilio",
        modality: "home_delivery",
        providerId: "andreani",
        providerName: "Andreani",
        type: CHECKOUT_DELIVERY_TYPE.SHIPPING,
      },
      type: CHECKOUT_DELIVERY_TYPE.SHIPPING,
    },
    discount: 20,
    items: [],
    lines: [line],
    paymentMethods: [],
    pickupPoints: [],
    quoteId: "quote-1",
    selectedPayment,
    shipping: 95,
    shippingDiscount: 15,
    shippingOptions: [],
    subtotal: 400,
    total: 475,
    warnings: [],
  };
}

function payment(): SelectedPayment {
  const bankConfig = {
    alias: "ENTRENAR.TEST",
    bankName: "Banco Test",
    cbuCvu: "0000000000000000000000",
    cuitCuil: "20-00000000-0",
    holderName: "EntrenAR Test",
    internalSecret: "internal-secret",
  } as unknown as CheckoutBankTransferProjection;
  const method: CheckoutPaymentMethodProjection = {
    acceptedMethods: ["Transferencia bancaria"],
    bankConfig,
    description: "Bank transfer",
    id: "bank-transfer",
    logoSrc: "/transfer.svg",
    name: "Transferencia Bancaria",
    options: [{ fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" }],
    selectedOptionId: "direct-transfer",
  };

  return {
    method,
    option: { fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" },
  };
}

function resolvedLine(): ResolvedCheckoutLine {
  const product: CheckoutCatalogProduct = {
    brand: "EntrenAR",
    categoryIds: ["category-1"],
    compareAtPrice: 250,
    effectivePrice: 210,
    id: "product-1",
    missingLogistics: false,
    name: "Snapshot product",
    promotionalPrice: 210,
    salePrice: 250,
    shippingRequired: true,
    sku: "PRODUCT-SKU",
    variants: [{
      attributes: { flavor: "chocolate" },
      compareAtPrice: 220,
      id: "variant-1",
      isDefault: true,
      name: "Chocolate",
      price: 200,
      quantity: 4,
      sku: "VARIANT-SKU",
      stockMode: StockMode.TRACKED,
    }],
    visibility: CatalogVisibility.VISIBLE,
    weightGrams: 300,
  };

  return {
    availableQuantity: 4,
    cartItemId: "cart-item-1",
    compareAtPrice: 220,
    lineSubtotal: 400,
    product,
    quantity: 2,
    totalWeightGrams: 600,
    unitPrice: 200,
    variant: product.variants[0],
    weightGrams: 300,
  };
}

function resolution(): CheckoutCartResolution {
  return {
    cart: { id: "cart-1" } as CheckoutCartResolution["cart"],
    merged: false,
    ownerKey: "user:customer-1",
    session: { id: "session-1" } as CheckoutSessionRecord,
  } as CheckoutCartResolution;
}
