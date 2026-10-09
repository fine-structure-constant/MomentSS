import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useI18n } from '../i18n'
import type { PhotoOverlay, TextAppearance } from '../types'
import { layoutPhotoOverlay, type PhotoPlacement, type StitchLayout, type StitchLayoutItem, type TextMeasure } from '../lib/stitchLayout'

function textStyle(style: TextAppearance): CSSProperties {
  return { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.italic ? 'italic' : 'normal' }
}

function TextLines({ style, lines, lineHeight, x = 0 }: { style: TextAppearance; lines: string[]; lineHeight: number; x?: number }) {
  return <text style={textStyle(style)} fill={style.color} textAnchor={style.align === 'left' ? 'start' : style.align === 'right' ? 'end' : 'middle'} dominantBaseline="central" xmlSpace="preserve">
    {lines.map((line, index) => <tspan key={index} x={x} y={(index - (lines.length - 1) / 2) * lineHeight}>{line}</tspan>)}
  </text>
}

function Overlay({ overlay, width, height, measure }: { overlay: PhotoOverlay; width: number; height: number; measure: TextMeasure }) {
  const box = layoutPhotoOverlay(overlay, width, height, measure)
  const strokeWidth = overlay.borderWidth ?? 2
  const strokeStyle = overlay.borderStyle ?? 'none'
  const dash = strokeStyle === 'dashed' ? `${Math.max(4, strokeWidth * 4)} ${Math.max(3, strokeWidth * 2.5)}` : strokeStyle === 'dotted' ? `0 ${Math.max(4, strokeWidth * 3)}` : undefined
  const x = overlay.align === 'left' ? -box.width / 2 + box.padding : overlay.align === 'right' ? box.width / 2 - box.padding : 0
  return <svg className="structured-overlay" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
    <g transform={`translate(${box.x} ${box.y}) rotate(${overlay.rotation})`}>
      <rect x={-box.width / 2} y={-box.height / 2} width={box.width} height={box.height} rx={Math.min(overlay.borderRadius ?? 0, box.width / 2, box.height / 2)}
        fill={overlay.background} fillOpacity={(overlay.backgroundOpacity ?? 58) / 100}
        stroke={strokeStyle === 'none' ? 'none' : overlay.borderColor ?? '#ffffff'} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap={strokeStyle === 'dotted' ? 'round' : 'butt'} />
      <TextLines style={overlay} lines={box.lines} lineHeight={box.lineHeight} x={x} />
    </g>
  </svg>
}

function PhotoContent({ placement, measure }: { placement: PhotoPlacement; measure: TextMeasure }) {
  const { photo, crop, width, height } = placement
  const url = useObjectUrl(photo.blob)
  return <>
    {url && <img className="structured-photo" src={url} alt="" decoding="async" style={{
      width: `${photo.width / crop.sw * 100}%`, height: `${photo.height / crop.sh * 100}%`,
      left: `${-crop.sx / crop.sw * 100}%`, top: `${-crop.sy / crop.sh * 100}%`,
    }} />}
    {photo.overlay && <Overlay overlay={photo.overlay} width={width} height={height} measure={measure} />}
  </>
}

export function PhotoPlacementPreview({ placement, measure }: { placement: PhotoPlacement; measure: TextMeasure }) {
  return <div className="photo-placement-preview" style={{ aspectRatio: `${placement.width} / ${placement.height}` }}><PhotoContent placement={placement} measure={measure} /></div>
}

interface PreviewProps {
  layout: StitchLayout
  background: string
  measure: TextMeasure
  selectedId: string | null
  focusedId: string | null
  onSelect: (id: string, focusId: string) => void
  onFocus: (id: string | null) => void
}

export function StitchPreview({ layout, background, measure, selectedId, focusedId, onSelect, onFocus }: PreviewProps) {
  const { t } = useI18n()
  const focusedIndex = layout.items.findIndex((item) => item.block.id === focusedId)
  const focused = focusedIndex >= 0 ? layout.items[focusedIndex] : null
  const backRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (focusedId) backRef.current?.focus({ preventScroll: true }) }, [focusedId])
  useEffect(() => {
    if (!focused) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) onFocus(null) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [focused, onFocus])

  const name = (item: StitchLayoutItem) => item.block.type === 'photo' ? item.block.name : item.block.type === 'photo-row' ? t('stitch.photoRow') : item.block.text || t('stitch.blankText')
  const renderItem = (item: StitchLayoutItem, overview: boolean) => {
    const block = item.block
    const selected = block.id === selectedId || item.photos.some(({ photo }) => photo.id === selectedId)
    return <div key={block.id} data-preview-layer={block.id} className={`structured-item ${selected ? 'is-selected' : ''}`} style={{
      position: overview ? 'absolute' : 'relative',
      left: overview ? `${item.x / layout.width * 100}%` : undefined,
      top: overview ? `${item.y / layout.height * 100}%` : undefined,
      width: overview ? `${item.width / layout.width * 100}%` : '100%',
      aspectRatio: `${item.width} / ${item.height}`,
    }}>
      {block.type === 'text' && item.text ? (
        <button type="button" className="structured-hit" style={{ background: block.background }} aria-pressed={selectedId === block.id} aria-label={t('stitch.inspectPart', { name: name(item) })} onClick={() => onSelect(block.id, block.id)}>
          <svg viewBox={`0 0 ${item.width} ${item.height}`} aria-hidden="true">
            <g transform={`translate(${item.width / 2} ${item.height / 2}) rotate(${block.rotation})`}>
              <TextLines style={block} lines={item.text.lines} lineHeight={item.text.lineHeight} x={block.align === 'left' ? -item.width / 2 + block.padding : block.align === 'right' ? item.width / 2 - block.padding : 0} />
            </g>
          </svg>
        </button>
      ) : item.photos.map((photo) => (
        <button key={photo.photo.id} type="button" className={`structured-hit structured-hit--photo ${selectedId === photo.photo.id ? 'is-selected' : ''}`} aria-pressed={selectedId === photo.photo.id}
          aria-label={t('stitch.inspectPart', { name: photo.photo.name })} onClick={() => onSelect(photo.photo.id, block.id)}
          style={{ left: `${photo.x / item.width * 100}%`, width: `${photo.width / item.width * 100}%` }}>
          <PhotoContent placement={photo} measure={measure} />
        </button>
      ))}
      {block.type === 'photo-row' && <button type="button" className="preview-row-action" aria-label={t('stitch.inspectPart', { name: t('stitch.photoRow') })} onClick={() => onSelect(block.id, block.id)}><ColumnsLabel label={t('stitch.photoRow')} /></button>}
    </div>
  }

  return <div className={`structured-preview ${focused ? 'is-focused' : ''}`}>
    <div className="preview-toolbar">
      {focused ? <>
        <button ref={backRef} type="button" className="text-button" onClick={() => onFocus(null)}><ArrowLeft size={16} />{t('stitch.backToCollage')}</button>
        <span>{t('stitch.layerNumber', { number: focusedIndex + 1 })}</span>
        <div className="preview-navigation">
          <button type="button" className="icon-button" disabled={focusedIndex === 0} aria-label={t('stitch.previousPart')} onClick={() => { const next = layout.items[focusedIndex - 1]; onSelect(next.block.id, next.block.id) }}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-button" disabled={focusedIndex === layout.items.length - 1} aria-label={t('stitch.nextPart')} onClick={() => { const next = layout.items[focusedIndex + 1]; onSelect(next.block.id, next.block.id) }}><ChevronRight size={18} /></button>
        </div>
      </> : <p><Maximize2 size={14} />{t('stitch.previewHint')}</p>}
    </div>
    {focused ? <div className="focused-sheet" style={{ background }}><h3>{name(focused)}</h3>{renderItem(focused, false)}</div>
      : <div className="structured-sheet" style={{ background, aspectRatio: `${layout.width} / ${layout.height}` }}>{layout.items.map((item) => renderItem(item, true))}</div>}
  </div>
}

function ColumnsLabel({ label }: { label: string }) { return <><Maximize2 size={13} />{label}</> }
