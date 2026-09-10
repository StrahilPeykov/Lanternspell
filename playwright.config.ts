import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: '**/gameplay.spec.ts', fullyParallel: false, workers: 1,
  timeout: 240_000, expect: { timeout: 10_000 },
  outputDir: 'evidence/playwright', reporter: [['list'], ['json', { outputFile: 'evidence/playwright-results.json' }]],
  use: { baseURL: process.env.GAME_URL || 'http://127.0.0.1:5180', viewport: { width: 1280, height: 720 },
    headless: true, launchOptions: { args: ['--use-angle=d3d11', '--enable-gpu'] }, screenshot: 'only-on-failure', video: 'on', trace: 'retain-on-failure' },
});
