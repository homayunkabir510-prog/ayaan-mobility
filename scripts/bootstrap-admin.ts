import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const connectionString = readRequired("DATABASE_URL");
const adapter = new PrismaPg({ connectionString, max: 2, connectionTimeoutMillis: 5_000 });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const name = readRequired("BOOTSTRAP_ADMIN_NAME");
  const phone = readRequired("BOOTSTRAP_ADMIN_PHONE");
  const expectedTarget = readRequired("BOOTSTRAP_ADMIN_TARGET");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) throw new Error("Missing required environment variable: BOOTSTRAP_ADMIN_PASSWORD");

  const databaseUrl = new URL(connectionString);
  const databaseName = databaseUrl.pathname.replace(/^\//, "");
  const actualTarget = `${databaseUrl.hostname}${databaseUrl.port ? `:${databaseUrl.port}` : ""}/${databaseName}`;
  if (expectedTarget !== actualTarget) throw new Error("Bootstrap target confirmation does not match DATABASE_URL host/database.");

  if (name.length > 120) throw new Error("Admin name is too long.");
  if (!/^\+?[0-9]{6,32}$/.test(phone)) throw new Error("Admin phone must contain 6–32 digits and an optional leading +.");
  const passwordBytes = new TextEncoder().encode(password).byteLength;
  if (password.length < 16 || passwordBytes > 72) throw new Error("Initial admin password must be at least 16 characters and no more than 72 UTF-8 bytes.");
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (classes < 3) throw new Error("Initial admin password must use at least three character types.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const existingAdminCount = await tx.user.count({ where: { role: "SUPER_ADMIN" } });
    if (existingAdminCount > 0) throw new Error("An active bootstrap is allowed only before the first SUPER_ADMIN exists.");

    await tx.user.create({
      data: { name, phone, password: passwordHash, role: "SUPER_ADMIN", isActive: true },
    });
  }, { isolationLevel: "Serializable" });

  console.log("Initial SUPER_ADMIN account created. No password or hash was printed.");
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error && /^(Missing required environment variable:|Bootstrap target confirmation|Admin name is too long\.|Admin phone must|Initial admin password must|An active bootstrap)/.test(error.message)
      ? error.message
      : "Admin bootstrap failed. Check database connectivity and whether the phone is already in use; no credentials were printed.";
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
