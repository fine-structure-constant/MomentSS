import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTextBlock, DEFAULT_SETTINGS } from './defaults'
import { LEGACY_PROJECT_ID, loadProjects, loadSavedCompositions, loadStitchWorkspace, saveComposition, saveImportedAssets, saveProject, saveResourceSelection, saveStitchWorkspace } from './storage'

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('liubai-collage'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error) })
})
describe('project storage and legacy migration', () => {
  it('upgrades a v2 database without changing old records or unknown dates', async () => {
    const old = createTextBlock('literal **text**')
    await new Promise<void>((resolve) => {
      const request = indexedDB.open('liubai-collage', 2)
      request.onupgradeneeded = () => { request.result.createObjectStore('drafts'); request.result.createObjectStore('assets') }
      request.onsuccess = () => { const db = request.result; const tx = db.transaction(['drafts', 'assets'], 'readwrite'); tx.objectStore('assets').put([old], 'imported-stitch'); tx.objectStore('drafts').put({ blocks: [old], settings: DEFAULT_SETTINGS, updatedAt: 100 }, 'current-stitch'); tx.oncomplete = () => { db.close(); resolve() } }
    })
    const index = await loadProjects()
    expect(index.activeId).toBe(LEGACY_PROJECT_ID)
    const workspace = await loadStitchWorkspace()
    expect(workspace.assets[0]).toMatchObject({ text: 'literal **text**' })
    expect(workspace.assets[0].importedAt).toBeUndefined()
    expect(workspace.draft?.blocks).toHaveLength(1)
  })
  it('keeps tasks, drafts and snapshots isolated, and clears only selected resources', async () => {
    await loadProjects()
    await saveProject({ id: 'next', name: 'Next', createdAt: 1, updatedAt: 1 })
    const old = createTextBlock('old'), next = createTextBlock('next')
    await saveStitchWorkspace({ blocks: [old], settings: DEFAULT_SETTINGS, updatedAt: 1 }, [old])
    await saveImportedAssets([next], 'next')
    await saveComposition({ id: 'saved', name: 'saved', kind: 'collage', blocks: [old], settings: DEFAULT_SETTINGS, createdAt: 1, width: 1, height: 1, thumbnail: new Blob() })
    expect((await loadStitchWorkspace('next')).assets[0].id).toBe(next.id)
    expect(await loadSavedCompositions('next')).toEqual([])
    await saveResourceSelection([], [], LEGACY_PROJECT_ID)
    expect((await loadStitchWorkspace()).assets).toEqual([])
    expect((await loadStitchWorkspace()).draft?.blocks).toHaveLength(1)
    expect(await loadSavedCompositions()).toHaveLength(1)
    expect((await loadStitchWorkspace('next')).assets).toHaveLength(1)
  })
})
