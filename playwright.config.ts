import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Test-Umgebung laden (Test-Datenbank, Test-Admin, Test-Secrets)
dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true });

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E-Tests gegen einen Produktions-Build (`npm run build` muss vorher laufen).
 * Der Web-Server startet mit den Werten aus .env.test.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1, // gemeinsame Test-Datenbank → sequenziell
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      // Bestehende Specs laufen ausschließlich im Desktop-Viewport (1280 px) –
      // dort gelten die Tabellen-/Nav-Verträge (echte <tr>, sichtbare Links).
      name: "Desktop Chrome",
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Normaler Chrome-UA, damit Headless-Tests nicht als Bot klassifiziert werden
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    },
    {
      // Mobile-Suite (Pixel-7-Viewport): Tab-Bar, „Mehr“-Sheet, FilterPanel,
      // Overflow-Checks, Theme-Persistenz.
      name: "Mobile Chrome",
      testMatch: /mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
      },
    },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 90_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined),
    ) as Record<string, string>,
  },
});
