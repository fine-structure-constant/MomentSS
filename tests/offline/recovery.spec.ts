import { expect, test } from '@playwright/test'
test.use({ serviceWorkers: 'block' })

test('white photo text has an editing aid on the first advanced-editor mount before any keystroke', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles({ name: 'white.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8fd7df"/></svg>') })
  await page.getByRole('button', { name: '放大并调整：white.svg', exact: true }).click()
  await page.getByRole('button', { name: '添加图片文字', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('textbox', { name: '文字内容', exact: true }).fill('高级编辑器首次显示白字')
  await modal.getByRole('button', { name: '高级排版', exact: true }).click()
  const editor = modal.locator('.tiptap')
  await expect(editor).toHaveText('高级编辑器首次显示白字')
  await expect(editor).toHaveClass(/editor-light-text/)
  expect(await editor.evaluate((node) => getComputedStyle(node).textShadow)).not.toBe('none')
})

test('a stale deployment manifest cannot unmount basic editing or silently replace formatted content', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/app-manifest.json*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ schema: 1, build: 'old', version: 'old', files: [] }) }))
  await page.goto('/')
  await page.getByRole('button', { name: '文字卡片', exact: true }).click()
  await page.getByRole('tab', { name: '调整', exact: true }).click()
  const input = page.getByRole('textbox', { name: '文字内容', exact: true })
  await input.fill('旧缓存不能清空我的工作区')
  await page.getByRole('button', { name: '高级排版', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('内容已保留')
  await expect(input).toHaveValue('旧缓存不能清空我的工作区')
  await input.press('End'); await input.pressSequentially('abc')
  await expect(input).toHaveValue('旧缓存不能清空我的工作区abc')
  expect(errors).toEqual([])
})
