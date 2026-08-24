import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const execFileAsync = promisify(execFile);
const CATALOG_SETTINGS_ID = "singleton";
const EXPECTED_CATEGORY_IDS = [
  "cat-accessories",
  "cat-clothing",
  "cat-creatine-pre",
  "cat-market",
  "cat-protein",
  "cat-shakers",
  "cat-supplements",
  "cat-training",
  "cat-vitamins",
] as const;

describe("catalog persistence seed", () => {
  const databaseUrl = process.env["DATABASE_URL"];
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }),
  });

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required for catalog persistence integration tests.");
    }

    await runSeed();
    await runSeed();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps the singleton settings record and stable category IDs after two seed runs", async () => {
    const [settingsCount, categories, reconciledProduct] = await Promise.all([
      prisma.catalogSettings.count(),
      prisma.category.findMany({
        orderBy: { id: "asc" },
        select: { id: true, parentId: true, slug: true },
      }),
      prisma.product.findUnique({
        where: { id: "p-whey-pro" },
        select: { legacySourceId: true, publicSlug: true },
      }),
    ]);

    expect(settingsCount).toBe(1);
    await expect(prisma.catalogSettings.findUnique({ where: { id: CATALOG_SETTINGS_ID } })).resolves.toEqual(
      expect.objectContaining({ showOutOfStockAtEnd: true }),
    );
    expect(categories.map((category) => category.id)).toEqual(EXPECTED_CATEGORY_IDS);
    expect(categories.find((category) => category.id === "cat-protein")).toEqual(
      expect.objectContaining({ parentId: "cat-supplements", slug: "proteinas" }),
    );
    expect(reconciledProduct).toEqual({
      legacySourceId: "prod-whey-pro",
      publicSlug: "whey-protein-isolate-900g",
    });
  });
});

async function runSeed(): Promise<void> {
  const { stderr } = await execFileAsync(process.execPath, ["./node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_EMAIL: "admin@entrenar.test",
      ADMIN_PASSWORD: "entrenar_admin_password",
    },
    timeout: 60_000,
  });

  if (stderr) {
    throw new Error(`Catalog seed wrote to stderr: ${stderr}`);
  }
}
