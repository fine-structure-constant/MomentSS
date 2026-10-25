import type { ImportedAsset, Project, SavedComposition, StitchDraft } from '../types'
import { recoverEditedAssets, recoverImportedAssets } from './assetLibrary'
import { normalizeResource } from './resourceCatalog'

const DB_NAME = 'liubai-collage'
const DB_VERSION = 3
export const LEGACY_PROJECT_ID = 'legacy'
const PROJECTS = 'projects'
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
      if (!db.objectStoreNames.contains(PROJECTS)) {
        db.createObjectStore(PROJECTS)
        request.transaction!.objectStore(PROJECTS).put({ id: LEGACY_PROJECT_ID, name: '', createdAt: Date.now(), updatedAt: Date.now() }, `project:${LEGACY_PROJECT_ID}`)
      }
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onblocked = () => reject(new Error('database-blocked'))
    request.onerror = () => reject(request.error ?? new Error('无法打开浏览器本地草稿库'))
  })
}

const draftKey = (projectId: string) => projectId === LEGACY_PROJECT_ID ? STITCH_KEY : `draft:${projectId}`
const assetKey = (projectId: string) => projectId === LEGACY_PROJECT_ID ? LIBRARY_KEY : `imported:${projectId}`
export async function loadStitchWorkspace(projectId = LEGACY_PROJECT_ID): Promise<{ draft: StitchDraft | null; assets: ImportedAsset[] }> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, ASSETS], 'readonly')
    const draftRequest = transaction.objectStore(STORE).get(draftKey(projectId))
    const assetsRequest = transaction.objectStore(ASSETS).get(assetKey(projectId))
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
          ? recoverEditedAssets(imported, draft?.blocks ?? []).map(normalizeResource)
          : imported.map(normalizeResource),
      })
    }
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('读取本地工作区失败')) }
  })
}

export async function saveStitchWorkspace(draft: StitchDraft, assets: ImportedAsset[], projectId = LEGACY_PROJECT_ID): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE, ASSETS], 'readwrite')
    transaction.objectStore(STORE).put(draft, draftKey(projectId))
    transaction.objectStore(ASSETS).put(assets, assetKey(projectId))
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

export async function saveStitchDraft(draft: StitchDraft, projectId = LEGACY_PROJECT_ID): Promise<void> {
  await writeEntry(STORE, draftKey(projectId), draft)
}

export async function saveImportedAssets(assets: ImportedAsset[], projectId = LEGACY_PROJECT_ID): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS, 'readwrite')
    tx.objectStore(ASSETS).put(assets, assetKey(projectId))
    tx.objectStore(ASSETS).put(RESOURCE_EDIT_VERSION, RESOURCE_EDIT_VERSION_KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('保存资源失败')) }
  })
}

export async function loadSavedCompositions(projectId = LEGACY_PROJECT_ID): Promise<SavedComposition[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS, 'readonly')
    const request = tx.objectStore(ASSETS).getAll(IDBKeyRange.bound(COMPOSITION_PREFIX, `${COMPOSITION_PREFIX}\uffff`))
    tx.oncomplete = () => { db.close(); resolve((request.result as SavedComposition[]).filter((item) => (item.taskId ?? LEGACY_PROJECT_ID) === projectId).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('读取长图资源失败')) }
  })
}

export async function loadProjects(): Promise<{ projects: Project[]; activeId: string }> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS)
    const records = tx.objectStore(PROJECTS).getAll(IDBKeyRange.bound('project:', 'project:\uffff'))
    const active = tx.objectStore(PROJECTS).get('active')
    tx.oncomplete = () => { db.close(); resolve({ projects: records.result, activeId: active.result ?? LEGACY_PROJECT_ID }) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}
export async function saveProject(project: Project): Promise<void> { await writeEntry(PROJECTS, `project:${project.id}`, project) }
export async function saveActiveProject(projectId: string): Promise<void> { await writeEntry(PROJECTS, 'active', projectId) }

/** One transaction: bulk removal never commits just half its resource selection. */
export async function saveResourceSelection(assets: ImportedAsset[], removedCompositionIds: string[], projectId = LEGACY_PROJECT_ID, restoredCompositions: SavedComposition[] = []): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ASSETS, 'readwrite')
    tx.objectStore(ASSETS).put(assets, assetKey(projectId))
    tx.objectStore(ASSETS).put(RESOURCE_EDIT_VERSION, RESOURCE_EDIT_VERSION_KEY)
    for (const id of removedCompositionIds) tx.objectStore(ASSETS).delete(COMPOSITION_PREFIX + id)
    for (const composition of restoredCompositions) tx.objectStore(ASSETS).put(composition, COMPOSITION_PREFIX + composition.id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error) }
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
