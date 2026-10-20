export type CheckoutStepId = "identification" | "delivery" | "payment";

export type CheckoutPaymentMethodId = "mercado-pago" | "stripe" | "bank-transfer";

export type CheckoutShippingProvider = {
  id: string;
  name: string;
  logoSrc: string;
  eta: string;
  price: number;
  description: string;
};

export type CheckoutPickupPoint = {
  id: string;
  name: string;
  address: string;
  eta: string;
};

export type CheckoutPostalCodeLocation = {
  postalCode: string;
  province: string;
  cities: string[];
  pickupPoints: CheckoutPickupPoint[];
};

export type CheckoutPaymentMethod = {
  id: CheckoutPaymentMethodId;
  logoSrc: string;
  title: string;
  description: string;
  helper: string;
};

export const checkoutSecureCopy = {
  title: "Compra segura",
  description: "Revisá los datos de tu pedido antes de confirmarlo.",
  finalActionLabel: "Confirmar pedido",
} as const;

export const checkoutCouponCopy = {
  title: "Cupón de descuento",
  placeholder: "Ingresá tu cupón",
  helper: "El descuento se calcula y valida al aplicar el cupón.",
  actionLabel: "Añadir",
} as const;

export const checkoutSteps = [
  {
    id: "identification",
    title: "Identificación",
    summary: "Datos de contacto para continuar la compra.",
  },
  {
    id: "delivery",
    title: "Entrega",
    summary: "Código postal, método de envío y dirección de entrega.",
  },
  {
    id: "payment",
    title: "Pago",
    summary: "Medios de pago estáticos para validar la experiencia visual.",
  },
] satisfies Array<{ id: CheckoutStepId; title: string; summary: string }>;

export const checkoutShippingProviders: CheckoutShippingProvider[] = [
  {
    id: "andreani-home",
    name: "Andreani a domicilio",
    logoSrc: "/andreani.svg",
    eta: "3 a 5 días hábiles",
    price: 4200,
    description: "Entrega a domicilio.",
  },
  {
    id: "correo-argentino-branch",
    name: "Correo Argentino sucursal",
    logoSrc: "/correoArgentino.svg",
    eta: "4 a 7 días hábiles",
    price: 3600,
    description: "Retiro en sucursal.",
  },
];

export const checkoutPostalCodeLocations: CheckoutPostalCodeLocation[] = [
  {
    postalCode: "3400",
    province: "Corrientes",
    cities: ["Corrientes", "Goya", "Bella Vista"],
    pickupPoints: [
      {
        id: "corrientes-centro",
        name: "EntrenAR Point Corrientes Centro",
        address: "Junín 1240, Corrientes Capital",
        eta: "Retiro disponible en 24 hs hábiles",
      },
      {
        id: "goya-terminal",
        name: "Punto Goya Terminal",
        address: "Av. Italia 650, Goya",
        eta: "Retiro disponible en 48 hs hábiles",
      },
      {
        id: "bella-vista-norte",
        name: "Bella Vista Norte Pick Up",
        address: "Salta 310, Bella Vista",
        eta: "Retiro disponible en 48 hs hábiles",
      },
    ],
  },
  {
    postalCode: "1406",
    province: "Ciudad Autónoma de Buenos Aires",
    cities: ["Ciudad Autónoma de Buenos Aires", "Ramos Mejía", "Morón"],
    pickupPoints: [
      {
        id: "caballito-store",
        name: "EntrenAR Point Caballito",
        address: "Av. Rivadavia 5400, CABA",
        eta: "Retiro disponible en 24 hs hábiles",
      },
    ],
  },
];

export const checkoutPaymentMethods: CheckoutPaymentMethod[] = [
  {
    id: "mercado-pago",
    logoSrc: "/mercadoPago.svg",
    title: "Mercado Pago",
    description: "Tarjetas, saldo o dinero en cuenta.",
    helper: "Disponibilidad a confirmar al cotizar tu pedido.",
  },
  {
    id: "stripe",
    logoSrc: "/stripe.svg",
    title: "Stripe",
    description: "Pago con tarjeta.",
    helper: "Disponibilidad a confirmar al cotizar tu pedido.",
  },
  {
    id: "bank-transfer",
    logoSrc: "/transfer.svg",
    title: "Transferencia bancaria",
    description: "Pago por transferencia bancaria.",
    helper: "Disponibilidad a confirmar al cotizar tu pedido.",
  },
];

export const bankTransferInstructions = {
  accountHolder: "EntrenAR Demo",
  alias: "ENTRENAR.DEMO",
  cbu: "0000000000000000000000",
} as const;
