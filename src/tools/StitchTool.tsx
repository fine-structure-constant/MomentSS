import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Download,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers3,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { canvasToBlob, downloadBlob, filesToPhotoBlocks, renderStitch, type RenderReport } from '../lib/canvas'
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
import { clearStitchDraft, loadStitchDraft, saveStitchDraft } from '../lib/storage'
import type { ComposerBlock, ComposerSettings, PhotoBlock, PhotoRowBlock, TextBlock } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { FieldGroup, RangeField } from '../components/Fields'
import { PhotoTextEditorModal } from '../components/PhotoTextEditorModal'
import { TextControls } from '../components/TextControls'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'
import { useI18n } from '../i18n'

interface StitchToolProps {
  onToast: (message: ToastMessage) => void
}

function PhotoThumbnail({ block }: { block: PhotoBlock }) {
  const url = useObjectUrl(block.blob)
  return url ? <img src={url} alt="" /> : <span className="thumb-placeholder"><ImageIcon size={18} /></span>
}

export function StitchTool({ onToast }: StitchToolProps) {
  const { t } = useI18n()
  const [blocks, setBlocks] = useState<ComposerBlock[]>([])
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [renderReport, setRenderReport] = useState<RenderReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [photoEditorId, setPhotoEditorId] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'import' | 'layers' | 'adjust'>('import')
  const previewRef = useRef<HTMLCanvasElement>(null)

  const assets = useMemo(() => flattenComposerAssets(blocks), [blocks])
  const selected = useMemo(() => findComposerAsset(blocks, selectedId), [blocks, selectedId])
  const selectedRow = useMemo(() => findPhotoRow(blocks, selectedId), [blocks, selectedId])
  const editingPhoto = useMemo(() => {
    const block = findComposerAsset(blocks, photoEditorId)
    return block?.type === 'photo' ? block : null
  }, [blocks, photoEditorId])

  useEffect(() => {
    void loadStitchDraft()
      .then((draft) => {
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
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void saveStitchDraft({ blocks, settings, updatedAt: Date.now() })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [blocks, settings, hydrated])

  useEffect(() => {
    if (!previewRef.current || blocks.length === 0) return
    let cancelled = false
    void renderStitch(previewRef.current, blocks, settings, 560)
      .then((report) => {
        if (!cancelled) setRenderReport(report)
      })
      .catch(() => onToast({ text: t('stitch.previewError'), tone: 'warning' }))
    return () => { cancelled = true }
  }, [blocks, settings, onToast, t])

  const handleFiles = async (files: File[]) => {
    try {
      const photos = await filesToPhotoBlocks(files.slice(0, 40))
      if (!photos.length) throw new Error('没有可读取的图片')
      setBlocks((current) => [...current, ...photos])
      setSelectedId(photos[0].id)
      onToast({ text: t('stitch.addedPhotos', { count: photos.length }), tone: 'success' })
    } catch {
      onToast({ text: t('stitch.imageReadError'), tone: 'warning' })
    }
  }

  const insertText = () => {
    const text = createTextBlock(t('text.defaultCard'))
    setBlocks((current) => [...current, text])
    setSelectedId(text.id)
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
    const removedIds = target?.type === 'photo-row' ? target.photos.map((photo) => photo.id) : [id]
    setBlocks((current) => current.filter((block) => block.id !== id))
    if (selectedId && removedIds.includes(selectedId)) setSelectedId(null)
    if (photoEditorId && removedIds.includes(photoEditorId)) setPhotoEditorId(null)
  }

  const updateSelectedText = (patch: Partial<TextBlock>) => {
    if (!selected || selected.type !== 'text') return
    setBlocks((current) => current.map((block) => block.id === selected.id && block.type === 'text' ? { ...block, ...patch, type: 'text' } : block))
  }

  const updatePhoto = (id: string, patch: Partial<PhotoBlock>) => {
    setBlocks((current) => updatePhotoInBlocks(current, id, patch))
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
    setPanelTab('adjust')
  }

  const splitSelectedRow = () => {
    if (!selectedRow) return
    setBlocks((current) => splitPhotoRow(current, selectedRow.id))
  }

  const openPhotoTextEditor = (photo: PhotoBlock) => {
    if (!photo.overlay) updatePhoto(photo.id, { overlay: createPhotoOverlay(t('text.defaultOverlay')) })
    setPhotoEditorId(photo.id)
  }

  const exportImage = async () => {
    if (!blocks.length) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      const report = await renderStitch(canvas, blocks, settings)
      const blob = await canvasToBlob(canvas, settings.format, settings.quality)
      const extension = settings.format === 'image/png' ? 'png' : 'jpg'
      downloadBlob(blob, t('stitch.fileName', { date: new Date().toISOString().slice(0, 10), extension }))
      const dimensions = { width: report.width, height: report.height }
      onToast({ text: report.reduced ? t('stitch.downloadReduced', dimensions) : t('stitch.downloaded', dimensions), tone: report.reduced ? 'warning' : 'success' })
    } catch {
      onToast({ text: t('stitch.exportError'), tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }

  const resetDraft = async () => {
    if (blocks.length && !window.confirm(t('stitch.confirmClear'))) return
    setBlocks([])
    setSelectedId(null)
    setPhotoEditorId(null)
    setSettings(DEFAULT_SETTINGS)
    await clearStitchDraft()
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
        <main className="canvas-stage" aria-label={t('stitch.previewAria')}>
          <div className="canvas-stage__topline">
            <span>{t('stitch.liveCanvas')}</span>
            <span>{renderReport ? `${renderReport.width} × ${renderReport.height}` : t('stitch.waiting')}</span>
          </div>
          {blocks.length ? (
            <div className="long-canvas-wrap"><canvas ref={previewRef} /></div>
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
            {panelTab === 'import' && (
              <section className="studio-pane studio-pane--import" role="tabpanel">
                <div className="panel-heading"><div><h2>{t('stitch.addContent')}</h2><p>{t('upload.private')}</p></div></div>
                <div className="import-actions">
                  <UploadDropzone compact multiple onFiles={handleFiles} label={t('stitch.addPhotos')} />
                  <button type="button" className="secondary-button compact-action" onClick={insertText}><Type size={17} /> {t('stitch.textCard')}</button>
                </div>
                <div className="asset-library-head">
                  <div><h3>{t('stitch.assetLibrary')}</h3><p>{t('stitch.assetCount', { count: assets.length })}</p></div>
                </div>
                {assets.length ? (
                  <div className="asset-grid">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className={`asset-tile ${selectedId === asset.id ? 'is-selected' : ''} ${asset.type === 'text' ? 'asset-tile--text' : ''}`}
                        aria-label={asset.type === 'photo' ? `${t('stitch.assetPhoto')}: ${asset.name}` : `${t('stitch.assetText')}: ${asset.text || t('stitch.blankText')}`}
                        onClick={() => { setSelectedId(asset.id); setPanelTab('adjust') }}
                      >
                        <span className="asset-tile__preview">{asset.type === 'photo' ? <PhotoThumbnail block={asset} /> : <><Type size={21} /><em>{asset.text || t('stitch.blankText')}</em></>}</span>
                        <span className="asset-tile__name">{asset.type === 'photo' ? asset.name : asset.text || t('stitch.blankText')}</span>
                      </button>
                    ))}
                  </div>
                ) : <div className="mini-empty"><ImageIcon size={26} /><p>{t('stitch.sortHint')}</p></div>}
              </section>
            )}

            {panelTab === 'layers' && (
              <section className="studio-pane studio-pane--layers" role="tabpanel" aria-label={t('stitch.sequenceAria')}>
                <div className="panel-heading">
                  <div><h2>{t('stitch.sequence')}</h2><p>{blocks.length ? t('stitch.blockCount', { count: blocks.length }) : t('stitch.startWithPhotos')}</p></div>
                  <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label={t('stitch.clearDraft')}><RotateCcw size={18} /></button>
                </div>
                <div className="sequence-scroll">
                  <ol className="sequence-list">
                    {blocks.map((block, index) => {
                      const rowSelected = block.type === 'photo-row' && block.photos.some((photo) => photo.id === selectedId)
                      const itemSelected = block.id === selectedId || rowSelected
                      return (
                        <li key={block.id}>
                          <div
                            className={`sequence-item ${itemSelected ? 'is-selected' : ''} ${block.type === 'photo-row' ? 'sequence-item--row' : ''}`}
                            draggable
                            onDragStart={() => setDraggedId(block.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => { if (draggedId) moveBefore(draggedId, block.id); setDraggedId(null) }}
                            onClick={() => setSelectedId(block.type === 'photo-row' ? block.photos[0].id : block.id)}
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
              </section>
            )}

            {panelTab === 'adjust' && (
              <section className="studio-pane" role="tabpanel">
                {!selected && <div className="inspector-empty"><SlidersHorizontal size={22} /><p>{t('stitch.selectLayerHint')}</p></div>}

                {selected?.type === 'text' && (
                  <FieldGroup title={t('stitch.textStyle')} actions={<button type="button" className="danger-text" onClick={() => removeAsset(selected.id)}>{t('common.delete')}</button>}>
                    <TextControls value={selected} onChange={updateSelectedText} />
                    <RangeField label={t('stitch.verticalPadding')} value={selected.padding} min={24} max={160} suffix="px" onChange={(padding) => updateSelectedText({ padding })} />
                  </FieldGroup>
                )}

                {selected?.type === 'photo' && (
                  <>
                    <FieldGroup title={selectedRow ? t('stitch.photoRow') : t('stitch.photoFrame')} actions={<button type="button" className="danger-text" onClick={() => removeAsset(selected.id)}>{t('common.delete')}</button>}>
                      {selectedRow ? (
                        <>
                          <RangeField label={t('stitch.rowHeight')} value={selectedRow.heightRatio ?? 62} min={35} max={100} suffix="%" onChange={(heightRatio) => updateRow(selectedRow.id, { heightRatio })} />
                          <RangeField label={t('stitch.rowGap')} value={selectedRow.gap ?? 0} min={0} max={80} suffix="px" onChange={(gap) => updateRow(selectedRow.id, { gap })} />
                        </>
                      ) : (
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

                <FieldGroup title={t('stitch.canvasSettings')}>
                  <RangeField label={t('stitch.outputWidth')} value={settings.width} min={720} max={2160} step={120} suffix="px" onChange={(width) => setSettings({ ...settings, width })} />
                  <RangeField label={t('stitch.photoGap')} value={settings.gap} min={0} max={80} suffix="px" onChange={(gap) => setSettings({ ...settings, gap })} />
                  <RangeField label={t('stitch.outerPadding')} value={settings.padding} min={0} max={120} suffix="px" onChange={(padding) => setSettings({ ...settings, padding })} />
                  <label className="field"><span className="field__label">{t('stitch.backgroundColor')}</span><input type="color" value={settings.background} onChange={(event) => setSettings({ ...settings, background: event.currentTarget.value })} /></label>
                  <label className="field"><span className="field__label">{t('stitch.format')}</span><select value={settings.format} onChange={(event) => setSettings({ ...settings, format: event.currentTarget.value as ComposerSettings['format'] })}><option value="image/jpeg">{t('stitch.jpgSmall')}</option><option value="image/png">{t('stitch.pngLossless')}</option></select></label>
                  {settings.format === 'image/jpeg' && <RangeField label={t('stitch.jpgQuality')} value={Math.round(settings.quality * 100)} min={70} max={100} suffix="%" onChange={(quality) => setSettings({ ...settings, quality: quality / 100 })} />}
                </FieldGroup>
              </section>
            )}
          </div>

          <div className="studio-sidebar__footer">
            <div className={`save-indicator save-indicator--${saveState}`}><span />{saveState === 'saving' ? t('stitch.saving') : saveState === 'error' ? t('stitch.saveError') : t('stitch.saved')}</div>
            <button type="button" className="primary-button" onClick={() => void exportImage()} disabled={!blocks.length || busy}><Download size={18} />{busy ? t('stitch.generating') : t('stitch.download')}</button>
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
