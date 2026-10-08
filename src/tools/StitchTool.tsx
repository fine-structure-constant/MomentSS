import {
  ArrowDown,
  ArrowUp,
  Download,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { canvasToBlob, downloadBlob, filesToPhotoBlocks, renderStitch, type RenderReport } from '../lib/canvas'
import { createPhotoOverlay, createTextBlock, DEFAULT_SETTINGS } from '../lib/defaults'
import { clearStitchDraft, loadStitchDraft, saveStitchDraft } from '../lib/storage'
import type { ComposerBlock, ComposerSettings, PhotoBlock, TextBlock } from '../types'
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
  const previewRef = useRef<HTMLCanvasElement>(null)

  const selected = useMemo(() => blocks.find((block) => block.id === selectedId) ?? null, [blocks, selectedId])
  const editingPhoto = useMemo(() => {
    const block = blocks.find((item) => item.id === photoEditorId)
    return block?.type === 'photo' ? block : null
  }, [blocks, photoEditorId])

  useEffect(() => {
    void loadStitchDraft()
      .then((draft) => {
        if (!draft) return
        setBlocks(draft.blocks)
        setSettings(draft.settings)
        setSelectedId(draft.blocks[0]?.id ?? null)
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

  const insertText = (afterId?: string) => {
    const text = createTextBlock(t('text.defaultCard'))
    setBlocks((current) => {
      if (!afterId) return [...current, text]
      const index = current.findIndex((block) => block.id === afterId)
      const next = [...current]
      next.splice(index + 1, 0, text)
      return next
    })
    setSelectedId(text.id)
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

  const remove = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (photoEditorId === id) setPhotoEditorId(null)
  }

  const updateSelectedText = (patch: Partial<TextBlock>) => {
    if (!selected || selected.type !== 'text') return
    setBlocks((current) => current.map((block) => {
      if (block.id !== selected.id || block.type !== 'text') return block
      return { ...block, ...patch, type: 'text' }
    }))
  }

  const updatePhoto = (id: string, patch: Partial<PhotoBlock>) => {
    setBlocks((current) => current.map((block) => block.id === id && block.type === 'photo' ? { ...block, ...patch } : block))
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

  return (
    <>
    <div className="stitch-layout">
      <aside className="sequence-panel" aria-label={t('stitch.sequenceAria')}>
        <div className="panel-heading">
          <div><h2>{t('stitch.sequence')}</h2><p>{blocks.length ? t('stitch.blockCount', { count: blocks.length }) : t('stitch.startWithPhotos')}</p></div>
          <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label={t('stitch.clearDraft')}><RotateCcw size={18} /></button>
        </div>
        <div className="sequence-toolbar" aria-label={t('stitch.addContent')}>
          <UploadDropzone compact multiple onFiles={handleFiles} label={t('stitch.addPhotos')} />
          <button type="button" className="secondary-button" onClick={() => insertText()}><Type size={17} /> {t('stitch.textCard')}</button>
        </div>
        <div className="sequence-scroll">
        <ol className="sequence-list">
          {blocks.map((block, index) => (
            <li key={block.id}>
              <div
                className={`sequence-item ${selectedId === block.id ? 'is-selected' : ''}`}
                draggable
                onDragStart={() => setDraggedId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) moveBefore(draggedId, block.id)
                  setDraggedId(null)
                }}
                onClick={() => setSelectedId(block.id)}
              >
                <span className="drag-handle" aria-hidden="true"><GripVertical size={17} /></span>
                <span className="sequence-number">{index + 1}</span>
                <span className={`sequence-thumb ${block.type === 'text' ? 'sequence-thumb--text' : ''}`}>
                  {block.type === 'photo' ? <PhotoThumbnail block={block} /> : <Type size={21} />}
                </span>
                <span className="sequence-name">{block.type === 'photo' ? block.name : block.text || t('stitch.blankText')}</span>
                <span className="sequence-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, -1) }} disabled={index === 0} aria-label={t('stitch.moveUp')}><ArrowUp size={15} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, 1) }} disabled={index === blocks.length - 1} aria-label={t('stitch.moveDown')}><ArrowDown size={15} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); remove(block.id) }} aria-label={t('common.delete')}><Trash2 size={15} /></button>
                </span>
              </div>
              <button type="button" className="insert-text" onClick={() => insertText(block.id)}><Plus size={14} /> {t('stitch.insertTextHere')}</button>
            </li>
          ))}
        </ol>
        {!blocks.length && (
          <div className="mini-empty"><ImageIcon size={26} /><p>{t('stitch.sortHint')}</p></div>
        )}
        </div>
      </aside>

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
            <UploadDropzone multiple onFiles={handleFiles} label={t('stitch.choosePhotos')} />
          </div>
        )}
      </main>

      <aside className="inspector-panel" aria-label={t('stitch.settingsAria')}>
        <div className="inspector-actions">
          <div className={`save-indicator save-indicator--${saveState}`}><span />{saveState === 'saving' ? t('stitch.saving') : saveState === 'error' ? t('stitch.saveError') : t('stitch.saved')}</div>
          <button type="button" className="primary-button" onClick={() => void exportImage()} disabled={!blocks.length || busy}><Download size={18} />{busy ? t('stitch.generating') : t('stitch.download')}</button>
        </div>

        {selected?.type === 'text' && (
          <FieldGroup title={t('stitch.textStyle')} actions={<button type="button" className="danger-text" onClick={() => remove(selected.id)}>{t('common.delete')}</button>}>
            <TextControls value={selected} onChange={updateSelectedText} />
            <RangeField label={t('stitch.verticalPadding')} value={selected.padding} min={24} max={160} suffix="px" onChange={(padding) => updateSelectedText({ padding })} />
          </FieldGroup>
        )}

        {selected?.type === 'photo' && (
          <FieldGroup title={t('stitch.photoText')}>
            {!selected.overlay ? (
              <div className="inspector-empty"><p>{t('stitch.photoTextEmpty')}</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Plus size={17} /> {t('stitch.addPhotoText')}</button></div>
            ) : (
              <div className="inspector-empty"><p>{t('stitch.photoTextAdded')}</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Type size={17} /> {t('stitch.editPhotoText')}</button></div>
            )}
          </FieldGroup>
        )}

        <FieldGroup title={t('stitch.canvasSettings')}>
          <RangeField label={t('stitch.outputWidth')} value={settings.width} min={720} max={2160} step={120} suffix="px" onChange={(width) => setSettings({ ...settings, width })} />
          <RangeField label={t('stitch.photoGap')} value={settings.gap} min={0} max={80} suffix="px" onChange={(gap) => setSettings({ ...settings, gap })} />
          <RangeField label={t('stitch.outerPadding')} value={settings.padding} min={0} max={120} suffix="px" onChange={(padding) => setSettings({ ...settings, padding })} />
          <label className="field"><span className="field__label">{t('stitch.backgroundColor')}</span><input type="color" value={settings.background} onChange={(event) => setSettings({ ...settings, background: event.currentTarget.value })} /></label>
          <label className="field"><span className="field__label">{t('stitch.format')}</span><select value={settings.format} onChange={(event) => setSettings({ ...settings, format: event.currentTarget.value as ComposerSettings['format'] })}><option value="image/jpeg">{t('stitch.jpgSmall')}</option><option value="image/png">{t('stitch.pngLossless')}</option></select></label>
          {settings.format === 'image/jpeg' && <RangeField label={t('stitch.jpgQuality')} value={Math.round(settings.quality * 100)} min={70} max={100} suffix="%" onChange={(quality) => setSettings({ ...settings, quality: quality / 100 })} />}
        </FieldGroup>
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
