import { CATALOG_PRODUCTS } from "./catalog-commerce-baseline";

const SHOWCASE_FIXTURE_FAMILY = {
  ABANDONED_CARTS: "abandonedCarts",
  CATALOG: "catalog",
  CHECKOUT: "checkout",
  COMMERCE: "commerce",
  CUSTOMERS: "customers",
  SALES: "sales",
  INVENTORY: "inventory",
} as const;

type ShowcaseFixtureFamilyName = (typeof SHOWCASE_FIXTURE_FAMILY)[keyof typeof SHOWCASE_FIXTURE_FAMILY];

interface ShowcaseFixtureFamily {
  models: Readonly<Record<string, readonly string[]>>;
}

interface ShowcaseFixtureFamilies {
  abandonedCarts: ShowcaseFixtureFamily;
  catalog: ShowcaseFixtureFamily;
  checkout: ShowcaseFixtureFamily;
  commerce: ShowcaseFixtureFamily;
  customers: ShowcaseFixtureFamily;
  sales: ShowcaseFixtureFamily;
  inventory: ShowcaseFixtureFamily;
}

interface ShowcaseFixtureManifest {
  families: ShowcaseFixtureFamilies;
}

const SHOWCASE_FIXTURE_MANIFEST: ShowcaseFixtureManifest = {
  families: {
    abandonedCarts: {
      models: {
        cart: [
          "abandoned-cart-seed-cart-pending",
          "abandoned-cart-seed-cart-sent",
          "abandoned-cart-seed-cart-manual",
          "abandoned-cart-seed-cart-discarded",
        ],
        cartItem: [
          "abandoned-cart-seed-pending-item-whey",
          "abandoned-cart-seed-sent-item-creatine",
          "abandoned-cart-seed-manual-item-boxy",
          "abandoned-cart-seed-discarded-item-shaker",
        ],
        cartRecoverySettings: ["singleton"],
        checkoutSession: ["abandoned-cart-seed-pending", "abandoned-cart-seed-sent", "abandoned-cart-seed-manual", "abandoned-cart-seed-discarded"],
        checkoutSessionHistory: [
          "abandoned-cart-seed-pending-created",
          "abandoned-cart-seed-pending-abandoned",
          "abandoned-cart-seed-sent-created",
          "abandoned-cart-seed-sent-abandoned",
          "abandoned-cart-seed-sent-email",
          "abandoned-cart-seed-manual-created",
          "abandoned-cart-seed-manual-abandoned",
          "abandoned-cart-seed-manual-contact",
          "abandoned-cart-seed-discarded-created",
          "abandoned-cart-seed-discarded-abandoned",
          "abandoned-cart-seed-discarded-discarded",
        ],
      },
    },
    catalog: {
      models: {
        catalogSettings: ["singleton"],
        category: ["cat-supplements", "cat-protein", "cat-creatine-pre", "cat-vitamins", "cat-training", "cat-accessories", "cat-shakers", "cat-clothing", "cat-market"],
        product: ["p-whey-pro", "p-creatine", "p-pre", "p-boxy", "p-bar", "p-shaker", "p-mrs-taste", "p-magnesio", "p-pancakes", "p-bull-bar-caja", "p-notco-bar", "p-smartdiet-alfajor", "p-entrenuts-mix", "p-gold-oil", "prod-training-bands", "prod-training-gloves"],
        productCategory: ["p-whey-pro:cat-protein", "p-creatine:cat-creatine-pre", "p-pre:cat-creatine-pre", "p-boxy:cat-clothing", "p-bar:cat-market", "p-shaker:cat-shakers", "p-mrs-taste:cat-market", "p-magnesio:cat-vitamins", "p-pancakes:cat-market", "p-bull-bar-caja:cat-market", "p-notco-bar:cat-market", "p-smartdiet-alfajor:cat-market", "p-entrenuts-mix:cat-market", "p-gold-oil:cat-vitamins", "prod-training-bands:cat-accessories", "prod-training-gloves:cat-training"],
        productVariant: ["chocolate-900", "vainilla-900", "frutilla-900", "sin-sabor-300", "uva-250", "frutos-250", "negro-s", "negro-m", "negro-l", "negro-xl", "azul-s", "azul-m", "azul-l", "azul-xl", "box-12", "negro-700", "verde-700", "chocolate-335", "60-caps", "400g", "caja-x12", "chocolate-unit", "unidad", "500g", "60-softgels", "var-band-media", "var-band-alta", "var-gloves-s", "var-gloves-m", "var-gloves-l"],
      },
    },
    checkout: {
      models: {
        cart: ["checkout-seed-cart"],
        cartItem: ["checkout-seed-cart-item"],
        checkoutIdempotencyKey: ["checkout-seed-idempotency"],
        checkoutSession: ["checkout-seed-session"],
        coupon: ["checkout-seed-coupon"],
        couponRedemption: ["checkout-seed-redemption"],
        order: ["checkout-seed-order"],
        orderItem: ["checkout-seed-order-item"],
        orderPayment: ["checkout-seed-payment"],
        user: ["checkout-seed-customer"],
      },
    },
    commerce: {
      models: {
        paymentMethodConfig: ["bank-transfer", "mercado-pago", "stripe", "payway"],
        pickupPoint: ["retiro-principal"],
        shippingProvider: ["andreani", "correo-argentino"],
        weightBand: ["andreani-range-up-to-1kg", "andreani-range-1kg-to-3kg", "andreani-range-3kg-to-5kg", "andreani-range-5kg-to-10kg", "andreani-range-over-10kg", "correo-argentino-range-up-to-1kg", "correo-argentino-range-1kg-to-3kg", "correo-argentino-range-3kg-to-5kg", "correo-argentino-range-5kg-to-10kg", "correo-argentino-range-over-10kg"],
      },
    },
    customers: {
      models: {
        customer: ["cus_001", "cus_002", "cus_003", "cus_004", "cus_005", "cus_006", "cus_007", "cus_checkout_fixture"],
        customerAddress: ["cus_001", "cus_002", "cus_004", "cus_checkout_fixture"],
      },
    },
    sales: {
      models: {
        orderHistory: ["sales-crm-seed-order-created"],
        supplier: ["sales-crm-seed-supplier-nutrition", "sales-crm-seed-supplier-equipment"],
      },
    },
    inventory: {
      models: {
        product: CATALOG_PRODUCTS.map((product) => product.id),
        productVariant: CATALOG_PRODUCTS.flatMap((product) => product.variants.map((variant) => variant.id)),
      },
    },
  },
};

function getShowcaseManifestIdentityKeys(manifest: ShowcaseFixtureManifest): string[] {
  return Object.entries(manifest.families).flatMap(([family, fixtureFamily]) =>
    Object.keys(fixtureFamily.models).flatMap((model) =>
      fixtureFamily.models[model].map((id: string) => `${family}:${model}:${id}`),
    ),
  );
}

function assertShowcaseFixtureManifest(manifest: ShowcaseFixtureManifest): void {
  const identities = getShowcaseManifestIdentityKeys(manifest);
  if (new Set(identities).size !== identities.length) {
    throw new Error("Showcase fixture manifest contains duplicate model identities.");
  }
}

function assertShowcaseFixtureIds(family: ShowcaseFixtureFamilyName, models: Readonly<Record<string, readonly string[]>>): void {
  const expectedModels = SHOWCASE_FIXTURE_MANIFEST.families[family].models;
  for (const [model, expectedIds] of Object.entries(expectedModels)) {
    const actualIds = models[model] ?? [];
    if (actualIds.length !== expectedIds.length || expectedIds.some((id) => !actualIds.includes(id))) {
      throw new Error(`Showcase ${family} fixture IDs do not match the canonical manifest for ${model}.`);
    }
  }
}

export {
  SHOWCASE_FIXTURE_FAMILY,
  SHOWCASE_FIXTURE_MANIFEST,
  assertShowcaseFixtureIds,
  assertShowcaseFixtureManifest,
  getShowcaseManifestIdentityKeys,
};
export type { ShowcaseFixtureFamilyName, ShowcaseFixtureManifest };
