import { test, expect } from '@playwright/test'
import { assets, image, saved, tab } from './helpers'
import { readFile } from 'node:fs/promises'

test('mixed formatting, emoji, real fonts and export survive reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '文字卡片', exact: true }).click()
  await tab(page, '调整')
  const editor = page.getByRole('textbox', { name: '文字内容', exact: true })
  await editor.fill('Hello 旅途')
  await saved(page)
  await editor.press('ControlOrMeta+Home')
  await editor.press('ControlOrMeta+Shift+ArrowRight')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().trim())).toBe('Hello')
  await page.getByRole('button', { name: '粗体', exact: true }).click()
  await page.getByRole('combobox', { name: '字体', exact: true }).selectOption('"MomentSans-v1", sans-serif')
  const size = page.getByRole('spinbutton', { name: '字号', exact: true })
  await size.fill('48')
  await size.press('Enter')
  await page.locator('.rich-editor__color input').evaluate((element) => {
    const input = element as HTMLInputElement
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#ff0000')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await editor.press('ControlOrMeta+End')
  await page.getByRole('button', { name: 'Emoji', exact: true }).click()
  await page.getByRole('searchbox', { name: '搜索 Emoji', exact: true }).fill('海浪')
  await page.getByRole('button', { name: /^插入 🌊：/ }).click()
  await expect(editor).toBeFocused()
  await page.keyboard.type('123')
  await expect(editor).toContainText('旅途🌊123')
  await saved(page)
  await expect.poll(async () => JSON.stringify(await assets(page))).toContain('richText')
  await page.reload()
  await tab(page, '调整')
  await expect(editor).toContainText('旅途🌊123')
  await expect(editor.locator('[style*="48px"]')).toContainText('Hello')
  const fontCheck = await page.evaluate(async () => {
    await Promise.all(['MomentSans-v1', 'MomentRounded-v1'].map((family) => document.fonts.load(`400 32px "${family}"`, '旅途圆体')))
    const data = ['MomentSans-v1', 'MomentRounded-v1'].map((family) => { const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 70; const ctx = canvas.getContext('2d')!; ctx.font = `32px "${family}"`; ctx.fillText('旅途圆体', 10, 50); return canvas.toDataURL() })
    return data[0] !== data[1]
  })
  expect(fontCheck).toBe(true)
  await tab(page, '资源')
  await page.locator('.resource-tile__eye').first().click()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: /^导出 PNG：/ }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  const bytes = await readFile((await download.path())!)
  const redPixels = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/png' }))
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let red = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 160 && pixels[i + 1] < 100 && pixels[i + 2] < 100) red++
    return red
  }, [...bytes])
  expect(redPixels).toBeGreaterThan(100)
})

test('Markdown import and picture text share the structured renderer and preserve focus', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles(image())
  await page.getByRole('button', { name: '放大并调整：IMG_001.svg', exact: true }).click()
  await page.getByRole('button', { name: '添加图片文字', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: '导入 Markdown', exact: true }).click()
  await modal.getByRole('textbox', { name: 'Markdown 内容', exact: true }).fill('# 山海旅途\n\n**加粗**与正文\n\n- 日出\n- 海浪')
  await modal.getByRole('button', { name: '替换并编辑', exact: true }).click()
  const editor = modal.getByRole('textbox', { name: '文字内容', exact: true })
  await expect(editor.locator('h1')).toHaveText('山海旅途')
  await expect(editor.locator('strong')).toHaveText('加粗')
  await expect(editor.locator('li')).toHaveCount(2)
  await editor.press('ControlOrMeta+End')
  for (const key of ['a', 'b', 'c']) { await page.keyboard.type(key); await expect(editor).toBeFocused() }
  await modal.getByRole('button', { name: '完成', exact: true }).click()
  await saved(page)
  await page.getByRole('button', { name: '编辑画面文字', exact: true }).click()
  await expect(editor).toContainText('海浪abc')
  await expect(modal.locator('.photo-text-box svg text').filter({ hasText: '山海旅途' })).toBeVisible()
})
