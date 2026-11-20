const PLACEHOLDER_MARKERS = ["replace-with", "your-project", "user:password", "example.com"];

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

export function validateCoreEnvironment(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || isPlaceholder(databaseUrl)) {
    throw new Error("DATABASE_URL must be set to a real PostgreSQL connection string.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection string.");
  }
  if (!(["postgres:", "postgresql:"].includes(parsed.protocol)) || !parsed.hostname || !parsed.pathname.slice(1)) {
    throw new Error("DATABASE_URL must include a PostgreSQL host and database name.");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || isPlaceholder(sessionSecret) || new TextEncoder().encode(sessionSecret).byteLength < 32) {
    throw new Error("SESSION_SECRET must be a non-placeholder secret of at least 32 bytes.");
  }

  const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
  if (!Number.isInteger(configuredPoolMax) || configuredPoolMax < 1 || configuredPoolMax > 50) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 50.");
  }
}
