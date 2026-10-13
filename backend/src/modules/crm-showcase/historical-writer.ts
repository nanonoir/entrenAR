import { createHash } from "node:crypto";
import type { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { CartStatus, CatalogVisibility, CheckoutRecoveryStatus, CheckoutSessionStatus, CouponDiscountType, CouponHistoryAction, CouponStatus, CouponTargetType, InventoryMovementKind, InventoryReferenceType, OrderDeliveryType, OrderHistoryEventType, OrderInventoryPolicy, OrderShippingStatus, OrderStatus, PaymentStatus, PurchaseOrderStatus, StockMode } from "../../generated/prisma/enums";
import { CatalogRepository } from "../catalog/catalog.repository";
import { CommerceRepository } from "../commerce/commerce.repository";
import { CheckoutRepository, type CheckoutCartRecord } from "../checkout/checkout.repository";
import { CheckoutQuoteService, type CheckoutCalculationInput, type QuoteCalculation } from "../checkout/checkout-quote.service";
import { CheckoutPaymentRules } from "../checkout/checkout-payment.rules";
import { CheckoutSnapshotBuilder } from "../checkout/checkout-snapshot.builder";
import { checkoutCompleteRequestSchema, checkoutCustomerSchema, type CheckoutCompleteRequest } from "../checkout/checkout.schemas";
import { INVENTORY_ORIGIN } from "../inventory/inventory.constants";
import { InventoryRepository, type InventoryLedgerContext } from "../inventory/inventory.repository";
import { calculatePurchaseOrder } from "../purchase-orders/purchase-order.calculation";
import { transitionPurchaseOrder } from "../purchase-orders/purchase-orders.state-machine";
import { PURCHASE_ORDER_COMMAND } from "../purchase-orders/purchase-orders.schemas";
import { calculateManualSale } from "../sales/manual-sale.calculation";
import { manualSaleRecord } from "../sales/sales.repository";
import { SALE_COMMAND, type CreateManualSale } from "../sales/sales.schemas";
import { transitionSale, type SaleState, type SaleStatePatch } from "../sales/sales.state-machine";
import { abandonedCartInclude, toAbandonedCartDetailDto } from "../abandoned-carts/abandoned-carts.mapper";
import type { Baseline, FaultPoint } from "./crm-showcase.service";
import { compareId, digest, SHOWCASE_COUNTS, SHOWCASE_NAMESPACE, type Scenario, type ScenarioOrder } from "./scenario";

const DAY = 86_400_000;
const FIRST_NAMES = ["Lucía", "Mateo", "Valentina", "Nicolás", "Camila", "Joaquín", "Sofía", "Tomás", "Martina", "Agustín"];
const LAST_NAMES = ["Pereyra", "Giménez", "Romero", "Álvarez", "Acosta", "Benítez", "Medina", "Castro", "Rojas", "Molina"];
type Variant = Prisma.ProductVariantGetPayload<{ include: { product: { include: { categories: true } } } }>;
interface WriterEvidence { initialBalances: Record<string, number | null>; manifestDigest: string; }
interface Timeline { state: SaleState; patch: SaleStatePatch; paymentStatus: PaymentStatus; history: Prisma.OrderHistoryUncheckedCreateInput[]; restore: boolean; }

export class HistoricalWriter {
  private readonly inventory: InventoryRepository;
  private readonly quote: CheckoutQuoteService;
  private readonly snapshots: CheckoutSnapshotBuilder;
  private readonly catalog: CatalogRepository;
  constructor(prisma: PrismaService) {
    this.inventory = new InventoryRepository(prisma);
    const checkout = new CheckoutRepository(prisma, this.inventory);
    this.catalog = new CatalogRepository(prisma);
    const commerce = new CommerceRepository(prisma);
    this.quote = new CheckoutQuoteService(checkout, this.catalog, commerce);
    this.snapshots = new CheckoutSnapshotBuilder(checkout, new CheckoutPaymentRules(commerce));
  }

  async write(tx: Prisma.TransactionClient, scenario: Scenario, baseline: Baseline, testFault?: (point: FaultPoint) => void): Promise<WriterEvidence> {
    const publicCategories = await this.catalog.publicCheckoutCategoryIds(tx);
    const variants = (await tx.productVariant.findMany({ include: { product: { include: { categories: true } } }, orderBy: { id: "asc" }, where: { stockMode: { in: [StockMode.TRACKED, StockMode.INFINITE] }, product: { visibility: CatalogVisibility.VISIBLE } } }))
      .filter((variant) => variant.product.categories.some((item) => publicCategories.has(item.categoryId)) && compatiblePrice(variant) && variant.product.weightGrams !== null)
      .sort((a, b) => compareId(scenario.id("selection", a.id), scenario.id("selection", b.id)));
    const distinct: Variant[] = [];
    for (const variant of variants) if (!distinct.some((item) => item.productId === variant.productId)) distinct.push(variant);
    const tracked = distinct.filter((variant) => variant.stockMode === StockMode.TRACKED).slice(0, 12);
    if (tracked.length < 12) throw new Error("Showcase needs twelve distinct public tracked products with valid snapshot prices and shipping weights.");
    const infinite = distinct.filter((variant) => variant.stockMode === StockMode.INFINITE).slice(0, 2);
    const selected = [...tracked, ...infinite];
    const initialBalances = Object.fromEntries(selected.map((variant) => [variant.id, variant.quantity]));
    const start = new Date(scenario.input.referenceDate.getTime() - 60 * DAY);
    await this.parents(tx, scenario, start);
    await this.purchases(tx, scenario, tracked, start);
    // Service safety/prerequisite reads precede writes. Validate quotes after historical
    // receipts fund initially empty tracked variants; any failure rolls back this same transaction.
    await this.calculate(tx, scenario, tracked[0]!, 1000, new Date(scenario.input.referenceDate.getTime() - DAY), false);
    await this.calculate(tx, scenario, tracked[0]!, 1001, new Date(scenario.input.referenceDate.getTime() - DAY), true);
    const rankedUnits = new Map<string, number>();
    for (const order of scenario.orders) {
      const variant = selected[order.index % selected.length]!;
      const pickup = order.index % 7 === 0;
      const couponIndex = order.checkout && order.index % 3 === 0 ? Math.floor(order.index / 3) % SHOWCASE_COUNTS.coupons : undefined;
      const couponCode = couponIndex === undefined ? undefined : `CRM-DEMO-COUPON-${couponIndex + 1}`;
      const { calculation, cart, input } = await this.calculate(tx, scenario, variant, order.index, order.createdAt, pickup, couponCode);
      const timeline = buildTimeline(scenario, order, pickup ? OrderDeliveryType.PICKUP : OrderDeliveryType.SHIPPING);
      const orderId = scenario.id("order", order.index);
      const numeric = variant.stockMode === StockMode.TRACKED;
      const effect = numeric ? scenario.id("effect", order.index) : undefined;
      let commercial: Prisma.OrderUncheckedCreateInput;
      if (order.checkout) {
        const session = await this.session(tx, scenario, order.index, order.createdAt, calculation, cart, input, false);
        const snapshot = await this.snapshots.createOrderInput(tx, calculation, { cart, session, merged: false, ownerKey: `session:${session.id}` }, input, undefined, order.createdAt);
        const { items, payment, shippingAddressSnapshot, ...header } = snapshot;
        commercial = { ...header, shippingAddressSnapshot: shippingAddressSnapshot === null ? Prisma.DbNull : shippingAddressSnapshot, items: { create: items.map((item, index) => ({ ...item, id: scenario.id("order-item", `${order.index}:${index}`), createdAt: order.createdAt })) }, payment: { create: { ...payment, bankTransferSnapshot: payment.bankTransferSnapshot === null ? Prisma.DbNull : payment.bankTransferSnapshot, id: scenario.id("payment", order.index), status: timeline.paymentStatus, createdAt: order.createdAt, updatedAt: timelineTime(order) } }, id: orderId, number: `CRM-DEMO-ORDER-${order.index + 1}`, customerId: scenario.id("customer", order.customerIndex), ...timeline.patch, inventoryPolicy: numeric ? OrderInventoryPolicy.LEDGER_MANAGED : OrderInventoryPolicy.NOT_APPLICABLE, inventoryEffectId: effect ?? null, createdAt: order.createdAt, updatedAt: timelineTime(order) };
      } else {
        const manual = manualInput(calculation, input, scenario.id("customer", order.customerIndex));
        const record = manualSaleRecord(manual, `CRM-DEMO-ORDER-${order.index + 1}`, calculateManualSale(manual));
        const { items, paymentMethodId, paymentMethodSnapshot, paymentOptionId, paymentStatus: _paymentStatus, shippingAddressSnapshot, ...header } = record;
        void _paymentStatus;
        commercial = { ...header, shippingAddressSnapshot: shippingAddressSnapshot == null ? Prisma.DbNull : shippingAddressSnapshot, items: { create: items.map((item, index) => ({ ...item, id: scenario.id("order-item", `${order.index}:${index}`), createdAt: order.createdAt })) }, payment: { create: { amount: record.total, currency: record.currency, paymentMethodId, paymentMethodSnapshot, paymentOptionId, status: timeline.paymentStatus, id: scenario.id("payment", order.index), createdAt: order.createdAt, updatedAt: timelineTime(order) } }, id: orderId, ...timeline.patch, inventoryPolicy: numeric ? OrderInventoryPolicy.LEDGER_MANAGED : OrderInventoryPolicy.NOT_APPLICABLE, inventoryEffectId: effect ?? null, createdAt: order.createdAt, updatedAt: timelineTime(order) };
      }
      await tx.order.create({ data: commercial });
      await tx.orderHistory.createMany({ data: timeline.history });
      const context = ledgerContext(scenario, order, effect ?? scenario.id("unused-effect", order.index));
      await this.inventory.deductStockForItems(tx, [{ productId: variant.productId, variantId: variant.id, quantity: 1 }], context);
      if (timeline.restore) await this.inventory.restoreUncompensatedDeductions(tx, { ...context, createdAt: timelineTime(order), movementKind: InventoryMovementKind.SALE_CANCELLATION_RESTORATION, operationId: scenario.id("restore-operation", order.index), origin: INVENTORY_ORIGIN.ADMIN_SALES_CANCELLATION, movementId: (_productId, variantId, deductionId) => scenario.id("restore-movement", `${order.index}:${variantId}:${deductionId}`) });
      if (calculation.couponCalculation) {
        const coupon = calculation.couponCalculation;
        await tx.couponRedemption.create({ data: { id: scenario.id("redemption", order.index), couponId: coupon.record.id, orderId, couponCode: coupon.record.code, customerKeyHash: digestEmail(input.customer.email), discountAmount: coupon.totalDiscount, createdAt: order.createdAt } });
        await tx.coupon.update({ where: { id: coupon.record.id }, data: { usageCount: { increment: 1 }, updatedAt: order.createdAt } });
      }
      if (timeline.state.status !== OrderStatus.CANCELLED && timeline.paymentStatus === PaymentStatus.PAID) rankedUnits.set(variant.productId, (rankedUnits.get(variant.productId) ?? 0) + 1);
    }
    testFault?.("after-ledger");
    for (let index = 0; index < SHOWCASE_COUNTS.abandonments; index++) {
      const at = new Date(scenario.input.referenceDate.getTime() - (index + 1) * DAY);
      const { calculation, cart, input } = await this.calculate(tx, scenario, selected[index % selected.length]!, 2000 + index, at, index % 2 === 0);
      await this.session(tx, scenario, 2000 + index, at, calculation, cart, input, true);
    }
    await this.verifyBalances(tx, scenario, selected, initialBalances);
    const available = await tx.product.findMany({ include: { variants: true, categories: true }, where: { visibility: CatalogVisibility.VISIBLE } });
    const sellable = available.filter((product) => product.categories.some((category) => publicCategories.has(category.categoryId)) && product.variants.some((variant) => variant.stockMode === StockMode.INFINITE || variant.stockMode === StockMode.TRACKED && (variant.quantity ?? 0) > 0));
    const ranking = sellable.filter((product) => rankedUnits.has(product.id)).sort((a, b) => rankedUnits.get(b.id)! - rankedUnits.get(a.id)! || compareId(a.id, b.id)).slice(0, 10);
    if (ranking.length < 8 || sellable.length < 6) throw new Error("Insufficient qualifying available products for showcase flags.");
    const featured = representativeProducts(sellable).slice(0, 8);
    const bestsellerIds = new Set(ranking.map((product) => product.id));
    const featuredIds = new Set(featured.map((product) => product.id));
    // Keep PostgreSQL's original timestamp precision; a JS Date truncates microseconds.
    for (const product of baseline.Product ?? []) await tx.$executeRaw`UPDATE public."Product" SET "isBestSeller" = ${bestsellerIds.has(String(product.id))}, "isFeatured" = ${featuredIds.has(String(product.id))}, "updatedAt" = ${String(product.updatedAt)}::timestamp WHERE "id" = ${String(product.id)}`;
    for (const variant of selected) {
      const original = baseline.ProductVariant?.find((row) => row.id === variant.id);
      if (!original) throw new Error("Showcase selected variant baseline is missing.");
      await tx.$executeRaw`UPDATE public."ProductVariant" SET "updatedAt" = ${String(original.updatedAt)}::timestamp WHERE "id" = ${variant.id}`;
    }
    testFault?.("after-flags");
    await this.verifyGraph(tx, scenario);
    const after = await catalogSnapshot(tx);
    const before = Object.fromEntries(["Product", "ProductVariant", "ProductImage", "ProductCategory", "Category"].map((table) => [table, baseline[table] ?? []]));
    if (digest(catalogStructure(before)) !== digest(catalogStructure(after))) {
      const prior = catalogStructure(before), current = catalogStructure(after);
      const changed = Object.keys(prior).flatMap((table) => {
        if (digest(prior[table]) === digest(current[table])) return [];
        const rows = new Map(current[table]?.map((row) => [String(row.id), row]));
        return (prior[table] ?? []).flatMap((row) => Object.keys(row).filter((key) => digest(row[key]) !== digest(rows.get(String(row.id))?.[key])).map((key) => `${table}.${key}`));
      });
      throw new Error(`Showcase changed unauthorized catalog fields: ${[...new Set(changed)].join(", ")}.`);
    }
    const generated = await generatedSnapshot(tx);
    return { initialBalances, manifestDigest: digest(generated) };
  }

  private async calculate(tx: Prisma.TransactionClient, scenario: Scenario, variant: Variant, index: number, at: Date, pickup: boolean, couponCode?: string) {
    const customer = customerInput(index % SHOWCASE_COUNTS.customers);
    const cart: CheckoutCartRecord = { id: scenario.id("cart", index), userId: null, status: CartStatus.COMPLETED, createdAt: at, updatedAt: at, items: [{ id: scenario.id("cart-item", index), cartId: scenario.id("cart", index), productId: variant.productId, variantId: variant.id, quantity: 1, createdAt: at, updatedAt: at }] };
    const discovery: CheckoutCalculationInput = { items: cart.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })), customer, address: addressInput(customer), province: "Buenos Aires" };
    const options = await this.quote.calculateQuote(tx, cart, discovery, undefined, at, false);
    const method = [...options.paymentMethods].sort((a, b) => compareId(a.id, b.id)).find((method) => method.options.length > 0);
    const shipping = [...options.shippingOptions].sort((a, b) => compareId(a.id, b.id))[0];
    const point = [...options.pickupPoints].sort((a, b) => compareId(a.id, b.id))[0];
    if (!method || !shipping || !point) throw new Error("Showcase commerce configuration is insufficient for shipping, pickup or payment.");
    const input = checkoutCompleteRequestSchema.parse({ ...discovery, customer, idempotencyKey: scenario.id("unused-idempotency", index), paymentMethodId: method.id, paymentOptionId: [...method.options].sort((a, b) => compareId(a.id, b.id))[0]!.id, ...(pickup ? { pickupPointId: point.id, deliveryType: "pickup" } : { shippingMethodId: shipping.id, deliveryType: "shipping" }), ...(couponCode ? { couponCode } : {}) });
    const calculation = await this.quote.calculateQuote(tx, cart, input, undefined, at, true);
    calculation.quoteId = scenario.id("quote", index);
    return { calculation, cart, input };
  }

  private async parents(tx: Prisma.TransactionClient, scenario: Scenario, at: Date): Promise<void> {
    for (let index = 0; index < SHOWCASE_COUNTS.customers; index++) {
      const customer = customerInput(index);
      await tx.customer.create({ data: { id: scenario.id("customer", index), fullName: `${customer.firstName} ${customer.lastName}`, email: customer.email, phone: customer.phone, dniOrCuil: customer.dni, tags: ["CRM-DEMO"], notes: "CRM-DEMO: persona ficticia; no contactar.", firstInteractionDate: at, createdAt: at, updatedAt: at, address: { create: { id: scenario.id("customer-address", index), street: "Calle Ficticia DEMO", number: String(100 + index), postalCode: "1000", city: "Ciudad Demo", provinceOrState: "Buenos Aires", country: "Argentina", createdAt: at, updatedAt: at } } } });
    }
    for (let index = 0; index < SHOWCASE_COUNTS.suppliers; index++) await tx.supplier.create({ data: { id: scenario.id("supplier", index), code: `CRM-DEMO-SUPPLIER-${index + 1}`, name: `Distribuidora Demo ${index + 1}`, email: `crm-demo-supplier-${index}@example.invalid`, notes: "CRM-DEMO: proveedor ficticio; no contactar.", createdAt: at, updatedAt: at } });
    for (let index = 0; index < SHOWCASE_COUNTS.coupons; index++) await tx.coupon.create({ data: { id: scenario.id("coupon", index), code: `CRM-DEMO-COUPON-${index + 1}`, discountType: index % 2 === 0 ? CouponDiscountType.PERCENTAGE : CouponDiscountType.FIXED, discountValue: index % 2 === 0 ? 10 : 1, targetType: CouponTargetType.ALL_STORE, canCombineWithPromotions: true, status: CouponStatus.ACTIVE, createdAt: at, updatedAt: at, history: { create: { id: scenario.id("coupon-history", index), action: CouponHistoryAction.CREATED, actorName: "CRM-DEMO simulator", createdAt: at } } } });
  }

  private async purchases(tx: Prisma.TransactionClient, scenario: Scenario, variants: Variant[], start: Date): Promise<void> {
    for (let index = 0; index < SHOWCASE_COUNTS.purchases; index++) {
      const at = new Date(start.getTime() + index * 600_000);
      const receiptAt = new Date(at.getTime() + 300_000);
      let state = { status: PurchaseOrderStatus.DRAFT } as { status: PurchaseOrderStatus; receivedAt?: Date | null };
      if (index !== 2) state = transitionPurchaseOrder(state, PURCHASE_ORDER_COMMAND.SUBMIT, { now: at });
      if (index < 2) state = transitionPurchaseOrder(state, PURCHASE_ORDER_COMMAND.RECEIVE, { now: receiptAt });
      const purchaseId = scenario.id("purchase", index);
      const calculated = calculatePurchaseOrder({ expectedDate: null, notes: "CRM-DEMO: compra simulada", orderNumber: `CRM-DEMO-PURCHASE-${index + 1}`, supplierId: scenario.id("supplier", index % SHOWCASE_COUNTS.suppliers), shippingCost: 0, tax: 0, items: variants.map((variant) => ({ productId: variant.productId, variantId: variant.id, sku: variant.sku, title: variant.product.name, quantity: 10, unitCost: Number(variant.product.price) })) });
      const { items, ...header } = calculated;
      await tx.purchaseOrder.create({ data: { ...header, id: purchaseId, ...state, createdAt: at, updatedAt: state.receivedAt ?? at, items: { create: items.map((item, itemIndex) => ({ ...item, id: scenario.id("purchase-item", `${index}:${itemIndex}`) })) } } });
      if (state.status === PurchaseOrderStatus.RECEIVED) await this.inventory.incrementStockForItems(tx, variants.map((variant) => ({ productId: variant.productId, variantId: variant.id, quantity: 10 })), { origin: INVENTORY_ORIGIN.PURCHASE_ORDER, referenceType: InventoryReferenceType.PURCHASE_ORDER, referenceId: purchaseId, operationId: scenario.id("receipt-operation", index), movementKind: InventoryMovementKind.PURCHASE_ORDER_RECEIPT, createdAt: receiptAt, movementId: (productId, variantId) => scenario.id("receipt-movement", `${index}:${productId}:${variantId}`) });
    }
  }

  private async session(tx: Prisma.TransactionClient, scenario: Scenario, index: number, at: Date, calculation: QuoteCalculation, cart: CheckoutCartRecord, input: CheckoutCompleteRequest, abandoned: boolean) {
    await tx.cart.create({ data: { id: cart.id, status: abandoned ? CartStatus.ABANDONED : CartStatus.COMPLETED, createdAt: at, updatedAt: at, ...(abandoned ? { items: { create: cart.items.map(({ cartId, ...item }) => { void cartId; return item; }) } } : {}) } });
    return tx.checkoutSession.create({ data: { id: scenario.id("session", index), cartId: cart.id, tokenHash: digest([scenario.id("token-hash", index)]), recoveryTokenHash: abandoned ? digest([scenario.id("recovery-hash", index)]) : null, recoveryExpiresAt: abandoned ? scenario.input.referenceDate : null, status: abandoned ? CheckoutSessionStatus.ABANDONED : CheckoutSessionStatus.COMPLETED, recoveryStatus: abandoned && index % 2 === 0 ? CheckoutRecoveryStatus.MANUAL : CheckoutRecoveryStatus.PENDING, snapshotData: json({ customer: input.customer, items: calculation.items, discount: calculation.discount, shipping: calculation.shipping, subtotal: calculation.subtotal, total: calculation.total, delivery: calculation.delivery.snapshot, quoteId: calculation.quoteId }), abandonedAt: abandoned ? at : null, completedAt: abandoned ? null : at, lastActivityAt: at, createdAt: at, updatedAt: at, history: { create: { id: scenario.id("session-history", index), eventType: abandoned ? "ABANDONED" : "COMPLETED", notes: "CRM-DEMO historical simulation", metadata: {}, createdAt: at } } } });
  }

  private async verifyBalances(tx: Prisma.TransactionClient, scenario: Scenario, variants: Variant[], initial: Record<string, number | null>): Promise<void> {
    const movements = await tx.inventoryHistory.findMany({ where: { id: { startsWith: SHOWCASE_NAMESPACE } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const balances = { ...initial };
    const seen = new Set<string>();
    for (const movement of movements) {
      if (!movement.variantId || !variants.some((variant) => variant.id === movement.variantId && variant.productId === movement.productId) || balances[movement.variantId] === null || movement.stockMode !== StockMode.TRACKED || !movement.delta) throw new Error("Invalid showcase movement target.");
      if (movement.compensatesMovementId && !seen.has(movement.compensatesMovementId)) throw new Error("Invalid showcase compensation chronology.");
      balances[movement.variantId] = (balances[movement.variantId] ?? 0) + movement.delta;
      if (balances[movement.variantId]! < 0 || balances[movement.variantId] !== movement.resultingQuantity || movement.createdAt > scenario.input.referenceDate) throw new Error("Showcase intermediate inventory equation failed.");
      seen.add(movement.id);
      const reference = movement.referenceType === InventoryReferenceType.ORDER ? await tx.order.findUnique({ where: { id: movement.referenceId ?? "" } }) : movement.referenceType === InventoryReferenceType.PURCHASE_ORDER ? await tx.purchaseOrder.findUnique({ where: { id: movement.referenceId ?? "" } }) : null;
      if (!reference) throw new Error("Showcase movement commercial reference is unresolved.");
    }
    for (const variant of variants) {
      const current = await tx.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
      if (current.stockMode !== variant.stockMode || current.quantity !== balances[variant.id]) throw new Error("Showcase final inventory equation failed.");
    }
  }

  private async verifyGraph(tx: Prisma.TransactionClient, scenario: Scenario): Promise<void> {
    const namespace = { id: { startsWith: SHOWCASE_NAMESPACE } };
    if (await tx.customer.count({ where: namespace }) !== SHOWCASE_COUNTS.customers ||
        await tx.customerAddress.count({ where: namespace }) !== SHOWCASE_COUNTS.customers ||
        await tx.supplier.count({ where: namespace }) !== SHOWCASE_COUNTS.suppliers ||
        await tx.purchaseOrder.count({ where: namespace }) !== SHOWCASE_COUNTS.purchases ||
        await tx.checkoutSession.count({ where: { ...namespace, status: CheckoutSessionStatus.COMPLETED } }) !== scenario.orders.filter((order) => order.checkout).length) {
      throw new Error("Showcase parent/session graph counts failed.");
    }
    const orders = await tx.order.findMany({ where: { id: { startsWith: SHOWCASE_NAMESPACE } }, include: { items: true, payment: true, checkoutSession: { include: { cart: { include: { items: true } } } } } });
    if (orders.length !== SHOWCASE_COUNTS.orders) throw new Error("Showcase order count failed.");
    for (const order of orders) {
      const subtotal = order.items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));
      if (!subtotal.equals(order.subtotal) || !subtotal.sub(order.discountAmount).add(order.shippingCost).equals(order.total) || !order.payment?.amount.equals(order.total) || order.createdAt > scenario.input.referenceDate) throw new Error("Showcase commercial totals failed.");
      if (order.checkoutSession && (order.checkoutSession.status !== CheckoutSessionStatus.COMPLETED || order.checkoutSession.cart.items.length !== 0)) throw new Error("Showcase completed checkout graph failed.");
      if (order.deliveryType === OrderDeliveryType.SHIPPING && !order.shippingAddressSnapshot || order.deliveryType === OrderDeliveryType.PICKUP && order.shippingAddressSnapshot !== null) throw new Error("Showcase delivery address separation failed.");
      for (const item of order.items) if (!await tx.productVariant.findFirst({ where: { id: item.variantId ?? "", productId: item.productId } })) throw new Error("Showcase line ownership failed.");
    }
    const purchases = await tx.purchaseOrder.findMany({ where: namespace, include: { items: true } });
    for (const purchase of purchases) {
      const subtotal = purchase.items.reduce((sum, item) => sum.add(item.totalCost), new Prisma.Decimal(0));
      if (!subtotal.equals(purchase.subtotal) || !subtotal.add(purchase.tax).add(purchase.shippingCost).equals(purchase.total) || purchase.receivedAt && purchase.receivedAt > scenario.input.referenceDate) throw new Error("Showcase purchase totals or chronology failed.");
      for (const item of purchase.items) if (!await tx.productVariant.findFirst({ where: { id: item.variantId ?? "", productId: item.productId } }) || !item.unitCost.mul(item.quantity).equals(item.totalCost)) throw new Error("Showcase purchase line ownership or totals failed.");
      const receipts = await tx.inventoryHistory.count({ where: { referenceId: purchase.id, referenceType: InventoryReferenceType.PURCHASE_ORDER, movementKind: InventoryMovementKind.PURCHASE_ORDER_RECEIPT } });
      if (receipts !== (purchase.status === PurchaseOrderStatus.RECEIVED ? purchase.items.length : 0)) throw new Error("Showcase purchase receipt graph failed.");
    }
    const coupons = await tx.coupon.findMany({ where: { id: { startsWith: SHOWCASE_NAMESPACE } }, include: { redemptions: { include: { order: true } } } });
    if (coupons.length !== SHOWCASE_COUNTS.coupons || coupons.some((coupon) => coupon.usageCount !== coupon.redemptions.length || coupon.usageCount === 0)) throw new Error("Showcase coupon usage failed.");
    for (const coupon of coupons) if (coupon.redemptions.some((redemption) => redemption.couponCode !== coupon.code || redemption.order.couponCode !== coupon.code || !redemption.discountAmount.equals(redemption.order.discountAmount))) throw new Error("Showcase coupon redemption snapshot failed.");
    const abandoned = await tx.checkoutSession.findMany({ include: abandonedCartInclude, where: { id: { startsWith: SHOWCASE_NAMESPACE }, status: CheckoutSessionStatus.ABANDONED } });
    if (abandoned.length !== SHOWCASE_COUNTS.abandonments) throw new Error("Showcase abandonment count failed.");
    for (const session of abandoned) {
      const detail = toAbandonedCartDetailDto(session);
      if (detail.total <= 0 || !detail.customer.email || !detail.items.length || detail.items.some((item) => !item.name || item.unitPrice <= 0) || session.lastEmailSentAt) throw new Error("Showcase abandoned-cart reader failed.");
    }
  }
}

export function buildTimeline(scenario: Scenario, order: ScenarioOrder, deliveryType: OrderDeliveryType): Timeline {
  let state: SaleState = { deliveryType, isArchived: false, paymentStatus: PaymentStatus.PENDING, shippingStatus: deliveryType === OrderDeliveryType.PICKUP ? OrderShippingStatus.PICKUP : OrderShippingStatus.TO_PACK, status: order.checkout ? OrderStatus.PENDING : OrderStatus.CONFIRMED, confirmedAt: order.checkout ? null : order.createdAt };
  let patch: SaleStatePatch = { status: state.status, shippingStatus: state.shippingStatus, confirmedAt: state.confirmedAt };
  const history: Prisma.OrderHistoryUncheckedCreateInput[] = [{ id: scenario.id("order-history", `${order.index}:created`), orderId: scenario.id("order", order.index), type: OrderHistoryEventType.ORDER_CREATED, title: "CRM-DEMO order created", createdAt: order.createdAt }];
  const now = timelineTime(order);
  function apply(command: typeof SALE_COMMAND.CONFIRM | typeof SALE_COMMAND.PACK | typeof SALE_COMMAND.SHIP | typeof SALE_COMMAND.DELIVER | typeof SALE_COMMAND.CANCEL) {
    const transition = transitionSale(state, command, { now, cancellationReason: "CRM-DEMO synthetic cancellation", carrier: "CRM-DEMO", trackingCode: `CRM-DEMO-${order.index}` });
    patch = { ...patch, ...transition.patch };
    state = { ...state, ...transition.patch };
    if (command === SALE_COMMAND.CONFIRM) state.paymentStatus = PaymentStatus.PAID;
    history.push({ id: scenario.id("order-history", `${order.index}:${command}`), orderId: scenario.id("order", order.index), type: transition.eventType, title: `CRM-DEMO ${command}`, createdAt: now, ...(command === SALE_COMMAND.CANCEL ? { metadata: { restoreStock: order.stateIndex === 8 } } : {}) });
  }
  if (order.stateIndex >= 2) apply(SALE_COMMAND.CONFIRM);
  if (deliveryType === OrderDeliveryType.SHIPPING && order.stateIndex >= 3 && order.stateIndex <= 5) apply(SALE_COMMAND.PACK);
  if (deliveryType === OrderDeliveryType.SHIPPING && order.stateIndex >= 4 && order.stateIndex <= 5) apply(SALE_COMMAND.SHIP);
  if (deliveryType === OrderDeliveryType.SHIPPING && order.stateIndex === 5) apply(SALE_COMMAND.DELIVER);
  if (order.stateIndex >= 8) apply(SALE_COMMAND.CANCEL);
  const paymentStatus = order.stateIndex === 8 ? PaymentStatus.REFUNDED : state.paymentStatus ?? PaymentStatus.PENDING;
  return { state, patch, paymentStatus, history, restore: order.stateIndex === 8 };
}
function timelineTime(order: ScenarioOrder): Date { return new Date(order.createdAt.getTime() + (order.index === 0 ? 0 : 5_000)); }
function ledgerContext(scenario: Scenario, order: ScenarioOrder, inventoryEffectId: string): InventoryLedgerContext {
  return { inventoryEffectId, movementKind: order.checkout ? InventoryMovementKind.CHECKOUT_DEDUCTION : InventoryMovementKind.SALE_DEDUCTION, operationId: scenario.id("deduct-operation", order.index), origin: order.checkout ? INVENTORY_ORIGIN.CHECKOUT : INVENTORY_ORIGIN.ADMIN_MANUAL, referenceId: scenario.id("order", order.index), referenceType: InventoryReferenceType.ORDER, createdAt: order.createdAt, movementId: (productId, variantId) => scenario.id("deduct-movement", `${order.index}:${productId}:${variantId}`) };
}
function compatiblePrice(variant: Variant): boolean {
  const price = Number(variant.product.promotionalPrice ?? variant.product.price);
  return Number.isFinite(price) && price > 1 && (variant.product.compareAtPrice === null || Number(variant.product.compareAtPrice) > price);
}
export function customerInput(index: number) { return checkoutCustomerSchema.parse({ email: `crm-demo-${index}@example.invalid`, firstName: FIRST_NAMES[index % FIRST_NAMES.length]!, lastName: LAST_NAMES[Math.floor(index / 2) % LAST_NAMES.length]!, phone: `000-000-${String(index).padStart(4, "0")}`, dni: `000000${String(index).padStart(2, "0")}` }); }
function addressInput(customer: ReturnType<typeof customerInput>) { return { recipient: `${customer.firstName} ${customer.lastName}`, street: "Calle Ficticia DEMO 100", city: "Ciudad Demo", province: "Buenos Aires", postalCode: "1000", phone: customer.phone }; }
function manualInput(calculation: QuoteCalculation, input: CheckoutCompleteRequest, customerId: string): CreateManualSale {
  return { currency: "ARS", customer: input.customer, customerId, deliveryType: calculation.delivery.type === "pickup" ? OrderDeliveryType.PICKUP : OrderDeliveryType.SHIPPING, deliverySnapshot: objectJson(calculation.delivery.snapshot), discountSnapshot: {}, discountAmount: 0, shippingCost: calculation.shipping, paymentMethodId: calculation.selectedPayment!.method.id, paymentOptionId: calculation.selectedPayment!.option.id, paymentMethodSnapshot: { id: calculation.selectedPayment!.method.id, name: calculation.selectedPayment!.method.name }, paymentStatus: PaymentStatus.PENDING, ...(input.address && calculation.delivery.type !== "pickup" ? { shippingAddress: objectJson(input.address) } : {}), items: calculation.lines.map((line) => ({ productId: line.product.id, productName: line.product.name, variantId: line.variant!.id, variantName: line.variant!.name, attributes: objectJson(line.variant!.attributes), sku: line.variant!.sku, quantity: line.quantity, unitPrice: line.unitPrice, ...(line.compareAtPrice === undefined ? {} : { compareAtPrice: line.compareAtPrice }), snapshot: { name: line.product.name, effectivePrice: line.unitPrice, variantId: line.variant!.id }, ...(line.weightGrams === null ? {} : { weightGrams: line.weightGrams }) })) };
}
function objectJson(value: unknown): Record<string, unknown> { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>; }
function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function digestEmail(email: string): string { return createHash("sha256").update(email.trim().toLowerCase()).digest("hex"); }

function representativeProducts<T extends { id: string; brand: string | null; categories: { categoryId: string }[] }>(products: T[]): T[] {
  const sorted = [...products].sort((a, b) => compareId(a.id, b.id));
  const seen = new Set<string>();
  const representatives: T[] = [], remaining: T[] = [];
  for (const product of sorted) {
    const key = `${product.categories.map((category) => category.categoryId).sort(compareId)[0] ?? ""}:${product.brand ?? ""}`;
    if (seen.has(key)) remaining.push(product); else { seen.add(key); representatives.push(product); }
  }
  return [...representatives, ...remaining];
}
async function catalogSnapshot(tx: Prisma.TransactionClient): Promise<Baseline> {
  const result: Baseline = {};
  for (const table of ["Product", "ProductVariant", "ProductImage", "ProductCategory", "Category"]) {
    const rows = await tx.$queryRawUnsafe<{ row: Record<string, unknown> }[]>(`SELECT row_to_json(t) AS row FROM public."${table}" t`);
    result[table] = rows.map(({ row }) => row);
  }
  return result;
}
export function catalogStructure(catalog: Baseline): Baseline {
  return Object.fromEntries(Object.entries(catalog).map(([table, rows]) => [table, rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !(table === "Product" && ["isFeatured", "isBestSeller"].includes(key) || table === "ProductVariant" && key === "quantity")))).sort((a, b) => compareId(JSON.stringify(a), JSON.stringify(b)))]));
}
async function generatedSnapshot(tx: Prisma.TransactionClient): Promise<Baseline> {
  const result: Baseline = {};
  for (const table of ["Customer", "CustomerAddress", "Supplier", "PurchaseOrder", "PurchaseOrderItem", "Coupon", "CouponHistory", "CouponRedemption", "Cart", "CartItem", "CheckoutSession", "CheckoutSessionHistory", "Order", "OrderItem", "OrderPayment", "OrderHistory", "InventoryHistory"]) {
    const rows = await tx.$queryRawUnsafe<{ row: Record<string, unknown> }[]>(`SELECT row_to_json(t) AS row FROM public."${table}" t WHERE id LIKE 'crm-showcase:%' ORDER BY id`);
    result[table] = rows.map(({ row }) => row);
  }
  const catalog = await catalogSnapshot(tx);
  for (const table of ["Product", "ProductVariant"]) result[table] = (catalog[table] ?? []).sort((a, b) => compareId(String(a.id), String(b.id)));
  return result;
}
