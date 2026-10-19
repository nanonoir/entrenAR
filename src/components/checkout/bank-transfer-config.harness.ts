import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BANK_TRANSFER_UNAVAILABLE_MESSAGE,
  isUsableBankTransferConfig,
} from "@/components/checkout/bank-transfer-config";
import { getCheckoutConfigurationIssue } from "@/components/checkout/checkout-form.validators";
import type { CheckoutBankTransferConfig, CheckoutQuote } from "@/lib/api/checkout/checkout.repository";

const realConfig: CheckoutBankTransferConfig = {
  alias: "ENTRENAR.TIENDA",
  bankName: "Banco Nación",
  cbuCvu: "0110599520000012345678",
  cuitCuil: "30-71234567-9",
  holderName: "EntrenAR S.A.",
};

function run(): void {
  assert(isUsableBankTransferConfig(realConfig), "A real bank configuration must be usable.");
  assert(!isUsableBankTransferConfig(undefined), "A missing bank configuration must not be usable.");
  assert(!isUsableBankTransferConfig({ ...realConfig, cbuCvu: "0000000000000000000000" }), "A zeroed CBU must be a placeholder.");
  assert(!isUsableBankTransferConfig({ ...realConfig, cuitCuil: "20-00000000-0" }), "A zeroed CUIT must be a placeholder.");
  assert(!isUsableBankTransferConfig({ ...realConfig, holderName: "EntrenAR Demo" }), "A Demo holder must be a placeholder.");
  assert(!isUsableBankTransferConfig({ ...realConfig, alias: "ENTRENAR.DEMO" }), "A DEMO alias must be a placeholder.");
  assert(!isUsableBankTransferConfig({ ...realConfig, bankName: "Banco Demo" }), "A Demo bank must be a placeholder.");
  assert(!isUsableBankTransferConfig({ ...realConfig, alias: " " }), "A blank field must not be usable.");

  assert(
    getCheckoutConfigurationIssue(quoteWith(undefined), null, null, null, "bank-transfer") === BANK_TRANSFER_UNAVAILABLE_MESSAGE,
    "Missing bank configuration must block bank transfer.",
  );
  assert(
    getCheckoutConfigurationIssue(quoteWith({ ...realConfig, holderName: "EntrenAR Demo" }), null, null, null, "bank-transfer") === BANK_TRANSFER_UNAVAILABLE_MESSAGE,
    "Placeholder bank configuration must block bank transfer.",
  );
  assert(
    getCheckoutConfigurationIssue(quoteWith(realConfig), null, null, null, "bank-transfer") === null,
    "Real bank configuration must not require a phantom transfer proof or raise an issue.",
  );

  const root = process.cwd();
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");
  for (const path of [
    "src/components/checkout/use-checkout-wizard.ts",
    "src/components/checkout/use-checkout-completion.ts",
    "src/components/checkout/use-checkout-form-state.ts",
    "src/components/checkout/BankTransferPanel.tsx",
    "src/components/checkout/CheckoutPayment.tsx",
  ]) {
    const source = read(path);
    assert(!/hasTransferProof|TransferProof|type="file"/.test(source), `${path} must not require or collect a local transfer proof.`);
  }

  for (const path of [
    "src/app/(shop)/boton-de-arrepentimiento/page.tsx",
    "src/app/(shop)/cambios-y-devoluciones/page.tsx",
    "src/components/shop/support/SupportRequestUnavailable.tsx",
  ]) {
    assert(!/Recibimos tu solicitud|Solicitud recibida|SupportActionForm|onSubmit/.test(read(path)), `${path} must not simulate a received support request.`);
  }
  assert(
    read("src/components/shop/support/SupportRequestUnavailable.tsx").includes("La solicitud online no está disponible en este momento"),
    "Support routes must state that the online request is unavailable.",
  );

  for (const path of ["src/components/shop/support/OrderTrackingForm.tsx"]) {
    assert(!/en esta etapa/.test(read(path)), `${path} must not contain development-stage wording.`);
  }

  console.log("bank transfer config and support copy harness: passed");
}

function quoteWith(bankConfig: CheckoutBankTransferConfig | undefined): CheckoutQuote {
  return {
    paymentMethods: [{
      acceptedMethods: ["Transferencia bancaria"],
      ...(bankConfig ? { bankConfig } : {}),
      description: "Transferencia",
      id: "bank-transfer",
      logoSrc: "/transfer.svg",
      name: "Transferencia Bancaria",
      options: [{ fee: "0%", id: "direct-transfer", receiveIn: "Now", salesIn: "Now" }],
      selectedOptionId: "direct-transfer",
    }],
    pickupPoints: [],
    shippingOptions: [],
  } as unknown as CheckoutQuote;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

run();
