import { defineConfig, devices } from "@playwright/test";

/**
 * Isolierte Browserprüfung des Meta/TikTok/LinkedIn-Conversion-Trackings der
 * Buchseiten: kein DB-Reset, keine echten Werbeereignisse (externe Zugriffe
 * werden im Test blockiert, der First-Party-Empfänger wird aufgezeichnet).
 * Build vorher erstellen (`npm run build`).
 */
export default defineConfig({
  testDir: "./src/tests/browser",
  testMatch: /book-conversion\.spec\.ts/,
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  },
  webServer: {
    command: "npm run start -- -p 3102",
    url: "http://127.0.0.1:3102/gewinn",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PUBLIC_BASE_URL: "http://127.0.0.1:3102",
      APP_SECRET: "book-browser-test-secret-not-for-production",
      META_PIXEL_ID: "123456789012345",
      META_CAPI_ACCESS_TOKEN: "",
      TIKTOK_PIXEL_ID: "CTESTPIXEL0000000000",
      TIKTOK_EVENTS_API_TOKEN: "",
      LINKEDIN_PARTNER_ID: "1234567",
      LINKEDIN_CONVERSION_RULE_ID: "987654",
      LINKEDIN_CAPI_ACCESS_TOKEN: "",
      REDDIT_PIXEL_ID: "a2_testpixel",
      REDDIT_CAPI_ACCESS_TOKEN: "",
      GTM_CONTAINER_ID: "",
      GA4_MEASUREMENT_ID: "",
    },
  },
});
