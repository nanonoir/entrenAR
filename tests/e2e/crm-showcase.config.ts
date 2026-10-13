import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: ".", testMatch: ["crm-showcase.spec.ts", "product-detail-gallery.spec.ts"], workers: 1, retries: 0, timeout: 60000,
  outputDir: "../../test-results/crm-showcase",
  use: { baseURL: "http://127.0.0.1:3217", browserName: "chromium", trace: "retain-on-failure" },
  webServer: { command: "npx tsx tests/fixtures/crm-showcase-server.ts", cwd: resolve(__dirname, "../.."), url: "http://127.0.0.1:3217",
    reuseExistingServer: process.env.CRM_SHOWCASE_REUSE_FIXTURE === "1", timeout: 90000 },
});
