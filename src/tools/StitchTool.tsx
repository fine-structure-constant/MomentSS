import {
  ArrowDown,
  ArrowUp,
  Download,
  GripVertical,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Trash2,
  Type,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { canvasToBlob, downloadBlob, filesToPhotoBlocks, renderStitch, type RenderReport } from '../lib/canvas'
import { createPhotoOverlay, createTextBlock, DEFAULT_SETTINGS } from '../lib/defaults'
import { clearStitchDraft, loadStitchDraft, saveStitchDraft } from '../lib/storage'
import type { ComposerBlock, ComposerSettings, PhotoBlock, TextBlock } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { FieldGroup, RangeField } from '../components/Fields'
import { PhotoTextEditorModal } from '../components/PhotoTextEditorModal'
import { TextControls } from '../components/TextControls'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'

interface StitchToolProps {
  onToast: (message: ToastMessage) => void
}

function PhotoThumbnail({ block }: { block: PhotoBlock }) {
  const url = useObjectUrl(block.blob)
  return url ? <img src={url} alt="" /> : <span className="thumb-placeholder"><ImageIcon size={18} /></span>
}

export function StitchTool({ onToast }: StitchToolProps) {
  const [blocks, setBlocks] = useState<ComposerBlock[]>([])
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [renderReport, setRenderReport] = useState<RenderReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [photoEditorId, setPhotoEditorId] = useState<string | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const selected = useMemo(() => blocks.find((block) => block.id === selectedId) ?? null, [blocks, selectedId])
  const editingPhoto = useMemo(() => {
    const block = blocks.find((item) => item.id === photoEditorId)
    return block?.type === 'photo' ? block : null
  }, [blocks, photoEditorId])

  useEffect(() => {
    void loadStitchDraft()
      .then((draft) => {
        if (!draft) return
        setBlocks(draft.blocks)
        setSettings(draft.settings)
        setSelectedId(draft.blocks[0]?.id ?? null)
      })
      .catch(() => onToast({ text: '本地草稿读取失败；你仍可以继续编辑并导出。', tone: 'warning' }))
      .finally(() => setHydrated(true))
  }, [onToast])

  useEffect(() => {
    if (!hydrated) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void saveStitchDraft({ blocks, settings, updatedAt: Date.now() })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'))
    }, 650)
    return () => window.clearTimeout(timer)
  }, [blocks, settings, hydrated])

  useEffect(() => {
    if (!previewRef.current || blocks.length === 0) return
    let cancelled = false
    void renderStitch(previewRef.current, blocks, settings, 560)
      .then((report) => {
        if (!cancelled) setRenderReport(report)
      })
      .catch(() => onToast({ text: '预览生成失败，请移除无法读取的图片后重试。', tone: 'warning' }))
    return () => { cancelled = true }
  }, [blocks, settings, onToast])

  const handleFiles = async (files: File[]) => {
    try {
      const photos = await filesToPhotoBlocks(files.slice(0, 40))
      if (!photos.length) throw new Error('没有可读取的图片')
      setBlocks((current) => [...current, ...photos])
      setSelectedId(photos[0].id)
      onToast({ text: `已加入 ${photos.length} 张照片。`, tone: 'success' })
    } catch {
      onToast({ text: '图片无法读取。请改用 JPG、PNG、WebP 或 AVIF。', tone: 'warning' })
    }
  }

  const insertText = (afterId?: string) => {
    const text = createTextBlock()
    setBlocks((current) => {
      if (!afterId) return [...current, text]
      const index = current.findIndex((block) => block.id === afterId)
      const next = [...current]
      next.splice(index + 1, 0, text)
      return next
    })
    setSelectedId(text.id)
  }

  const move = (id: string, direction: -1 | 1) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const moveBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setBlocks((current) => {
      const next = [...current]
      const sourceIndex = next.findIndex((item) => item.id === sourceId)
      const targetIndex = next.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const [item] = next.splice(sourceIndex, 1)
      next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, item)
      return next
    })
  }

  const remove = (id: string) => {
    setBlocks((current) => current.filter((block) => block.id !== id))
    if (selectedId === id) setSelectedId(null)
    if (photoEditorId === id) setPhotoEditorId(null)
  }

  const updateSelectedText = (patch: Partial<TextBlock>) => {
    if (!selected || selected.type !== 'text') return
    setBlocks((current) => current.map((block) => {
      if (block.id !== selected.id || block.type !== 'text') return block
      return { ...block, ...patch, type: 'text' }
    }))
  }

  const updatePhoto = (id: string, patch: Partial<PhotoBlock>) => {
    setBlocks((current) => current.map((block) => block.id === id && block.type === 'photo' ? { ...block, ...patch } : block))
  }

  const openPhotoTextEditor = (photo: PhotoBlock) => {
    if (!photo.overlay) updatePhoto(photo.id, { overlay: createPhotoOverlay() })
    setPhotoEditorId(photo.id)
  }

  const exportImage = async () => {
    if (!blocks.length) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      const report = await renderStitch(canvas, blocks, settings)
      const blob = await canvasToBlob(canvas, settings.format, settings.quality)
      const extension = settings.format === 'image/png' ? 'png' : 'jpg'
      downloadBlob(blob, `留白拼图-长图-${new Date().toISOString().slice(0, 10)}.${extension}`)
      onToast({ text: report.reduced ? `已安全缩放至 ${report.width} × ${report.height} 后下载。` : `已下载 ${report.width} × ${report.height} 长图。`, tone: report.reduced ? 'warning' : 'success' })
    } catch {
      onToast({ text: '导出失败。请减少照片数量或降低输出宽度后重试。', tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }

  const resetDraft = async () => {
    if (blocks.length && !window.confirm('清空当前长图草稿？此操作无法撤销。')) return
    setBlocks([])
    setSelectedId(null)
    setPhotoEditorId(null)
    setSettings(DEFAULT_SETTINGS)
    await clearStitchDraft()
    onToast({ text: '长图草稿已清空。', tone: 'info' })
  }

  return (
    <>
    <div className="stitch-layout">
      <aside className="sequence-panel" aria-label="长图内容顺序">
        <div className="panel-heading">
          <div><h2>图文顺序</h2><p>{blocks.length ? `${blocks.length} 个内容块` : '从照片开始'}</p></div>
          <button type="button" className="icon-button" onClick={() => void resetDraft()} aria-label="清空草稿"><RotateCcw size={18} /></button>
        </div>
        <div className="sequence-toolbar" aria-label="添加内容">
          <UploadDropzone compact multiple onFiles={handleFiles} label="添加照片" />
          <button type="button" className="secondary-button" onClick={() => insertText()}><Type size={17} /> 文字卡片</button>
        </div>
        <div className="sequence-scroll">
        <ol className="sequence-list">
          {blocks.map((block, index) => (
            <li key={block.id}>
              <div
                className={`sequence-item ${selectedId === block.id ? 'is-selected' : ''}`}
                draggable
                onDragStart={() => setDraggedId(block.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggedId) moveBefore(draggedId, block.id)
                  setDraggedId(null)
                }}
                onClick={() => setSelectedId(block.id)}
              >
                <span className="drag-handle" aria-hidden="true"><GripVertical size={17} /></span>
                <span className="sequence-number">{index + 1}</span>
                <span className={`sequence-thumb ${block.type === 'text' ? 'sequence-thumb--text' : ''}`}>
                  {block.type === 'photo' ? <PhotoThumbnail block={block} /> : <Type size={21} />}
                </span>
                <span className="sequence-name">{block.type === 'photo' ? block.name : block.text || '空白文字'}</span>
                <span className="sequence-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, -1) }} disabled={index === 0} aria-label="上移"><ArrowUp size={15} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); move(block.id, 1) }} disabled={index === blocks.length - 1} aria-label="下移"><ArrowDown size={15} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); remove(block.id) }} aria-label="删除"><Trash2 size={15} /></button>
                </span>
              </div>
              <button type="button" className="insert-text" onClick={() => insertText(block.id)}><Plus size={14} /> 在这里插入文字</button>
            </li>
          ))}
        </ol>
        {!blocks.length && (
          <div className="mini-empty"><ImageIcon size={26} /><p>上传多张照片后，在这里拖动排序。</p></div>
        )}
        </div>
      </aside>

      <main className="canvas-stage" aria-label="长图实时预览">
        <div className="canvas-stage__topline">
          <span>实时画布</span>
          <span>{renderReport ? `${renderReport.width} × ${renderReport.height}` : '等待内容'}</span>
        </div>
        {blocks.length ? (
          <div className="long-canvas-wrap"><canvas ref={previewRef} /></div>
        ) : (
          <div className="hero-empty">
            <div className="aperture-mark" aria-hidden="true"><span /><span /><span /><span /></div>
            <h2>把旅途，排成一张长长的故事</h2>
            <p>照片留在你的浏览器里。添加后可拖动排序、插入文字，再下载高清长图。</p>
            <UploadDropzone multiple onFiles={handleFiles} label="选择旅行照片" />
          </div>
        )}
      </main>

      <aside className="inspector-panel" aria-label="编辑设置">
        <div className="inspector-actions">
          <div className={`save-indicator save-indicator--${saveState}`}><span />{saveState === 'saving' ? '正在保存' : saveState === 'error' ? '保存失败' : '本地草稿已保存'}</div>
          <button type="button" className="primary-button" onClick={() => void exportImage()} disabled={!blocks.length || busy}><Download size={18} />{busy ? '正在生成' : '下载长图'}</button>
        </div>

        {selected?.type === 'text' && (
          <FieldGroup title="文字样式" actions={<button type="button" className="danger-text" onClick={() => remove(selected.id)}>删除</button>}>
            <TextControls value={selected} onChange={updateSelectedText} />
            <RangeField label="上下留白" value={selected.padding} min={24} max={160} suffix="px" onChange={(padding) => updateSelectedText({ padding })} />
          </FieldGroup>
        )}

        {selected?.type === 'photo' && (
          <FieldGroup title="图片文字">
            {!selected.overlay ? (
              <div className="inspector-empty"><p>在独立画面编辑器中创建文字框，可直接拖到图片任意位置。</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Plus size={17} /> 添加图片文字</button></div>
            ) : (
              <div className="inspector-empty"><p>图片文字已添加。打开画面编辑器可拖动位置，并调整文本框宽度、字体、颜色和角度。</p><button type="button" className="secondary-button" onClick={() => openPhotoTextEditor(selected)}><Type size={17} /> 编辑画面文字</button></div>
            )}
          </FieldGroup>
        )}

        <FieldGroup title="画布设置">
          <RangeField label="输出宽度" value={settings.width} min={720} max={2160} step={120} suffix="px" onChange={(width) => setSettings({ ...settings, width })} />
          <RangeField label="照片间距" value={settings.gap} min={0} max={80} suffix="px" onChange={(gap) => setSettings({ ...settings, gap })} />
          <RangeField label="外侧留白" value={settings.padding} min={0} max={120} suffix="px" onChange={(padding) => setSettings({ ...settings, padding })} />
          <label className="field"><span className="field__label">背景颜色</span><input type="color" value={settings.background} onChange={(event) => setSettings({ ...settings, background: event.currentTarget.value })} /></label>
          <label className="field"><span className="field__label">格式</span><select value={settings.format} onChange={(event) => setSettings({ ...settings, format: event.currentTarget.value as ComposerSettings['format'] })}><option value="image/jpeg">JPG · 文件更小</option><option value="image/png">PNG · 无损</option></select></label>
          {settings.format === 'image/jpeg' && <RangeField label="JPG 质量" value={Math.round(settings.quality * 100)} min={70} max={100} suffix="%" onChange={(quality) => setSettings({ ...settings, quality: quality / 100 })} />}
        </FieldGroup>
      </aside>
    </div>
    {editingPhoto?.overlay && (
      <PhotoTextEditorModal
        photo={editingPhoto}
        overlay={editingPhoto.overlay}
        onChange={(overlay) => updatePhoto(editingPhoto.id, { overlay })}
        onClose={() => setPhotoEditorId(null)}
        onRemove={() => {
          updatePhoto(editingPhoto.id, { overlay: undefined })
          setPhotoEditorId(null)
        }}
      />
    )}
    </>
  )
}
