import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Save,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Maximize2,
  Layers3,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { filesToPhotoBlocks } from '../lib/canvas'
import { createComposition } from '../lib/resourceExport'
import { createLayerFromAsset, saveEditedAsset } from '../lib/assetLibrary'
import { buildStitchLayout, createTextMeasurer } from '../lib/stitchLayout'
import {
  findComposerAsset,
  findPhotoRow,
  flattenComposerAssets,
  pairPhotoWithNeighbor,
  removeAssetFromBlocks,
  splitPhotoRow,
  updatePhotoInBlocks,
} from '../lib/composer'
import { createPhotoOverlay, createTextBlock, DEFAULT_SETTINGS } from '../lib/defaults'
import { loadStitchWorkspace, saveStitchDraft } from '../lib/storage'
import type { ComposerBlock, ComposerSettings, ImportedAsset, PhotoBlock, PhotoRowBlock, TextBlock, SavedComposition } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { FieldGroup, RangeField } from '../components/Fields'
import { PhotoTextEditorModal } from '../components/PhotoTextEditorModal'
import { TextControls } from '../components/TextControls'
import { ResourcePanel } from '../components/ResourcePanel'
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
  const stageRef = useRef<HTMLElement>(null)
  const measure = useMemo(() => createTextMeasurer(), [])
  const layout = useMemo(() => buildStitchLayout(blocks, settings, measure), [blocks, settings, measure])
  const snapshot = useRef<{ blocks: ComposerBlock[]; settings: ComposerSettings } | null>(null)

  const selected = useMemo(() => findComposerAsset(blocks, selectedId), [blocks, selectedId])
  const selectedRow = useMemo(() => findPhotoRow(blocks, selectedId), [blocks, selectedId])
  const selectedLayer = blocks.find((block) => block.id === selectedId || (block.type === 'photo-row' && block.photos.some((photo) => photo.id === selectedId)))
  const selectedLayerIndex = selectedLayer ? blocks.indexOf(selectedLayer) : -1
  const selectedName = selected?.type === 'photo' ? selected.name : selected?.type === 'text' ? selected.text || t('stitch.blankText') : selectedRow ? t('stitch.photoRow') : ''
  const editingPhoto = useMemo(() => {
    const block = findComposerAsset(blocks, photoEditorId)
    return block?.type === 'photo' ? block : null
  }, [blocks, photoEditorId])

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

  const handleFiles = async (files: File[]) => {
    try {
      const photos = await filesToPhotoBlocks(files.slice(0, 40))
      if (!photos.length) throw new Error('没有可读取的图片')
      const layers = photos.map(createLayerFromAsset)
      setAssets((current) => [...current, ...photos])
      setBlocks((current) => [...current, ...layers])
      setSelectedId(layers[0].id)
      setFocusedId(null)
      onToast({ text: t('stitch.addedPhotos', { count: photos.length }), tone: 'success' })
    } catch {
      onToast({ text: t('stitch.imageReadError'), tone: 'warning' })
    }
  }

  const insertText = () => {
    const text = createTextBlock(t('text.defaultCard'))
    const layer = createLayerFromAsset(text)
    setAssets((current) => [...current, text])
    setBlocks((current) => [...current, layer])
    setSelectedId(layer.id)
    setFocusedId(null)
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

  const removeAsset = (id: string) => {
    setBlocks((current) => removeAssetFromBlocks(current, id))
    if (selectedId === id) setSelectedId(null)
    if (photoEditorId === id) setPhotoEditorId(null)
  }

  const removeLayer = (id: string) => {
    const target = blocks.find((block) => block.id === id)
    const removedIds = target?.type === 'photo-row' ? [id, ...target.photos.map((photo) => photo.id)] : [id]
    setBlocks((current) => current.filter((block) => block.id !== id))
    if (focusedId === id) setFocusedId(null)
    if (selectedId && removedIds.includes(selectedId)) setSelectedId(null)
    if (photoEditorId && removedIds.includes(photoEditorId)) setPhotoEditorId(null)
  }

  const updateSelectedText = (patch: Partial<TextBlock>) => {
    if (!selected || selected.type !== 'text') return
    const edited: TextBlock = { ...selected, ...patch, type: 'text' }
    setBlocks((current) => current.map((block) => block.id === selected.id && block.type === 'text' ? { ...block, ...patch, type: 'text' } : block))
    setAssets((current) => saveEditedAsset(current, edited))
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

  const pairSelectedPhoto = () => {
    if (!selected || selected.type !== 'photo' || selectedRow) {
      onToast({ text: t('stitch.pairNeedsAdjacent'), tone: 'info' })
      return
    }
    const result = pairPhotoWithNeighbor(blocks, selected.id)
    if (!result.row) {
      onToast({ text: t('stitch.pairNeedsAdjacent'), tone: 'info' })
      return
    }
    setBlocks(result.blocks)
    setSelectedId(selected.id)
  }

  const splitSelectedRow = () => {
    if (!selectedRow) return
    setBlocks((current) => splitPhotoRow(current, selectedRow.id))
    if (selectedId === selectedRow.id) setSelectedId(selectedRow.photos[0].id)
    if (focusedId === selectedRow.id) setFocusedId(selectedRow.photos[0].id)
  }

  const openPhotoTextEditor = (photo: PhotoBlock) => {
    if (!photo.overlay) updatePhoto(photo.id, { overlay: createPhotoOverlay(t('text.defaultOverlay')) })
    setPhotoEditorId(photo.id)
  }

  const saveLongImage = async () => {
    if (!blocks.length || busy) return
    setBusy(true)
    try {
      await library.flushAssets()
      const composition = await createComposition(t('resource.defaultName', { number: library.compositions.length + 1 }), blocks, settings)
      await library.addComposition(composition)
      setPanelTab('import')
      onToast({ text: t('resource.saved'), tone: 'success' })
    } catch { onToast({ text: t('resource.saveError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }

  const openComposition = (composition: SavedComposition) => {
    if (blocks.length && !window.confirm(t('resource.confirmOpen'))) return
    setBlocks(structuredClone(composition.blocks))
    setSettings({ ...composition.settings })
    setSelectedId(flattenComposerAssets(composition.blocks)[0]?.id ?? null)
    setFocusedId(null)
    setPhotoEditorId(null)
    setPanelTab('layers')
  }

  const resetDraft = async () => {
    if (blocks.length && !window.confirm(t('stitch.confirmClear'))) return
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
              onFiles={handleFiles} onText={insertText} onAdd={addAssetToCanvas} onOpen={openComposition} onCover={onCover} onToast={onToast} />}

            {panelTab === 'layers' && (
              <section className="studio-pane studio-pane--layers" role="tabpanel" aria-label={t('stitch.sequenceAria')}>
                <div className="panel-heading">
                  <div><h2>{t('stitch.sequence')}</h2><p>{blocks.length ? t('stitch.blockCount', { count: blocks.length }) : t('stitch.startWithPhotos')}</p></div>
                  <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label={t('stitch.clearDraft')}><RotateCcw size={18} /></button>
                </div>
                <div className="sequence-scroll">
                  <ol className="sequence-list">
                    {blocks.map((block, index) => {
                      const rowSelected = block.type === 'photo-row' && (block.id === selectedId || block.photos.some((photo) => photo.id === selectedId))
                      const itemSelected = block.id === selectedId || rowSelected
                      return (
                        <li key={block.id}>
                          <div
                            className={`sequence-item ${itemSelected ? 'is-selected' : ''} ${block.type === 'photo-row' ? 'sequence-item--row' : ''}`}
                            draggable
                            onDragStart={() => setDraggedId(block.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => { if (draggedId) moveBefore(draggedId, block.id); setDraggedId(null) }}
                            role="button"
                            tabIndex={0}
                            aria-label={t('stitch.selectLayer', { number: index + 1 })}
                            onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedId(block.id) } }}
                            onClick={() => setSelectedId(block.id)}
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
                              <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, -1) }} disabled={index === 0} aria-label={t('stitch.moveUp')}><ArrowUp size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, 1) }} disabled={index === blocks.length - 1} aria-label={t('stitch.moveDown')}><ArrowDown size={15} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); removeLayer(block.id) }} aria-label={t('common.delete')}><Trash2 size={15} /></button>
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  {!blocks.length && <div className="mini-empty"><ImageIcon size={26} /><p>{t('stitch.sortHint')}</p></div>}
                </div>
                <div className="layer-bottom-actions">
                  <button type="button" className="secondary-button" onClick={insertText}><Plus size={16} /> {t('stitch.addTextAtBottom')}</button>
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

                {selectedRow && <FieldGroup title={t('stitch.photoRow')} actions={<button type="button" className="danger-text" onClick={() => removeLayer(selectedRow.id)}>{t('common.delete')}</button>}>
                  <RangeField label={t('stitch.rowHeight')} value={selectedRow.heightRatio ?? 62} min={35} max={100} suffix="%" onChange={(heightRatio) => updateRow(selectedRow.id, { heightRatio })} />
                  <RangeField label={t('stitch.rowGap')} value={selectedRow.gap ?? 0} min={0} max={80} suffix="px" onChange={(gap) => updateRow(selectedRow.id, { gap })} />
                  <button type="button" className="text-button" onClick={splitSelectedRow}>{t('stitch.splitRow')}</button>
                </FieldGroup>}

                {selected?.type === 'text' && (
                  <FieldGroup title={t('stitch.textStyle')} actions={<button type="button" className="danger-text" onClick={() => removeAsset(selected.id)}>{t('common.delete')}</button>}>
                    <TextControls value={selected} onChange={updateSelectedText} />
                    <RangeField label={t('stitch.verticalPadding')} value={selected.padding} min={24} max={160} suffix="px" onChange={(padding) => updateSelectedText({ padding })} />
                  </FieldGroup>
                )}

                {selected?.type === 'photo' && (
                  <>
                    <FieldGroup title={t('stitch.photoFrame')} actions={<button type="button" className="danger-text" onClick={() => removeAsset(selected.id)}>{t('common.delete')}</button>}>
                      {!selectedRow && (
                        <RangeField label={t('stitch.frameHeight')} value={selected.frameHeight ?? 100} min={45} max={150} suffix="%" onChange={(frameHeight) => updatePhoto(selected.id, { frameHeight })} />
                      )}
                      <RangeField label={t('stitch.cropZoom')} value={selected.cropZoom ?? 1} min={1} max={4} step={0.05} suffix="×" onChange={(cropZoom) => updatePhoto(selected.id, { cropZoom })} />
                      <RangeField label={t('crop.horizontal')} value={Math.round((selected.cropX ?? 0) * 100)} min={-100} max={100} suffix="%" onChange={(cropX) => updatePhoto(selected.id, { cropX: cropX / 100 })} />
                      <RangeField label={t('crop.vertical')} value={Math.round((selected.cropY ?? 0) * 100)} min={-100} max={100} suffix="%" onChange={(cropY) => updatePhoto(selected.id, { cropY: cropY / 100 })} />
                      <div className="inline-inspector-actions">
                        <button type="button" className="text-button" onClick={() => updatePhoto(selected.id, { frameHeight: 100, cropZoom: 1, cropX: 0, cropY: 0 })}>{t('stitch.resetPhotoFrame')}</button>
                        {selectedRow && <button type="button" className="text-button" onClick={splitSelectedRow}>{t('stitch.splitRow')}</button>}
                      </div>
                    </FieldGroup>
                    <FieldGroup title={t('stitch.photoText')}>
                      {!selected.overlay ? (
                        <div className="inspector-empty"><p>{t('stitch.photoTextEmpty')}</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Plus size={17} /> {t('stitch.addPhotoText')}</button></div>
                      ) : (
                        <div className="inspector-empty"><p>{t('stitch.photoTextAdded')}</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Type size={17} /> {t('stitch.editPhotoText')}</button></div>
                      )}
                    </FieldGroup>
                  </>
                )}

              </section>
            )}
          </div>

          <div className="studio-sidebar__footer">
            <div className={`save-indicator save-indicator--${workspaceSaveState}`}><span />{workspaceSaveState === 'saving' ? t('stitch.saving') : workspaceSaveState === 'error' ? t('stitch.saveError') : t('stitch.saved')}</div>
            <button type="button" className="primary-button" onClick={() => void saveLongImage()} disabled={!blocks.length || busy}><Save size={18} />{busy ? t('resource.saving') : t('resource.saveLong')}</button>
          </div>
        </aside>
      </div>
      {editingPhoto?.overlay && (
        <PhotoTextEditorModal
          photo={editingPhoto}
          overlay={editingPhoto.overlay}
          onChange={(overlay) => updatePhoto(editingPhoto.id, { overlay })}
          onClose={() => setPhotoEditorId(null)}
          onRemove={() => {
            updatePhoto(editingPhoto.id, { overlay: undefined })
            setPhotoEditorId(null)
          }}
        />
      )}
    </>
  )
}
