import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import type { TextAlign, TextAppearance } from '../types'
import { RangeField } from './Fields'

const FONT_OPTIONS = [
  { label: '清朗圆体', value: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: '现代黑体', value: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: '人文宋体', value: '"Songti SC", SimSun, serif' },
  { label: '旅行手札', value: 'KaiTi, "STKaiti", serif' },
]

interface TextControlsProps {
  value: TextAppearance
  onChange: (patch: Partial<TextAppearance>) => void
}

export function TextControls({ value, onChange }: TextControlsProps) {
  const alignment: Array<{ value: TextAlign; icon: typeof AlignLeft; label: string }> = [
    { value: 'left', icon: AlignLeft, label: '左对齐' },
    { value: 'center', icon: AlignCenter, label: '居中' },
    { value: 'right', icon: AlignRight, label: '右对齐' },
  ]

  return (
    <>
      <label className="field">
        <span className="field__label">文字内容</span>
        <textarea rows={3} value={value.text} onChange={(event) => onChange({ text: event.currentTarget.value })} />
      </label>
      <label className="field">
        <span className="field__label">字体</span>
        <select value={value.fontFamily} onChange={(event) => onChange({ fontFamily: event.currentTarget.value })}>
          {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
        </select>
      </label>
      <div className="control-row">
        <button type="button" className={`icon-toggle ${value.fontWeight >= 600 ? 'is-active' : ''}`} aria-pressed={value.fontWeight >= 600} onClick={() => onChange({ fontWeight: value.fontWeight >= 600 ? 400 : 700 })}><Bold size={18} /><span className="visually-hidden">粗体</span></button>
        <button type="button" className={`icon-toggle ${value.italic ? 'is-active' : ''}`} aria-pressed={value.italic} onClick={() => onChange({ italic: !value.italic })}><Italic size={18} /><span className="visually-hidden">斜体</span></button>
        <div className="segmented compact-segment" aria-label="文字对齐">
          {alignment.map(({ value: align, icon: Icon, label }) => (
            <button key={align} type="button" className={value.align === align ? 'is-active' : ''} aria-label={label} aria-pressed={value.align === align} onClick={() => onChange({ align })}><Icon size={18} /></button>
          ))}
        </div>
      </div>
      <div className="color-row">
        <label><span>文字</span><input type="color" value={normalizeColor(value.color, '#10223d')} onChange={(event) => onChange({ color: event.currentTarget.value })} /></label>
        <label><span>底色</span><input type="color" value={normalizeColor(value.background, '#ffffff')} onChange={(event) => onChange({ background: event.currentTarget.value })} /></label>
      </div>
      <RangeField label="字号" value={value.fontSize} min={24} max={128} suffix="px" onChange={(fontSize) => onChange({ fontSize })} />
      <RangeField label="倾斜角度" value={value.rotation} min={-12} max={12} suffix="°" onChange={(rotation) => onChange({ rotation })} />
      <RangeField label="行距" value={value.lineHeight} min={1} max={2} step={0.05} suffix="×" onChange={(lineHeight) => onChange({ lineHeight })} />
    </>
  )
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}
