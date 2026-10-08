import { Check, Move, Trash2, X } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { clamp, resolvePhotoOverlayLayout } from '../lib/geometry'
import type { PhotoBlock, PhotoOverlay } from '../types'
import { RangeField } from './Fields'
import { TextControls } from './TextControls'
import { useI18n } from '../i18n'

interface PhotoTextEditorModalProps {
  photo: PhotoBlock
  overlay: PhotoOverlay
  onChange: (next: PhotoOverlay) => void
  onClose: () => void
  onRemove: () => void
}

function withOpacity(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!match) return color
  const [, r, g, b] = match
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${opacity / 100})`
}

export function PhotoTextEditorModal({ photo, overlay, onChange, onClose, onRemove }: PhotoTextEditorModalProps) {
  const { t } = useI18n()
  const imageUrl = useObjectUrl(photo.blob)
  const previewRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const draggingRef = useRef(false)
  const layout = resolvePhotoOverlayLayout(overlay)
  const opacity = overlay.backgroundOpacity ?? 58
  const boxPadding = overlay.boxPadding ?? 28
  const borderStyle = overlay.borderStyle ?? 'none'
  const borderWidth = overlay.borderWidth ?? 2
  const borderRadius = overlay.borderRadius ?? 0

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const updateLayout = (patch: Partial<PhotoOverlay>) => {
    const next = resolvePhotoOverlayLayout({ ...overlay, ...patch })
    onChange({ ...overlay, ...patch, ...next, position: undefined })
  }

  const moveToPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !previewRef.current) return
    const rect = previewRef.current.getBoundingClientRect()
    updateLayout({
      x: clamp((event.clientX - rect.left) / rect.width, layout.width / 2, 1 - layout.width / 2),
      y: clamp((event.clientY - rect.top) / rect.height, 0.06, 0.94),
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
              className="photo-text-preview"
              ref={previewRef}
              style={{ '--photo-aspect': photo.width / photo.height } as CSSProperties}
            >
              {imageUrl && <img src={imageUrl} alt={photo.name} />}
              <div
                className="photo-text-box"
                role="button"
                tabIndex={0}
                aria-label={t('photoText.draggable')}
                onKeyDown={nudge}
                onPointerDown={(event) => {
                  draggingRef.current = true
                  event.currentTarget.setPointerCapture(event.pointerId)
                  moveToPointer(event)
                }}
                onPointerMove={moveToPointer}
                onPointerUp={(event) => {
                  draggingRef.current = false
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }}
                style={{
                  left: `${layout.x * 100}%`,
                  top: `${layout.y * 100}%`,
                  width: `${layout.width * 100}%`,
                  color: overlay.color,
                  background: withOpacity(overlay.background, opacity),
                  padding: `${boxPadding / 10.8}cqw`,
                  borderStyle,
                  borderWidth: `${borderWidth / 10.8}cqw`,
                  borderColor: overlay.borderColor ?? '#ffffff',
                  borderRadius: `${borderRadius / 10.8}cqw`,
                  fontFamily: overlay.fontFamily,
                  fontSize: `${overlay.fontSize / 10}cqw`,
                  fontWeight: overlay.fontWeight,
                  fontStyle: overlay.italic ? 'italic' : 'normal',
                  lineHeight: overlay.lineHeight,
                  textAlign: overlay.align,
                  transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg)`,
                }}
              >
                {overlay.text || t('text.emptyOverlay')}
              </div>
            </div>
          </div>

          <aside className="photo-text-controls" aria-label={t('photoText.settings')}>
            <TextControls value={overlay} onChange={(patch) => onChange({ ...overlay, ...patch })} />
            <div className="photo-position-group">
              <h3>{t('photoText.position')}</h3>
              <RangeField label={t('photoText.horizontal')} value={Math.round(layout.x * 100)} min={Math.round(layout.width * 50)} max={Math.round(100 - layout.width * 50)} suffix="%" onChange={(x) => updateLayout({ x: x / 100 })} />
              <RangeField label={t('photoText.vertical')} value={Math.round(layout.y * 100)} min={6} max={94} suffix="%" onChange={(y) => updateLayout({ y: y / 100 })} />
              <RangeField label={t('photoText.width')} value={Math.round(layout.width * 100)} min={28} max={94} suffix="%" onChange={(width) => updateLayout({ width: width / 100 })} />
              <RangeField label={t('photoText.opacity')} value={opacity} min={0} max={100} suffix="%" onChange={(backgroundOpacity) => onChange({ ...overlay, backgroundOpacity })} />
            </div>
            <div className="photo-position-group">
              <h3>{t('photoText.container')}</h3>
              <RangeField label={t('photoText.padding')} value={boxPadding} min={0} max={72} suffix="px" onChange={(nextPadding) => onChange({ ...overlay, boxPadding: nextPadding })} />
              <label className="field">
                <span className="field__label">{t('photoText.borderStyle')}</span>
                <select value={borderStyle} onChange={(event) => onChange({ ...overlay, borderStyle: event.currentTarget.value as PhotoOverlay['borderStyle'] })}>
                  <option value="none">{t('photoText.borderNone')}</option>
                  <option value="solid">{t('photoText.borderSolid')}</option>
                  <option value="dashed">{t('photoText.borderDashed')}</option>
                  <option value="dotted">{t('photoText.borderDotted')}</option>
                </select>
              </label>
              {borderStyle !== 'none' && (
                <>
                  <RangeField label={t('photoText.borderWidth')} value={borderWidth} min={1} max={12} suffix="px" onChange={(nextBorderWidth) => onChange({ ...overlay, borderWidth: nextBorderWidth })} />
                  <label className="field color-field">
                    <span className="field__label">{t('photoText.borderColor')}</span>
                    <input type="color" value={overlay.borderColor ?? '#ffffff'} onChange={(event) => onChange({ ...overlay, borderColor: event.currentTarget.value })} />
                  </label>
                </>
              )}
              <RangeField label={t('photoText.radius')} value={borderRadius} min={0} max={64} suffix="px" onChange={(nextRadius) => onChange({ ...overlay, borderRadius: nextRadius })} />
            </div>
          </aside>
        </div>

        <footer className="photo-text-modal__footer">
          <button type="button" className="danger-button" onClick={onRemove}><Trash2 size={17} /> {t('photoText.remove')}</button>
          <button type="button" className="primary-button" onClick={onClose}><Check size={18} /> {t('common.done')}</button>
        </footer>
      </section>
    </div>
  )
}
