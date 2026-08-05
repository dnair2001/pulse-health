import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * The demo server (`apps/mock-api/demo_server.py`) is the only place both frontends and the API
 * live on one origin, which is what makes an Angular-vs-React comparison possible in one run.
 * Port 8080 is reserved for the long-lived demo instance humans view over a forwarded port, so
 * the suite defaults to 8099 instead of competing for it.
 */
const port = Number(process.env.E2E_PORT ?? 8099);

/** Set E2E_BASE_URL to point the suite at an already-running server and skip `webServer`. */
const externalBaseURL = process.env.E2E_BASE_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;

const mockApiDir = path.join(__dirname, '..', 'apps', 'mock-api');

export default defineConfig({
  testDir: './tests',
  // Every spec mutates one shared FastAPI store, so parallel workers would observe each other's
  // bookings and cancellations. A single worker is what keeps the suite order-independent.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        // demo_server.py refuses to import unless both bundles exist, so a missing
        // `npm run demo:build` fails here with that message rather than as a blank page.
        command: `.venv/bin/uvicorn demo_server:app --host 127.0.0.1 --port ${port}`,
        cwd: mockApiDir,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        // The API logs one structured line per request, which buries the test report. Errors
        // still come through on stderr.
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 60_000,
      },
});
