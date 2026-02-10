import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  webServer: {
    command: 'python3 -m http.server 4173 --directory dist',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  }
});
