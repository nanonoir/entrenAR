/** Dedicated fixture: deliberately does not load setup-e2e-environment or its DATABASE_URL fallback. */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  roots: ["<rootDir>/test"],
  setupFiles: [],
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/crm-showcase.integration-spec.ts", "<rootDir>/test/crm-showcase-checkout.integration-spec.ts"],
  testPathIgnorePatterns: ["/dist/", "/node_modules/"],
  testTimeout: 150000,
  transform: { "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
};
