import { Prisma } from "../../generated/prisma/client";

export type MoneyInput = Prisma.Decimal | number | string;

export function normalizeMoney(value: MoneyInput): Prisma.Decimal {
  const decimal = toDecimal(value);

  if (!decimal.isFinite() || decimal.decimalPlaces() > 2) {
    throw new Error("Money must be a valid monetary amount with at most two decimal places.");
  }

  return decimal.toDecimalPlaces(2);
}

export function addMoney(left: MoneyInput, right: MoneyInput): Prisma.Decimal {
  return normalizeMoney(normalizeMoney(left).plus(normalizeMoney(right)));
}

export function subtractMoney(left: MoneyInput, right: MoneyInput): Prisma.Decimal {
  return normalizeMoney(normalizeMoney(left).minus(normalizeMoney(right)));
}

export function multiplyMoney(value: MoneyInput, quantity: number): Prisma.Decimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Money quantity must be a non-negative integer.");
  }

  return normalizeMoney(normalizeMoney(value).mul(quantity));
}

function toDecimal(value: MoneyInput): Prisma.Decimal {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Money must be a valid monetary amount with at most two decimal places.");
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new Error("Money must be a valid monetary amount with at most two decimal places.");
  }
}
