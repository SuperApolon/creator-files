// check.mjs から呼ばれる設定。直接 `npx playwright test` しても動く（環境変数は check.mjs 参照）。
import { defineConfig, devices } from '@playwright/test';
const maxDiff = Number(process.env.OQ_MAX_DIFF || '0.01');
export default defineConfig({
  testDir: './tests',
  outputDir: './out/test-results',
  snapshotPathTemplate: './baselines/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: './out/report', open: 'never' }]],
  workers: 2,
  timeout: 60_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: maxDiff, animations: 'disabled', caret: 'hide' } },
  use: { launchOptions: process.env.OQ_CHROMIUM ? { executablePath: process.env.OQ_CHROMIUM } : {} },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, userAgent: devices['iPhone 13'].userAgent } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
