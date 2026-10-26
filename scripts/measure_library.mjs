import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true })
const results = []
try {
  for (const count of [50, 200]) {
    const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 960 } }), page = await context.newPage()
    await page.goto(process.argv[2] || 'http://127.0.0.1:4185')
    const files = Array.from({ length: count }, (_, index) => ({ name: `IMG_${index + 1}.svg`, mimeType: 'image/svg+xml', buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280"><rect width="1920" height="1280" fill="hsl(${index * 7 % 360} 55% 65%)"/><circle cx="800" cy="600" r="320" fill="#143b5c"/><text x="40" y="90" font-size="64">Synthetic ${index}</text></svg>`) }))
    const start = performance.now()
    await page.locator('input[type=file]').setInputFiles(files)
    await expect(page.locator('.resource-tile')).toHaveCount(count, { timeout: 90000 })
    await expect(page.getByText('本地草稿已保存', { exact: true })).toBeVisible({ timeout: 90000 })
    const importedMs = performance.now() - start
    const reloadStart = performance.now(); await page.reload()
    await expect(page.locator('.resource-tile')).toHaveCount(count, { timeout: 20000 })
    const reloadMs = performance.now() - reloadStart
    await page.waitForTimeout(300)
    const diagnostics = await page.evaluate(async () => {
      const path = '/src/lib/storage.ts', workspace = await (await import(path)).loadStitchWorkspace()
      return { originalImagesInDOM: document.querySelectorAll('.structured-photo').length, thumbnailBytes: workspace.assets.reduce((sum, item) => sum + (item.thumbnail?.size ?? 0), 0), approximateStorage: await navigator.storage.estimate() }
    })
    results.push({ count, sample: 'generated 1920x1280 SVG; not a real camera-roll benchmark', importedMs: Math.round(importedMs), reloadMs: Math.round(reloadMs), ...diagnostics })
    await context.close()
  }
  await mkdir('design/src/previews/r07-f10', { recursive: true })
  await writeFile('design/src/previews/r07-f10/library-measurements.json', JSON.stringify({ platform: process.platform, browser: 'Chromium/Edge headless desktop', results }, null, 2))
  console.log(JSON.stringify(results))
} finally { await browser.close() }
