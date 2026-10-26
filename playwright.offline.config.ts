import { defineConfig } from '@playwright/test'
import base from './playwright.config'
export default defineConfig({ ...base, testDir: './tests/offline', outputDir: './test-results-offline', timeout: 120000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4187' },
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4187 --strictPort', url: 'http://127.0.0.1:4187', reuseExistingServer: !process.env.CI },
})
