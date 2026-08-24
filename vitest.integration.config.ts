import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

// Testdatenbank und Test-Secrets laden (überschreibt lokale .env-Werte)
dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true });

/** Integrationstests gegen die Test-Datenbank (.env.test). */
export default defineConfig({
  test: {
    include: ["src/tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["src/tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/tests/stubs/server-only.ts"),
    },
  },
});
