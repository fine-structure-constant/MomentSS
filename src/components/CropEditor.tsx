import { useEffect, useRef } from 'react'
import type { CropState, SourceImage } from '../types'
import { renderCropPreview } from '../lib/canvas'
import { RangeField } from './Fields'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    void renderCropPreview(canvasRef.current, source, crop, aspect, 720, grid)
  }, [source, crop, aspect, grid])

  return (
    <div className="crop-editor">
      <div className="crop-editor__preview">
        <canvas ref={canvasRef} aria-label={title} />
        <span className="crop-editor__badge">{grid ? `${grid.columns} × ${grid.rows}` : '1 : 1'}</span>
      </div>
      <div className="crop-editor__controls">
        <div className="section-copy"><h2>{title}</h2><p>{hint}</p></div>
        <RangeField label="缩放" value={crop.zoom} min={1} max={4} step={0.05} suffix="×" onChange={(zoom) => onChange({ ...crop, zoom })} />
        <RangeField label="左右位置" value={Math.round(crop.x * 100)} min={-100} max={100} suffix="%" onChange={(x) => onChange({ ...crop, x: x / 100 })} />
        <RangeField label="上下位置" value={Math.round(crop.y * 100)} min={-100} max={100} suffix="%" onChange={(y) => onChange({ ...crop, y: y / 100 })} />
        <button type="button" className="text-button" onClick={() => onChange({ zoom: 1, x: 0, y: 0 })}>重置取景框</button>
      </div>
    </div>
  )
}
