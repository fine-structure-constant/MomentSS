import { Download, Grid2X2, Images, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { downloadBlob, exportGridTiles, fileToSourceImage } from '../lib/canvas'
import { DEFAULT_CROP } from '../lib/defaults'
import { gridDimensions } from '../lib/geometry'
import type { CropState, SourceImage } from '../types'
import { CropEditor } from '../components/CropEditor'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'
import { useI18n } from '../i18n'

interface GridToolProps {
  onToast: (message: ToastMessage) => void
}

export function GridTool({ onToast }: GridToolProps) {
  const { t } = useI18n()
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
      onToast({ text: t('grid.loaded'), tone: 'success' })
    } catch {
      onToast({ text: t('grid.readError'), tone: 'warning' })
    }
  }

  const createTiles = async () => {
    if (!source) return []
    setBusy(true)
    try {
      return await exportGridTiles(source, crop, count)
    } catch {
      onToast({ text: t('grid.exportError'), tone: 'warning' })
      return []
    } finally {
      setBusy(false)
    }
  }

  const downloadAll = async () => {
    const blobs = await createTiles()
    blobs.forEach((blob, index) => {
      window.setTimeout(() => downloadBlob(blob, t('grid.fileName', { count, index: String(index + 1).padStart(2, '0') })), index * 120)
    })
    if (blobs.length) onToast({ text: t('grid.downloadStarted', { count: blobs.length }), tone: 'success' })
  }

  if (!source) {
    return (
      <div className="single-tool-empty">
        <div className="tool-intro">
          <div className="intro-icon"><Grid2X2 size={30} /></div>
          <h1>{t('grid.heroTitle')}</h1>
          <p>{t('grid.heroBody')}</p>
        </div>
        <div className="count-picker" aria-label={t('grid.countAria')}>
          {([4, 6, 9] as const).map((value) => <button type="button" key={value} className={count === value ? 'is-active' : ''} onClick={() => setCount(value)}><strong>{value}</strong><span>{value === 4 ? '2 × 2' : value === 6 ? '3 × 2' : '3 × 3'}</span></button>)}
        </div>
        <UploadDropzone onFiles={handleFiles} label={t('grid.choose')} />
      </div>
    )
  }

  return (
    <div className="grid-layout">
      <section className="grid-main">
        <CropEditor source={source} crop={crop} onChange={setCrop} aspect={aspect} grid={dimensions} title={t('grid.cropTitle')} hint={t('grid.cropHint')} />
      </section>
      <aside className="grid-actions">
        <div className="panel-heading"><div><h2>{t('grid.layoutTitle')}</h2><p>{t('grid.layoutHint')}</p></div><Rows3 size={20} /></div>
        <div className="count-picker count-picker--vertical" aria-label={t('grid.countAria')}>
          {([4, 6, 9] as const).map((value) => <button type="button" key={value} className={count === value ? 'is-active' : ''} onClick={() => { setCount(value); setCrop(DEFAULT_CROP) }}><strong>{t('grid.images', { count: value })}</strong><span>{t(`grid.layout${value}` as 'grid.layout4' | 'grid.layout6' | 'grid.layout9')}</span></button>)}
        </div>
        <div className={`order-sample order-sample--${dimensions.columns}`} aria-label={t('grid.orderAria')}>
          {Array.from({ length: count }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <button type="button" className="primary-button wide-button" disabled={busy} onClick={() => void downloadAll()}><Download size={18} /> {busy ? t('grid.slicing') : t('grid.downloadAll', { count })}</button>
        <UploadDropzone compact onFiles={handleFiles} label={t('common.replaceImage')} />
        <p className="honest-note"><Images size={15} /> {t('grid.orderHint')}</p>
      </aside>
    </div>
  )
}
