import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:4184', locale: 'zh-CN', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, channel: process.platform === 'win32' ? 'msedge' : undefined } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4184 --strictPort', url: 'http://127.0.0.1:4184', reuseExistingServer: !process.env.CI },
})
