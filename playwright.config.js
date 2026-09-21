import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PDM_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}/`;

// WebKit n'est pas installable partout : PDM_SKIP_WEBKIT=1 le retire des projets.
const projects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  },
];

if (!process.env.PDM_SKIP_WEBKIT) {
  projects.push({ name: 'webkit', use: { ...devices['iPhone 13'] } });
}

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: `node tools/serve.js --port=${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
