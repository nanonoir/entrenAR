import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { Prisma } from "../../generated/prisma/client";
import {
  OrderDeliveryType,
  OrderStatus,
  PaymentStatus,
  Role,
} from "../../generated/prisma/enums";
import {
  CHECKOUT_CURRENCY,
  CHECKOUT_DELIVERY_TYPE,
} from "./checkout.constants";
import type {
  CheckoutCompleteRequest,
  CheckoutCustomerInput,
} from "./checkout.schemas";
import {
  CheckoutRepository,
  type CheckoutCartResolution,
  type CheckoutOrderCreateInput,
  type TransactionClient,
} from "./checkout.repository";
import { CheckoutPaymentRules } from "./checkout-payment.rules";
import type {
  CheckoutActorContext,
  DeliveryCalculation,
  QuoteCalculation,
} from "./checkout-quote.service";
import { roundMoney } from "./checkout-line-resolver";

interface OrderCustomerSnapshot {
  dni?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

@Injectable()
export class CheckoutSnapshotBuilder {
  constructor(
    private readonly checkoutRepository: CheckoutRepository,
    private readonly paymentRules: CheckoutPaymentRules,
  ) {}

  async createOrderInput(
    transaction: TransactionClient,
    calculation: QuoteCalculation,
    resolution: CheckoutCartResolution,
    input: CheckoutCompleteRequest,
    actor: CheckoutActorContext | undefined,
    now: Date,
  ): Promise<CheckoutOrderCreateInput> {
    const customer = await this.customerSnapshot(transaction, input.customer, actor);
    const addressSnapshot = await this.addressSnapshot(transaction, input, calculation.delivery, actor);

    return this.orderCreateInput(
      calculation,
      resolution,
      customer,
      addressSnapshot,
      actor?.userId,
      now,
    );
  }

  private async customerSnapshot(
    transaction: TransactionClient,
    input: CheckoutCustomerInput,
    actor: CheckoutActorContext | undefined,
  ): Promise<OrderCustomerSnapshot> {
    if (!actor?.userId) return customerSnapshotFromInput(input);
    const user = await this.checkoutRepository.userForCheckout(transaction, actor.userId);
    if (!user || user.role !== Role.CUSTOMER) throw this.forbidden();

    return {
      ...(user.dni ?? input.dni ? { dni: user.dni ?? input.dni } : {}),
      email: user.email,
      firstName: input.firstName,
      lastName: input.lastName,
      ...(user.phone ?? input.phone ? { phone: user.phone ?? input.phone } : {}),
    };
  }

  private async addressSnapshot(
    transaction: TransactionClient,
    input: CheckoutCompleteRequest,
    delivery: DeliveryCalculation,
    actor: CheckoutActorContext | undefined,
  ): Promise<Prisma.InputJsonValue | null> {
    if (delivery.type !== CHECKOUT_DELIVERY_TYPE.SHIPPING) return null;

    if (input.addressId) {
      if (!actor?.userId) throw this.unauthorized();
      const address = await this.checkoutRepository.addressByOwner(transaction, actor.userId, input.addressId);
      if (!address) throw this.notFound("The requested checkout address was not found.");

      return {
        city: address.city,
        label: address.label,
        phone: address.phone,
        postalCode: address.postalCode,
        province: address.province,
        recipient: address.recipient,
        street: address.street,
      };
    }

    if (!input.address) throw this.shippingUnavailable();
    return input.address;
  }

  private orderCreateInput(
    calculation: QuoteCalculation,
    resolution: CheckoutCartResolution,
    customer: OrderCustomerSnapshot,
    addressSnapshot: Prisma.InputJsonValue | null,
    userId: string | undefined,
    now: Date,
  ): CheckoutOrderCreateInput {
    const payment = this.paymentRules.requireSelectedPayment(calculation.selectedPayment);
    const deliveryType = calculation.delivery.type === CHECKOUT_DELIVERY_TYPE.PICKUP
      ? OrderDeliveryType.PICKUP
      : OrderDeliveryType.SHIPPING;
    const discountSnapshot: Prisma.InputJsonValue = {
      automaticShippingDiscount: roundMoney(Math.max(0, calculation.shippingDiscount - (calculation.couponCalculation?.shippingDiscount ?? 0))),
      couponCode: calculation.couponCalculation?.record.code ?? null,
      couponId: calculation.couponCalculation?.record.id ?? null,
      couponDiscount: calculation.couponCalculation?.totalDiscount ?? 0,
      ...(calculation.couponCalculation?.record.discountType
        ? { couponType: calculation.couponCalculation.record.discountType }
        : {}),
      ...(calculation.couponCalculation?.record.discountValue === null || !calculation.couponCalculation
        ? {}
        : { couponValue: decimalToNumber(calculation.couponCalculation.record.discountValue) }),
      productDiscount: calculation.discount,
      shippingDiscount: calculation.shippingDiscount,
    };
    const customerSnapshot: Prisma.InputJsonValue = {
      ...(customer.dni ? { dni: customer.dni } : {}),
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      ...(customer.phone ? { phone: customer.phone } : {}),
    };

    return {
      cartId: resolution.cart.id,
      checkoutSessionId: resolution.session.id,
      ...(calculation.couponCalculation ? { couponCode: calculation.couponCalculation.record.code } : {}),
      currency: CHECKOUT_CURRENCY,
      ...(customer.dni ? { customerDni: customer.dni } : {}),
      customerEmail: customer.email,
      customerFirstName: customer.firstName,
      customerLastName: customer.lastName,
      ...(customer.phone ? { customerPhone: customer.phone } : {}),
      customerSnapshot,
      deliverySnapshot: calculation.delivery.snapshot,
      deliveryType,
      discountAmount: calculation.discount,
      discountSnapshot,
      items: calculation.lines.map((line) => ({
        attributes: line.variant?.attributes ?? {},
        ...(line.compareAtPrice === undefined ? {} : { compareAtPrice: line.compareAtPrice }),
        lineSubtotal: line.lineSubtotal,
        productId: line.product.id,
        productName: line.product.name,
        quantity: line.quantity,
        sku: line.variant?.sku ?? line.product.sku,
        snapshot: {
          ...(line.product.brand ? { brand: line.product.brand } : {}),
          effectivePrice: line.unitPrice,
          name: line.product.name,
          ...(line.variant ? { variantId: line.variant.id, variantName: line.variant.name } : {}),
          ...(line.weightGrams === null ? {} : { weightGrams: line.weightGrams }),
        },
        unitPrice: line.unitPrice,
        ...(line.variant ? { variantId: line.variant.id, variantName: line.variant.name } : {}),
        ...(line.weightGrams === null ? {} : { weightGrams: line.weightGrams }),
      })),
      number: nextOrderNumber(now),
      payment: {
        amount: calculation.total,
        ...(payment.method.bankConfig
          ? { bankTransferSnapshot: this.paymentRules.bankTransferSnapshot(payment.method.bankConfig) }
          : {}),
        currency: CHECKOUT_CURRENCY,
        paymentMethodId: payment.method.id,
        paymentMethodSnapshot: this.paymentRules.paymentMethodSnapshot(payment),
        paymentOptionId: payment.option.id,
        status: PaymentStatus.PENDING,
      },
      shippingAddressSnapshot: addressSnapshot,
      shippingCost: calculation.shipping,
      status: OrderStatus.PENDING,
      subtotal: calculation.subtotal,
      total: calculation.total,
      ...(userId ? { userId } : {}),
    };
  }

  private shippingUnavailable(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.SHIPPING_OPTION_UNAVAILABLE, message: "The selected shipping option is unavailable.", ok: false });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({ code: ERROR_CODE.FORBIDDEN, message: "Forbidden.", ok: false });
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({ code: ERROR_CODE.UNAUTHORIZED, message: "Unauthorized.", ok: false });
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ code: ERROR_CODE.NOT_FOUND, message, ok: false });
  }
}

function customerSnapshotFromInput(input: CheckoutCustomerInput): OrderCustomerSnapshot {
  return {
    ...(input.dni ? { dni: input.dni } : {}),
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.phone ? { phone: input.phone } : {}),
  };
}

function decimalToNumber(value: { toString(): string } | number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error("Checkout money values must serialize to finite numbers.");
  return numberValue;
}

function nextOrderNumber(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `EN-${date}-${suffix}`;
}
