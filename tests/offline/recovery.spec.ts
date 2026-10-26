import { expect, test } from '@playwright/test'
test.use({ serviceWorkers: 'block' })

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
