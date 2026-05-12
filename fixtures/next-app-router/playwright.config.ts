import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3107',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'COVRA=1 COVRA_COVERAGE=1 E2E_COVERAGE=1 npx next build . --webpack && node ../../dist/cli.js start-server -- node ../../node_modules/next/dist/bin/next start . -p 3107',
    url: 'http://127.0.0.1:3107',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
