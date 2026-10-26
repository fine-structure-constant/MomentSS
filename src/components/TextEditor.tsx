import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { TextAppearance } from '../types'
import { useI18n } from '../i18n'
import { BasicTextEditor } from './BasicTextEditor'
import { PluginBoundary } from './PluginBoundary'
import { requiresRichEditor } from '../lib/editorDocument'
import { installPlugin, isPluginEnabled, loadFeature } from '../lib/featurePlugins'
import { plainTextDocument } from '../lib/richText'
import { useConfirmDialog } from './ConfirmDialog'

type Props = { value: TextAppearance; onChange: (patch: Partial<TextAppearance>) => void }
export function TextEditor({ value, onChange }: Props) {
  const { t } = useI18n(), { confirm, dialog } = useConfirmDialog(), formatted = requiresRichEditor(value)
  const [Editor, setEditor] = useState<ComponentType<Props> | null>(null), [mode, setMode] = useState<'basic' | 'loading' | 'advanced' | 'error'>('basic'), [attempt, setAttempt] = useState(0)
  const intended = useRef(false), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const enable = async () => {
    intended.current = true; setMode('loading')
    try {
      await installPlugin('rich-text')
      const module = await loadFeature('rich-text', () => import('./RichTextEditor'))
      if (active.current) { setEditor(() => module.default); if (intended.current) setMode('advanced'); setAttempt((value) => value + 1) }
    } catch { if (active.current) setMode('error') }
  }
  useEffect(() => { if (formatted && isPluginEnabled('rich-text')) void enable() }, [])
  const base = <BasicTextEditor value={value} onChange={onChange} readOnly={formatted} onFocus={() => { if (!formatted && mode === 'loading') { intended.current = false; setMode('basic') } }} />
  const fallback = <>{base}<p role="alert" className="editor-load-message">{t(formatted ? 'editor.failedFormatted' : 'editor.failed')}</p><button className="secondary-button" onClick={() => void enable()}>{t('editor.retry')}</button></>
  return <div className="text-editor-shell">
    {mode === 'advanced' && Editor ? <PluginBoundary key={attempt} fallback={fallback} onFailure={() => setMode('error')}><Editor value={value} onChange={onChange} /></PluginBoundary> : <>{base}{mode === 'error' && <p role="alert" className="editor-load-message">{t(formatted ? 'editor.failedFormatted' : 'editor.failed')}</p>}{formatted && <p className="section-copy">{t('editor.preserved')}</p>}<button type="button" className="advanced-editor-action" disabled={mode === 'loading'} onClick={() => { if (Editor) setMode('advanced'); else void enable() }}>{t(mode === 'loading' ? 'editor.loading' : mode === 'error' ? 'editor.retry' : 'editor.advanced')}</button></>}
    {formatted && mode !== 'advanced' && <button className="text-button" onClick={async () => { if (await confirm({ title: t('editor.plainTitle'), body: t('editor.plainBody'), confirmLabel: t('editor.plainConfirm') })) { intended.current = false; onChange({ richText: plainTextDocument(value.text) }); setMode('basic') } }}>{t('editor.plainConfirm')}</button>}
    {dialog}
  </div>
}
