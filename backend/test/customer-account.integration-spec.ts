import { randomUUID } from "node:crypto";

import * as bcrypt from "bcrypt";
import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { CatalogVisibility, Role, StockMode } from "../src/generated/prisma/enums";
import type { AppConfig } from "../src/config/app.config";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { AuthService } from "../src/modules/auth/auth.service";
import type { PasswordResetDelivery, ResetDeliveryPort } from "../src/modules/auth/reset-delivery.port";
import { AccountRepository } from "../src/modules/account/account.repository";
import { AccountService } from "../src/modules/account/account.service";
import { CatalogQueryService } from "../src/modules/catalog/catalog-query.service";
import { CatalogRepository } from "../src/modules/catalog/catalog.repository";
import { ProductService } from "../src/modules/catalog/product.service";
import { UsersService } from "../src/modules/users/users.service";
import { WishlistRepository } from "../src/modules/wishlist/wishlist.repository";
import { WishlistService } from "../src/modules/wishlist/wishlist.service";

const databaseUrl = process.env["DATABASE_URL"];
const PASSWORD_REPLACEMENT = "ReplacementPassword123!";

describe("customer account persistence integration", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }),
  });
  const users = new UsersService(prisma as unknown as PrismaService);
  const accountRepository = new AccountRepository(prisma as unknown as PrismaService);
  const account = new AccountService(accountRepository);
  const catalogRepository = new CatalogRepository(prisma as unknown as PrismaService);
  const catalogQueries = new CatalogQueryService(catalogRepository);
  const productService = new ProductService(catalogRepository);
  const wishlistRepository = new WishlistRepository(prisma as unknown as PrismaService);
  const wishlist = new WishlistService(wishlistRepository, catalogQueries, productService);
  const deliveries: PasswordResetDelivery[] = [];
  const auth = new AuthService(
    createConfig(),
    {} as JwtService,
    prisma as unknown as PrismaService,
    users,
    createResetDelivery(deliveries),
  );
  let fixtures: AccountFixtures | undefined;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for customer account integration tests.");
    }

    fixtures = await createFixtures(prisma);
  });

  afterAll(async () => {
    if (fixtures) {
      await deleteFixtures(prisma, fixtures);
    }
    await prisma.$disconnect();
  });

  it("persists profile changes, scopes foreign addresses, and enforces six addresses under concurrency", async () => {
    const fixture = requireFixtures(fixtures);
    const profile = await account.getProfile(fixture.owner.id);

    expect(profile).toEqual({
      birthDate: null,
      dni: null,
      email: fixture.owner.email,
      firstName: null,
      gender: null,
      lastName: null,
      phone: null,
    });
    expect(profile).not.toHaveProperty("passwordHash");

    const updatedProfile = await account.updateProfile(fixture.owner.id, {
      birthDate: "1990-01-01",
      dni: "12345678",
      firstName: "Fixture",
      gender: "other",
      lastName: "Customer",
      phone: "+54 11 5555-5555",
    });
    expect(updatedProfile).toEqual({
      birthDate: "1990-01-01",
      dni: "12345678",
      email: fixture.owner.email,
      firstName: "Fixture",
      gender: "other",
      lastName: "Customer",
      phone: "+54 11 5555-5555",
    });

    const foreignAddress = await account.createAddress(fixture.foreign.id, addressInput("foreign"));
    await expectCode(
      account.updateAddress(fixture.owner.id, foreignAddress.id, addressInput("attempted-update")),
      "NOT_FOUND",
    );
    await expectCode(account.deleteAddress(fixture.owner.id, foreignAddress.id), "NOT_FOUND");
    await expect(prisma.userAddress.findUnique({ where: { id: foreignAddress.id } })).resolves.toEqual(
      expect.objectContaining({ label: "foreign" }),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) => account.createAddress(fixture.owner.id, addressInput(`owner-${index}`))),
    );
    const created = results.filter((result) => result.status === "fulfilled");
    const rejectedCodes = results.flatMap((result) => result.status === "rejected" ? [errorCode(result.reason)] : []);

    expect(created).toHaveLength(6);
    expect(rejectedCodes).toEqual(["ADDRESS_LIMIT_REACHED", "ADDRESS_LIMIT_REACHED"]);
    await expect(accountRepository.listAddresses(fixture.owner.id)).resolves.toHaveLength(6);
  });

  it("persists only public wishlist products and protects composite uniqueness and ownership", async () => {
    const fixture = requireFixtures(fixtures);
    const results = await Promise.allSettled([
      wishlist.add(fixture.owner.id, fixture.visibleProduct.id),
      wishlist.add(fixture.owner.id, fixture.visibleProduct.id),
    ]);
    const successful = results.filter((result) => result.status === "fulfilled");
    const rejectedCodes = results.flatMap((result) => result.status === "rejected" ? [errorCode(result.reason)] : []);

    expect(successful).toHaveLength(1);
    expect(rejectedCodes).toEqual(["WISHLIST_ITEM_EXISTS"]);
    await expectCode(wishlist.add(fixture.owner.id, fixture.hiddenProduct.id), "PRODUCT_NOT_FOUND");
    await expectCode(wishlist.add(fixture.owner.id, "missing-product"), "PRODUCT_NOT_FOUND");

    const products = await wishlist.list(fixture.owner.id);
    expect(products).toHaveLength(1);
    expect(products[0]).toEqual(expect.objectContaining({
      id: fixture.visibleProduct.id,
      price: 49.99,
      slug: fixture.visibleProduct.publicSlug,
    }));
    expect(products[0]).not.toHaveProperty("userId");
    await expect(wishlist.list(fixture.foreign.id)).resolves.toEqual([]);

    await expectCode(wishlist.remove(fixture.foreign.id, fixture.visibleProduct.id), "WISHLIST_ITEM_NOT_FOUND");
    await expect(wishlist.remove(fixture.owner.id, fixture.visibleProduct.id)).resolves.toEqual({ ok: true });
    await expectCode(wishlist.remove(fixture.owner.id, fixture.visibleProduct.id), "WISHLIST_ITEM_NOT_FOUND");
  });

  it("stores hashed expiring reset credentials and consumes them exactly once", async () => {
    const fixture = requireFixtures(fixtures);
    deliveries.length = 0;

    const knownResponse = await auth.forgotPassword(fixture.owner.email);
    const unknownResponse = await auth.forgotPassword(`unknown-${fixture.suffix}@example.test`);
    expect(knownResponse).toEqual({ ok: true });
    expect(unknownResponse).toEqual(knownResponse);
    expect(deliveries).toHaveLength(1);

    const delivery = deliveries[0];
    if (!delivery) throw new Error("Expected a captured reset delivery.");
    const storedToken = await prisma.passwordResetToken.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { userId: fixture.owner.id },
    });
    expect(storedToken.tokenHash).not.toBe(delivery.token);
    expect(storedToken.usedAt).toBeNull();
    expect(knownResponse).not.toHaveProperty("token");

    await expect(auth.resetPassword(delivery.token, PASSWORD_REPLACEMENT)).resolves.toEqual({ ok: true });
    await expect(prisma.passwordResetToken.findUnique({ where: { id: storedToken.id } })).resolves.toEqual(
      expect.objectContaining({ usedAt: expect.any(Date) }),
    );
    const resetUser = await users.findById(fixture.owner.id);
    if (!resetUser) throw new Error("Expected the reset fixture user to remain available.");
    await expect(users.verifyPassword(PASSWORD_REPLACEMENT, resetUser.passwordHash)).resolves.toBe(true);
    await expect(users.verifyPassword(fixture.owner.password, resetUser.passwordHash)).resolves.toBe(false);
    await expectCode(auth.resetPassword(delivery.token, "AnotherPassword123!"), "INVALID_RESET_TOKEN");

    deliveries.length = 0;
    await auth.forgotPassword(fixture.owner.email);
    const expiredDelivery = deliveries[0];
    if (!expiredDelivery) throw new Error("Expected a second captured reset delivery.");
    const expiredStoredToken = await prisma.passwordResetToken.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { userId: fixture.owner.id },
    });
    await prisma.passwordResetToken.update({
      data: { expiresAt: new Date(Date.now() - 1_000) },
      where: { id: expiredStoredToken.id },
    });
    await expectCode(auth.resetPassword(expiredDelivery.token, "ExpiredPassword123!"), "INVALID_RESET_TOKEN");
  });
});

async function createFixtures(prisma: PrismaClient): Promise<AccountFixtures> {
  const suffix = randomUUID();
  const owner = await createUser(prisma, "owner", Role.CUSTOMER, suffix);
  const foreign = await createUser(prisma, "foreign", Role.CUSTOMER, suffix);
  const categoryId = `account-category-${suffix}`;
  await prisma.category.create({
    data: {
      id: categoryId,
      name: "Customer account fixture category",
      slug: `customer-account-category-${suffix}`,
      sortOrder: 1,
      visibility: CatalogVisibility.VISIBLE,
    },
  });

  const visibleProduct = await createProduct(prisma, suffix, categoryId, "visible", CatalogVisibility.VISIBLE);
  const hiddenProduct = await createProduct(prisma, suffix, categoryId, "hidden", CatalogVisibility.HIDDEN);

  return {
    categoryId,
    foreign,
    hiddenProduct,
    owner,
    suffix,
    visibleProduct,
  };
}

async function createUser(
  prisma: PrismaClient,
  label: string,
  role: Role,
  suffix: string,
): Promise<UserFixture> {
  const id = `account-${label}-${suffix}`;
  const email = `account-${label}-${suffix}@example.test`;
  const password = `Ephemeral-${label}-${suffix}-A1!`;

  await prisma.user.create({
    data: {
      email,
      id,
      passwordHash: await bcrypt.hash(password, 4),
      role,
    },
  });

  return { email, id, password };
}

async function createProduct(
  prisma: PrismaClient,
  suffix: string,
  categoryId: string,
  label: string,
  visibility: CatalogVisibility,
): Promise<ProductFixture> {
  const id = `account-product-${label}-${suffix}`;
  const publicSlug = `customer-account-${label}-${suffix}`;
  await prisma.product.create({
    data: {
      brand: "EntrenAR Fixture",
      id,
      name: `Customer account ${label} product`,
      publicSlug,
      quantity: 8,
      salePrice: "49.99",
      sku: `ACCOUNT-${label.toUpperCase()}-${suffix}`,
      slug: `customer-account-admin-${label}-${suffix}`,
      stockMode: StockMode.TRACKED,
      visibility,
    },
  });
  await prisma.productCategory.create({ data: { categoryId, productId: id } });

  return { id, publicSlug };
}

async function deleteFixtures(prisma: PrismaClient, fixtures: AccountFixtures): Promise<void> {
  const userIds = [fixtures.owner.id, fixtures.foreign.id];
  const productIds = [fixtures.visibleProduct.id, fixtures.hiddenProduct.id];
  await prisma.wishlistItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.productCategory.deleteMany({ where: { productId: { in: productIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({ where: { id: fixtures.categoryId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

function addressInput(label: string) {
  return {
    city: "Buenos Aires",
    label,
    phone: "+54 11 5555-5555",
    postalCode: "C1000",
    province: "Buenos Aires",
    recipient: "Fixture Customer",
    street: "123 Test Street",
  };
}

function createConfig(): ConfigService<AppConfig, true> {
  const values = {
    jwtRefreshSecret: `integration-refresh-secret-${randomUUID()}`,
    jwtRefreshTtlSeconds: 2_592_000,
    nodeEnv: "test" as const,
  };
  return {
    getOrThrow: (key: keyof typeof values) => values[key],
  } as unknown as ConfigService<AppConfig, true>;
}

function createResetDelivery(deliveries: PasswordResetDelivery[]): ResetDeliveryPort {
  return {
    deliverPasswordReset: async (delivery) => {
      deliveries.push(delivery);
    },
  };
}

function requireFixtures(value: AccountFixtures | undefined): AccountFixtures {
  if (!value) throw new Error("Customer account fixtures were not initialized.");
  return value;
}

async function expectCode(operation: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(errorCode(error)).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected ${expectedCode}.`);
}

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof HttpException)) return undefined;
  const response = error.getResponse();

  return typeof response === "object" && response !== null && "code" in response && typeof response.code === "string"
    ? response.code
    : undefined;
}

interface AccountFixtures {
  categoryId: string;
  foreign: UserFixture;
  hiddenProduct: ProductFixture;
  owner: UserFixture;
  suffix: string;
  visibleProduct: ProductFixture;
}

interface ProductFixture {
  id: string;
  publicSlug: string;
}

interface UserFixture {
  email: string;
  id: string;
  password: string;
}
