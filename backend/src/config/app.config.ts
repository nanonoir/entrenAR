import { z } from "zod";

export const NODE_ENV = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export type NodeEnvironment = (typeof NODE_ENV)[keyof typeof NODE_ENV];

export interface AppConfig {
  bodyLimitBytes: number;
  corsOrigin: string;
  corsOrigins?: string[];
  databaseUrl: string;
  frontendUrl?: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshSecret: string;
  jwtRefreshTtlSeconds: number;
  nodeEnv: NodeEnvironment;
  port: number;
  throttleLimit: number;
  throttleTtlSeconds: number;
}

const DEFAULT_FRONTEND_URL = "http://localhost:3000";
const httpUrlSchema = z.url({ error: "URL must be a valid URL." }).refine(
  (value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { error: "URL must use the http or https protocol." },
);
const corsOriginsSchema = z.string().transform((value, context) => {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const origins: string[] = [];

  entries.forEach((entry, index) => {
    const result = httpUrlSchema.safeParse(entry);
    if (!result.success) {
      context.addIssue({
        code: "custom",
        message: `CORS_ORIGINS entry ${index + 1} must be a valid HTTP(S) URL.`,
      });
      return;
    }

    origins.push(normalizeOrigin(result.data));
  });

  return origins;
});

const appConfigSchema = z.object({
  BODY_LIMIT_BYTES: z.coerce.number().int().min(1_024).max(10_485_760).default(104_857),
  CORS_ORIGIN: httpUrlSchema.optional(),
  CORS_ORIGINS: corsOriginsSchema.optional(),
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid database URL." }),
  FRONTEND_URL: httpUrlSchema.optional(),
  JWT_ACCESS_SECRET: z.string().min(32, { error: "JWT_ACCESS_SECRET must contain at least 32 characters." }),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  JWT_REFRESH_SECRET: z.string().min(32, { error: "JWT_REFRESH_SECRET must contain at least 32 characters." }),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3_600).max(7_776_000).default(2_592_000),
  NODE_ENV: z.enum([NODE_ENV.DEVELOPMENT, NODE_ENV.PRODUCTION, NODE_ENV.TEST]).default(NODE_ENV.DEVELOPMENT),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  THROTTLE_LIMIT: z.coerce.number().int().min(1).max(1_000).default(100),
  THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
}, { error: "Invalid backend environment configuration." });

type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export function loadAppConfig(environment: EnvironmentVariables = process.env): AppConfig {
  const result = appConfigSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid backend configuration:\n${details}`);
  }

  const parsed = result.data;
  const corsOrigins = uniqueOrigins([
    ...(parsed.CORS_ORIGINS ?? []),
    ...(parsed.FRONTEND_URL ? [normalizeOrigin(parsed.FRONTEND_URL)] : []),
    ...(parsed.CORS_ORIGIN ? [normalizeOrigin(parsed.CORS_ORIGIN)] : []),
  ]);

  return {
    bodyLimitBytes: parsed.BODY_LIMIT_BYTES,
    corsOrigin: corsOrigins[0] ?? DEFAULT_FRONTEND_URL,
    corsOrigins,
    databaseUrl: parsed.DATABASE_URL,
    frontendUrl: parsed.FRONTEND_URL ? normalizeOrigin(parsed.FRONTEND_URL) : undefined,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtAccessTtlSeconds: parsed.JWT_ACCESS_TTL_SECONDS,
    jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
    jwtRefreshTtlSeconds: parsed.JWT_REFRESH_TTL_SECONDS,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    throttleLimit: parsed.THROTTLE_LIMIT,
    throttleTtlSeconds: parsed.THROTTLE_TTL_SECONDS,
  };
}

export function validateEnvironment(environment: Record<string, unknown>): AppConfig {
  const values: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(environment)) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }

  return loadAppConfig(values);
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins.length > 0 ? origins : [DEFAULT_FRONTEND_URL])];
}
