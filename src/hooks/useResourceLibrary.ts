import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImportedAsset, SavedComposition } from '../types'
import type { ToastMessage } from '../components/StatusToast'
import { deleteComposition, loadSavedCompositions, loadStitchWorkspace, saveComposition, saveImportedAssets } from '../lib/storage'
import { useI18n } from '../i18n'

export function useResourceLibrary(onToast: (message: ToastMessage) => void) {
  const { t } = useI18n()
  const [assets, setAssets] = useState<ImportedAsset[]>([])
  const [compositions, setCompositions] = useState<SavedComposition[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const latest = useRef(assets)
  latest.current = assets

  useEffect(() => {
    void Promise.all([loadStitchWorkspace(), loadSavedCompositions()])
      .then(([workspace, saved]) => { setAssets(workspace.assets); setCompositions(saved); setReady(true) })
      .catch(() => { setLoadError(true); onToast({ text: t('resource.readError'), tone: 'warning' }) })
    // Locale changes must not reload or replace in-progress resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToast])

  const flushAssets = useCallback(async () => {
    try {
      await saveImportedAssets(latest.current)
      setSaveState('saved')
    } catch (error) { setSaveState('error'); throw error }
  }, [])

  useEffect(() => {
    if (!ready) return
    setSaveState('saving')
    const timer = window.setTimeout(() => { void flushAssets().catch(() => {}) }, 650)
    return () => window.clearTimeout(timer)
  }, [assets, ready, flushAssets])

  const addComposition = useCallback(async (composition: SavedComposition) => {
    await saveComposition(composition)
    setCompositions((current) => [composition, ...current.filter((item) => item.id !== composition.id)])
    setLastSavedId(composition.id)
  }, [])

  const removeComposition = useCallback(async (id: string) => {
    await deleteComposition(id)
    setCompositions((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearSavedFocus = useCallback(() => setLastSavedId(null), [])
  return { assets, setAssets, compositions, ready, loadError, lastSavedId, clearSavedFocus, saveState, flushAssets, addComposition, removeComposition }
}

export type ResourceLibrary = ReturnType<typeof useResourceLibrary>
