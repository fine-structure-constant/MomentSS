import type { ImportedAsset, Project, SavedComposition, StitchDraft } from '../types'
import { recoverEditedAssets, recoverImportedAssets } from './assetLibrary'
import { normalizeResource } from './resourceCatalog'
import { blobReferences, commitGraphs, hydrateGraph, readLibraryRecords } from './storageGraph'

export const LEGACY_PROJECT_ID = 'legacy'
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('liubai-collage', 4)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ['drafts', 'assets', 'records', 'blobs']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects')
        request.transaction!.objectStore('projects').put({ id: LEGACY_PROJECT_ID, name: '', createdAt: Date.now(), updatedAt: Date.now() }, 'project:legacy')
      }
    }
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
    request.onblocked = () => reject(new Error('database-blocked'))
    request.onerror = () => reject(request.error ?? new Error('database-open-failed'))
  })
}
async function database<T>(action: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase()
  try { return await action(db) } finally { db.close() }
}
const draftKey = (id: string) => id === LEGACY_PROJECT_ID ? 'current-stitch' : `draft:${id}`
const assetKey = (id: string) => id === LEGACY_PROJECT_ID ? 'imported-stitch' : `imported:${id}`
function get(db: IDBDatabase, store: string, key: IDBValidKey | IDBKeyRange, all = false): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store), request = all ? tx.objectStore(store).getAll(key) : tx.objectStore(store).get(key)
    tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error)
  })
}
export async function loadStitchWorkspace(projectId = LEGACY_PROJECT_ID): Promise<{ draft: StitchDraft | null; assets: ImportedAsset[] }> {
  return database(async (db) => {
    const [rawDraft, index, version] = await Promise.all([get(db, 'drafts', draftKey(projectId)), get(db, 'assets', assetKey(projectId)), get(db, 'assets', 'resource-edit-version')])
    const draft = await hydrateGraph<StitchDraft | null>(db, rawDraft ?? null)
    if ((draft?.schemaVersion ?? 1) > 2) throw new Error('unsupported-draft-version')
    const raw = index === undefined ? null : await readLibraryRecords(db, assetKey(projectId), index)
    const imported = raw === null ? recoverImportedAssets(draft?.blocks ?? []) : await hydrateGraph<ImportedAsset[]>(db, raw)
    return { draft, assets: ((Number(version) || 0) < 1 ? recoverEditedAssets(imported, draft?.blocks ?? []) : imported).map(normalizeResource) }
  })
}
const write = (store: string, key: string, value: unknown) => ({ store, key, value })
export async function saveStitchWorkspace(draft: StitchDraft, assets: ImportedAsset[], projectId = LEGACY_PROJECT_ID): Promise<void> {
  await database((db) => commitGraphs(db, [write('drafts', draftKey(projectId), draft), write('assets', 'resource-edit-version', 1)], { key: assetKey(projectId), items: assets }))
}
export async function saveStitchDraft(draft: StitchDraft, projectId = LEGACY_PROJECT_ID): Promise<void> {
  await database((db) => commitGraphs(db, [write('drafts', draftKey(projectId), draft)]))
}
export async function clearStitchDraft(): Promise<void> { await database((db) => commitGraphs(db, [write('drafts', 'current-stitch', undefined)])) }
export async function saveImportedAssets(assets: ImportedAsset[], projectId = LEGACY_PROJECT_ID): Promise<void> {
  await database((db) => commitGraphs(db, [write('assets', 'resource-edit-version', 1)], { key: assetKey(projectId), items: assets }))
}
export async function loadSavedCompositions(projectId = LEGACY_PROJECT_ID): Promise<SavedComposition[]> {
  return database(async (db) => {
    const raw = await get(db, 'assets', IDBKeyRange.bound('composition:', 'composition:\uffff'), true)
    const compositions = await hydrateGraph<SavedComposition[]>(db, (raw as SavedComposition[]).filter((item) => (item.taskId ?? LEGACY_PROJECT_ID) === projectId))
    return compositions.filter((item) => (item.taskId ?? LEGACY_PROJECT_ID) === projectId).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  })
}
export async function loadProjects(): Promise<{ projects: Project[]; activeId: string }> {
  return database(async (db) => {
    const [projects, activeId] = await Promise.all([get(db, 'projects', IDBKeyRange.bound('project:', 'project:\uffff'), true), get(db, 'projects', 'active')])
    return { projects: projects as Project[], activeId: (activeId as string) ?? LEGACY_PROJECT_ID }
  })
}
export async function saveProject(project: Project): Promise<void> { await database((db) => commitGraphs(db, [write('projects', `project:${project.id}`, project)])) }
export async function saveActiveProject(id: string): Promise<void> { await database((db) => commitGraphs(db, [write('projects', 'active', id)])) }
export async function saveResourceSelection(assets: ImportedAsset[], removed: string[], projectId = LEGACY_PROJECT_ID, restored: SavedComposition[] = []): Promise<void> {
  await database((db) => commitGraphs(db, [write('assets', 'resource-edit-version', 1), ...removed.map((id) => write('assets', `composition:${id}`, undefined)), ...restored.map((item) => write('assets', `composition:${item.id}`, item))], { key: assetKey(projectId), items: assets }))
}
export async function saveComposition(composition: SavedComposition): Promise<void> { await database((db) => commitGraphs(db, [write('assets', `composition:${composition.id}`, composition)])) }
export async function deleteComposition(id: string): Promise<void> { await database((db) => commitGraphs(db, [write('assets', `composition:${id}`, undefined)])) }
export async function loadToolState<T>(tool: string, projectId: string): Promise<T | null> {
  return database(async (db) => hydrateGraph<T | null>(db, await get(db, 'drafts', `tool:${tool}:${projectId}`) ?? null))
}
export async function saveToolState(tool: string, projectId: string, value: unknown): Promise<void> {
  await database((db) => commitGraphs(db, [write('drafts', `tool:${tool}:${projectId}`, value)]))
}
/** Restore into a fresh task in one transaction, preserving the original workspace. */
export async function restoreProject(project: Project, draft: StitchDraft | null, assets: ImportedAsset[], saved: SavedComposition[], grid?: unknown): Promise<void> {
  await database((db) => commitGraphs(db, [write('projects', `project:${project.id}`, project), write('drafts', draftKey(project.id), draft), write('assets', 'resource-edit-version', 1), ...saved.map((item) => write('assets', `composition:${item.id}`, item)), ...(grid ? [write('drafts', `tool:grid:${project.id}`, grid)] : [])], { key: assetKey(project.id), items: assets }))
}
/** Scan and collect in the same exclusive transaction, so an autosave cannot race GC. */
export async function compactStorage(): Promise<number> {
  return database((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(['drafts', 'assets', 'records', 'blobs'], 'readwrite'), refs = new Set<string>()
    let pending = 3, removed = 0
    for (const name of ['drafts', 'assets', 'records']) {
      const request = tx.objectStore(name).getAll()
      request.onsuccess = () => {
        blobReferences(request.result, refs)
        if (--pending) return
        const cursor = tx.objectStore('blobs').openCursor()
        cursor.onsuccess = () => { const entry = cursor.result; if (!entry) return; if (!refs.has(String(entry.key))) { entry.delete(); removed++ } entry.continue() }
      }
    }
    tx.oncomplete = () => resolve(removed); tx.onabort = () => reject(tx.error)
  }))
}
