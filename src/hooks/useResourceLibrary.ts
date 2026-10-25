import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type { ImportedAsset, Project, SavedComposition, StitchDraft } from '../types'
import type { ToastMessage } from '../components/StatusToast'
import { LEGACY_PROJECT_ID, loadProjects, loadSavedCompositions, loadStitchWorkspace, saveActiveProject, saveComposition, saveImportedAssets, saveProject, saveResourceSelection, saveStitchDraft, saveStitchWorkspace } from '../lib/storage'
import { restoreRemoved } from '../lib/operations'
import { useI18n } from '../i18n'

export function useResourceLibrary(onToast: (message: ToastMessage) => void) {
  const { t } = useI18n()
  const [assets, setAssetState] = useState<ImportedAsset[]>([])
  const [compositions, setCompositionState] = useState<SavedComposition[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState(LEGACY_PROJECT_ID)
  const [ready, setReady] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const latest = useRef(assets)
  const savedRef = useRef(compositions)
  const projectRef = useRef(projectId)
  const draftRef = useRef<StitchDraft | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = queue.current.catch(() => {}).then(operation)
    queue.current = next
    return next
  }, [])
  const applyAssets = useCallback((next: ImportedAsset[]) => { latest.current = next; setAssetState(next) }, [])
  const applySaved = useCallback((next: SavedComposition[]) => { savedRef.current = next; setCompositionState(next) }, [])
  const setAssets = useCallback((action: SetStateAction<ImportedAsset[]>) => {
    if (projectRef.current !== projectId) return
    applyAssets(typeof action === 'function' ? action(latest.current) : action)
  }, [projectId, applyAssets])
  const readProject = useCallback(async (id: string) => {
    const [workspace, saved] = await Promise.all([loadStitchWorkspace(id), loadSavedCompositions(id)])
    projectRef.current = id
    draftRef.current = workspace.draft
    setProjectId(id)
    applyAssets(workspace.assets)
    applySaved(saved)
    setLastSavedId(null)
    setSaveState('saved')
  }, [applyAssets, applySaved])
  useEffect(() => {
    let disposed = false
    void loadProjects().then(async (index) => {
      if (disposed) return
      setProjects(index.projects)
      const active = index.projects.find((item) => item.id === index.activeId && !item.archivedAt) ?? index.projects.find((item) => !item.archivedAt)
      if (!active) throw new Error('missing-project')
      await readProject(active.id)
      setReady(true)
    }).catch(() => { setLoadError(true); onToast({ text: t('resource.readError'), tone: 'warning' }) })
    return () => { disposed = true }
    // Locale changes must not replace edits in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readProject, onToast])
  const flushAssets = useCallback(async () => {
    const id = projectRef.current, current = latest.current
    try { await enqueue(() => saveImportedAssets(current, id)); setSaveState('saved') }
    catch (error) { setSaveState('error'); throw error }
  }, [enqueue])
  useEffect(() => {
    if (!ready) return
    setSaveState('saving')
    const timer = window.setTimeout(() => { void flushAssets().catch(() => {}) }, 650)
    return () => window.clearTimeout(timer)
  }, [assets, ready, flushAssets])
  const stageDraft = useCallback((draft: StitchDraft, id: string) => { if (projectRef.current === id) draftRef.current = draft }, [])
  const persistDraft = useCallback((draft: StitchDraft, id: string) => enqueue(() => saveStitchDraft(draft, id)), [enqueue])
  const flushWorkspace = useCallback(async () => {
    const id = projectRef.current, draft = draftRef.current, current = latest.current
    await enqueue(() => draft ? saveStitchWorkspace(draft, current, id) : saveImportedAssets(current, id))
  }, [enqueue])
  const switchProject = useCallback(async (id: string) => {
    if (id === projectRef.current) return
    setSwitching(true)
    try {
      await flushWorkspace()
      setReady(false)
      await readProject(id)
      await saveActiveProject(id)
    } catch (error) { onToast({ text: t('project.switchError'), tone: 'warning' }); throw error }
    finally { setReady(true); setSwitching(false) }
  }, [flushWorkspace, readProject, onToast, t])
  const createProject = useCallback(async (name: string) => {
    const project: Project = { id: crypto.randomUUID(), name: name.trim().slice(0, 80), createdAt: Date.now(), updatedAt: Date.now() }
    await saveProject(project)
    setProjects((current) => [...current, project])
    await switchProject(project.id)
  }, [switchProject])
  const updateProject = useCallback(async (project: Project) => {
    await saveProject(project)
    setProjects((current) => current.map((item) => item.id === project.id ? project : item))
  }, [])
  const addComposition = useCallback(async (composition: SavedComposition) => {
    const target = { ...composition, taskId: composition.taskId ?? projectId }
    await enqueue(() => saveComposition(target))
    if (projectRef.current === target.taskId) {
      applySaved([target, ...savedRef.current.filter((item) => item.id !== target.id)])
      setLastSavedId(target.id)
    }
  }, [projectId, enqueue, applySaved])
  const deleteResources = useCallback(async (ids: string[]) => {
    const id = projectId, before = latest.current, savedBefore = savedRef.current
    const removed = new Set(ids)
    const savedIds = savedBefore.filter((item) => removed.has(item.id)).map((item) => item.id)
    const after = before.filter((item) => !removed.has(item.id))
    applyAssets(after)
    applySaved(savedBefore.filter((item) => !removed.has(item.id)))
    try { await enqueue(() => saveResourceSelection(after, savedIds, id)) }
    catch (error) {
      if (projectRef.current === id) { applyAssets(restoreRemoved(latest.current, before, ids)); applySaved(restoreRemoved(savedRef.current, savedBefore, ids)) }
      throw error
    }
    return async () => {
      // Apply the inverse before yielding, so later user actions see the restored state.
      if (projectRef.current === id) {
        const currentSaved = savedRef.current
        const restored = restoreRemoved(latest.current, before, ids)
        const restoredSaved = restoreRemoved(currentSaved, savedBefore, ids)
        const targets = restoredSaved.filter((item) => savedIds.includes(item.id) && !currentSaved.some((record) => record.id === item.id))
        applyAssets(restored)
        applySaved(restoredSaved)
        try { await enqueue(() => saveResourceSelection(restored, [], id, targets)) }
        catch (error) { setSaveState('error'); throw error }
        return
      }
      await enqueue(async () => {
        const current = (await loadStitchWorkspace(id)).assets
        const restored = restoreRemoved(current, before, ids)
        const existing = await loadSavedCompositions(id)
        const restoredSaved = restoreRemoved(existing, savedBefore, ids)
        await saveResourceSelection(restored, [], id, restoredSaved.filter((item) => savedIds.includes(item.id) && !existing.some((record) => record.id === item.id)))
      })
    }
  }, [projectId, applyAssets, applySaved, enqueue])
  const removeComposition = useCallback(async (id: string) => { await deleteResources([id]) }, [deleteResources])
  const clearSavedFocus = useCallback(() => setLastSavedId(null), [])
  const copyProjectAssets = useCallback(async (sourceId: string) => {
    const targetId = projectId
    const imported = (await loadStitchWorkspace(sourceId)).assets.map((asset, index) => ({ ...asset, id: crypto.randomUUID(), sourceId: undefined, taskId: targetId, importedAt: Date.now(), importOrder: index }))
    if (projectRef.current === targetId) setAssets((current) => [...current, ...imported])
  }, [projectId, setAssets])
  return { assets, setAssets, compositions, ready, loadError, lastSavedId, clearSavedFocus, saveState, flushAssets, addComposition, removeComposition, deleteResources,
    projects, projectId, switching, switchProject, createProject, updateProject, stageDraft, persistDraft, flushWorkspace, copyProjectAssets }
}
export type ResourceLibrary = ReturnType<typeof useResourceLibrary>
