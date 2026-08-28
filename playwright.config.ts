import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const verifyPort = process.env.VERIFY_PORT ?? '8081';
const baseURL = process.env.VERIFY_BASE_URL ?? `http://127.0.0.1:${verifyPort}`;

export default defineConfig({
  testDir: '.cursor/skills/verify-perleap/helpers',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    locale: 'en-US',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: path.join('.cursor/skills/verify-perleap/evidence/playwright-test-results'),
});
