import { expect, type Page } from '@playwright/test'
import type { ImportedAsset } from '../../src/types'
export const image = (name = 'IMG_001.svg') => ({ name, mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#8fd7df"/></svg>') })
export const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true }).click()
export const saved = (page: Page) => expect(page.getByText('本地草稿已保存', { exact: true })).toBeVisible()
export async function assets(page: Page, projectId = 'legacy') {
  return page.evaluate(async (id): Promise<ImportedAsset[]> => { const path = '/src/lib/storage.ts'; return (await (await import(path)).loadStitchWorkspace(id)).assets }, projectId)
}
