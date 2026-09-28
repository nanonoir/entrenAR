import "dotenv/config";

process.env.ADMIN_GATE_SIGNING_SECRET ??= "e2e-admin-gate-signing-secret-with-32-chars";

const requiredEnvironmentVariables: readonly string[] = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

const missingEnvironmentVariables: string[] = requiredEnvironmentVariables.filter(
  (key) => !process.env[key],
);

if (!process.env["DATABASE_URL_E2E"] && !process.env["DATABASE_URL"]) {
  missingEnvironmentVariables.push("DATABASE_URL_E2E or DATABASE_URL");
}

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `E2E tests require environment variables: ${missingEnvironmentVariables.join(", ")}.`,
  );
}

process.env.NODE_ENV = "test";
