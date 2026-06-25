export type PaymentProviderId = "bank-transfer" | "mercado-pago" | "stripe" | "payway";

export type PaymentStatus = "active" | "inactive";

export type PaymentProviderOption = {
  id: string;
  salesIn: string;
  receiveIn: string;
  fee: string;
};

export type PaymentProviderDefinition = {
  id: PaymentProviderId;
  name: string;
  description: string;
  logoSrc: string;
  acceptedMethods: string[];
  options: PaymentProviderOption[];
};

export const paymentProviderOrder: PaymentProviderId[] = [
  "bank-transfer",
  "mercado-pago",
  "stripe",
  "payway",
];

const paymentProviderDefinitions: PaymentProviderDefinition[] = [
  {
    id: "bank-transfer",
    name: "Transferencia Bancaria",
    description: "Recibí pagos directos en una cuenta bancaria o billetera virtual.",
    logoSrc: "/transfer.svg",
    acceptedMethods: ["Transferencia bancaria"],
    options: [{ id: "direct-transfer", salesIn: "En el momento", receiveIn: "En el momento", fee: "0%" }],
  },
  {
    id: "mercado-pago",
    name: "Mercado Pago",
    description: "Cobranzas con dinero en cuenta, tarjetas y medios de pago locales.",
    logoSrc: "/mercadoPago.svg",
    acceptedMethods: ["Billetera virtual", "Tarjeta de débito", "Tarjeta de crédito", "Pago en efectivo / redes de cobranza"],
    options: [
      { id: "mp-instant", salesIn: "En el momento", receiveIn: "En el momento", fee: "6.29%" },
      { id: "mp-10-days", salesIn: "10 días", receiveIn: "10 días", fee: "4.39%" },
      { id: "mp-18-days", salesIn: "18 días", receiveIn: "18 días", fee: "3.39%" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Procesamiento internacional para tarjetas y billeteras compatibles.",
    logoSrc: "/stripeLogo.svg",
    acceptedMethods: ["Tarjetas internacionales"],
    options: [
      { id: "stripe-eea-standard", salesIn: "En el momento", receiveIn: "En el momento", fee: "2.9% + USD0.30" },
    ],
  },
  {
    id: "payway",
    name: "Payway",
    description: "Cobros con tarjetas locales y acreditación configurable.",
    logoSrc: "/payway.svg",
    acceptedMethods: ["Tarjetas de crédito", "Tarjetas de débito", "Tarjetas prepagas", "QR", "Billeteras virtuales"],
    options: [
      { id: "payway-debit", salesIn: "En el momento", receiveIn: "En el momento", fee: "1.20% + IVA" },
      { id: "payway-credit-instant", salesIn: "En el momento (crédito)", receiveIn: "En el momento (crédito)", fee: "6.30% + IVA" },
      { id: "payway-credit-8-business-days", salesIn: "Crédito a 8 días hábiles", receiveIn: "Crédito a 8 días hábiles", fee: "2.00% + IVA" },
    ],
  },
];

export async function getPaymentProviderDefinitions() {
  return paymentProviderDefinitions;
}
