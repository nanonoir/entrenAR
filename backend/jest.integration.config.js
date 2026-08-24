/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  passWithNoTests: true,
  rootDir: ".",
  roots: ["<rootDir>/test"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.integration-spec.ts"],
  testPathIgnorePatterns: ["/dist/", "/node_modules/"],
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
};
