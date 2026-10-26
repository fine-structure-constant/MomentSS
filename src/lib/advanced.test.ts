import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createTextBlock, DEFAULT_SETTINGS } from './defaults'
import { compactStorage, loadProjects, loadStitchWorkspace, openDatabase, saveImportedAssets, saveStitchWorkspace } from './storage'
import { createProjectPackage, importProjectPackage, readProjectPackage } from './projectBackup'
import { layoutRichText } from './richText'
import { buildStitchLayout } from './stitchLayout'
import { pasteLayerStyle, copyLayerStyle } from './layerStyles'
import type { PhotoBlock } from '../types'
import { unzipSync, zipSync } from 'fflate'

beforeEach(async () => { await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase('liubai-collage'); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) }) })
const photo = (id: string): PhotoBlock => ({ id, type: 'photo', name: id, blob: new Blob(['same image bytes'], { type: 'image/png' }), width: 800, height: 600 })
describe('storage graph and editable packages', () => {
  it('shares immutable bytes across resources/drafts and GC keeps all live references', async () => {
    const a = photo('a'), b = photo('b')
    await saveStitchWorkspace({ blocks: [a], settings: DEFAULT_SETTINGS, updatedAt: 1 }, [a, b])
    const db = await openDatabase()
    const count = await new Promise<number>((resolve) => { const tx = db.transaction('blobs'); const r = tx.objectStore('blobs').count(); tx.oncomplete = () => { db.close(); resolve(r.result) } })
    expect(count).toBe(1)
    await saveImportedAssets([])
    expect(await compactStorage()).toBe(0)
    expect((await loadStitchWorkspace()).draft?.blocks).toHaveLength(1)
    await saveStitchWorkspace({ blocks: [], settings: DEFAULT_SETTINGS, updatedAt: 2 }, [])
    expect(await compactStorage()).toBe(1)
  })
  it('exports bytes and structured formatting and restores atomically into a new task', async () => {
    const project = (await loadProjects()).projects[0], a = photo('a'), text = { ...createTextBlock('海浪 🌊'), emojiStyle: 'twemoji-v17' as const }
    await saveStitchWorkspace({ blocks: [a, text], settings: DEFAULT_SETTINGS, updatedAt: 1 }, [a, text])
    const archive = await createProjectPackage(project), parsed = await readProjectPackage(archive)
    expect(await (parsed.assets[0] as PhotoBlock).blob.text()).toBe('same image bytes')
    const restored = await importProjectPackage(archive)
    expect(restored.id).not.toBe('legacy')
    expect((await loadStitchWorkspace(restored.id)).assets[1]).toMatchObject({ emojiStyle: 'twemoji-v17', taskId: restored.id })
    expect((await loadStitchWorkspace()).assets).toHaveLength(2)
    await expect(readProjectPackage(new Blob(['bad']))).rejects.toBeDefined()
  })
  it('rejects modified package bytes before creating a task', async () => {
    const project = (await loadProjects()).projects[0], a = photo('a')
    await saveStitchWorkspace({ blocks: [a], settings: DEFAULT_SETTINGS, updatedAt: 1 }, [a])
    const files = unzipSync(new Uint8Array(await (await createProjectPackage(project)).arrayBuffer()))
    const key = Object.keys(files).find((key) => key.startsWith('blobs/'))!
    files[key][0] ^= 255
    await expect(importProjectPackage(new Blob([zipSync(files) as Uint8Array<ArrayBuffer>]))).rejects.toThrow('backup-checksum')
    expect((await loadProjects()).projects).toHaveLength(1)
  })
  it('leaves a future resource index intact instead of overwriting unknown data', async () => {
    const db = await openDatabase()
    await new Promise<void>((resolve) => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put({ schemaVersion: 99, ids: [] }, 'imported-stitch'); tx.oncomplete = () => resolve() })
    db.close()
    await expect(loadStitchWorkspace()).rejects.toThrow('unsupported-record-version')
    await expect(saveImportedAssets([])).rejects.toBeDefined()
  })
})
describe('shared presentation geometry', () => {
  it('creates one complete emoji run and uses explicit geometry for graphic styles', () => {
    const style = { ...createTextBlock('A👨‍👩‍👧‍👦🌊'), emojiStyle: 'twemoji-v17' as const }
    const layout = layoutRichText(style, 1000, (text) => text.length * 10)
    expect(layout.runs.filter((run) => run.emoji).map((run) => run.text)).toEqual(['👨‍👩‍👧‍👦', '🌊'])
    expect(layout.runs.filter((run) => run.emoji).every((run) => run.width === style.fontSize)).toBe(true)
  })
  it('lays out 3 images with weighted widths and gaps, preserving complete layers', () => {
    const layout = buildStitchLayout([{ id: 'row', type: 'photo-row', photos: [photo('a'), photo('b'), photo('c')], widths: [1, 2, 1], gap: 10 }], DEFAULT_SETTINGS, () => 0)
    const photos = layout.items[0].photos
    expect(photos[1].width).toBe(photos[0].width * 2)
    expect(photos.at(-1)!.x + photos.at(-1)!.width).toBe(1080)
  })
  it('copies styling without overwriting content, crop or identity', () => {
    const a = createTextBlock('source', { color: '#ff0000' }), b = createTextBlock('target')
    expect(pasteLayerStyle(b, copyLayerStyle(a)!)).toMatchObject({ id: b.id, text: 'target', color: '#ff0000' })
  })
})
