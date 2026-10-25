import { test, expect } from '@playwright/test'
import { image, saved, tab } from './helpers'

test('selected layers can move upward, expose grouped actions, copy and undo deletion', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([image('one.svg'), image('two.svg'), image('three.svg')])
  await tab(page, '图层')
  await page.getByRole('button', { name: '选择图层 3', exact: true }).click()
  const selected = page.locator('.layer-row.is-selected')
  await expect(selected.getByRole('button', { name: '上移', exact: true })).toBeVisible()
  expect(await selected.getByRole('button', { name: '上移', exact: true }).evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await selected.getByRole('button', { name: '上移', exact: true }).click()
  await expect(page.locator('.layer-row__label strong')).toHaveText(['one.svg', 'three.svg', 'two.svg'])
  await selected.locator('.layer-row__more').click()
  await selected.getByRole('button', { name: '复制图层', exact: true }).click()
  await expect(page.locator('.layer-row')).toHaveCount(4)
  await selected.locator('.layer-row__more').click()
  await selected.getByRole('button', { name: '从画布移除', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '从画布移除', exact: true }).click()
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.locator('.layer-row')).toHaveCount(4)
  await saved(page)
  await page.reload(); await tab(page, '图层')
  await expect(page.locator('.layer-row')).toHaveCount(4)
})

test('keyboard sorting works through the dedicated drag handle', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([image('one.svg'), image('two.svg')])
  await tab(page, '图层')
  const handle = page.getByRole('button', { name: '排序图层 1', exact: true })
  await handle.focus(); await handle.press('Space')
  await expect(page.locator('.layer-row.is-dragging')).toHaveCount(1)
  const target = await page.locator('.layer-row').nth(1).getAttribute('data-layer-id')
  await handle.press('ArrowDown')
  await expect(page.locator('.layer-list')).toHaveAttribute('data-over-id', target!)
  await handle.press('Space')
  await expect(page.locator('.layer-row__label strong')).toHaveText(['two.svg', 'one.svg'])
})

test('touch drag reorders layers without requiring a mouse', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'Actual touch input is tested in the mobile project.')
  await page.goto('/')
  await page.locator('input[type=file]').setInputFiles([image('one.svg'), image('two.svg')])
  await tab(page, '图层')
  const handles = page.locator('.layer-row__handle')
  await handles.first().scrollIntoViewIfNeeded()
  const first = (await handles.first().boundingBox())!, second = (await handles.nth(1).boundingBox())!
  const client = await context.newCDPSession(page)
  const x = first.x + first.width / 2, y = first.y + first.height / 2, end = second.y + second.height / 2
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  await page.waitForTimeout(250)
  for (let step = 1; step <= 8; step++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (end - y) * step / 8, id: 1 }] })
    await page.waitForTimeout(35)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.locator('.layer-row__label strong')).toHaveText(['two.svg', 'one.svg'])
})
