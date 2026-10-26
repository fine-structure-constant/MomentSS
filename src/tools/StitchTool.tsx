import { installPlugin } from '../lib/featurePlugins'
import {
  Columns2,
  CopyPlus,
  FoldVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  Maximize2,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { filesToPhotoBlocks, type ImportProgress } from '../lib/canvas'
import { createComposition } from '../lib/resourceExport'
import { createLayerFromAsset, findTextAsset, saveEditedAsset } from '../lib/assetLibrary'
import { buildStitchLayout, createTextMeasurer } from '../lib/stitchLayout'
import {
  findComposerAsset,
  findPhotoRow,
  flattenComposerAssets,
  insertBlockAfter,
  pairPhotoWithNext,
  removeAssetFromBlocks,
  renamePhotosInBlocks,
  splitPhotoRow,
  swapRowPhotos,
  updatePhotoInBlocks,
} from '../lib/composer'
import { createPhotoOverlay, createTextBlock, DEFAULT_SETTINGS } from '../lib/defaults'
import { clamp, photoFrameAspect } from '../lib/geometry'
import {
  pickOverlayStyle,
  pickTextStyle,
  readOverlayStylePreset,
  readTextStylePreset,
  rememberOverlayStyle,
  rememberTextStyle,
  type OverlayStylePreset,
  type TextStylePreset,
} from '../lib/preferences'
import { loadStitchWorkspace } from '../lib/storage'
import type { ComposerBlock, ComposerSettings, ImportedAsset, PhotoBlock, PhotoOverlay, PhotoRowBlock, SavedComposition, TextBlock } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { FieldGroup, RangeField } from '../components/Fields'
import { CropFields } from '../components/CropEditor'
import { PhotoTextEditorModal } from '../components/PhotoTextEditorModal'
import { TextControls } from '../components/TextControls'
import { ResourcePanel } from '../components/ResourcePanel'
import { useConfirmDialog } from '../components/ConfirmDialog'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import { StitchPreview } from '../components/StitchPreview'
import type { ToastMessage } from '../components/StatusToast'
import { useI18n } from '../i18n'
import { restoreDeletedLayer } from '../lib/operations'
import { textStyles } from '../lib/fonts'
import { useTextFonts } from '../hooks/useTextFonts'
import { LayerList } from '../components/LayerList'

interface StitchToolProps {
  onToast: (message: ToastMessage) => void
  library: ResourceLibrary
  onCover: (id: string) => void
}

function PhotoThumbnail({ block }: { block: PhotoBlock }) {
  const url = useObjectUrl(block.blob)
  return url ? <img src={url} alt="" /> : <span className="thumb-placeholder"><ImageIcon size={18} /></span>
}

export function StitchTool({ onToast, library, onCover }: StitchToolProps) {
  const { t } = useI18n()
  const { confirm, dialog } = useConfirmDialog()
  const [blocks, setBlocks] = useState<ComposerBlock[]>([])
  const latestBlocks = useRef(blocks)
  latestBlocks.current = blocks
  const { assets, setAssets } = library
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const workspaceSaveState = saveState === 'error' || library.saveState === 'error' ? 'error' : saveState === 'saving' || library.saveState === 'saving' ? 'saving' : 'saved'
  const [busy, setBusy] = useState(false)
  const importController = useRef<AbortController | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  useEffect(() => () => importController.current?.abort(), [])
  const [photoEditorId, setPhotoEditorId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'import' | 'layers' | 'adjust'>('import')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [sourceCompositionId, setSourceCompositionId] = useState<string | null>(null)
  const [textPreset, setTextPreset] = useState<Partial<TextStylePreset>>({})
  const [overlayPreset, setOverlayPreset] = useState<Partial<OverlayStylePreset>>({})
  const [prefsReady, setPrefsReady] = useState(false)
  const stageRef = useRef<HTMLElement>(null)
  const fontState = useTextFonts(textStyles(blocks))
  const measure = useMemo(() => createTextMeasurer(), [fontState.revision])
  const layout = useMemo(() => buildStitchLayout(blocks, settings, measure), [blocks, settings, measure])
  const snapshot = useRef<{ blocks: ComposerBlock[]; settings: ComposerSettings; sourceCompositionId: string | null } | null>(null)

  const selected = useMemo(() => findComposerAsset(blocks, selectedId), [blocks, selectedId])
  const selectedRow = useMemo(() => findPhotoRow(blocks, selectedId), [blocks, selectedId])
  const selectedLayer = blocks.find((block) => block.id === selectedId || (block.type === 'photo-row' && block.photos.some((photo) => photo.id === selectedId)))
  const selectedLayerIndex = selectedLayer ? blocks.indexOf(selectedLayer) : -1
  const selectedName = selected?.type === 'photo' ? selected.name : selected?.type === 'text' ? selected.text || t('stitch.blankText') : selectedRow ? t('stitch.photoRow') : ''
  const sourceComposition = useMemo(
    () => library.compositions.find((item) => item.id === sourceCompositionId && item.kind === 'collage') ?? null,
    [library.compositions, sourceCompositionId],
  )
  const editingPhoto = useMemo(() => {
    const block = findComposerAsset(blocks, photoEditorId)
    return block?.type === 'photo' ? block : null
  }, [blocks, photoEditorId])
  const editingPlacement = useMemo(() => {
    if (!editingPhoto) return null
    for (const item of layout.items) {
      const found = item.photos.find((placement) => placement.photo.id === editingPhoto.id)
      if (found) return found
    }
    return null
  }, [layout, editingPhoto])
  const selectedPlacement = useMemo(() => {
    if (selected?.type !== 'photo') return null
    for (const item of layout.items) {
      const found = item.photos.find((placement) => placement.photo.id === selected.id)
      if (found) return found
    }
    return null
  }, [layout, selected])

  useEffect(() => {
    void loadStitchWorkspace(library.projectId)
      .then(({ draft }) => {
        if (!draft) { setHydrated(true); return }
        setBlocks(draft.blocks)
        setSettings(draft.settings)
        setSourceCompositionId(draft.sourceCompositionId ?? null)
        setSelectedId(flattenComposerAssets(draft.blocks)[0]?.id ?? null)
        setHydrated(true)
      })
      .catch(() => onToast({ text: t('stitch.draftReadError'), tone: 'warning' }))
    // The draft hydrates once; changing UI language must never replace in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onToast])

  useEffect(() => {
    setTextPreset(readTextStylePreset() ?? {})
    setOverlayPreset(readOverlayStylePreset() ?? {})
    setPrefsReady(true)
  }, [])

  // Styling preferences are a convenience, so they persist on a slower debounce than the draft.
  useEffect(() => {
    if (!prefsReady) return
    const timer = window.setTimeout(() => {
      rememberTextStyle(textPreset)
      rememberOverlayStyle(overlayPreset)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [textPreset, overlayPreset, prefsReady])

  useLayoutEffect(() => {
    if (!hydrated) return
    snapshot.current = { blocks, settings, sourceCompositionId }
    library.stageDraft({ blocks, settings, sourceCompositionId, updatedAt: Date.now(), schemaVersion: 2 }, library.projectId)
  }, [blocks, settings, sourceCompositionId, hydrated, library.stageDraft, library.projectId])

  useEffect(() => {
    if (!hydrated) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void library.persistDraft({ blocks, settings, sourceCompositionId, updatedAt: Date.now(), schemaVersion: 2 }, library.projectId)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [blocks, settings, sourceCompositionId, hydrated, library.persistDraft, library.projectId])

  useEffect(() => {
    return () => {
      const latest = snapshot.current
      if (latest) void library.persistDraft({ ...latest, updatedAt: Date.now(), schemaVersion: 2 }, library.projectId).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!focusedId) return
    stageRef.current?.scrollTo({ top: 0 })
    if (window.matchMedia('(max-width: 900px)').matches) stageRef.current?.scrollIntoView({ block: 'start' })
  }, [focusedId])

  const handleFiles = async (files: File[]) => {
    if (importController.current) return
    const controller = new AbortController(); importController.current = controller
    try {
      const photos = (await filesToPhotoBlocks(files, { signal: controller.signal, onProgress: setImportProgress })).map((photo) => ({ ...photo, taskId: library.projectId }))
      if (!photos.length) { if (controller.signal.aborted) onToast({ text: t('import.cancelled'), tone: 'info' }); else onToast({ text: t('stitch.imageReadError'), tone: 'warning' }); return }
      const layers = photos.map(createLayerFromAsset)
      setAssets((current) => [...current, ...photos])
      setBlocks((current) => [...current, ...layers])
      setSelectedId(layers[0].id)
      setFocusedId(null)
      onToast({ text: t('stitch.addedPhotos', { count: photos.length }), tone: 'success' })
      // Reading stops at unreadable files; say so instead of dropping them silently.
      if (photos.length < files.length) {
        onToast({ text: t('stitch.skippedPhotos', { count: files.length - photos.length }), tone: 'warning' })
      }
    } catch {
      onToast({ text: t('stitch.imageReadError'), tone: 'warning' })
    } finally { importController.current = null }
  }

  /** Inserts a text card at an explicit position; an identical card reuses its resource. */
  const insertTextAt = (index: number, template?: 'title' | 'caption' | 'date') => {
    const text = template === 'date' ? new Date().toLocaleDateString() : template ? t(`template.${template}`) : t('text.defaultCard')
    const candidate = { ...createTextBlock(text, { ...textPreset, ...(template ? { fontSize: template === 'title' ? 76 : template === 'caption' ? 32 : 40, background: template === 'title' ? '#e3f4f5' : '#ffffff', color: '#143b5c' } : {}) }), importedAt: Date.now(), updatedAt: Date.now(), taskId: library.projectId }
    const reusable = findTextAsset(assets, candidate)
    const layer = createLayerFromAsset(reusable ?? candidate)
    if (!reusable) setAssets((current) => [...current, candidate])
    setBlocks((current) => {
      const anchor = current[clamp(index, 0, current.length) - 1]
      return anchor ? insertBlockAfter(current, anchor.id, layer) : [layer, ...current]
    })
    setSelectedId(layer.id)
    setFocusedId(null)
    setPanelTab('layers')
  }

  const addAssetToCanvas = (asset: ImportedAsset) => {
    const layer = createLayerFromAsset(asset)
    setBlocks((current) => [...current, layer])
    setSelectedId(layer.id)
    setFocusedId(null)
    onToast({ text: t('stitch.assetAdded'), tone: 'success' })
  }

  const inspectPart = (id: string, focusId: string) => {
    setSelectedId(id)
    setFocusedId(focusId)
    setPanelTab('adjust')
  }

  const layerLabel = (block: ComposerBlock) => block.type === 'photo' ? block.name : block.type === 'text' ? (block.text || t('stitch.blankText')) : t('stitch.photoRow')

  /** Removes a layer, a whole row, or one photo inside a row — always reversible. */
  const removeCanvasItem = async (id: string) => {
    const block = blocks.find((item) => item.id === id)
    const row = findPhotoRow(blocks, id)
    const isRowPhoto = !block && !!row
    const label = block ? layerLabel(block) : (row?.photos.find((photo) => photo.id === id)?.name ?? t('stitch.photoRow'))
    const ok = await confirm({
      title: isRowPhoto ? t('stitch.removeFromRowTitle') : t('stitch.removeLayerTitle'),
      body: isRowPhoto ? t('stitch.removeFromRowBody', { name: label }) : t('stitch.removeLayerBody', { name: label }),
      confirmLabel: isRowPhoto ? t('stitch.removeFromRow') : t('stitch.removeFromCanvas'),
      tone: 'danger',
    })
    if (!ok) return
    const previous = blocks
    setBlocks(isRowPhoto ? removeAssetFromBlocks(blocks, id) : blocks.filter((item) => item.id !== id))
    if (focusedId === id) setFocusedId(null)
    if (photoEditorId === id) setPhotoEditorId(null)
    if (selectedId === id) setSelectedId(null)
    onToast({
      text: t('stitch.layerRemoved', { name: label }),
      tone: 'info',
      action: { label: t('common.undo'), onAction: () => setBlocks((current) => restoreDeletedLayer(current, previous, id)) },
    })
  }

  const updateSelectedText = (patch: Partial<TextBlock>) => {
    if (!selected || selected.type !== 'text') return
    const edited: TextBlock = { ...selected, ...patch, type: 'text' }
    setBlocks((current) => current.map((block) => block.id === selected.id && block.type === 'text' ? { ...block, ...patch, type: 'text' } : block))
    setAssets((current) => saveEditedAsset(current, edited))
    setTextPreset(pickTextStyle(edited))
  }

  const updatePhoto = (id: string, patch: Partial<PhotoBlock>) => {
    const photo = findComposerAsset(latestBlocks.current, id)
    if (!photo || photo.type !== 'photo') return
    setBlocks((current) => updatePhotoInBlocks(current, id, patch))
    setAssets((current) => saveEditedAsset(current, { ...photo, ...patch, type: 'photo' }))
  }

  const updateRow = (id: string, patch: Partial<PhotoRowBlock>) => {
    setBlocks((current) => current.map((block) => block.id === id && block.type === 'photo-row' ? { ...block, ...patch, type: 'photo-row' } : block))
  }

  const commitOverlay = (overlay: PhotoOverlay) => {
    if (!editingPhoto) return
    updatePhoto(editingPhoto.id, { overlay })
    setOverlayPreset(pickOverlayStyle(overlay))
    setPhotoEditorId(null)
  }

  /**
   * The layer list offers this only on a layer with a photo right below it, so one click
   * merges the two; the toast keeps it reversible like every other canvas edit.
   */
  const pairWithNextLayer = (photoId: string) => {
    const previous = blocks
    const result = pairPhotoWithNext(blocks, photoId)
    if (!result.row) {
      onToast({ text: t('stitch.pairNeedsPhoto'), tone: 'info' })
      return
    }
    setBlocks(result.blocks)
    setSelectedId(result.row.id)
    onToast({
      text: t('stitch.paired'),
      tone: 'success',
      action: { label: t('common.undo'), onAction: () => { setBlocks((current) => splitPhotoRow(current, result.row!.id)); setSelectedId(photoId) } },
    })
  }

  const splitSelectedRow = () => {
    if (!selectedRow) return
    setBlocks((current) => splitPhotoRow(current, selectedRow.id))
    if (selectedId === selectedRow.id) setSelectedId(selectedRow.photos[0].id)
    if (focusedId === selectedRow.id) setFocusedId(selectedRow.photos[0].id)
  }

  const removeOverlay = () => {
    if (!editingPhoto) return
    const photoId = editingPhoto.id
    const previous = editingPhoto.overlay
    updatePhoto(photoId, { overlay: undefined })
    setPhotoEditorId(null)
    if (previous) {
      onToast({
        text: t('stitch.overlayRemoved'),
        tone: 'info',
        action: { label: t('common.undo'), onAction: () => updatePhoto(photoId, { overlay: previous }) },
      })
    }
  }

  const saveLongImage = async (mode: 'update' | 'copy') => {
    if (!blocks.length || busy) return
    setBusy(true)
    try {
      await library.flushAssets()
      const target = mode === 'update' ? sourceComposition : null
      const created = await createComposition(
        target?.name ?? t('resource.defaultName', { number: library.compositions.length + 1 }),
        blocks,
        settings,
      )
      const composition = target ? { ...created, id: target.id, name: target.name, kind: target.kind, createdAt: target.createdAt, updatedAt: Date.now() } : { ...created, updatedAt: created.createdAt }
      await library.addComposition(composition)
      setSourceCompositionId(composition.id)
      setPanelTab('import')
      onToast({ text: t(target ? 'resource.updated' : 'resource.saved'), tone: 'success' })
    } catch { onToast({ text: t('resource.saveError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }

  const openComposition = async (composition: SavedComposition) => {
    if (blocks.length) {
      const ok = await confirm({
        title: t('resource.openTitle'),
        body: t('resource.confirmOpen'),
        confirmLabel: t('resource.edit'),
      })
      if (!ok) return
    }
    setBlocks(structuredClone(composition.blocks))
    setSettings({ ...composition.settings })
    setSourceCompositionId(composition.id)
    setSelectedId(flattenComposerAssets(composition.blocks)[0]?.id ?? null)
    setFocusedId(null)
    setPhotoEditorId(null)
    setPanelTab('layers')
  }

  const renameAsset = (asset: ImportedAsset, name: string) => {
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, displayName: name, updatedAt: Date.now(), ...(item.type === 'photo' ? { name } : {}) } : item))
    // Placed copies follow their resource so the layer list stays readable.
    setBlocks((current) => renamePhotosInBlocks(current, asset.id, name))
  }

  const resetDraft = async () => {
    if (blocks.length) {
      const ok = await confirm({
        title: t('stitch.clearTitle'),
        body: t('stitch.confirmClear'),
        confirmLabel: t('stitch.clearDraft'),
        tone: 'danger',
      })
      if (!ok) return
    }
    try {
      await library.flushAssets()
      await library.persistDraft({ blocks: [], settings: DEFAULT_SETTINGS, updatedAt: Date.now(), sourceCompositionId: null, schemaVersion: 2 }, library.projectId)
    } catch {
      onToast({ text: t('stitch.saveError'), tone: 'warning' })
      return
    }
    setBlocks([])
    setSelectedId(null)
    setPhotoEditorId(null)
    setFocusedId(null)
    setSourceCompositionId(null)
    setSettings(DEFAULT_SETTINGS)
    onToast({ text: t('stitch.cleared'), tone: 'info' })
  }

  const panelTabs = [
    { id: 'import' as const, label: t('stitch.panelImport'), icon: ImagePlus },
    { id: 'layers' as const, label: t('stitch.panelLayers'), icon: Layers3 },
    { id: 'adjust' as const, label: t('stitch.panelAdjust'), icon: SlidersHorizontal },
  ]

  return (
    <>
      <div className="stitch-layout">
        <main ref={stageRef} className="canvas-stage" aria-label={t('stitch.previewAria')}>
          <div className="canvas-stage__topline">
            <span>{t('stitch.liveCanvas')}</span>
            <span>{blocks.length ? `${Math.round(layout.width)} × ${Math.round(layout.height)}` : t('stitch.waiting')}</span>
          </div>
          {(fontState.loading || fontState.error) && <p role="status" className="font-status">{t(fontState.error ? 'font.error' : 'font.loading')}</p>}
          {blocks.length ? (
            <StitchPreview layout={layout} background={settings.background} measure={measure} selectedId={selectedId} focusedId={focusedId} onSelect={inspectPart} onFocus={setFocusedId} />
          ) : (
            <div className="hero-empty">
              <div className="aperture-mark" aria-hidden="true"><span /><span /><span /><span /></div>
              <h2>{t('stitch.heroTitle')}</h2>
              <p>{t('stitch.heroBody')}</p>
              <button type="button" className="primary-button" onClick={() => setPanelTab('import')}><ImagePlus size={18} /> {t('stitch.openImport')}</button>
            </div>
          )}
        </main>

        <aside className="studio-sidebar" aria-label={t('stitch.settingsAria')}>
          <div className="studio-tabs" role="tablist" aria-label={t('stitch.panelMenu')}>
            {panelTabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={panelTab === id} className={panelTab === id ? 'is-active' : ''} onClick={() => setPanelTab(id)}>
                <Icon size={17} /><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="studio-sidebar__content">
            {importProgress && (!!importController.current || importProgress.failures.length > 0 || importProgress.cancelled) && <div className="import-status" role="status"><p>{t('import.progress', { current: importProgress.current, total: importProgress.total })}</p>{importController.current && <button className="text-button" onClick={() => importController.current?.abort()}>{t('import.cancel')}</button>}{importProgress.cancelled && <p>{t('import.cancelled')}</p>}{importProgress.failures.length > 0 && <details open><summary>{t('import.failed')} ({importProgress.failures.length})</summary><ul>{importProgress.failures.map(({ file, reason }, index) => <li key={index}>{file.name} — {t(reason === 'plugin' ? 'plugins.required' : reason === 'unsupported' ? 'import.unsupported' : 'import.reason')}</li>)}</ul><button className="secondary-button" disabled={!!importController.current} onClick={async () => { try { if (importProgress.failures.some(({ reason }) => reason === 'plugin')) await installPlugin('heic'); await handleFiles(importProgress.failures.map(({ file }) => file)) } catch { onToast({ text: t('plugins.error'), tone: 'warning' }) } }}>{t(importProgress.failures.some(({ reason }) => reason === 'plugin') ? 'plugins.enableHeic' : 'import.retry')}</button></details>}</div>}
            {panelTab === 'import' && <ResourcePanel library={library} selectedSourceId={selected?.sourceId ?? selected?.id ?? null}
              onFiles={handleFiles} onText={() => insertTextAt(blocks.length)} onAdd={addAssetToCanvas} onOpen={openComposition}
              onCover={onCover} onRenameAsset={renameAsset} onToast={onToast} confirm={confirm} />}
            {panelTab === 'import' && <label className="field template-picker"><span className="field__label">{t('template.label')}</span><select value="" onChange={(event) => { const value = event.currentTarget.value as 'title' | 'caption' | 'date'; if (value) insertTextAt(blocks.length, value) }}><option value="">{t('template.label')}</option>{(['title', 'caption', 'date'] as const).map((name) => <option key={name} value={name}>{t(`template.${name}`)}</option>)}</select></label>}

            {panelTab === 'layers' && (
              <section className="studio-pane studio-pane--layers" role="tabpanel" aria-label={t('stitch.sequenceAria')}>
                <div className="panel-heading">
                  <div><h2>{t('stitch.sequence')}</h2><p>{blocks.length ? t('stitch.blockCount', { count: blocks.length }) : t('stitch.startWithPhotos')}</p></div>
                  <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label={t('stitch.clearDraft')}><RotateCcw size={18} /></button>
                </div>

                <LayerList blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} onInspect={(id) => { setSelectedId(id); setPanelTab('adjust') }} onChange={setBlocks} onStyleApply={(asset) => setAssets((current) => saveEditedAsset(current, asset))} onInsert={insertTextAt} onRemove={(id) => void removeCanvasItem(id)} onPair={pairWithNextLayer} />
                {selectedRow && <div className="layer-bottom-actions"><button type="button" className="secondary-button" onClick={splitSelectedRow}><Columns2 size={16} />{t('stitch.splitRow')}</button></div>}
                <FieldGroup title={t('stitch.canvasSettings')}>
                  <RangeField label={t('stitch.outputWidth')} value={settings.width} min={720} max={2160} step={120} suffix="px" onChange={(width) => setSettings({ ...settings, width })} />
                  <RangeField label={t('stitch.photoGap')} value={settings.gap} min={0} max={80} suffix="px" onChange={(gap) => setSettings({ ...settings, gap })} />
                  <RangeField label={t('stitch.outerPadding')} value={settings.padding} min={0} max={120} suffix="px" onChange={(padding) => setSettings({ ...settings, padding })} />
                  <label className="field"><span className="field__label">{t('stitch.backgroundColor')}</span><input type="color" value={settings.background} onChange={(event) => setSettings({ ...settings, background: event.currentTarget.value })} /></label>
                </FieldGroup>
              </section>
            )}

            {panelTab === 'adjust' && (
              <section className="studio-pane" role="tabpanel">
                {(selected || selectedRow) ? (
                  <div className="adjust-context">
                    <span className="adjust-context__thumb">{selected?.type === 'photo' ? <PhotoThumbnail block={selected} /> : selected?.type === 'text' ? <Type size={23} /> : selectedRow?.photos.map((photo) => <PhotoThumbnail key={photo.id} block={photo} />)}</span>
                    <div><h2>{selectedName}</h2><p>{t('stitch.layerNumber', { number: selectedLayerIndex + 1 })}{selectedRow ? ` · ${t('stitch.photoRow')}${selected?.type === 'photo' ? ` · ${t('stitch.photoNumber', { number: selectedRow.photos.findIndex((photo) => photo.id === selected.id) + 1 })}` : ''}` : ''}</p></div>
                    {selectedLayer && <button type="button" className="icon-button" aria-label={t('stitch.focusSelection')} onClick={() => setFocusedId(selectedLayer.id)}><Maximize2 size={17} /></button>}
                    {selectedRow && <div className="adjust-context__photos">{selectedRow.photos.map((photo, index) => <button key={photo.id} type="button" className={selectedId === photo.id ? 'is-active' : ''} onClick={() => setSelectedId(photo.id)}>{index + 1}. {photo.name}</button>)}</div>}
                  </div>
                ) : <div className="inspector-empty"><SlidersHorizontal size={22} /><p>{t('stitch.selectLayerHint')}</p></div>}

                {selectedRow && <FieldGroup title={t('stitch.photoRow')} actions={<button type="button" className="danger-text" onClick={() => void removeCanvasItem(selectedRow.id)}>{t('stitch.removeFromCanvas')}</button>}>
                  <RangeField label={t('stitch.rowHeight')} value={selectedRow.heightRatio ?? 62} min={35} max={100} suffix="%" onChange={(heightRatio) => updateRow(selectedRow.id, { heightRatio })} />
                  <RangeField label={t('stitch.rowGap')} value={selectedRow.gap ?? 0} min={0} max={80} suffix="px" onChange={(gap) => updateRow(selectedRow.id, { gap })} />
                  <label className="field"><span className="field__label">{t('layers.ratio')}</span><input key={selectedRow.id + ':' + selectedRow.photos.length} defaultValue={(selectedRow.widths ?? selectedRow.photos.map(() => 1)).join(', ')} onBlur={(event) => { const values = event.currentTarget.value.split(/[,，]/).map(Number); if (values.length === selectedRow.photos.length && values.every((n) => Number.isFinite(n) && n >= 1 && n <= 100)) updateRow(selectedRow.id, { widths: values }); else event.currentTarget.value = (selectedRow.widths ?? selectedRow.photos.map(() => 1)).join(', ') }} /></label>
                  <div className="inline-inspector-actions">
                    <button type="button" className="text-button" onClick={() => setBlocks((current) => swapRowPhotos(current, selectedRow.id))}>{t('stitch.swapRowPhotos')}</button>
                    <button type="button" className="text-button" onClick={splitSelectedRow}>{t('stitch.splitRow')}</button>
                  </div>
                </FieldGroup>}

                {selected?.type === 'text' && (
                  <FieldGroup title={t('stitch.textStyle')} actions={<button type="button" className="danger-text" onClick={() => void removeCanvasItem(selected.id)}>{t('stitch.removeFromCanvas')}</button>}>
                    <TextControls key={selected.id} value={selected} onChange={updateSelectedText} />
                    <RangeField label={t('stitch.verticalPadding')} value={selected.padding} min={24} max={160} suffix="px" onChange={(padding) => updateSelectedText({ padding })} />
                  </FieldGroup>
                )}

                {selected?.type === 'photo' && (
                  <>
                    <FieldGroup title={t('stitch.photoFrame')} actions={<button type="button" className="danger-text" onClick={() => void removeCanvasItem(selected.id)}>{selectedRow ? t('stitch.removeFromRow') : t('stitch.removeFromCanvas')}</button>}>
                      {!selectedRow && (
                        <RangeField label={t('stitch.frameHeight')} value={selected.frameHeight ?? 100} min={45} max={150} suffix="%" onChange={(frameHeight) => updatePhoto(selected.id, { frameHeight })} />
                      )}
                      <CropFields
                        source={selected}
                        crop={{ zoom: selected.cropZoom ?? 1, x: selected.cropX ?? 0, y: selected.cropY ?? 0 }}
                        aspect={selectedPlacement ? selectedPlacement.width / selectedPlacement.height : photoFrameAspect(selected)}
                        onChange={(crop) => updatePhoto(selected.id, { cropZoom: crop.zoom, cropX: crop.x, cropY: crop.y })}
                      />
                      <div className="inline-inspector-actions">
                        <button type="button" className="text-button" onClick={() => updatePhoto(selected.id, { frameHeight: 100, cropZoom: 1, cropX: 0, cropY: 0 })}>{t('stitch.resetPhotoFrame')}</button>
                        {selectedRow && <button type="button" className="text-button" onClick={splitSelectedRow}>{t('stitch.splitRow')}</button>}
                      </div>
                    </FieldGroup>
                    <FieldGroup title={t('stitch.photoText')}>
                      {!selected.overlay ? (
                        <div className="inspector-empty"><p>{t('stitch.photoTextEmpty')}</p><button type="button" className="secondary-button" onClick={() => setPhotoEditorId(selected.id)}><Plus size={17} /> {t('stitch.addPhotoText')}</button></div>
                      ) : (
                        <div className="inspector-empty"><p>{t('stitch.photoTextAdded')}</p><button type="button" className="secondary-button" onClick={() => setPhotoEditorId(selected.id)}><Type size={17} /> {t('stitch.editPhotoText')}</button></div>
                      )}
                    </FieldGroup>
                  </>
                )}

              </section>
            )}
          </div>

          <div className="studio-sidebar__footer">
            <div className={`save-indicator save-indicator--${workspaceSaveState}`}><span />{workspaceSaveState === 'saving' ? t('stitch.saving') : workspaceSaveState === 'error' ? t('stitch.saveError') : t('stitch.saved')}</div>
            {sourceComposition && <p className="save-target">{t('resource.editingNamed', { name: sourceComposition.name })}</p>}
            <div className="save-actions">
              {sourceComposition && (
                <button type="button" className="secondary-button" onClick={() => void saveLongImage('copy')} disabled={!blocks.length || busy}><CopyPlus size={17} />{t('resource.saveAsNew')}</button>
              )}
              <button type="button" className="primary-button" onClick={() => void saveLongImage(sourceComposition ? 'update' : 'copy')} disabled={!blocks.length || busy}>
                <Save size={18} />{busy ? t('resource.saving') : sourceComposition ? t('resource.updateLong') : t('resource.saveLong')}
              </button>
            </div>
          </div>
        </aside>
      </div>
      {editingPhoto && (
        <PhotoTextEditorModal
          key={editingPhoto.id}
          photo={editingPhoto}
          overlay={editingPhoto.overlay ?? null}
          fallbackOverlay={createPhotoOverlay(t('text.defaultOverlay'), overlayPreset)}
          aspect={editingPlacement ? editingPlacement.width / editingPlacement.height : photoFrameAspect(editingPhoto)}
          frameWidth={editingPlacement?.width ?? settings.width}
          onCropChange={(patch) => updatePhoto(editingPhoto.id, patch)}
          onCommit={commitOverlay}
          onRemove={removeOverlay}
          onClose={() => setPhotoEditorId(null)}
        />
      )}
      {dialog}
    </>
  )
}
