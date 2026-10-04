import { Download, Grid2X2, Images, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { downloadBlob, exportGridTiles, fileToSourceImage } from '../lib/canvas'
import { DEFAULT_CROP } from '../lib/defaults'
import { gridDimensions } from '../lib/geometry'
import type { CropState, SourceImage } from '../types'
import { CropEditor } from '../components/CropEditor'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'

interface GridToolProps {
  onToast: (message: ToastMessage) => void
}

export function GridTool({ onToast }: GridToolProps) {
  const [source, setSource] = useState<SourceImage | null>(null)
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP)
  const [count, setCount] = useState<4 | 6 | 9>(9)
  const [busy, setBusy] = useState(false)
  const dimensions = useMemo(() => gridDimensions(count), [count])
  const aspect = dimensions.columns / dimensions.rows

  const handleFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    try {
      setSource(await fileToSourceImage(file))
      setCrop(DEFAULT_CROP)
      onToast({ text: '图片已载入，调整构图后即可切图。', tone: 'success' })
    } catch {
      onToast({ text: '无法读取这张图片，请改用 JPG、PNG、WebP 或 AVIF。', tone: 'warning' })
    }
  }

  const createTiles = async () => {
    if (!source) return []
    setBusy(true)
    try {
      return await exportGridTiles(source, crop, count)
    } catch {
      onToast({ text: '切图失败。请换用尺寸较小的图片后重试。', tone: 'warning' })
      return []
    } finally {
      setBusy(false)
    }
  }

  const downloadAll = async () => {
    const blobs = await createTiles()
    blobs.forEach((blob, index) => {
      window.setTimeout(() => downloadBlob(blob, `留白拼图-${count}宫格-${String(index + 1).padStart(2, '0')}.jpg`), index * 120)
    })
    if (blobs.length) onToast({ text: `已开始下载 ${blobs.length} 张切图；浏览器可能询问是否允许多个下载。`, tone: 'success' })
  }

  if (!source) {
    return (
      <div className="single-tool-empty">
        <div className="tool-intro">
          <div className="intro-icon"><Grid2X2 size={30} /></div>
          <h1>一张图，铺满整组朋友圈</h1>
          <p>选择 4、6 或 9 图版式，调整整体取景后，程序会按从左到右、从上到下的发布顺序切成正方形图片。</p>
        </div>
        <div className="count-picker" aria-label="切图数量">
          {([4, 6, 9] as const).map((value) => <button type="button" key={value} className={count === value ? 'is-active' : ''} onClick={() => setCount(value)}><strong>{value}</strong><span>{value === 4 ? '2 × 2' : value === 6 ? '3 × 2' : '3 × 3'}</span></button>)}
        </div>
        <UploadDropzone onFiles={handleFiles} label="选择要切开的图片" />
      </div>
    )
  }

  return (
    <div className="grid-layout">
      <section className="grid-main">
        <CropEditor source={source} crop={crop} onChange={setCrop} aspect={aspect} grid={dimensions} title="调整整组画面" hint="白线是切割位置。主体尽量不要压在线上，切出的每张图都会保持正方形。" />
      </section>
      <aside className="grid-actions">
        <div className="panel-heading"><div><h2>选择版式</h2><p>按朋友圈显示顺序导出</p></div><Rows3 size={20} /></div>
        <div className="count-picker count-picker--vertical" aria-label="切图数量">
          {([4, 6, 9] as const).map((value) => <button type="button" key={value} className={count === value ? 'is-active' : ''} onClick={() => { setCount(value); setCrop(DEFAULT_CROP) }}><strong>{value} 图</strong><span>{value === 4 ? '2 列 × 2 行' : value === 6 ? '3 列 × 2 行' : '3 列 × 3 行'}</span></button>)}
        </div>
        <div className={`order-sample order-sample--${dimensions.columns}`} aria-label="下载顺序示意">
          {Array.from({ length: count }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <button type="button" className="primary-button wide-button" disabled={busy} onClick={() => void downloadAll()}><Download size={18} /> {busy ? '正在切图' : `下载全部 ${count} 张`}</button>
        <UploadDropzone compact onFiles={handleFiles} label="更换图片" />
        <p className="honest-note"><Images size={15} /> 下载后按编号顺序选择图片，即可还原整张画面。</p>
      </aside>
    </div>
  )
}
