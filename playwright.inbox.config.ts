import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/browser",
  testMatch: /inbox-book\.spec\.ts/,
  timeout: 30_000,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://127.0.0.1:3103",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- -p 3103",
    url: "http://127.0.0.1:3103/buch-inbox",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PUBLIC_BASE_URL: "http://127.0.0.1:3103",
      APP_SECRET: "inbox-browser-test-secret-not-for-production",
      DATABASE_URL: "postgresql://inbox:inbox@127.0.0.1:1/inbox?connect_timeout=1",
      META_PIXEL_ID: "123456789012345",
      META_CAPI_ACCESS_TOKEN: "",
      TIKTOK_PIXEL_ID: "",
      TIKTOK_EVENTS_API_TOKEN: "",
      REDDIT_PIXEL_ID: "a2_testpixel",
      REDDIT_CAPI_ACCESS_TOKEN: "",
      REDDIT_CAPI_TEST_ID: "",
      LINKEDIN_PARTNER_ID: "",
      LINKEDIN_CAPI_ACCESS_TOKEN: "",
      LINKEDIN_CONVERSION_RULE_ID: "",
      GTM_CONTAINER_ID: "",
      GA4_MEASUREMENT_ID: "",
    },
  },
});
