import { GalleryVerticalEnd, Grid2X2, Languages, ShieldCheck, SquareDashed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { StatusToast, type ToastMessage } from './components/StatusToast'
import { CoverTool } from './tools/CoverTool'
import { GridTool } from './tools/GridTool'
import { StitchTool } from './tools/StitchTool'
import type { ToolId } from './types'
import { useI18n, type MessageKey } from './i18n'

const TOOLS: Array<{ id: ToolId; label: MessageKey; short: MessageKey; icon: typeof GalleryVerticalEnd }> = [
  { id: 'stitch', label: 'tool.stitch', short: 'tool.stitchShort', icon: GalleryVerticalEnd },
  { id: 'cover', label: 'tool.cover', short: 'tool.coverShort', icon: SquareDashed },
  { id: 'grid', label: 'tool.grid', short: 'tool.gridShort', icon: Grid2X2 },
]

function App() {
  const { locale, setLocale, t } = useI18n()
  const [activeTool, setActiveTool] = useState<ToolId>('stitch')
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((message: ToastMessage) => setToast(message), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#main" aria-label={t('app.home')}>
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>{t('app.brand')}</strong><small>{t('app.tagline')}</small></span>
        </a>

        <nav className="tool-tabs" aria-label={t('app.tools')}>
          {TOOLS.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTool === id ? 'is-active' : ''}
              aria-current={activeTool === id ? 'page' : undefined}
              onClick={() => setActiveTool(id)}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
              <span className="tool-label-long">{t(label)}</span><span className="tool-label-short">{t(short)}</span>
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <div className="local-badge"><ShieldCheck aria-hidden="true" size={17} /><span>{t('app.localOnly')}</span></div>
          <label className="language-select">
            <Languages aria-hidden="true" size={17} />
            <span className="visually-hidden">{t('language.label')}</span>
            <select value={locale} aria-label={t('language.label')} onChange={(event) => setLocale(event.currentTarget.value as typeof locale)}>
              <option value="zh-CN">简中</option>
              <option value="zh-TW">繁中</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
      </header>

      <div className="privacy-ribbon"><span /><strong>{t('app.noUpload')}</strong><span>{t('app.draftLocal')}</span></div>

      <div id="main" className="tool-surface">
        {activeTool === 'stitch' && <StitchTool onToast={showToast} />}
        {activeTool === 'cover' && <CoverTool onToast={showToast} />}
        {activeTool === 'grid' && <GridTool onToast={showToast} />}
      </div>

      <StatusToast message={toast} />
    </div>
  )
}

export default App
