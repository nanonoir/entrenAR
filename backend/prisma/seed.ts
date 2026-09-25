import "dotenv/config";

import * as bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { Role } from "../src/generated/prisma/enums";
import { SHOWCASE_FIXTURE_FAMILY, SHOWCASE_FIXTURE_MANIFEST, assertShowcaseFixtureIds, assertShowcaseFixtureManifest } from "../src/modules/showcase-reset/fixtures/showcase-fixture-manifest";
import { CATALOG_PRODUCTS, CATALOG_SETTINGS_ID, CATEGORIES, COMMERCE_DEFAULT_PREPARATION_HOURS, DEFAULT_WEIGHT_BANDS, PAYMENT_METHODS, SHIPPING_PROVIDERS, inferredProperties, productSku, stockFields, variantAttributes } from "../src/modules/showcase-reset/fixtures/catalog-commerce-baseline";
import { seedAbandonedCarts } from "./fixtures/abandoned-carts-fixtures";
import { seedCheckout } from "./fixtures/checkout-fixtures";
import { seedCustomersCrm } from "./fixtures/customers-crm-fixtures";
import { seedSalesCrm } from "./fixtures/sales-crm-fixtures";

const ADMIN_PASSWORD_SALT_ROUNDS = 12;
const seedEnvironmentSchema = z.object({ ADMIN_EMAIL: z.email({ error: "ADMIN_EMAIL must be a valid email address." }), ADMIN_PASSWORD: z.string().min(12, { error: "ADMIN_PASSWORD must contain at least 12 characters." }), DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid database URL." }) });

async function seedAdmin(prisma: PrismaClient, email: string, password: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = existing && await bcrypt.compare(password, existing.passwordHash) ? existing.passwordHash : await bcrypt.hash(password, ADMIN_PASSWORD_SALT_ROUNDS);
  await prisma.user.upsert({ where: { email }, create: { email, passwordHash, role: Role.ADMIN }, update: { passwordHash, role: Role.ADMIN } });
}

async function seedCatalog(prisma: PrismaClient): Promise<void> {
  for (const category of CATEGORIES) await prisma.category.upsert({ where: { id: category.id }, create: { ...category, visibility: category.visibility ?? "VISIBLE" }, update: { ...category, visibility: category.visibility ?? "VISIBLE" } });
  for (const product of CATALOG_PRODUCTS) {
    const existingProduct = await prisma.product.findUnique({ where: { publicSlug: product.publicSlug } });
    if (existingProduct && existingProduct.id !== product.id) await prisma.product.update({ where: { id: existingProduct.id }, data: { id: product.id } });
    const productStock = stockFields(product.stock);
    const data = { ...productStock, brand: product.brand, compareAtPrice: product.compareAtPrice, description: product.description, highlightSections: [], imageTone: product.imageTone, legacySourceId: product.legacySourceId, manualOrder: product.manualOrder, name: product.name, promotionalPrice: product.promotionalPrice, publicSlug: product.publicSlug, salePrice: product.salePrice, sku: productSku(product), slug: product.slug, subcategorySlugs: [], tags: [...(product.tags ?? [])], variantProperties: inferredProperties(product), visibility: product.visibility ?? "VISIBLE" as const };
    await prisma.product.upsert({ where: { id: product.id }, create: { id: product.id, ...data }, update: data });
    await prisma.productCategory.upsert({ where: { productId_categoryId: { productId: product.id, categoryId: product.categoryId } }, create: { productId: product.id, categoryId: product.categoryId }, update: {} });
    for (const variant of product.variants) {
      const variantData = { ...stockFields(variant.stock), attributes: variantAttributes(product, variant), compareAtPrice: variant.compareAtPrice, isDefault: product.variants.length === 1, name: variant.name, price: variant.price, productId: product.id, sku: variant.sku ?? `${productSku(product)}-${variant.id.toUpperCase()}` };
      await prisma.productVariant.upsert({ where: { id: variant.id }, create: { id: variant.id, ...variantData }, update: variantData });
    }
  }
  await prisma.catalogSettings.upsert({ where: { id: CATALOG_SETTINGS_ID }, create: { id: CATALOG_SETTINGS_ID, persistOrder: true, showOutOfStockAtEnd: true }, update: { persistOrder: true, showOutOfStockAtEnd: true } });
}

async function seedCommerce(prisma: PrismaClient): Promise<void> {
  for (const method of PAYMENT_METHODS) {
    const data = { acceptedMethods: [...method.acceptedMethods], bankConfig: method.bankConfig ?? Prisma.DbNull, description: method.description, logoSrc: method.logoSrc, name: method.name, options: method.options.map((option) => ({ ...option })), selectedOptionId: null, status: "INACTIVE" as const };
    await prisma.paymentMethodConfig.upsert({ where: { id: method.id }, create: { id: method.id, ...data }, update: data });
  }
  for (const provider of SHIPPING_PROVIDERS) {
    const providerData = { enabledModalities: [], name: provider.name, status: "NOT_CONFIGURED" as const };
    await prisma.shippingProvider.upsert({ where: { id: provider.id }, create: { id: provider.id, ...providerData }, update: providerData });
    for (const [index, band] of DEFAULT_WEIGHT_BANDS.entries()) {
      const id = `${provider.id}-${band.id}`;
      const data = { cost: band.cost, maxWeightGrams: band.maxWeightGrams, minWeightGrams: band.minWeightGrams, shippingProviderId: provider.id, sortOrder: index + 1 };
      await prisma.weightBand.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }
  const pickupData = { city: null, contactEmail: null, contactName: null, contactPhone: null, costType: "FREE" as const, coverageType: "ALL" as const, fixedCost: null, isMain: true, name: "Punto de retiro principal", number: null, postalCode: null, preparationHours: COMMERCE_DEFAULT_PREPARATION_HOURS, provinces: [], province: null, status: "NOT_CONFIGURED" as const, street: null };
  await prisma.pickupPoint.upsert({ where: { id: "retiro-principal" }, create: { id: "retiro-principal", ...pickupData }, update: pickupData });
}

function assertSeedFixtureManifest(): void {
  assertShowcaseFixtureManifest(SHOWCASE_FIXTURE_MANIFEST);
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.CATALOG, { catalogSettings: [CATALOG_SETTINGS_ID], category: CATEGORIES.map((category) => category.id), product: CATALOG_PRODUCTS.map((product) => product.id), productCategory: CATALOG_PRODUCTS.map((product) => `${product.id}:${product.categoryId}`), productVariant: CATALOG_PRODUCTS.flatMap((product) => product.variants.map((variant) => variant.id)) });
  assertShowcaseFixtureIds(SHOWCASE_FIXTURE_FAMILY.COMMERCE, { paymentMethodConfig: PAYMENT_METHODS.map((method) => method.id), pickupPoint: ["retiro-principal"], shippingProvider: SHIPPING_PROVIDERS.map((provider) => provider.id), weightBand: SHIPPING_PROVIDERS.flatMap((provider) => DEFAULT_WEIGHT_BANDS.map((band) => `${provider.id}-${band.id}`)) });
}

async function main(): Promise<void> {
  assertSeedFixtureManifest();
  const environment = seedEnvironmentSchema.parse(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }) });
  try { await seedAdmin(prisma, environment.ADMIN_EMAIL.toLowerCase(), environment.ADMIN_PASSWORD); await seedCatalog(prisma); await seedCommerce(prisma); await seedCheckout(prisma); await seedAbandonedCarts(prisma); await seedCustomersCrm(prisma); await seedSalesCrm(prisma); } finally { await prisma.$disconnect(); }
}

void main();
