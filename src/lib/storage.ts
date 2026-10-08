import type { ImportedAsset, SavedComposition, StitchDraft } from '../types'
import { recoverEditedAssets, recoverImportedAssets } from './assetLibrary'

const DB_NAME = 'liubai-collage'
const DB_VERSION = 2
const STORE = 'drafts'
const ASSETS = 'assets'
const LIBRARY_KEY = 'imported-stitch'
const RESOURCE_EDIT_VERSION_KEY = 'resource-edit-version'
const RESOURCE_EDIT_VERSION = 1
const STITCH_KEY = 'current-stitch'
const COMPOSITION_PREFIX = 'composition:'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开浏览器本地草稿库'))
  })
}

export async function loadStitchWorkspace(): Promise<{ draft: StitchDraft | null; assets: ImportedAsset[] }> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, ASSETS], 'readonly')
    const draftRequest = transaction.objectStore(STORE).get(STITCH_KEY)
    const assetsRequest = transaction.objectStore(ASSETS).get(LIBRARY_KEY)
    const resourceVersionRequest = transaction.objectStore(ASSETS).get(RESOURCE_EDIT_VERSION_KEY)
    transaction.oncomplete = () => {
      db.close()
      const draft = (draftRequest.result as StitchDraft | undefined) ?? null
      const assets = assetsRequest.result as ImportedAsset[] | undefined
      // An explicitly empty library must never be repopulated from remaining layers.
      const imported = assets ?? recoverImportedAssets(draft?.blocks ?? [])
      resolve({
        draft,
        assets: (resourceVersionRequest.result ?? 0) < RESOURCE_EDIT_VERSION
          ? recoverEditedAssets(imported, draft?.blocks ?? [])
          : imported,
      })
    }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('读取本地工作区失败')) }
  })
}

export async function saveStitchWorkspace(draft: StitchDraft, assets: ImportedAsset[]): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, ASSETS], 'readwrite')
    transaction.objectStore(STORE).put(draft, STITCH_KEY)
    transaction.objectStore(ASSETS).put(assets, LIBRARY_KEY)
    transaction.objectStore(ASSETS).put(RESOURCE_EDIT_VERSION, RESOURCE_EDIT_VERSION_KEY)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('保存本地工作区失败')) }
  })
}

export async function clearStitchDraft(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(STITCH_KEY)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('清除本地草稿失败')) }
  })
}

export async function saveStitchDraft(draft: StitchDraft): Promise<void> {
  await writeEntry(STORE, STITCH_KEY, draft)
}

export async function saveImportedAssets(assets: ImportedAsset[]): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS, 'readwrite')
    tx.objectStore(ASSETS).put(assets, LIBRARY_KEY)
    tx.objectStore(ASSETS).put(RESOURCE_EDIT_VERSION, RESOURCE_EDIT_VERSION_KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('保存资源失败')) }
  })
}

export async function loadSavedCompositions(): Promise<SavedComposition[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS, 'readonly')
    const request = tx.objectStore(ASSETS).getAll(IDBKeyRange.bound(COMPOSITION_PREFIX, `${COMPOSITION_PREFIX}\uffff`))
    tx.oncomplete = () => { db.close(); resolve((request.result as SavedComposition[]).sort((a, b) => b.createdAt - a.createdAt)) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('读取长图资源失败')) }
  })
}

export async function saveComposition(composition: SavedComposition): Promise<void> {
  await writeEntry(ASSETS, COMPOSITION_PREFIX + composition.id, composition)
}

export async function deleteComposition(id: string): Promise<void> {
  await writeEntry(ASSETS, COMPOSITION_PREFIX + id, undefined)
}

async function writeEntry(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    if (value === undefined) tx.objectStore(store).delete(key)
    else tx.objectStore(store).put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('保存本地资源失败')) }
  })
}
