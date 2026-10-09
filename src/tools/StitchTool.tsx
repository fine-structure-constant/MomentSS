import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Columns2,
  CopyPlus,
  GripVertical,
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
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { filesToPhotoBlocks } from '../lib/canvas'
import { createComposition } from '../lib/resourceExport'
import { createLayerFromAsset, findTextAsset, saveEditedAsset } from '../lib/assetLibrary'
import { buildStitchLayout, createTextMeasurer } from '../lib/stitchLayout'
import {
  findComposerAsset,
  findPhotoRow,
  flattenComposerAssets,
  insertBlockAfter,
  moveBlockToEdge,
  pairPhotoWithNeighbor,
  pairPhotos,
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
import { loadStitchWorkspace, saveStitchDraft } from '../lib/storage'
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
  const { assets, setAssets } = library
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const workspaceSaveState = saveState === 'error' || library.saveState === 'error' ? 'error' : saveState === 'saving' || library.saveState === 'saving' ? 'saving' : 'saved'
  const [busy, setBusy] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [photoEditorId, setPhotoEditorId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'import' | 'layers' | 'adjust'>('import')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [pairAnchorId, setPairAnchorId] = useState<string | null>(null)
  const [sourceCompositionId, setSourceCompositionId] = useState<string | null>(null)
  const [textPreset, setTextPreset] = useState<Partial<TextStylePreset>>({})
  const [overlayPreset, setOverlayPreset] = useState<Partial<OverlayStylePreset>>({})
  const [prefsReady, setPrefsReady] = useState(false)
  const stageRef = useRef<HTMLElement>(null)
  const measure = useMemo(() => createTextMeasurer(), [])
  const layout = useMemo(() => buildStitchLayout(blocks, settings, measure), [blocks, settings, measure])
  const snapshot = useRef<{ blocks: ComposerBlock[]; settings: ComposerSettings } | null>(null)

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
    void loadStitchWorkspace()
      .then(({ draft }) => {
        if (!draft) return
        setBlocks(draft.blocks)
        setSettings(draft.settings)
        setSelectedId(flattenComposerAssets(draft.blocks)[0]?.id ?? null)
      })
      .catch(() => onToast({ text: t('stitch.draftReadError'), tone: 'warning' }))
      .finally(() => setHydrated(true))
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

  useEffect(() => {
    if (!hydrated) return
    snapshot.current = { blocks, settings }
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void saveStitchDraft({ blocks, settings, updatedAt: Date.now() })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [blocks, settings, hydrated])

  useEffect(() => {
    return () => {
      const latest = snapshot.current
      if (latest) void saveStitchDraft({ blocks: latest.blocks, settings: latest.settings, updatedAt: Date.now() }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!focusedId) return
    stageRef.current?.scrollTo({ top: 0 })
    if (window.matchMedia('(max-width: 900px)').matches) stageRef.current?.scrollIntoView({ block: 'start' })
  }, [focusedId])

  useEffect(() => {
    if (!pairAnchorId) return
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setPairAnchorId(null) }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [pairAnchorId])

  const handleFiles = async (files: File[]) => {
    try {
      const photos = await filesToPhotoBlocks(files)
      if (!photos.length) throw new Error('no readable image')
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
    }
  }

  /** Inserts a text card at an explicit position; an identical card reuses its resource. */
  const insertTextAt = (index: number) => {
    const candidate = createTextBlock(t('text.defaultCard'), textPreset)
    const reusable = findTextAsset(assets, candidate)
    const layer = createLayerFromAsset(reusable ?? candidate)
    if (!reusable) setAssets((current) => [...current, candidate])
    setBlocks((current) => {
      const anchor = current[clamp(index, 0, current.length) - 1]
      return anchor ? insertBlockAfter(current, anchor.id, layer) : [layer, ...current]
    })
    setSelectedId(layer.id)
    setFocusedId(null)
    setPairAnchorId(null)
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

  const move = (id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const moveBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setBlocks((current) => {
      const next = [...current]
      const sourceIndex = next.findIndex((item) => item.id === sourceId)
      const targetIndex = next.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const [item] = next.splice(sourceIndex, 1)
      next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, item)
      return next
    })
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
      action: { label: t('common.undo'), onAction: () => setBlocks(previous) },
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
    const photo = findComposerAsset(blocks, id)
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

  const pairSelectedPhoto = () => {
    if (!selected || selected.type !== 'photo' || selectedRow) {
      onToast({ text: t('stitch.pairNeedsPhoto'), tone: 'info' })
      return
    }
    // One click when a photo already sits beside it; otherwise ask for the second photo.
    const neighbour = pairPhotoWithNeighbor(blocks, selected.id)
    if (neighbour.row) {
      setBlocks(neighbour.blocks)
      setSelectedId(selected.id)
      onToast({ text: t('stitch.paired'), tone: 'success' })
      return
    }
    setPairAnchorId(selected.id)
    onToast({ text: t('stitch.pairPickSecond'), tone: 'info' })
  }

  const completePairing = (secondId: string) => {
    if (!pairAnchorId) return
    const result = pairPhotos(blocks, pairAnchorId, secondId)
    setPairAnchorId(null)
    if (!result.row) {
      onToast({ text: t('stitch.pairFailed'), tone: 'warning' })
      return
    }
    setBlocks(result.blocks)
    setSelectedId(result.row.id)
    setPanelTab('adjust')
    onToast({ text: t('stitch.paired'), tone: 'success' })
  }

  const selectLayer = (block: ComposerBlock) => {
    if (pairAnchorId && block.type === 'photo') {
      if (block.id === pairAnchorId) setPairAnchorId(null)
      else completePairing(block.id)
      return
    }
    setSelectedId(block.id)
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
      const composition = target ? { ...created, id: target.id, name: target.name, kind: target.kind, createdAt: Date.now() } : created
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
    setPairAnchorId(null)
    setPanelTab('layers')
  }

  const renameAsset = (asset: ImportedAsset, name: string) => {
    if (asset.type !== 'photo') return
    setAssets((current) => current.map((item) => item.id === asset.id ? { ...item, name } : item))
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
      await saveStitchDraft({ blocks: [], settings: DEFAULT_SETTINGS, updatedAt: Date.now() })
    } catch {
      onToast({ text: t('stitch.saveError'), tone: 'warning' })
      return
    }
    setBlocks([])
    setSelectedId(null)
    setPhotoEditorId(null)
    setFocusedId(null)
    setPairAnchorId(null)
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
            {panelTab === 'import' && <ResourcePanel library={library} selectedSourceId={selected?.sourceId ?? selected?.id ?? null}
              onFiles={handleFiles} onText={() => insertTextAt(blocks.length)} onAdd={addAssetToCanvas} onOpen={openComposition}
              onCover={onCover} onRenameAsset={renameAsset} onToast={onToast} confirm={confirm} />}

            {panelTab === 'layers' && (
              <section className="studio-pane studio-pane--layers" role="tabpanel" aria-label={t('stitch.sequenceAria')}>
                <div className="panel-heading">
                  <div><h2>{t('stitch.sequence')}</h2><p>{blocks.length ? t('stitch.blockCount', { count: blocks.length }) : t('stitch.startWithPhotos')}</p></div>
                  <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label={t('stitch.clearDraft')}><RotateCcw size={18} /></button>
                </div>

                {pairAnchorId && (
                  <div className="pair-banner" role="status">
                    <span>{t('stitch.pairPicking')}</span>
                    <button type="button" className="text-button" onClick={() => setPairAnchorId(null)}><X size={14} />{t('common.cancel')}</button>
                  </div>
                )}

                <div className="sequence-scroll">
                  <ol className="sequence-list">
                    {blocks.map((block, index) => {
                      const rowSelected = block.type === 'photo-row' && (block.id === selectedId || block.photos.some((photo) => photo.id === selectedId))
                      const itemSelected = block.id === selectedId || rowSelected
                      const pairTarget = !!pairAnchorId && block.type === 'photo' && block.id !== pairAnchorId
                      return (
                        <li key={block.id} className="sequence-row">
                          <button type="button" className="insert-text" onClick={() => insertTextAt(index)} aria-label={t('stitch.insertTextHere', { number: index + 1 })}>
                            <Plus size={13} />{t('stitch.insertTextHere', { number: index + 1 })}
                          </button>
                          <div
                            className={`sequence-item ${itemSelected ? 'is-selected' : ''} ${block.type === 'photo-row' ? 'sequence-item--row' : ''} ${block.id === pairAnchorId ? 'is-pair-anchor' : ''} ${pairTarget ? 'is-pair-target' : ''}`}
                            draggable
                            onDragStart={() => setDraggedId(block.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => { if (draggedId) moveBefore(draggedId, block.id); setDraggedId(null) }}
                            role="button"
                            tabIndex={0}
                            aria-label={t('stitch.selectLayer', { number: index + 1 })}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return
                              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectLayer(block) }
                              if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowUp') { event.preventDefault(); setBlocks((current) => moveBlockToEdge(current, block.id, 'start')) }
                              if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') { event.preventDefault(); setBlocks((current) => moveBlockToEdge(current, block.id, 'end')) }
                            }}
                            onClick={() => selectLayer(block)}
                          >
                            <span className="drag-handle" aria-hidden="true"><GripVertical size={17} /></span>
                            <span className="sequence-number">{index + 1}</span>
                            <span className={`sequence-thumb ${block.type === 'text' ? 'sequence-thumb--text' : ''} ${block.type === 'photo-row' ? 'sequence-thumb--pair' : ''}`}>
                              {block.type === 'photo' && <PhotoThumbnail block={block} />}
                              {block.type === 'text' && <Type size={21} />}
                              {block.type === 'photo-row' && block.photos.map((photo) => <PhotoThumbnail key={photo.id} block={photo} />)}
                            </span>
                            {block.type === 'photo-row' ? (
                              <span className="sequence-name sequence-name--row">
                                <strong><Columns2 size={13} /> {t('stitch.photoRow')}</strong>
                                <span className="row-photo-selectors">
                                  {block.photos.map((photo, photoIndex) => (
                                    <button key={photo.id} type="button" className={selectedId === photo.id ? 'is-active' : ''} onClick={(event) => { event.stopPropagation(); setSelectedId(photo.id); setPanelTab('adjust') }}>
                                      {photoIndex + 1}. {photo.name}
                                    </button>
                                  ))}
                                </span>
                              </span>
                            ) : <span className="sequence-name">{block.type === 'photo' ? block.name : block.text || t('stitch.blankText')}</span>}
                            <span className="sequence-actions">
                              <button type="button" onClick={(event) => { event.stopPropagation(); setBlocks((current) => moveBlockToEdge(current, block.id, 'start')) }} disabled={index === 0} aria-label={t('stitch.moveTop')} title={t('stitch.moveTop')}><ChevronsUp size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, -1) }} disabled={index === 0} aria-label={t('stitch.moveUp')} title={t('stitch.moveUp')}><ArrowUp size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, 1) }} disabled={index === blocks.length - 1} aria-label={t('stitch.moveDown')} title={t('stitch.moveDown')}><ArrowDown size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); setBlocks((current) => moveBlockToEdge(current, block.id, 'end')) }} disabled={index === blocks.length - 1} aria-label={t('stitch.moveBottom')} title={t('stitch.moveBottom')}><ChevronsDown size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); void removeCanvasItem(block.id) }} aria-label={t('stitch.removeFromCanvas')} title={t('stitch.removeFromCanvas')}><Trash2 size={15} /></button>
                            </span>
                          </div>
                        </li>
                      )
                    })}
                    {!!blocks.length && (
                      <li className="sequence-row sequence-row--tail">
                        <button type="button" className="insert-text" onClick={() => insertTextAt(blocks.length)} aria-label={t('stitch.addTextAtBottom')}>
                          <Plus size={13} />{t('stitch.addTextAtBottom')}
                        </button>
                      </li>
                    )}
                  </ol>
                  {!blocks.length && <div className="mini-empty"><ImageIcon size={26} /><p>{t('stitch.sortHint')}</p></div>}
                </div>
                <div className="layer-bottom-actions">
                  <button type="button" className="secondary-button" onClick={() => insertTextAt(blocks.length)}><Plus size={16} /> {t('stitch.addTextAtBottom')}</button>
                  {selectedRow ? (
                    <button type="button" className="secondary-button" onClick={splitSelectedRow}><Columns2 size={16} /> {t('stitch.splitRow')}</button>
                  ) : (
                    <button type="button" className="secondary-button" onClick={pairSelectedPhoto}><Columns2 size={16} /> {t('stitch.pairPhotos')}</button>
                  )}
                  <p>{t('stitch.pairPhotosHint')}</p>
                </div>
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
