import { BadRequestException } from "@nestjs/common";
import { ERROR_CODE } from "../../common/errors/api-error.response";
import { addMoney, multiplyMoney, normalizeMoney, subtractMoney } from "../../common/money/money.utils";
import { OrderDeliveryType } from "../../generated/prisma/enums";
import type { CreateManualSale } from "./sales.schemas";
import type { ManualSaleCalculatedValues } from "./sales.repository";

export function calculateManualSale(input: CreateManualSale): ManualSaleCalculatedValues {
  const items = input.items.map((item) => ({ lineSubtotal: multiplyMoney(item.unitPrice, item.quantity) }));
  const subtotal = items.reduce((sum, item) => addMoney(sum, item.lineSubtotal), normalizeMoney(0));
  const discountAmount = normalizeMoney(input.discountAmount);
  const shippingCost = input.deliveryType === OrderDeliveryType.PICKUP ? normalizeMoney(0) : normalizeMoney(input.shippingCost);
  if (discountAmount.greaterThan(subtotal)) {
    throw new BadRequestException({ code: ERROR_CODE.VALIDATION_ERROR, message: "Manual sale discount cannot exceed its subtotal.", ok: false });
  }
  const total = addMoney(subtractMoney(subtotal, discountAmount), shippingCost);
  return { discountAmount, items, shippingCost, subtotal, total };
}
