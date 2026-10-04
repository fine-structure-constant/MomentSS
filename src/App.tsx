import { GalleryVerticalEnd, Grid2X2, ShieldCheck, SquareDashed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { StatusToast, type ToastMessage } from './components/StatusToast'
import { CoverTool } from './tools/CoverTool'
import { GridTool } from './tools/GridTool'
import { StitchTool } from './tools/StitchTool'
import type { ToolId } from './types'

const TOOLS: Array<{ id: ToolId; label: string; short: string; icon: typeof GalleryVerticalEnd }> = [
  { id: 'stitch', label: '长图排版', short: '长图', icon: GalleryVerticalEnd },
  { id: 'cover', label: '封面置中', short: '封面', icon: SquareDashed },
  { id: 'grid', label: '九宫格', short: '切图', icon: Grid2X2 },
]

function App() {
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
        <a className="brand" href="#main" aria-label="留白拼图首页">
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span><strong>留白拼图</strong><small>把旅途，排成一张长长的故事</small></span>
        </a>

        <nav className="tool-tabs" aria-label="图片工具">
          {TOOLS.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeTool === id ? 'is-active' : ''}
              aria-current={activeTool === id ? 'page' : undefined}
              onClick={() => setActiveTool(id)}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
              <span className="tool-label-long">{label}</span><span className="tool-label-short">{short}</span>
            </button>
          ))}
        </nav>

        <div className="local-badge"><ShieldCheck aria-hidden="true" size={17} /><span>仅在本机处理</span></div>
      </header>

      <div className="privacy-ribbon"><span /><strong>照片不上传</strong><span>草稿自动保存在此浏览器</span></div>

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
