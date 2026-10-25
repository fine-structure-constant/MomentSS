import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.argv[2] || 'http://127.0.0.1:4185'
const output = path.resolve(process.argv[3] || 'design/src/previews/f01-r06')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'msedge' : undefined })
try {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(baseURL)
  await page.locator('input[type=file]').setInputFiles(['test-fixtures/coast.svg', 'test-fixtures/street.svg'])
  await page.locator('.resource-tile').nth(1).waitFor()
  await page.getByRole('button', { name: '文字卡片', exact: true }).click()
  await page.getByRole('tab', { name: '调整', exact: true }).click()
  await page.getByRole('button', { name: '导入 Markdown', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown 内容', exact: true }).fill('# 海风与散步\n\n沿途记录**值得停留**的时刻 🌊\n\n- 看一场日出\n- 留一点空白')
  await page.getByRole('button', { name: '替换并编辑', exact: true }).click()
  await page.getByText('本地草稿已保存', { exact: true }).waitFor()
  await page.getByRole('button', { name: '保存长图', exact: true }).click()
  await page.locator('[data-composition-id]').waitFor()
  await page.screenshot({ path: path.join(output, 'resources-desktop.png') })
  await page.getByRole('tab', { name: '图层', exact: true }).click()
  await page.getByRole('button', { name: '选择图层 1', exact: true }).click()
  await page.screenshot({ path: path.join(output, 'layers-desktop.png') })
  await page.getByRole('button', { name: '放大并调整：coast.svg', exact: true }).click()
  await page.getByRole('button', { name: '添加图片文字', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: '导入 Markdown', exact: true }).click()
  await modal.getByRole('textbox', { name: 'Markdown 内容', exact: true }).fill('# 海风正好\n\n今天也要**慢慢走** ✨')
  await modal.getByRole('button', { name: '替换并编辑', exact: true }).click()
  await page.screenshot({ path: path.join(output, 'photo-text-desktop.png') })
  await modal.getByRole('button', { name: '完成', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: '图层', exact: true }).click()
  await page.locator('.layer-list').evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }))
  await page.screenshot({ path: path.join(output, 'layers-mobile.png') })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  await page.getByRole('combobox', { name: '界面语言', exact: true }).selectOption('en')
  await expect(page.getByRole('tab', { name: 'Layers', exact: true })).toBeVisible()
  const englishOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  const overflowing = englishOverflow ? await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).map((el) => ({ tag: el.tagName, className: el.className, text: el.textContent?.slice(0, 80) })).slice(-15)) : []
  console.log(JSON.stringify({ output, errors, overflow, englishOverflow, overflowing }))
  if (errors.length || overflow || englishOverflow) process.exitCode = 1
} finally { await browser.close() }
