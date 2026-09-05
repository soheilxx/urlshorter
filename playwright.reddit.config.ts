import { defineConfig, devices } from "@playwright/test";

/** Isolierte Browserprüfung: kein DB-Reset, keine echten Werbeereignisse. Build vorher erstellen. */
export default defineConfig({
  testDir: "./src/tests/browser",
  testMatch: /reddit-(tracking|book)\.spec\.ts/,
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- -p 3101",
    url: "http://127.0.0.1:3101/das-buch",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PUBLIC_BASE_URL: "http://127.0.0.1:3101",
      APP_SECRET: "reddit-browser-test-secret-not-for-production",
      REDDIT_PIXEL_ID: "a2_testpixel",
      REDDIT_CAPI_ACCESS_TOKEN: "",
      REDDIT_CAPI_TEST_ID: "",
      GTM_CONTAINER_ID: "",
      META_PIXEL_ID: "",
      TIKTOK_PIXEL_ID: "",
      LINKEDIN_PARTNER_ID: "",
    },
  },
});
