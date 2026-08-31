import { ConflictException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";

import { ERROR_CODE } from "../../../common/errors/api-error.response";
import { PaymentMethodStatus } from "../../../generated/prisma/enums";
import {
  PAYMENT_PROVIDER,
  PAYMENT_PROVIDER_DEFINITIONS,
  PAYMENT_STATUS,
} from "../commerce.constants";
import { toPaymentMethodProjection, type PaymentMethodProjection } from "../commerce.mapper";
import { CommerceRepository } from "../commerce.repository";
import type { PaymentMethodUpdateInput } from "../schemas/payment.schemas";

@Injectable()
export class PaymentService {
  constructor(private readonly commerceRepository: CommerceRepository) {}

  async list(): Promise<PaymentMethodProjection[]> {
    const records = await this.commerceRepository.paymentMethods();

    return records.map(toPaymentMethodProjection);
  }

  async getPaymentMethods(): Promise<PaymentMethodProjection[]> {
    return this.list();
  }

  async update(providerId: string, input: PaymentMethodUpdateInput): Promise<PaymentMethodProjection> {
    const definition = PAYMENT_PROVIDER_DEFINITIONS.find((candidate) => candidate.id === providerId);
    if (!definition) throw this.notFound();

    return this.commerceRepository.transaction(async (transaction) => {
      const current = await this.commerceRepository.paymentMethodById(transaction, providerId);
      if (!current) throw this.notFound();

      const selectedOptionId = input.selectedOptionId ?? current.selectedOptionId ?? undefined;
      if (selectedOptionId && !definition.options.some((option) => option.id === selectedOptionId)) {
        throw this.invalidProviderOption();
      }

      if (providerId !== PAYMENT_PROVIDER.BANK_TRANSFER && input.bankConfig !== undefined && input.bankConfig !== null) {
        throw this.validationError("Bank instructions are only valid for bank transfer.");
      }

      if (input.status === PAYMENT_STATUS.ACTIVE) {
        if (providerId === PAYMENT_PROVIDER.BANK_TRANSFER) {
          if (input.bankConfig === null || (input.bankConfig === undefined && current.bankConfig === null)) {
            throw this.validationError("Bank transfer requires bank instructions before activation.");
          }
        } else if (!selectedOptionId) {
          throw this.invalidProviderOption();
        }
      }

      const updated = await this.commerceRepository.updatePaymentMethod(transaction, providerId, {
        bankConfig: providerId === PAYMENT_PROVIDER.BANK_TRANSFER ? input.bankConfig : null,
        selectedOptionId: providerId === PAYMENT_PROVIDER.BANK_TRANSFER
          ? input.selectedOptionId ?? current.selectedOptionId ?? "direct-transfer"
          : selectedOptionId ?? null,
        status: input.status === PAYMENT_STATUS.ACTIVE
          ? this.activeStatus()
          : this.inactiveStatus(),
      });

      return toPaymentMethodProjection(updated);
    });
  }

  async updatePaymentMethod(providerId: string, input: PaymentMethodUpdateInput): Promise<PaymentMethodProjection> {
    return this.update(providerId, input);
  }

  private activeStatus() {
    return PaymentMethodStatus.ACTIVE;
  }

  private inactiveStatus() {
    return PaymentMethodStatus.INACTIVE;
  }

  private invalidProviderOption(): ConflictException {
    return new ConflictException({
      code: ERROR_CODE.INVALID_PROVIDER_OPTION,
      message: "The selected payment provider option is not supported.",
      ok: false,
    });
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: ERROR_CODE.NOT_FOUND,
      message: "The requested payment method was not found.",
      ok: false,
    });
  }

  private validationError(message: string): BadRequestException {
    return new BadRequestException({
      code: ERROR_CODE.VALIDATION_ERROR,
      message,
      ok: false,
    });
  }
}
