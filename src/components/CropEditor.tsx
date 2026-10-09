import { useEffect, useRef, type PointerEvent } from 'react'
import type { CropState, SourceImage } from '../types'
import { renderCropPreview } from '../lib/canvas'
import { clamp, computeCropRect, cropPanRoom } from '../lib/geometry'
import { RangeField } from './Fields'
import { useI18n } from '../i18n'

interface CropFieldsProps {
  source: { width: number; height: number }
  crop: CropState
  aspect: number
  onChange: (crop: CropState) => void
}

/**
 * Shared crop controls. The focus sliders are disabled while their axis is flush with the
 * source, because at the minimum zoom a slider with no room would move nothing at all.
 */
export function CropFields({ source, crop, aspect, onChange }: CropFieldsProps) {
  const { t } = useI18n()
  const room = cropPanRoom(source.width, source.height, aspect, crop)

  return (
    <>
      <RangeField label={t('crop.zoom')} value={crop.zoom} min={1} max={4} step={0.05} suffix="×" onChange={(zoom) => onChange({ ...crop, zoom })} />
      <RangeField label={t('crop.horizontal')} value={Math.round(crop.x * 100)} min={-100} max={100} suffix="%" disabled={!room.x} onChange={(x) => onChange({ ...crop, x: x / 100 })} />
      <RangeField label={t('crop.vertical')} value={Math.round(crop.y * 100)} min={-100} max={100} suffix="%" disabled={!room.y} onChange={(y) => onChange({ ...crop, y: y / 100 })} />
      <button type="button" className="text-button" onClick={() => onChange({ zoom: 1, x: 0, y: 0 })}>{t('crop.reset')}</button>
      {(!room.x || !room.y) && <p className="field__note">{t('crop.noRoomHint')}</p>}
    </>
  )
}

interface CropEditorProps {
  source: SourceImage
  crop: CropState
  onChange: (crop: CropState) => void
  aspect: number
  grid?: { columns: number; rows: number }
  title: string
  hint: string
}

export function CropEditor({ source, crop, onChange, aspect, grid, title, hint }: CropEditorProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; crop: CropState } | null>(null)
  const room = cropPanRoom(source.width, source.height, aspect, crop)

  useEffect(() => {
    if (!canvasRef.current) return
    void renderCropPreview(canvasRef.current, source, crop, aspect, 720, grid)
  }, [source, crop, aspect, grid])

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!room.x && !room.y) return
    drag.current = { x: event.clientX, y: event.clientY, crop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    const bounds = previewRef.current?.getBoundingClientRect()
    if (!start || !bounds) return
    const rect = computeCropRect(source.width, source.height, aspect, start.crop)
    const maxX = source.width - rect.sw
    const maxY = source.height - rect.sh
    const scaleX = rect.sw / Math.max(1, bounds.width)
    const scaleY = rect.sh / Math.max(1, bounds.height)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    onChange({
      ...start.crop,
      x: maxX > 0.5 ? clamp(start.crop.x - (dx * scaleX * 2) / maxX, -1, 1) : start.crop.x,
      y: maxY > 0.5 ? clamp(start.crop.y - (dy * scaleY * 2) / maxY, -1, 1) : start.crop.y,
    })
  }

  return (
    <div className="crop-editor">
      <div
        ref={previewRef}
        className={`crop-editor__preview ${room.x || room.y ? 'is-pannable' : ''}`}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={(event) => {
          drag.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { drag.current = null }}
      >
        <canvas ref={canvasRef} aria-label={title} />
        <span className="crop-editor__badge">{grid ? `${grid.columns} × ${grid.rows}` : '1 : 1'}</span>
        {(room.x || room.y) && <span className="crop-editor__hint">{t('crop.dragHint')}</span>}
      </div>
      <div className="crop-editor__controls">
        <div className="section-copy"><h2>{title}</h2><p>{hint}</p></div>
        <CropFields source={source} crop={crop} aspect={aspect} onChange={onChange} />
      </div>
    </div>
  )
}
