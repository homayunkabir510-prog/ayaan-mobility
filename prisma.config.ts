import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Client generation works without a live database; migration commands still
  // require DATABASE_URL from the process environment or local .env file.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
