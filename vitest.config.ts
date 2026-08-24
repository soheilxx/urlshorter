import path from "node:path";
import { defineConfig } from "vitest/config";

/** Unit-Tests (keine Datenbank nötig). */
export default defineConfig({
  test: {
    include: ["src/tests/unit/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/tests/stubs/server-only.ts"),
    },
  },
});
