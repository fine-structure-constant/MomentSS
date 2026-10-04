import { Download, Image as ImageIcon, ScanLine, SquareDashed } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canvasToBlob, downloadBlob, fileToSourceImage, renderCoverComposite, renderSquareCover } from '../lib/canvas'
import { DEFAULT_CROP } from '../lib/defaults'
import type { CropState, SourceImage } from '../types'
import { CropEditor } from '../components/CropEditor'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'

interface CoverToolProps {
  onToast: (message: ToastMessage) => void
}

export function CoverTool({ onToast }: CoverToolProps) {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP)
  const [busy, setBusy] = useState(false)
  const compositeRef = useRef<HTMLCanvasElement>(null)

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      const image = await fileToSourceImage(file)
      setSource(image)
      setCrop(DEFAULT_CROP)
      onToast({ text: '长图已载入，请调整正方形取景框。', tone: 'success' })
    } catch {
      onToast({ text: '无法读取这张图片，请改用 JPG、PNG、WebP 或 AVIF。', tone: 'warning' })
    }
  }

  useEffect(() => {
    if (!source || !compositeRef.current) return
    void renderCoverComposite(compositeRef.current, source, crop, Math.min(560, source.width))
  }, [source, crop])

  const downloadSquare = async () => {
    if (!source) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      await renderSquareCover(canvas, source, crop, Math.min(1600, source.width))
      downloadBlob(await canvasToBlob(canvas, 'image/jpeg', 0.94), '留白拼图-方形封面.jpg')
      onToast({ text: '方形封面已下载。', tone: 'success' })
    } catch {
      onToast({ text: '封面生成失败，请换一张尺寸较小的图片重试。', tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }

  const downloadComposite = async () => {
    if (!source) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      const report = await renderCoverComposite(canvas, source, crop)
      downloadBlob(await canvasToBlob(canvas, 'image/jpeg', 0.94), '留白拼图-置中封面长图.jpg')
      onToast({ text: report.reduced ? '长图已因浏览器画布限制安全缩放后下载。' : '置中封面长图已下载。', tone: report.reduced ? 'warning' : 'success' })
    } catch {
      onToast({ text: '长图生成失败。请先压缩原图或换用桌面浏览器。', tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }

  if (!source) {
    return (
      <div className="single-tool-empty">
        <div className="tool-intro">
          <div className="intro-icon"><SquareDashed size={30} /></div>
          <h1>把想要的画面，放进长图正中</h1>
          <p>上传一张已经拼好的长图，裁出正方形封面。我们会把它插入长图中部，并同步显示朋友圈中心缩略图的近似预览。</p>
        </div>
        <UploadDropzone onFiles={handleFiles} label="选择一张长图" />
        <p className="honest-note">不同微信版本的缩略图策略可能变化；这里采用“长图中部正方形”的常见逻辑，不能替代发布前的最终预览。</p>
      </div>
    )
  }

  return (
    <div className="cover-layout">
      <section className="crop-pane">
        <CropEditor source={source} crop={crop} onChange={setCrop} aspect={1} title="裁出正方形封面" hint="调整缩放与位置，让最重要的主体完整落在方框里。" />
        <UploadDropzone compact onFiles={handleFiles} label="更换长图" />
      </section>

      <section className="composite-pane">
        <div className="panel-heading"><div><h2>置中后的长图</h2><p>方形封面被插入原图垂直中点</p></div><ScanLine size={20} /></div>
        <div className="composite-preview"><canvas ref={compositeRef} /></div>
      </section>

      <aside className="cover-actions">
        <div className="preview-square">
          <ImageIcon size={22} />
          <div><strong>朋友圈缩略图预览</strong><span>近似展示中心 1:1 画面</span></div>
        </div>
        <div className="step-list" aria-label="操作说明">
          <p><span>1</span> 调整方形取景框</p>
          <p><span>2</span> 检查置中长图</p>
          <p><span>3</span> 下载并在微信发布前预览</p>
        </div>
        <button type="button" className="primary-button wide-button" disabled={busy} onClick={() => void downloadComposite()}><Download size={18} /> 下载置中长图</button>
        <button type="button" className="secondary-button wide-button" disabled={busy} onClick={() => void downloadSquare()}><SquareDashed size={18} /> 单独下载方形封面</button>
        <p className="honest-note">所有处理都在当前浏览器内完成，原图不会上传。</p>
      </aside>
    </div>
  )
}
