import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import type { TextAlign, TextAppearance } from '../types'
import { RangeField } from './Fields'
import { useI18n, type MessageKey } from '../i18n'

const FONT_OPTIONS = [
  { label: 'text.fontRounded', value: 'ui-rounded, "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: 'text.fontSans', value: '"Avenir Next", "PingFang SC", "Microsoft YaHei UI", sans-serif' },
  { label: 'text.fontSerif', value: '"Songti SC", SimSun, serif' },
  { label: 'text.fontHand', value: 'KaiTi, "STKaiti", serif' },
]

interface TextControlsProps {
  value: TextAppearance
  onChange: (patch: Partial<TextAppearance>) => void
}

export function TextControls({ value, onChange }: TextControlsProps) {
  const { t } = useI18n()
  const alignment: Array<{ value: TextAlign; icon: typeof AlignLeft; label: MessageKey }> = [
    { value: 'left', icon: AlignLeft, label: 'text.alignLeft' },
    { value: 'center', icon: AlignCenter, label: 'text.alignCenter' },
    { value: 'right', icon: AlignRight, label: 'text.alignRight' },
  ]

  return (
    <>
      <label className="field">
        <span className="field__label">{t('text.content')}</span>
        <textarea rows={3} value={value.text} onChange={(event) => onChange({ text: event.currentTarget.value })} />
      </label>
      <label className="field">
        <span className="field__label">{t('text.font')}</span>
        <select value={value.fontFamily} onChange={(event) => onChange({ fontFamily: event.currentTarget.value })}>
          {FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{t(font.label as MessageKey)}</option>)}
        </select>
      </label>
      <div className="control-row">
        <button type="button" className={`icon-toggle ${value.fontWeight >= 600 ? 'is-active' : ''}`} aria-pressed={value.fontWeight >= 600} onClick={() => onChange({ fontWeight: value.fontWeight >= 600 ? 400 : 700 })}><Bold size={18} /><span className="visually-hidden">{t('text.bold')}</span></button>
        <button type="button" className={`icon-toggle ${value.italic ? 'is-active' : ''}`} aria-pressed={value.italic} onClick={() => onChange({ italic: !value.italic })}><Italic size={18} /><span className="visually-hidden">{t('text.italic')}</span></button>
        <div className="segmented compact-segment" aria-label={t('text.alignment')}>
          {alignment.map(({ value: align, icon: Icon, label }) => (
            <button key={align} type="button" className={value.align === align ? 'is-active' : ''} aria-label={t(label)} aria-pressed={value.align === align} onClick={() => onChange({ align })}><Icon size={18} /></button>
          ))}
        </div>
      </div>
      <div className="color-row">
        <label><span>{t('text.color')}</span><input type="color" value={normalizeColor(value.color, '#10223d')} onChange={(event) => onChange({ color: event.currentTarget.value })} /></label>
        <label><span>{t('text.background')}</span><input type="color" value={normalizeColor(value.background, '#ffffff')} onChange={(event) => onChange({ background: event.currentTarget.value })} /></label>
      </div>
      <RangeField label={t('text.size')} value={value.fontSize} min={24} max={128} suffix="px" onChange={(fontSize) => onChange({ fontSize })} />
      <RangeField label={t('text.rotation')} value={value.rotation} min={-12} max={12} suffix="°" onChange={(rotation) => onChange({ rotation })} />
      <RangeField label={t('text.lineHeight')} value={value.lineHeight} min={1} max={2} step={0.05} suffix="×" onChange={(lineHeight) => onChange({ lineHeight })} />
    </>
  )
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}
