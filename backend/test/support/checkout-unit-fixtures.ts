import { Prisma } from "../../src/generated/prisma/client";
import {
  CartStatus,
  CatalogVisibility,
  CouponCustomerLimitType,
  CouponDateLimitType,
  CouponDiscountType,
  CouponMaxDiscountType,
  CouponStatus,
  CouponTargetType,
  CouponUsageLimitType,
  OrderStatus,
  PaymentMethodStatus,
  Role,
  ShippingDiscountTargetType,
  ShippingProviderStatus,
  ShippingZoneTargetType,
  StockMode,
} from "../../src/generated/prisma/enums";
import type { CheckoutCatalogProduct } from "../../src/modules/catalog/catalog.mapper";
import { CatalogRepository } from "../../src/modules/catalog/catalog.repository";
import type {
  CouponRecord,
  PaymentMethodRecord,
  ShippingDiscountRecord,
  ShippingProviderRecord,
} from "../../src/modules/commerce/commerce.mapper";
import { CommerceRepository } from "../../src/modules/commerce/commerce.repository";
import {
  CheckoutRepository,
  type CheckoutCartRecord,
  type CheckoutOrderRecord,
  type CheckoutSessionRecord,
  type TransactionClient,
} from "../../src/modules/checkout/checkout.repository";
import { CheckoutService, type CheckoutActorContext } from "../../src/modules/checkout/checkout.service";

export interface CheckoutUnitHarness {
  catalogRepository: jest.Mocked<CatalogRepository>;
  checkoutRepository: jest.Mocked<CheckoutRepository>;
  commerceRepository: jest.Mocked<CommerceRepository>;
  customerActor: CheckoutActorContext;
  session: CheckoutSessionRecord;
  service: CheckoutService;
}

export function createCheckoutUnitHarness(): CheckoutUnitHarness {
  const transaction = {} as TransactionClient;
  const cart = checkoutUnitCartRecord();
  const session = checkoutUnitSessionRecord();
  const checkoutRepository = {
    addressByOwner: jest.fn(),
    claimIdempotency: jest.fn(),
    clearCart: jest.fn(),
    completeIdempotency: jest.fn(),
    completeSession: jest.fn(),
    createCouponRedemption: jest.fn(),
    createPendingOrder: jest.fn(),
    deductStockForCheckout: jest.fn(),
    idempotencyByOwnerAndKey: jest.fn(),
    incrementCouponUsage: jest.fn(),
    lockCoupon: jest.fn(),
    replaceCartItems: jest.fn(),
    resolveCart: jest.fn(),
    sessionByToken: jest.fn(),
    stockTargetForCheckout: jest.fn(),
    transaction: jest.fn(),
    updateSessionSnapshot: jest.fn(),
    userForCheckout: jest.fn(),
  } as unknown as jest.Mocked<CheckoutRepository>;
  checkoutRepository.transaction.mockImplementation(async (callback) => callback(transaction));
  checkoutRepository.resolveCart.mockResolvedValue({ merged: false, cart, ownerKey: "user:customer-1", session, sessionToken: "checkout-session-token-1" });
  checkoutRepository.replaceCartItems.mockImplementation(async (_transaction, cartId, items) => ({
    ...cart,
    id: cartId,
    items: items.map((item, index) => ({
      cartId,
      createdAt: cart.createdAt,
      id: cart.items[index]?.id ?? `cart-item-${index + 1}`,
      productId: item.productId,
      quantity: item.quantity,
      updatedAt: cart.updatedAt,
      variantId: item.variantId ?? null,
    })),
  }));
  checkoutRepository.updateSessionSnapshot.mockImplementation(async (_transaction, _sessionId, snapshotData) => {
    session.snapshotData = snapshotData as Prisma.JsonValue;
  });
  checkoutRepository.idempotencyByOwnerAndKey.mockResolvedValue(null);
  checkoutRepository.claimIdempotency.mockResolvedValue({
    created: true,
    record: {
      completedAt: null,
      id: "idempotency-1",
      idempotencyKey: "checkout-complete-key",
      orderId: null,
      ownerKey: "user:customer-1",
      requestHash: "request-hash",
      responseSnapshot: null,
      status: "PENDING",
    },
  });
  checkoutRepository.stockTargetForCheckout.mockResolvedValue({
    kind: "variant",
    productId: "product-1",
    quantity: 5,
    stockMode: StockMode.TRACKED,
    variantId: "variant-1",
  });
  checkoutRepository.deductStockForCheckout.mockResolvedValue({
    remainingQuantity: 4,
    status: "deducted",
    target: {
      kind: "variant",
      productId: "product-1",
      quantity: 4,
      stockMode: StockMode.TRACKED,
      variantId: "variant-1",
    },
  });
  checkoutRepository.incrementCouponUsage.mockResolvedValue(true);
  checkoutRepository.createCouponRedemption.mockResolvedValue();
  checkoutRepository.clearCart.mockResolvedValue();
  checkoutRepository.completeSession.mockResolvedValue();
  checkoutRepository.completeIdempotency.mockResolvedValue({
    completedAt: new Date(),
    id: "idempotency-1",
    idempotencyKey: "checkout-complete-key",
    orderId: "order-1",
    ownerKey: "user:customer-1",
    requestHash: "request-hash",
    responseSnapshot: null,
    status: "COMPLETED",
  });
  checkoutRepository.userForCheckout.mockResolvedValue({
    dni: null,
    email: "customer@example.test",
    firstName: "Stored",
    id: "customer-1",
    lastName: "Customer",
    phone: null,
    role: Role.CUSTOMER,
  });
  checkoutRepository.createPendingOrder.mockResolvedValue(checkoutUnitOrderRecord());

  const catalogRepository = {
    checkoutProductById: jest.fn().mockResolvedValue(checkoutUnitCatalogProduct()),
    checkoutProductByIdForUpdate: jest.fn().mockResolvedValue(checkoutUnitCatalogProduct()),
    publicCheckoutCategoryIds: jest.fn().mockResolvedValue(new Set(["category-1"])),
  } as unknown as jest.Mocked<CatalogRepository>;
  const commerceRepository = {
    checkoutCouponByCode: jest.fn().mockResolvedValue(null),
    checkoutPaymentMethods: jest.fn().mockResolvedValue([checkoutUnitPaymentMethodRecord()]),
    checkoutPickupPoints: jest.fn().mockResolvedValue([]),
    checkoutShippingDiscounts: jest.fn().mockResolvedValue([]),
    checkoutShippingProviders: jest.fn().mockResolvedValue([checkoutUnitShippingProviderRecord()]),
  } as unknown as jest.Mocked<CommerceRepository>;
  const service = new CheckoutService(checkoutRepository, catalogRepository, commerceRepository);

  return {
    catalogRepository,
    checkoutRepository,
    commerceRepository,
    customerActor: { role: Role.CUSTOMER, userId: "customer-1" },
    session,
    service,
  };
}

function checkoutUnitCartRecord(): CheckoutCartRecord {
  const now = new Date();
  return {
    createdAt: now,
    id: "cart-1",
    items: [{ cartId: "cart-1", createdAt: now, id: "cart-item-1", productId: "product-1", quantity: 1, updatedAt: now, variantId: "variant-1" }],
    status: CartStatus.ACTIVE,
    updatedAt: now,
    userId: "customer-1",
  };
}

function checkoutUnitSessionRecord(): CheckoutSessionRecord {
  const now = new Date();
  return {
    abandonedAt: null,
    cartId: "cart-1",
    completedAt: null,
    createdAt: now,
    expiresAt: null,
    id: "session-1",
    lastActivityAt: now,
    lastEmailSentAt: null,
    recoveryStatus: "PENDING",
    snapshotData: {},
    status: "ACTIVE",
    tokenHash: "hash",
    updatedAt: now,
    userId: "customer-1",
  };
}

function checkoutUnitOrderRecord(): CheckoutOrderRecord {
  return {
    currency: "ARS",
    id: "order-1",
    number: "EN-ORDER-1",
    status: OrderStatus.PENDING,
    total: "175",
  } as unknown as CheckoutOrderRecord;
}

export function checkoutUnitCatalogProduct(): CheckoutCatalogProduct {
  return {
    brand: "EntrenAR",
    categoryIds: ["category-1"],
    compareAtPrice: 100,
    effectivePrice: 80,
    id: "product-1",
    missingLogistics: false,
    name: "Fixture Product",
    promotionalPrice: 80,
    salePrice: 100,
    shippingRequired: true,
    sku: "PRODUCT-1",
    variants: [{
      attributes: { flavor: "chocolate" },
      compareAtPrice: 90,
      id: "variant-1",
      isDefault: true,
      name: "Chocolate",
      price: 75,
      quantity: 5,
      sku: "VARIANT-1",
      stockMode: StockMode.TRACKED,
    }],
    visibility: CatalogVisibility.VISIBLE,
    weightGrams: 100,
  };
}

function checkoutUnitPaymentMethodRecord(): PaymentMethodRecord {
  return {
    acceptedMethods: ["Transferencia bancaria"],
    bankConfig: { alias: "ENTRENAR.DEMO", bankName: "Banco Demo", cbuCvu: "0000000000000000000000", cuitCuil: "20-00000000-0", holderName: "EntrenAR Demo" },
    description: "Bank transfer",
    id: "bank-transfer",
    logoSrc: "/transfer.svg",
    name: "Transferencia Bancaria",
    options: [{ fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" }],
    selectedOptionId: "direct-transfer",
    status: PaymentMethodStatus.ACTIVE,
    updatedAt: new Date(),
  } as unknown as PaymentMethodRecord;
}

function checkoutUnitShippingProviderRecord(): ShippingProviderRecord {
  return {
    enabledModalities: ["home_delivery"],
    freeShippingThreshold: null,
    id: "andreani",
    name: "Andreani",
    originApartment: null,
    originCity: "Buenos Aires",
    originCuitCuil: null,
    originEmail: "origin@example.test",
    originFloor: null,
    originNumber: "123",
    originPhone: "+54 11 5555-5555",
    originPostalCode: "C1000",
    originProvince: "Buenos Aires",
    originReference: null,
    originSenderName: "EntrenAR",
    originStreet: "Main Street",
    status: ShippingProviderStatus.ACTIVE,
    updatedAt: new Date(),
    weightBands: [{ cost: "100", id: "andreani-range-up-to-1kg", maxWeightGrams: 1_000, minWeightGrams: 0, sortOrder: 1, updatedAt: new Date() }],
  } as unknown as ShippingProviderRecord;
}

function couponRecord(): CouponRecord {
  const now = new Date();
  return {
    canCombineWithPromotions: true,
    categories: [],
    code: "TEN-PERCENT",
    createdAt: now,
    customerLimitType: CouponCustomerLimitType.UNLIMITED,
    customerUsageLimit: null,
    dateLimitType: CouponDateLimitType.UNLIMITED,
    deletedAt: null,
    discountType: CouponDiscountType.PERCENTAGE,
    discountValue: "10",
    endDate: null,
    history: [],
    id: "coupon-1",
    includeShippingCost: false,
    maxDiscountAmount: null,
    maxDiscountType: CouponMaxDiscountType.NONE,
    minimumCartAmount: "0",
    products: [],
    startDate: null,
    status: CouponStatus.ACTIVE,
    targetType: CouponTargetType.ALL_STORE,
    totalUsageLimit: null,
    totalUsageLimitType: CouponUsageLimitType.UNLIMITED,
    updatedAt: now,
    usageCount: 0,
  } as unknown as CouponRecord;
}

function shippingDiscountRecord(): ShippingDiscountRecord {
  const now = new Date();
  return {
    canCombineWithPromotions: false,
    categories: [],
    createdAt: now,
    deletedAt: null,
    id: "shipping-discount-1",
    minimumCartAmount: "0",
    onlyCheapestShippingMethod: false,
    shippingMethodIds: ["andreani:envío-a-domicilio"],
    status: CouponStatus.ACTIVE,
    targetType: ShippingDiscountTargetType.ALL_STORE,
    updatedAt: now,
    zoneIds: [],
    zoneTargetType: ShippingZoneTargetType.ALL,
  } as unknown as ShippingDiscountRecord;
}

export function checkoutUnitCouponRecord(): CouponRecord {
  return couponRecord();
}

export function checkoutUnitShippingDiscountRecord(): ShippingDiscountRecord {
  return shippingDiscountRecord();
}
