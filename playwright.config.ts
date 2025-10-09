import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/functional',

  // Add web server configuration
  webServer: {
    command: 'npx http-server . -p 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  use: {
    baseURL: 'http://localhost:8080',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});