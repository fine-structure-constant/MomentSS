import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { ImportedAsset, Project, SavedComposition, StitchDraft } from '../types'
import { loadSavedCompositions, loadStitchWorkspace, loadToolState, restoreProject } from './storage'
import { blobReferences, decodeGraph, encodeGraph } from './storageGraph'

interface Package { schema: 1; project: Project; draft: StitchDraft | null; assets: ImportedAsset[]; compositions: SavedComposition[]; grid: unknown }
export async function createProjectPackage(project: Project): Promise<Blob> {
  const [workspace, compositions, grid] = await Promise.all([loadStitchWorkspace(project.id), loadSavedCompositions(project.id), loadToolState('grid', project.id)])
  const graph = await encodeGraph({ schema: 1, project, ...workspace, compositions, grid })
  const entries: Record<string, Uint8Array> = { 'project.json': strToU8(JSON.stringify(graph.value)) }
  let total = entries['project.json'].length
  for (const [id, blob] of graph.blobs) { total += blob.size; if (total > 256 * 1024 * 1024) throw new Error('backup-budget'); entries[`blobs/${id}`] = new Uint8Array(await blob.arrayBuffer()) }
  return new Blob([zipSync(entries, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}
export async function readProjectPackage(blob: Blob): Promise<Package> {
  if (blob.size > 260 * 1024 * 1024) throw new Error('backup-budget')
  let total = 0, count = 0
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()), { filter: (entry) => {
    total += entry.originalSize; count++
    if (total > 256 * 1024 * 1024 || count > 5000 || !/^(project\.json|blobs\/[a-f0-9]{64})$/.test(entry.name) || entry.name === 'project.json' && entry.originalSize > 8 * 1024 * 1024) throw new Error('invalid-backup')
    return true
  } })
  if (!entries['project.json']) throw new Error('invalid-backup')
  const json = JSON.parse(strFromU8(entries['project.json']))
  if (json.schema !== 1 || !json.project || typeof json.project.name !== 'string' || !Array.isArray(json.assets) || !Array.isArray(json.compositions) || json.assets.length > 5000 || json.compositions.length > 5000) throw new Error('invalid-backup')
  const blobs = new Map<string, Blob>()
  for (const key of blobReferences(json)) {
    const bytes = entries[`blobs/${key}`]
    if (!bytes) throw new Error('missing-blob')
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))].map((n) => n.toString(16).padStart(2, '0')).join('')
    if (hash !== key) throw new Error('backup-checksum')
    blobs.set(key, new Blob([bytes as Uint8Array<ArrayBuffer>]))
  }
  const result = decodeGraph<Package>(json, blobs)
  const settings = (value: unknown) => {
    const data = value as Record<string, unknown> | null
    if (!data || typeof data.width !== 'number' || data.width < 1 || data.width > 16384 || !Number.isFinite(data.width) || typeof data.padding !== 'number' || data.padding < 0 || data.padding > data.width / 2 || typeof data.gap !== 'number' || data.gap < 0 || data.gap > 2000 || !['image/png', 'image/jpeg'].includes(String(data.format))) throw new Error('invalid-settings')
  }
  const document = (value: unknown, depth = 0, counter = { count: 0 }) => {
    if (!value || typeof value !== 'object' || depth > 16 || ++counter.count > 50000) throw new Error('invalid-document')
    const node = value as { version?: number; type?: string; content?: unknown[]; text?: unknown }
    if (node.version !== undefined && node.version !== 1 || !['doc', 'paragraph', 'text', 'heading', 'hardBreak', 'bulletList', 'orderedList', 'listItem', 'blockquote'].includes(node.type ?? '') || node.text !== undefined && typeof node.text !== 'string') throw new Error('invalid-document')
    if (node.content) { if (!Array.isArray(node.content)) throw new Error('invalid-document'); node.content.forEach((child) => document(child, depth + 1, counter)) }
  }
  const asset = (item: ImportedAsset) => {
    if (!item || typeof item.id !== 'string' || !['photo', 'text'].includes(item.type)) throw new Error('invalid-asset')
    if ((item.schemaVersion ?? 1) > 2) throw new Error('unsupported-resource')
    if (item.type === 'photo' && (!(item.blob instanceof Blob) || !Number.isFinite(item.width) || item.width <= 0 || !Number.isFinite(item.height) || item.height <= 0)) throw new Error('invalid-image')
    if (item.type === 'text' && (typeof item.text !== 'string' || !Number.isFinite(item.fontSize))) throw new Error('invalid-text')
    const text = item.type === 'text' ? item : item.overlay
    if (text?.richText) document(text.richText)
  }
  const blocks = (items: unknown) => {
    if (!Array.isArray(items) || items.length > 5000) throw new Error('invalid-layers')
    for (const item of items) { if (item.type === 'photo-row') { if (!Array.isArray(item.photos) || item.photos.length < 2 || item.photos.length > 4) throw new Error('invalid-row'); item.photos.forEach(asset) } else asset(item) }
  }
  result.assets.forEach(asset)
  if (new Set(result.assets.map((item) => item.id)).size !== result.assets.length || new Set(result.compositions.map((item) => item.id)).size !== result.compositions.length) throw new Error('duplicate-resource-id')
  if (result.draft) { if ((result.draft.schemaVersion ?? 1) > 2) throw new Error('unsupported-draft'); blocks(result.draft.blocks); settings(result.draft.settings) }
  for (const composition of result.compositions) { blocks(composition.blocks); settings(composition.settings); if ((composition.schemaVersion ?? 1) > 2 || !(composition.thumbnail instanceof Blob) || typeof composition.id !== 'string') throw new Error('invalid-composition'); if (composition.cover) asset(composition.cover.photo) }
  if (result.grid) {
    const grid = result.grid as { count: number; size: number; crop: { zoom: number; x: number; y: number }; source?: { blob: Blob; width: number; height: number } }
    if (![4, 6, 9].includes(grid.count) || ![720, 1080, 1440, 2160].includes(grid.size) || !grid.crop || !Number.isFinite(grid.crop.zoom) || grid.crop.zoom < 1 || grid.crop.zoom > 4) throw new Error('invalid-grid')
    if (grid.source && (!(grid.source.blob instanceof Blob) || grid.source.width <= 0 || grid.source.height <= 0)) throw new Error('invalid-grid')
  }
  return result
}
export async function importProjectPackage(blob: Blob, restoredName = 'Restored task'): Promise<Project> {
  const value = await readProjectPackage(blob), id = crypto.randomUUID(), now = Date.now()
  const project: Project = { id, name: (value.project.name ? `${value.project.name} · ${restoredName}` : restoredName).slice(0, 80), createdAt: now, updatedAt: now }
  const ids = new Map(value.compositions.map((item) => [item.id, `composition-${crypto.randomUUID()}`]))
  const compositions = value.compositions.map((item) => ({ ...item, id: ids.get(item.id)!, taskId: id }))
  const draft = value.draft ? { ...value.draft, sourceCompositionId: ids.get(value.draft.sourceCompositionId ?? '') ?? null } : null
  await restoreProject(project, draft, value.assets.map((item) => ({ ...item, taskId: id })), compositions, value.grid)
  return project
}
