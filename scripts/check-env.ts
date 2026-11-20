import { validateCoreEnvironment } from "../src/lib/env";

try {
  validateCoreEnvironment();
  console.log("Core runtime environment is configured. No environment values were printed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment validation failed.");
  process.exitCode = 1;
}
