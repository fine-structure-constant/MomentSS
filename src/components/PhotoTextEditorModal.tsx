import { Check, Move, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { clamp, computeCropRect, cropPanRoom, resolvePhotoOverlayLayout } from '../lib/geometry'
import type { CropState, PhotoBlock, PhotoOverlay } from '../types'
import { RangeField } from './Fields'
import { CropFields } from './CropEditor'
import { TextControls } from './TextControls'
import { useI18n } from '../i18n'

interface PhotoTextEditorModalProps {
  photo: PhotoBlock
  /** Committed overlay, or null when the photo has none yet. */
  overlay: PhotoOverlay | null
  /** Aspect of the frame this photo occupies in the collage, so the preview matches the export. */
  aspect: number
  /** Frame width in output pixels; the preview converts absolute sizes against it. */
  frameWidth: number
  fallbackOverlay: PhotoOverlay
  onCropChange: (patch: Partial<PhotoBlock>) => void
  onCommit: (overlay: PhotoOverlay) => void
  onRemove: () => void
  onClose: () => void
}

function withOpacity(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!match) return color
  const [, r, g, b] = match
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity / 100})`
}

export function PhotoTextEditorModal({
  photo, overlay, aspect, frameWidth, fallbackOverlay, onCropChange, onCommit, onRemove, onClose,
}: PhotoTextEditorModalProps) {
  const { t } = useI18n()
  const imageUrl = useObjectUrl(photo.blob)
  const previewRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const textDrag = useRef(false)
  const panDrag = useRef<{ x: number; y: number; crop: CropState } | null>(null)

  // Edits stay local until the user confirms, so opening and closing never adds text.
  const [draft, setDraft] = useState<PhotoOverlay>(() => overlay ?? fallbackOverlay)
  const crop: CropState = { zoom: photo.cropZoom ?? 1, x: photo.cropX ?? 0, y: photo.cropY ?? 0 }
  const rect = computeCropRect(photo.width, photo.height, aspect, crop)
  const room = cropPanRoom(photo.width, photo.height, aspect, crop)
  const layout = resolvePhotoOverlayLayout(draft)
  const opacity = draft.backgroundOpacity ?? 58
  const boxPadding = draft.boxPadding ?? 28
  const borderStyle = draft.borderStyle ?? 'none'
  const borderWidth = draft.borderWidth ?? 2
  const borderRadius = draft.borderRadius ?? 0
  const perPixel = 100 / Math.max(1, frameWidth)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const updateLayout = (patch: Partial<PhotoOverlay>) => {
    const next = resolvePhotoOverlayLayout({ ...draft, ...patch })
    setDraft({ ...draft, ...patch, ...next, position: undefined })
  }

  const moveToPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!textDrag.current || !previewRef.current) return
    const bounds = previewRef.current.getBoundingClientRect()
    updateLayout({
      x: clamp((event.clientX - bounds.left) / bounds.width, layout.width / 2, 1 - layout.width / 2),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0.06, 0.94),
    })
  }

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01
    const movement = {
      ArrowLeft: { x: layout.x - step },
      ArrowRight: { x: layout.x + step },
      ArrowUp: { y: layout.y - step },
      ArrowDown: { y: layout.y + step },
    }[event.key]
    if (!movement) return
    event.preventDefault()
    updateLayout(movement)
  }

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!room.x && !room.y) return
    panDrag.current = { x: event.clientX, y: event.clientY, crop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const start = panDrag.current
    const bounds = previewRef.current?.getBoundingClientRect()
    if (!start || !bounds) return
    const maxX = photo.width - rect.sw
    const maxY = photo.height - rect.sh
    const scaleX = rect.sw / Math.max(1, bounds.width)
    const scaleY = rect.sh / Math.max(1, bounds.height)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    onCropChange({
      cropX: maxX > 0.5 ? clamp(start.crop.x - (dx * scaleX * 2) / maxX, -1, 1) : start.crop.x,
      cropY: maxY > 0.5 ? clamp(start.crop.y - (dy * scaleY * 2) / maxY, -1, 1) : start.crop.y,
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="photo-text-modal" role="dialog" aria-modal="true" aria-labelledby="photo-text-title">
        <header className="photo-text-modal__header">
          <div><h2 id="photo-text-title">{t('photoText.title')}</h2><p><Move size={14} /> {t('photoText.hint')}</p></div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label={t('photoText.close')}><X size={19} /></button>
        </header>

        <div className="photo-text-modal__body">
          <div className="photo-text-canvas">
            <div
              className={`photo-text-preview ${room.x || room.y ? 'is-pannable' : ''}`}
              ref={previewRef}
              style={{ '--photo-aspect': aspect } as CSSProperties}
              onPointerDown={startPan}
              onPointerMove={movePan}
              onPointerUp={(event) => {
                panDrag.current = null
                event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={() => { panDrag.current = null }}
            >
              {imageUrl && <img src={imageUrl} alt={photo.name} style={{
                width: `${photo.width / rect.sw * 100}%`,
                height: `${photo.height / rect.sh * 100}%`,
                left: `${-rect.sx / rect.sw * 100}%`,
                top: `${-rect.sy / rect.sh * 100}%`,
              }} />}
              <div
                className="photo-text-box"
                role="button"
                tabIndex={0}
                aria-label={t('photoText.draggable')}
                onKeyDown={nudge}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  textDrag.current = true
                  event.currentTarget.setPointerCapture(event.pointerId)
                  moveToPointer(event)
                }}
                onPointerMove={moveToPointer}
                onPointerUp={(event) => {
                  textDrag.current = false
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }}
                style={{
                  left: `${layout.x * 100}%`,
                  top: `${layout.y * 100}%`,
                  width: `${layout.width * 100}%`,
                  color: draft.color,
                  background: withOpacity(draft.background, opacity),
                  padding: `${boxPadding * perPixel}cqw`,
                  borderStyle,
                  borderWidth: `${borderWidth * perPixel}cqw`,
                  borderColor: draft.borderColor ?? '#ffffff',
                  borderRadius: `${borderRadius * perPixel}cqw`,
                  fontFamily: draft.fontFamily,
                  fontSize: `${draft.fontSize * perPixel}cqw`,
                  fontWeight: draft.fontWeight,
                  fontStyle: draft.italic ? 'italic' : 'normal',
                  lineHeight: draft.lineHeight,
                  textAlign: draft.align,
                  transform: `translate(-50%, -50%) rotate(${draft.rotation}deg)`,
                }}
              >
                {draft.text || t('text.emptyOverlay')}
              </div>
              {(room.x || room.y) && <span className="photo-text-preview__hint">{t('crop.dragHint')}</span>}
            </div>
          </div>

          <aside className="photo-text-controls" aria-label={t('photoText.settings')}>
            <TextControls value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
            <div className="photo-position-group">
              <h3>{t('photoText.position')}</h3>
              <RangeField label={t('photoText.horizontal')} value={Math.round(layout.x * 100)} min={Math.round(layout.width * 50)} max={Math.round(100 - layout.width * 50)} suffix="%" onChange={(x) => updateLayout({ x: x / 100 })} />
              <RangeField label={t('photoText.vertical')} value={Math.round(layout.y * 100)} min={6} max={94} suffix="%" onChange={(y) => updateLayout({ y: y / 100 })} />
              <RangeField label={t('photoText.width')} value={Math.round(layout.width * 100)} min={28} max={94} suffix="%" onChange={(width) => updateLayout({ width: width / 100 })} />
              <RangeField label={t('photoText.opacity')} value={opacity} min={0} max={100} suffix="%" onChange={(backgroundOpacity) => setDraft({ ...draft, backgroundOpacity })} />
            </div>
            <div className="photo-position-group">
              <h3>{t('photoText.container')}</h3>
              <RangeField label={t('photoText.padding')} value={boxPadding} min={0} max={72} suffix="px" onChange={(nextPadding) => setDraft({ ...draft, boxPadding: nextPadding })} />
              <label className="field">
                <span className="field__label">{t('photoText.borderStyle')}</span>
                <select value={borderStyle} onChange={(event) => setDraft({ ...draft, borderStyle: event.currentTarget.value as PhotoOverlay['borderStyle'] })}>
                  <option value="none">{t('photoText.borderNone')}</option>
                  <option value="solid">{t('photoText.borderSolid')}</option>
                  <option value="dashed">{t('photoText.borderDashed')}</option>
                  <option value="dotted">{t('photoText.borderDotted')}</option>
                </select>
              </label>
              {borderStyle !== 'none' && (
                <>
                  <RangeField label={t('photoText.borderWidth')} value={borderWidth} min={1} max={12} suffix="px" onChange={(nextBorderWidth) => setDraft({ ...draft, borderWidth: nextBorderWidth })} />
                  <label className="field color-field">
                    <span className="field__label">{t('photoText.borderColor')}</span>
                    <input type="color" value={draft.borderColor ?? '#ffffff'} onChange={(event) => setDraft({ ...draft, borderColor: event.currentTarget.value })} />
                  </label>
                </>
              )}
              <RangeField label={t('photoText.radius')} value={borderRadius} min={0} max={64} suffix="px" onChange={(nextRadius) => setDraft({ ...draft, borderRadius: nextRadius })} />
            </div>
            <div className="photo-position-group">
              <h3>{t('photoText.crop')}</h3>
              <CropFields source={photo} crop={crop} aspect={aspect} onChange={(next) => onCropChange({ cropZoom: next.zoom, cropX: next.x, cropY: next.y })} />
            </div>
          </aside>
        </div>

        <footer className="photo-text-modal__footer">
          <button type="button" className="danger-button" onClick={onRemove}><Trash2 size={17} /> {t('photoText.remove')}</button>
          <button type="button" className="primary-button" onClick={() => onCommit(draft)}><Check size={18} /> {t('common.done')}</button>
        </footer>
      </section>
    </div>
  )
}
