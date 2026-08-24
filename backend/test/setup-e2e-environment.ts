const requiredEnvironmentVariables = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
] as const;

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (key) => !process.env[key],
);

if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `E2E tests require environment variables: ${missingEnvironmentVariables.join(", ")}.`,
  );
}

process.env.NODE_ENV = "test";
