import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const output = 'design/src/previews/editor-plugins'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true })
const results = []
try {
  for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ locale: 'zh-CN', viewport, isMobile: name === 'mobile', hasTouch: name === 'mobile' })
    const page = await context.newPage(), errors = [], optionalRequests = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => { if (/RichTextEditor|heic-to|\.woff2/.test(request.url())) optionalRequests.push(request.url()) })
    await page.goto(process.argv[2] || 'http://127.0.0.1:4185')
    await page.locator('input[type=file]').setInputFiles(['test-fixtures/coast.svg', 'test-fixtures/street.svg'])
    await page.getByRole('button', { name: '放大并调整：coast.svg', exact: true }).click()
    const start = performance.now()
    await page.getByRole('button', { name: '添加图片文字', exact: true }).click()
    const modal = page.getByRole('dialog'), input = modal.getByRole('textbox', { name: '文字内容', exact: true })
    await input.fill('白色文字也能立即输入 🌊')
    const editableMs = Math.round(performance.now() - start)
    await page.screenshot({ animations: 'disabled', path: `${output}/input-${name}.png` })
    await modal.getByRole('button', { name: '完成', exact: true }).click()
    await page.getByRole('tab', { name: '图层', exact: true }).click()
    await page.locator('.layer-toolbar').evaluate((element) => { if (innerWidth < 900) window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 190) })
    await page.screenshot({ animations: 'disabled', path: `${output}/layers-${name}.png` })
    await page.getByRole('button', { name: '扩展', exact: true }).click()
    await page.screenshot({ animations: 'disabled', path: `${output}/plugins-${name}.png` })
    await page.locator('.plugin-control').press('Escape')
    await page.getByRole('button', { name: '新建排版任务', exact: true }).click()
    await page.getByRole('button', { name: '新建排版任务', exact: true }).click()
    await page.getByRole('combobox', { name: '当前排版任务', exact: true }).click()
    await page.screenshot({ animations: 'disabled', path: `${output}/tasks-${name}.png` })
    await page.keyboard.press('Escape')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false); expect(errors).toEqual([]); expect(optionalRequests).toEqual([])
    results.push({ name, editableMs, errors, optionalRequests, overflow })
    await context.close()
  }
  await writeFile(`${output}/verification.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results))
} finally { await browser.close() }
