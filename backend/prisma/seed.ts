import "dotenv/config";

import * as bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  CatalogVisibility,
  PaymentMethodStatus,
  PickupCostType,
  PickupCoverageType,
  PickupPointStatus,
  Role,
  ShippingProviderStatus,
  StockMode,
} from "../src/generated/prisma/enums";
import { seedCheckout } from "./fixtures/checkout-fixtures";
import { seedCustomersCrm } from "./fixtures/customers-crm-fixtures";
import { seedSalesCrm } from "./fixtures/sales-crm-fixtures";

const ADMIN_PASSWORD_SALT_ROUNDS = 12;
const CATALOG_SETTINGS_ID = "singleton";
const STOCK_KIND = { INFINITE: "infinite", TRACKED: "tracked" } as const;
const PAYMENT_METHOD_STATUS = { INACTIVE: PaymentMethodStatus.INACTIVE } as const;
const SHIPPING_PROVIDER_STATUS = { NOT_CONFIGURED: ShippingProviderStatus.NOT_CONFIGURED } as const;
const PICKUP_POINT_STATUS = { NOT_CONFIGURED: PickupPointStatus.NOT_CONFIGURED } as const;
const COMMERCE_DEFAULT_PREPARATION_HOURS = 24;

interface PaymentOptionSeed {
  id: string;
  salesIn: string;
  receiveIn: string;
  fee: string;
}

interface BankTransferConfigSeed extends Record<string, string> {
  cbuCvu: string;
  alias: string;
  holderName: string;
  cuitCuil: string;
  bankName: string;
}

interface PaymentMethodSeed {
  id: string;
  name: string;
  description: string;
  logoSrc: string;
  acceptedMethods: readonly string[];
  options: readonly PaymentOptionSeed[];
  bankConfig?: BankTransferConfigSeed;
}

interface WeightBandSeed {
  id: string;
  minWeightGrams: number;
  maxWeightGrams: number | null;
  cost: string;
  sortOrder: number;
}

interface ShippingProviderSeed {
  id: string;
  name: string;
}

type StockKind = (typeof STOCK_KIND)[keyof typeof STOCK_KIND];

interface StockSeed {
  kind: StockKind;
  quantity?: number;
}

interface VariantSeed {
  id: string;
  name: string;
  stock: StockSeed;
  compareAtPrice?: string;
  price?: string;
  attributes?: Prisma.InputJsonValue;
  sku?: string;
}

interface ProductSeed {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  categoryId: string;
  salePrice: string;
  stock: StockSeed;
  variants: readonly VariantSeed[];
  brand?: string;
  compareAtPrice?: string;
  description?: string;
  imageTone?: string;
  legacySourceId?: string;
  manualOrder: number;
  promotionalPrice?: string;
  tags?: readonly string[];
  variantProperties?: Prisma.InputJsonValue;
  visibility?: CatalogVisibility;
}

interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  parentId?: string;
  description?: string;
  visibility?: CatalogVisibility;
}

const PAYMENT_METHODS: readonly PaymentMethodSeed[] = [
  {
    id: "bank-transfer",
    name: "Transferencia Bancaria",
    description: "Recibí pagos directos en una cuenta bancaria o billetera virtual.",
    logoSrc: "/transfer.svg",
    acceptedMethods: ["Transferencia bancaria"],
    options: [{ id: "direct-transfer", salesIn: "En el momento", receiveIn: "En el momento", fee: "0%" }],
    bankConfig: {
      cbuCvu: "0000000000000000000000",
      alias: "ENTRENAR.DEMO",
      holderName: "EntrenAR Demo",
      cuitCuil: "20-00000000-0",
      bankName: "Banco Demo",
    },
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
    options: [{ id: "stripe-eea-standard", salesIn: "En el momento", receiveIn: "En el momento", fee: "2.9% + USD0.30" }],
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
] as const;

const DEFAULT_WEIGHT_BANDS: readonly WeightBandSeed[] = [
  { id: "range-up-to-1kg", minWeightGrams: 0, maxWeightGrams: 1000, cost: "7500.00", sortOrder: 1 },
  { id: "range-1kg-to-3kg", minWeightGrams: 1000, maxWeightGrams: 3000, cost: "10500.00", sortOrder: 2 },
  { id: "range-3kg-to-5kg", minWeightGrams: 3000, maxWeightGrams: 5000, cost: "15000.00", sortOrder: 3 },
  { id: "range-5kg-to-10kg", minWeightGrams: 5000, maxWeightGrams: 10000, cost: "22000.00", sortOrder: 4 },
  { id: "range-over-10kg", minWeightGrams: 10000, maxWeightGrams: null, cost: "30000.00", sortOrder: 5 },
] as const;

const SHIPPING_PROVIDERS: readonly ShippingProviderSeed[] = [
  { id: "andreani", name: "Andreani" },
  { id: "correo-argentino", name: "Correo Argentino" },
] as const;

const seedEnvironmentSchema = z.object({
  ADMIN_EMAIL: z.email({ error: "ADMIN_EMAIL must be a valid email address." }),
  ADMIN_PASSWORD: z.string().min(12, { error: "ADMIN_PASSWORD must contain at least 12 characters." }),
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid database URL." }),
});

// Reconciles public and admin mock identities without accepting their two stale
// public-slug collisions as canonical records.
const ADMIN_LEGACY_ID_BY_CANONICAL_PRODUCT = {
  "p-creatine": "prod-creatine",
  "p-whey-pro": "prod-whey-pro",
} as const;

const CATEGORIES: readonly CategorySeed[] = [
  { id: "cat-supplements", name: "Suplementos", slug: "suplementos", sortOrder: 1, description: "Nutrición deportiva y apoyo al rendimiento." },
  { id: "cat-protein", name: "Proteínas", slug: "proteinas", parentId: "cat-supplements", sortOrder: 1 },
  { id: "cat-creatine-pre", name: "Creatina y pre", slug: "creatina-y-pre", parentId: "cat-supplements", sortOrder: 2 },
  { id: "cat-vitamins", name: "Vitaminas", slug: "vitaminas", parentId: "cat-supplements", sortOrder: 3 },
  { id: "cat-training", name: "Entrenamiento", slug: "entrenamiento", sortOrder: 2 },
  { id: "cat-accessories", name: "Accesorios", slug: "accesorios", sortOrder: 3, visibility: CatalogVisibility.HIDDEN },
  { id: "cat-shakers", name: "Shakers", slug: "shakers", sortOrder: 4 },
  { id: "cat-clothing", name: "Indumentaria", slug: "indumentaria", sortOrder: 5 },
  { id: "cat-market", name: "Market", slug: "market", sortOrder: 6 },
] as const;

const tracked = (quantity: number): StockSeed => ({ kind: STOCK_KIND.TRACKED, quantity });
const infinite = (): StockSeed => ({ kind: STOCK_KIND.INFINITE });

// Curated from src/lib/data/products.ts. Ratings, review counts, and generated
// gallery images deliberately remain outside the persistence foundation.
const PUBLIC_PRODUCTS: readonly ProductSeed[] = [
  { id: "p-whey-pro", slug: "whey-protein-isolate-900g", publicSlug: "whey-protein-isolate-900g", name: "Whey Protein Isolate 900g", brand: "Body Advance", categoryId: "cat-protein", salePrice: "78900.00", stock: tracked(18), manualOrder: 1, legacySourceId: ADMIN_LEGACY_ID_BY_CANONICAL_PRODUCT["p-whey-pro"], imageTone: "green", tags: ["25g proteína", "Bajo azúcar", "Sin TACC"], variants: [{ id: "chocolate-900", name: "Chocolate", stock: tracked(18), sku: "SUP-WHEY-001-CHO" }, { id: "vainilla-900", name: "Vainilla", stock: tracked(11), sku: "SUP-WHEY-001-VAI" }, { id: "frutilla-900", name: "Frutilla", stock: tracked(7), price: "77900.00" }] },
  { id: "p-creatine", slug: "creatina-monohidrato-300g", publicSlug: "creatina-monohidrato-300g", name: "Creatina Monohidrato 300g", brand: "Star Nutrition", categoryId: "cat-creatine-pre", salePrice: "31200.00", stock: tracked(24), manualOrder: 2, legacySourceId: ADMIN_LEGACY_ID_BY_CANONICAL_PRODUCT["p-creatine"], imageTone: "black", tags: ["Micronizada", "Sin sabor", "300g"], variants: [{ id: "sin-sabor-300", name: "Sin sabor", stock: tracked(24) }] },
  { id: "p-pre", slug: "pre-workout-energy-250g", publicSlug: "pre-workout-energy-250g", name: "Pre Workout Energy 250g", brand: "ENA", categoryId: "cat-creatine-pre", salePrice: "28000.00", compareAtPrice: "40000.00", stock: tracked(6), manualOrder: 3, imageTone: "red", variants: [{ id: "uva-250", name: "Uva", stock: tracked(6), compareAtPrice: "40000.00" }, { id: "frutos-250", name: "Frutos rojos", stock: tracked(0) }] },
  { id: "p-boxy", slug: "remera-boxy-fit-drop-0", publicSlug: "remera-boxy-fit-drop-0", name: "Remera Boxy Fit DROP #0", brand: "EntrenAR", categoryId: "cat-clothing", salePrice: "49999.00", compareAtPrice: "71990.00", stock: tracked(18), manualOrder: 4, imageTone: "blue", variantProperties: [{ id: "color", name: "Color", values: [{ id: "negro", label: "Negro" }, { id: "azul", label: "Azul" }] }, { id: "talle", name: "Talle", values: [{ id: "s", label: "S" }, { id: "m", label: "M" }, { id: "l", label: "L" }, { id: "xl", label: "XL" }] }], variants: [{ id: "negro-s", name: "Negro / S", stock: tracked(4), attributes: { color: "negro", talle: "s" } }, { id: "negro-m", name: "Negro / M", stock: tracked(5), attributes: { color: "negro", talle: "m" } }, { id: "negro-l", name: "Negro / L", stock: tracked(0), attributes: { color: "negro", talle: "l" } }, { id: "negro-xl", name: "Negro / XL", stock: tracked(2), attributes: { color: "negro", talle: "xl" } }, { id: "azul-s", name: "Azul / S", stock: tracked(3), attributes: { color: "azul", talle: "s" } }, { id: "azul-m", name: "Azul / M", stock: tracked(4), attributes: { color: "azul", talle: "m" } }, { id: "azul-l", name: "Azul / L", stock: tracked(3), attributes: { color: "azul", talle: "l" } }, { id: "azul-xl", name: "Azul / XL", stock: tracked(0), attributes: { color: "azul", talle: "xl" } }] },
  { id: "p-bar", slug: "protein-bar-chocolate-box", publicSlug: "protein-bar-chocolate-box", name: "Protein Bar Chocolate Box", brand: "Gentech", categoryId: "cat-market", salePrice: "22800.00", stock: tracked(20), manualOrder: 5, variants: [{ id: "box-12", name: "Chocolate", stock: tracked(20) }] },
  { id: "p-shaker", slug: "shaker-entrenar-700ml", publicSlug: "shaker-entrenar-700ml", name: "Shaker EntrenAR 700ml", brand: "EntrenAR", categoryId: "cat-shakers", salePrice: "8900.00", stock: tracked(32), manualOrder: 6, variants: [{ id: "negro-700", name: "Negro 700ml", stock: tracked(17) }, { id: "verde-700", name: "Verde 700ml", stock: tracked(15) }] },
  { id: "p-mrs-taste", slug: "mrs-taste-chocolate-zero-335g", publicSlug: "mrs-taste-chocolate-zero-335g", name: "Mrs Taste Chocolate Zero 335g", brand: "Mrs Taste", categoryId: "cat-market", salePrice: "11372.00", compareAtPrice: "14215.00", stock: tracked(18), manualOrder: 7, variants: [{ id: "chocolate-335", name: "Chocolate", stock: tracked(18), compareAtPrice: "14215.00" }] },
  { id: "p-magnesio", slug: "ena-citrato-magnesio-60-caps", publicSlug: "ena-citrato-magnesio-60-caps", name: "ENA Citrato de Magnesio 60 CAPS", brand: "ENA", categoryId: "cat-vitamins", salePrice: "13940.00", compareAtPrice: "17425.00", stock: tracked(14), manualOrder: 8, variants: [{ id: "60-caps", name: "Unico", stock: tracked(14), compareAtPrice: "17425.00" }] },
  { id: "p-pancakes", slug: "granger-pancake-proteicos-400g", publicSlug: "granger-pancake-proteicos-400g", name: "Granger Pancake Proteicos 400g", brand: "Granger", categoryId: "cat-market", salePrice: "14000.00", compareAtPrice: "17500.00", stock: tracked(10), manualOrder: 9, variants: [{ id: "400g", name: "Unico", stock: tracked(10), compareAtPrice: "17500.00" }] },
  { id: "p-bull-bar-caja", slug: "bull-bar-60gr-caja-x12", publicSlug: "bull-bar-60gr-caja-x12", name: "Bull Bar 60gr Caja x12", brand: "Bull Bar", categoryId: "cat-market", salePrice: "34800.00", compareAtPrice: "43500.00", stock: tracked(12), manualOrder: 10, variants: [{ id: "caja-x12", name: "Chocolate", stock: tracked(12), compareAtPrice: "43500.00" }] },
  { id: "p-notco-bar", slug: "notco-protein-bar-chocolate", publicSlug: "notco-protein-bar-chocolate", name: "Notco Protein Bar Chocolate", brand: "Notco", categoryId: "cat-market", salePrice: "4200.00", compareAtPrice: "5250.00", stock: tracked(30), manualOrder: 11, variants: [{ id: "chocolate-unit", name: "Chocolate", stock: tracked(30), compareAtPrice: "5250.00" }] },
  { id: "p-smartdiet-alfajor", slug: "smartdiet-alfajor-proteico", publicSlug: "smartdiet-alfajor-proteico", name: "Smartdiet Alfajor Proteico", brand: "Smartdiet", categoryId: "cat-market", salePrice: "3100.00", compareAtPrice: "3900.00", stock: tracked(28), manualOrder: 12, variants: [{ id: "unidad", name: "Unidad", stock: tracked(28), compareAtPrice: "3900.00" }] },
  { id: "p-entrenuts-mix", slug: "entrenuts-mix-frutos-secos-500g", publicSlug: "entrenuts-mix-frutos-secos-500g", name: "Entrenuts Mix Frutos Secos 500g", brand: "Entrenuts", categoryId: "cat-market", salePrice: "9200.00", compareAtPrice: "11500.00", stock: tracked(16), manualOrder: 13, variants: [{ id: "500g", name: "Unico", stock: tracked(16), compareAtPrice: "11500.00" }] },
  { id: "p-gold-oil", slug: "gold-nutrition-fish-oil-60-softgels", publicSlug: "gold-nutrition-fish-oil-60-softgels", name: "Gold Nutrition Fish Oil 60 Softgels", brand: "Gold Nutrition", categoryId: "cat-vitamins", salePrice: "15800.00", compareAtPrice: "19750.00", stock: tracked(11), manualOrder: 14, variants: [{ id: "60-softgels", name: "Unico", stock: tracked(11), compareAtPrice: "19750.00" }] },
] as const;

// The two admin-only records retain their admin IDs. Their stale mock
// publicSlug values collided with p-shaker and p-boxy, so canonical slugs use
// their own CRM slug rather than overwriting established public URLs.
const ADMIN_ONLY_PRODUCTS: readonly ProductSeed[] = [
  { id: "prod-training-bands", slug: "set-bandas-entrenamiento", publicSlug: "set-bandas-entrenamiento", name: "Set de Bandas de Entrenamiento", brand: "EntrenAR", categoryId: "cat-accessories", salePrice: "18900.00", promotionalPrice: "15900.00", stock: infinite(), manualOrder: 15, variantProperties: [{ id: "resistencia", name: "Resistencia", values: [{ id: "media", label: "Media" }, { id: "alta", label: "Alta" }] }], variants: [{ id: "var-band-media", name: "Media", sku: "ACC-BAND-SET-MED", stock: infinite(), attributes: { resistencia: "media" } }, { id: "var-band-alta", name: "Alta", sku: "ACC-BAND-SET-ALT", stock: infinite(), attributes: { resistencia: "alta" } }] },
  { id: "prod-training-gloves", slug: "guantes-training-pro", publicSlug: "guantes-training-pro", name: "Guantes Training Pro", brand: "EntrenAR", categoryId: "cat-training", salePrice: "21900.00", stock: tracked(0), manualOrder: 16, visibility: CatalogVisibility.HIDDEN, variantProperties: [{ id: "talle", name: "Talle", values: [{ id: "s", label: "S" }, { id: "m", label: "M" }, { id: "l", label: "L" }] }], variants: [{ id: "var-gloves-s", name: "S", sku: "ACC-GLOV-PRO-S", stock: tracked(0), attributes: { talle: "s" } }, { id: "var-gloves-m", name: "M", sku: "ACC-GLOV-PRO-M", stock: tracked(0), attributes: { talle: "m" } }, { id: "var-gloves-l", name: "L", sku: "ACC-GLOV-PRO-L", stock: tracked(0), attributes: { talle: "l" } }] },
] as const;

function stockFields(stock: StockSeed): { stockMode: StockMode; quantity: number | null } {
  if (stock.kind === STOCK_KIND.INFINITE) return { quantity: null, stockMode: StockMode.INFINITE };
  if (stock.quantity === undefined || stock.quantity < 0 || !Number.isInteger(stock.quantity)) {
    throw new Error("Tracked catalog seed stock must be a non-negative integer.");
  }
  return { quantity: stock.quantity, stockMode: StockMode.TRACKED };
}

function productSku(product: ProductSeed): string {
  if (product.id === "p-whey-pro") return "SUP-WHEY-001";
  if (product.id === "p-creatine") return "SUP-CREA-300";
  return `CAT-${product.id.toUpperCase()}`;
}

function inferredProperties(product: ProductSeed): Prisma.InputJsonValue {
  if (product.variantProperties) return product.variantProperties;
  if (product.variants.length < 2) return [];
  return [{ id: "option", name: "Option", values: product.variants.map((variant) => ({ id: variant.id, label: variant.name })) }];
}

function attributes(product: ProductSeed, variant: VariantSeed): Prisma.InputJsonValue {
  if (variant.attributes) return variant.attributes;
  return product.variants.length < 2 ? {} : { option: variant.id };
}

async function seedAdmin(prisma: PrismaClient, email: string, password: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = existing && await bcrypt.compare(password, existing.passwordHash)
    ? existing.passwordHash
    : await bcrypt.hash(password, ADMIN_PASSWORD_SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: Role.ADMIN },
    update: { passwordHash, role: Role.ADMIN },
  });
}

async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      create: { ...category, visibility: category.visibility ?? CatalogVisibility.VISIBLE },
      update: { ...category, visibility: category.visibility ?? CatalogVisibility.VISIBLE },
    });
  }

  for (const product of [...PUBLIC_PRODUCTS, ...ADMIN_ONLY_PRODUCTS]) {
    const productStock = stockFields(product.stock);
    const existingProduct = await prisma.product.findUnique({
      where: { publicSlug: product.publicSlug },
    });

    if (existingProduct && existingProduct.id !== product.id) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: { id: product.id },
      });
    }

    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        ...productStock,
        brand: product.brand,
        compareAtPrice: product.compareAtPrice,
        description: product.description,
        highlightSections: [],
        id: product.id,
        imageTone: product.imageTone,
        legacySourceId: product.legacySourceId,
        manualOrder: product.manualOrder,
        name: product.name,
        promotionalPrice: product.promotionalPrice,
        publicSlug: product.publicSlug,
        salePrice: product.salePrice,
        sku: productSku(product),
        slug: product.slug,
        subcategorySlugs: [],
        tags: [...(product.tags ?? [])],
        variantProperties: inferredProperties(product),
        visibility: product.visibility ?? CatalogVisibility.VISIBLE,
      },
      update: {
        ...productStock,
        brand: product.brand,
        compareAtPrice: product.compareAtPrice,
        description: product.description,
        highlightSections: [],
        imageTone: product.imageTone,
        legacySourceId: product.legacySourceId,
        manualOrder: product.manualOrder,
        name: product.name,
        promotionalPrice: product.promotionalPrice,
        publicSlug: product.publicSlug,
        salePrice: product.salePrice,
        sku: productSku(product),
        slug: product.slug,
        subcategorySlugs: [],
        tags: [...(product.tags ?? [])],
        variantProperties: inferredProperties(product),
        visibility: product.visibility ?? CatalogVisibility.VISIBLE,
      },
    });
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: product.categoryId } },
      create: { productId: product.id, categoryId: product.categoryId },
      update: {},
    });
    for (const variant of product.variants) {
      await prisma.productVariant.upsert({
        where: { id: variant.id },
        create: { ...stockFields(variant.stock), attributes: attributes(product, variant), compareAtPrice: variant.compareAtPrice, id: variant.id, isDefault: product.variants.length === 1, name: variant.name, price: variant.price, productId: product.id, sku: variant.sku ?? `${productSku(product)}-${variant.id.toUpperCase()}` },
        update: { ...stockFields(variant.stock), attributes: attributes(product, variant), compareAtPrice: variant.compareAtPrice, isDefault: product.variants.length === 1, name: variant.name, price: variant.price, productId: product.id, sku: variant.sku ?? `${productSku(product)}-${variant.id.toUpperCase()}` },
      });
    }
  }
  await prisma.catalogSettings.upsert({
    where: { id: CATALOG_SETTINGS_ID },
    create: { id: CATALOG_SETTINGS_ID, persistOrder: true, showOutOfStockAtEnd: true },
    update: { persistOrder: true, showOutOfStockAtEnd: true },
  });
}

async function seedPaymentMethods(prisma: PrismaClient): Promise<void> {
  for (const paymentMethod of PAYMENT_METHODS) {
    await prisma.paymentMethodConfig.upsert({
      where: { id: paymentMethod.id },
      create: {
        acceptedMethods: [...paymentMethod.acceptedMethods],
        bankConfig: paymentMethod.bankConfig ?? Prisma.DbNull,
        description: paymentMethod.description,
        id: paymentMethod.id,
        logoSrc: paymentMethod.logoSrc,
        name: paymentMethod.name,
        options: paymentMethod.options.map((option) => ({ ...option })),
        selectedOptionId: null,
        status: PAYMENT_METHOD_STATUS.INACTIVE,
      },
      update: {
        acceptedMethods: [...paymentMethod.acceptedMethods],
        bankConfig: paymentMethod.bankConfig ?? Prisma.DbNull,
        description: paymentMethod.description,
        logoSrc: paymentMethod.logoSrc,
        name: paymentMethod.name,
        options: paymentMethod.options.map((option) => ({ ...option })),
        selectedOptionId: null,
        status: PAYMENT_METHOD_STATUS.INACTIVE,
      },
    });
  }
}

async function seedShippingProviders(prisma: PrismaClient): Promise<void> {
  for (const provider of SHIPPING_PROVIDERS) {
    await prisma.shippingProvider.upsert({
      where: { id: provider.id },
      create: {
        enabledModalities: [],
        id: provider.id,
        name: provider.name,
        status: SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED,
      },
      update: {
        enabledModalities: [],
        name: provider.name,
        status: SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED,
      },
    });

    for (const [index, defaultBand] of DEFAULT_WEIGHT_BANDS.entries()) {
      const band: WeightBandSeed = {
        ...defaultBand,
        id: `${provider.id}-${defaultBand.id}`,
        sortOrder: index + 1,
      };

      await prisma.weightBand.upsert({
        where: { id: band.id },
        create: {
          cost: band.cost,
          id: band.id,
          maxWeightGrams: band.maxWeightGrams,
          minWeightGrams: band.minWeightGrams,
          shippingProviderId: provider.id,
          sortOrder: band.sortOrder,
        },
        update: {
          cost: band.cost,
          maxWeightGrams: band.maxWeightGrams,
          minWeightGrams: band.minWeightGrams,
          shippingProviderId: provider.id,
          sortOrder: band.sortOrder,
        },
      });
    }
  }
}

async function seedPickupPoints(prisma: PrismaClient): Promise<void> {
  await prisma.pickupPoint.upsert({
    where: { id: "retiro-principal" },
    create: {
      city: null,
      contactEmail: null,
      contactName: null,
      contactPhone: null,
      costType: PickupCostType.FREE,
      coverageType: PickupCoverageType.ALL,
      fixedCost: null,
      id: "retiro-principal",
      isMain: true,
      name: "Punto de retiro principal",
      number: null,
      postalCode: null,
      preparationHours: COMMERCE_DEFAULT_PREPARATION_HOURS,
      provinces: [],
      province: null,
      status: PICKUP_POINT_STATUS.NOT_CONFIGURED,
      street: null,
    },
    update: {
      city: null,
      contactEmail: null,
      contactName: null,
      contactPhone: null,
      costType: PickupCostType.FREE,
      coverageType: PickupCoverageType.ALL,
      fixedCost: null,
      isMain: true,
      name: "Punto de retiro principal",
      number: null,
      postalCode: null,
      preparationHours: COMMERCE_DEFAULT_PREPARATION_HOURS,
      provinces: [],
      province: null,
      status: PICKUP_POINT_STATUS.NOT_CONFIGURED,
      street: null,
    },
  });
}

async function seedCommerce(prisma: PrismaClient): Promise<void> {
  await seedPaymentMethods(prisma);
  await seedShippingProviders(prisma);
  await seedPickupPoints(prisma);
}

async function main(): Promise<void> {
  const environment = seedEnvironmentSchema.parse(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }) });
  try {
    await seedAdmin(prisma, environment.ADMIN_EMAIL.toLowerCase(), environment.ADMIN_PASSWORD);
    await seedCatalog(prisma);
    await seedCommerce(prisma);
    await seedCheckout(prisma);
    await seedCustomersCrm(prisma);
    await seedSalesCrm(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
