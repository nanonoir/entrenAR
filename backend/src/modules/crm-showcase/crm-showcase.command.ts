import { readFile, stat } from "node:fs/promises";
import { authorizeTarget } from "./target-policy";
import { assembleScenario, type ScenarioInput } from "./scenario";

export interface ShowcaseCommandInput extends ScenarioInput { authorizationPath: string; }
export function parseShowcaseArguments(args: readonly string[]): ShowcaseCommandInput {
  const values = new Map<string, string>();
  const allowed = ["--seed", "--reference-date", "--authorization"];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!, value = args[index + 1];
    if (!allowed.includes(key) || values.has(key) || !value || value.startsWith("--")) throw new Error("Expected --seed, --reference-date and --authorization exactly once.");
    values.set(key, value);
  }
  const reference = values.get("--reference-date");
  if (values.size !== 3 || !reference || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(reference)) throw new Error("Showcase requires an explicit UTC ISO reference instant.");
  const result = { seed: values.get("--seed")!, referenceDate: new Date(reference), authorizationPath: values.get("--authorization")! };
  assembleScenario(result);
  if (result.referenceDate.toISOString() !== reference.replace(/Z$/, reference.includes(".") ? "Z" : ".000Z")) throw new Error("Showcase reference instant is invalid.");
  return result;
}

export async function runShowcaseCommand(args: readonly string[]): Promise<void> {
  const input = parseShowcaseArguments(args);
  if ((await stat(input.authorizationPath)).size > 16_384) throw new Error("Showcase authorization is too large.");
  let manifest: unknown;
  try { manifest = JSON.parse(await readFile(input.authorizationPath, "utf8")); } catch { throw new Error("Showcase authorization cannot be read."); }
  const url = process.env["CRM_SHOWCASE_DATABASE_URL"];
  const target = authorizeTarget(url, manifest, process.env["NODE_ENV"]);
  // Bind only after authorization. No AppModule, seed, reset, storage or delivery clients are bootstrapped.
  const prior = process.env["DATABASE_URL"];
  process.env["DATABASE_URL"] = url;
  const { PrismaService } = await import("../../common/prisma/prisma.service");
  const { CrmShowcaseService } = await import("./crm-showcase.service");
  const prisma = new PrismaService();
  try {
    const result = await new CrmShowcaseService(prisma, target).run(input);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
    if (prior === undefined) delete process.env["DATABASE_URL"]; else process.env["DATABASE_URL"] = prior;
  }
}
