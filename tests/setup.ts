import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/spotter_test";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-long-enough-32-chars";
process.env.STAFF_SESSION_SECRET ??= "test-staff-session-secret-different-32-chars";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  if (testDatabaseUrl === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must point at a disposable database, not DATABASE_URL.");
  }

  process.env.DATABASE_URL = testDatabaseUrl;
}
