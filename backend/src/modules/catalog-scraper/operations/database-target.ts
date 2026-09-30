import { createHash } from "node:crypto";
import { isIP } from "node:net";

export interface DatabaseTargetIdentity {
  fingerprint: string;
  host: string;
  hostAddress?: string;
  port: number;
  database: string;
  schema: string;
}

/** Parse the configured PostgreSQL URL into a credential-free destination identity. */
export function identifyDatabaseTarget(connectionString = process.env["DATABASE_URL"]): DatabaseTargetIdentity {
  if (!connectionString) throw new Error("Database target configuration is missing.");

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Database target configuration is invalid.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database target must use PostgreSQL.");
  }

  const hosts = url.searchParams.getAll("host");
  const ports = url.searchParams.getAll("port");
  const databases = url.searchParams.getAll("dbname");
  const hostAddresses = url.searchParams.getAll("hostaddr");
  if (hosts.length > 1 || ports.length > 1 || databases.length > 1 || hostAddresses.length > 1 || url.searchParams.has("options") || url.searchParams.has("search_path")) {
    throw new Error("Database target configuration is ambiguous.");
  }
  const host = normalizeHost(hosts[0] ?? url.hostname);
  const hostAddress = hostAddresses[0] === undefined ? undefined : normalizeHost(hostAddresses[0]);
  const portValue = ports[0] ?? url.port;
  const port = portValue ? Number(portValue) : 5432;
  let database: string;
  try {
    database = databases[0] ?? decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("Database target configuration is invalid.");
  }
  const querySchemas = url.searchParams.getAll("schema");
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !database || querySchemas.length > 1) {
    throw new Error("Database target configuration is ambiguous.");
  }
  const schema = querySchemas[0] ?? "public";
  if (!schema.trim() || /[\u0000-\u001f]/.test(schema)) throw new Error("Database target configuration is ambiguous.");
  const normalized = JSON.stringify([host, hostAddress ?? null, port, database, schema]);
  const fingerprint = createHash("sha256").update(normalized).digest("hex");
  return { fingerprint, host, ...(hostAddress ? { hostAddress } : {}), port, database, schema };
}

export function reportDatabaseTarget(identity = identifyDatabaseTarget()): Readonly<DatabaseTargetIdentity> {
  return { ...identity };
}

function normalizeHost(value: string): string {
  const host = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host.includes("/") || /[@\\\s?#]/.test(host) || (!isIP(host) && !/^[a-z0-9._-]+$/.test(host))) {
    throw new Error("Database target configuration is ambiguous.");
  }
  return host;
}
