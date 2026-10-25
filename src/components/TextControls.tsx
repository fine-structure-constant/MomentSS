import { lazy, Suspense } from 'react'
import type { TextAppearance } from '../types'
import { RangeField } from './Fields'
import { useI18n } from '../i18n'

const RichTextEditor = lazy(() => import('./RichTextEditor'))
export function TextControls({ value, onChange }: { value: TextAppearance; onChange: (patch: Partial<TextAppearance>) => void }) {
  const { t } = useI18n()
  return <>
    <Suspense fallback={<p role="status">{t('rich.loading')}</p>}><RichTextEditor value={value} onChange={onChange} /></Suspense>
    <div className="color-row"><label><span>{t('text.background')}</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(value.background) ? value.background : '#ffffff'} onChange={(event) => onChange({ background: event.currentTarget.value })} /></label></div>
    <RangeField label={t('rich.baseSize')} value={value.fontSize} min={24} max={128} suffix="px" onChange={(fontSize) => onChange({ fontSize })} />
    <RangeField label={t('text.rotation')} value={value.rotation} min={-12} max={12} suffix="°" onChange={(rotation) => onChange({ rotation })} />
    <RangeField label={t('text.lineHeight')} value={value.lineHeight} min={1} max={2} step={0.05} suffix="×" onChange={(lineHeight) => onChange({ lineHeight })} />
  </>
}
