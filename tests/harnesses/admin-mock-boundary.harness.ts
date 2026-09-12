import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import * as ts from "typescript";

const PROJECT_ROOT = resolve(process.cwd());

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

const ADMIN_UI_ROOTS = [
  "src/components/admin",
  "src/app/(admin)",
] as const;

const ADMIN_BOUNDARY_SUPPORT_FILES = [
  "src/lib/data/admin/discounts/options.ts",
  "src/lib/data/admin/shipping/tracking.ts",
] as const;

const ENTITY_MOCK_MODULES = new Set([
  "src/lib/data/account",
  "src/lib/data/categories",
  "src/lib/data/products",
  "src/lib/data/admin/customers/mock-customers",
  "src/lib/data/admin/sales-flow/abandonedCarts",
  "src/lib/data/admin/sales-flow/mock-products",
  "src/lib/data/admin/sales-flow/purchaseOrders",
  "src/lib/data/admin/sales-flow/sales",
]);

const IMPORT_KIND = {
  DYNAMIC_IMPORT: "dynamic import",
  EXPORT: "re-export",
  IMPORT: "import",
  REQUIRE: "require",
} as const;

type ImportKind = (typeof IMPORT_KIND)[keyof typeof IMPORT_KIND];

interface ImportViolation {
  file: string;
  kind: ImportKind;
  line: number;
  module: string;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.has(extensionOf(entry.name)) ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

function extensionOf(filePath: string): string {
  const match = /\.[^.]+$/.exec(filePath);
  return match?.[0] ?? "";
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

  if (!resolvedPath) return undefined;

  return projectPath(resolvedPath).replace(/\.(?:c|m)?tsx?$/, "").replace(/\.(?:c|m)?jsx?$/, "");
}

function isEntityMockImport(filePath: string, specifier: string): boolean {
  const resolvedModulePath = modulePath(filePath, specifier);
  return resolvedModulePath !== undefined && ENTITY_MOCK_MODULES.has(resolvedModulePath);
}

function importHasRuntimeBindings(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly || clause.name) return !clause.isTypeOnly;
  if (!clause.namedBindings) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.length === 0 || clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function exportHasRuntimeBindings(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly || !node.exportClause) return !node.isTypeOnly;
  if (ts.isNamespaceExport(node.exportClause)) return true;
  return node.exportClause.elements.length === 0 || node.exportClause.elements.some((element) => !element.isTypeOnly);
}

function scanFile(filePath: string, source: string): ImportViolation[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    extensionOf(filePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const violations: ImportViolation[] = [];

  function addViolation(node: ts.Node, kind: ImportKind, specifier: string): void {
    if (!isEntityMockImport(filePath, specifier)) return;
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

async function run(): Promise<void> {
  const rootFiles = await Promise.all(ADMIN_UI_ROOTS.map((root) => collectSourceFiles(resolve(PROJECT_ROOT, root))));
  const supportFiles = ADMIN_BOUNDARY_SUPPORT_FILES.map((filePath) => resolve(PROJECT_ROOT, filePath));
  const files = [...new Set([...rootFiles.flat(), ...supportFiles])].sort();
  const violations = (await Promise.all(files.map(async (filePath) => scanFile(filePath, await readFile(filePath, "utf8"))))).flat();

  if (violations.length > 0) {
    const details = violations.map((violation) => `- ${violation.file}:${violation.line} ${violation.kind} ${violation.module}`).join("\n");
    throw new Error(`Admin UI imports entity mock data directly:\n${details}`);
  }

  console.log(`admin mock boundary harness: passed; scanned ${files.length} admin UI and boundary files`);
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The admin mock gate failed.");
  process.exitCode = 1;
});
