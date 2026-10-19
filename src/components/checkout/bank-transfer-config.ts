import type { CheckoutBankTransferConfig } from "@/lib/api/checkout/checkout.repository";

export const BANK_TRANSFER_UNAVAILABLE_MESSAGE = "La transferencia bancaria no está disponible en este momento.";

const PLACEHOLDER_WORD = /\bdemo\b/i;

/**
 * Presentation-only check: the quote is the authority, this only keeps known
 * seed placeholders (zeroed CBU/CUIT, "Demo" labels) from being shown as real bank data.
 */
export function isUsableBankTransferConfig(config: CheckoutBankTransferConfig | null | undefined): config is CheckoutBankTransferConfig {
  if (!config) return false;

  const fields = [config.holderName, config.alias, config.bankName, config.cbuCvu, config.cuitCuil];
  if (fields.some((field) => !field?.trim())) return false;
  if ([config.holderName, config.alias, config.bankName].some((field) => PLACEHOLDER_WORD.test(field))) return false;

  const cbuDigits = config.cbuCvu.replace(/\D/g, "");
  if (!cbuDigits || /^0+$/.test(cbuDigits)) return false;

  const cuitDigits = config.cuitCuil.replace(/\D/g, "");
  if (!cuitDigits || /^0+$/.test(cuitDigits.slice(2, -1))) return false;

  return true;
}
