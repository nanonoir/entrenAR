import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import * as ts from "typescript";
const PROJECT_ROOT = resolve(process.cwd());
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SHOP_UI_ROOTS = ["src/components/shop", "src/app/(shop)", "src/stores"] as const;
// Admin stores intentionally retain their own offline fixtures; harnesses are test support.
const SHOP_ENTITY_MOCK_MODULES = new Set([
  "src/lib/data/account",
  "src/lib/data/cart-preview",
  "src/lib/data/categories",
  "src/lib/data/products",
]);
const IMPORT_KIND = { DYNAMIC_IMPORT: "dynamic import", EXPORT: "re-export", IMPORT: "import", REQUIRE: "require" } as const;
type ImportKind = (typeof IMPORT_KIND)[keyof typeof IMPORT_KIND];
interface ImportViolation {
  file: string;
  kind: ImportKind;
  line: number;
  module: string;
}
async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    const extension = /\.[^.]+$/.exec(entry.name)?.[0] ?? "";
    return SOURCE_EXTENSIONS.has(extension) && !/(?:\.harness|\.spec|\.test)\.(?:ts|tsx)$/.test(entry.name)
      ? [entryPath]
      : [];
  }));
  return files.flat();
}
function projectPath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

function modulePath(filePath: string, specifier: string): string | undefined {
  const resolvedPath = specifier.startsWith("@/")
    ? resolve(PROJECT_ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(filePath), specifier)
      : undefined;
  return resolvedPath
    ? projectPath(resolvedPath).replace(/\.(?:c|m)?tsx?$/, "").replace(/\.(?:c|m)?jsx?$/, "")
    : undefined;
}
function importHasRuntimeBindings(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly || clause.name) return !clause.isTypeOnly;
  if (!clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.length === 0 || clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}
function exportHasRuntimeBindings(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly || !node.exportClause) return !node.isTypeOnly;
  if (ts.isNamespaceExport(node.exportClause)) return true;
  return node.exportClause.elements.length === 0 || node.exportClause.elements.some((element) => !element.isTypeOnly);
}
function scanFile(filePath: string, source: string): ImportViolation[] {
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, extensionOf(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const violations: ImportViolation[] = [];

  function addViolation(node: ts.Node, kind: ImportKind, specifier: string): void {
    const resolvedModule = modulePath(filePath, specifier);
    if (!resolvedModule || !SHOP_ENTITY_MOCK_MODULES.has(resolvedModule)) return;
    violations.push({
      file: projectPath(filePath),
      kind,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      module: specifier,
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const specifier = ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
      if (specifier && importHasRuntimeBindings(node)) addViolation(node, IMPORT_KIND.IMPORT, specifier);
    } else if (ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
      if (specifier && exportHasRuntimeBindings(node)) addViolation(node, IMPORT_KIND.EXPORT, specifier);
    } else if (ts.isCallExpression(node)) {
      const [argument] = node.arguments;
      const specifier = argument && ts.isStringLiteralLike(argument) ? argument.text : undefined;
      if (specifier && node.expression.kind === ts.SyntaxKind.ImportKeyword) addViolation(node, IMPORT_KIND.DYNAMIC_IMPORT, specifier);
      if (specifier && ts.isIdentifier(node.expression) && node.expression.text === "require") addViolation(node, IMPORT_KIND.REQUIRE, specifier);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
function extensionOf(filePath: string): string {
  return /\.[^.]+$/.exec(filePath)?.[0] ?? "";
}
async function run(): Promise<void> {
  const roots = await Promise.all(SHOP_UI_ROOTS.map((root) => collectSourceFiles(resolve(PROJECT_ROOT, root))));
  const files = [...new Set(roots.flat())].sort();
  const violations = (await Promise.all(files.map(async (filePath) => scanFile(filePath, await readFile(filePath, "utf8"))))).flat();
  if (violations.length > 0) {
    const details = violations.map((violation) => `- ${violation.file}:${violation.line} ${violation.kind} ${violation.module}`).join("\n");
    throw new Error(`Shop UI imports entity mock data directly:\n${details}`);
  }
  console.log(`shop mock boundary harness: passed; scanned ${files.length} shop UI and store files`);
}
void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The shop mock gate failed.");
  process.exitCode = 1;
});
