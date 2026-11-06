import { defineConfig, devices } from '@playwright/test';

// Release gate: the built client loads and runs at desktop and phone sizes.
// Set SMOKE_URL to test a live deployment instead of the local preview build.
const live = process.env.SMOKE_URL;
const local = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: live ?? local },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  ...(live
    ? {}
    : {
        webServer: {
          command: 'npm run preview -w @factory4x/client -- --port 4173 --strictPort --host 127.0.0.1',
          url: local,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
