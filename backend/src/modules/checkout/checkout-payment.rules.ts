import { ConflictException, Injectable } from "@nestjs/common";

import { ERROR_CODE } from "../../common/errors/api-error.response";
import type { Prisma } from "../../generated/prisma/client";
import { CHECKOUT_PAYMENT_METHOD } from "./checkout.constants";
import type {
  CheckoutBankTransferProjection,
  CheckoutPaymentMethodProjection,
  CheckoutPaymentOptionProjection,
  CheckoutWarningProjection,
} from "./checkout.mapper";
import type { TransactionClient } from "./checkout.repository";
import {
  toPaymentMethodProjection,
} from "../commerce/commerce.mapper";
import { CommerceRepository } from "../commerce/commerce.repository";

export interface CheckoutPaymentInput {
  paymentMethodId?: string;
  paymentOptionId?: string;
}

export interface SelectedPayment {
  method: CheckoutPaymentMethodProjection;
  option: CheckoutPaymentOptionProjection;
}

export interface PaymentRulesCalculation {
  paymentMethods: CheckoutPaymentMethodProjection[];
  selectedPayment?: SelectedPayment;
}

@Injectable()
export class CheckoutPaymentRules {
  constructor(private readonly commerceRepository: CommerceRepository) {}

  async calculate(
    transaction: TransactionClient,
    input: CheckoutPaymentInput,
    required: boolean,
  ): Promise<PaymentRulesCalculation> {
    const paymentMethods = await this.checkoutPaymentMethods(transaction);
    const selectedPayment = this.selectPayment(input, paymentMethods, required);

    return { paymentMethods, selectedPayment };
  }

  warnings(paymentMethods: readonly CheckoutPaymentMethodProjection[]): CheckoutWarningProjection[] {
    if (paymentMethods.length > 0) return [];

    return [{ code: ERROR_CODE.PAYMENT_METHOD_UNAVAILABLE, message: "No payment methods are currently available." }];
  }

  requireSelectedPayment(selectedPayment: SelectedPayment | undefined): SelectedPayment {
    if (!selectedPayment) throw this.paymentMethodUnavailable();
    return selectedPayment;
  }

  paymentMethodSnapshot(selectedPayment: SelectedPayment): Prisma.InputJsonValue {
    return {
      id: selectedPayment.method.id,
      name: selectedPayment.method.name,
      option: {
        fee: selectedPayment.option.fee,
        id: selectedPayment.option.id,
        receiveIn: selectedPayment.option.receiveIn,
        salesIn: selectedPayment.option.salesIn,
      },
    };
  }

  bankTransferSnapshot(config: CheckoutBankTransferProjection): Prisma.InputJsonValue {
    return {
      alias: config.alias,
      bankName: config.bankName,
      cbuCvu: config.cbuCvu,
      cuitCuil: config.cuitCuil,
      holderName: config.holderName,
    };
  }

  private async checkoutPaymentMethods(transaction: TransactionClient): Promise<CheckoutPaymentMethodProjection[]> {
    const records = await this.commerceRepository.checkoutPaymentMethods(transaction);

    return records.flatMap((record) => {
      const projection = toPaymentMethodProjection(record);
      if (!isPublicPaymentMethod(projection.id)) return [];
      if (projection.id === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER && !projection.bankConfig) return [];

      const method: CheckoutPaymentMethodProjection = {
        acceptedMethods: projection.acceptedMethods,
        ...(projection.bankConfig ? { bankConfig: projection.bankConfig } : {}),
        description: projection.description,
        id: projection.id,
        logoSrc: projection.logoSrc,
        name: projection.name,
        options: projection.options,
        ...(projection.selectedOptionId ? { selectedOptionId: projection.selectedOptionId } : {}),
      };
      return [method];
    });
  }

  private selectPayment(
    input: CheckoutPaymentInput,
    paymentMethods: readonly CheckoutPaymentMethodProjection[],
    required: boolean,
  ): SelectedPayment | undefined {
    if (!input.paymentMethodId) {
      if (required) throw this.paymentMethodUnavailable();
      return undefined;
    }

    const method = paymentMethods.find((candidate) => candidate.id === input.paymentMethodId);
    if (!method) throw this.paymentMethodUnavailable();
    const optionId = input.paymentOptionId ?? method.selectedOptionId;
    const option = optionId ? method.options.find((candidate) => candidate.id === optionId) : undefined;
    if (!option) throw this.paymentMethodUnavailable();

    return { method, option };
  }

  private paymentMethodUnavailable(): ConflictException {
    return new ConflictException({ code: ERROR_CODE.PAYMENT_METHOD_UNAVAILABLE, message: "The selected payment method is unavailable.", ok: false });
  }
}

function isPublicPaymentMethod(value: string): value is (typeof CHECKOUT_PAYMENT_METHOD)[keyof typeof CHECKOUT_PAYMENT_METHOD] {
  return value === CHECKOUT_PAYMENT_METHOD.BANK_TRANSFER
    || value === CHECKOUT_PAYMENT_METHOD.MERCADO_PAGO
    || value === CHECKOUT_PAYMENT_METHOD.STRIPE;
}
