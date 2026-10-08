import { Download, Image as ImageIcon, ScanLine, SquareDashed } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { canvasToBlob, downloadBlob, fileToSourceImage, renderCoverComposite, renderSquareCover } from '../lib/canvas'
import { DEFAULT_CROP } from '../lib/defaults'
import type { CropState, SourceImage } from '../types'
import { CropEditor } from '../components/CropEditor'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'
import { useI18n } from '../i18n'

interface CoverToolProps {
  onToast: (message: ToastMessage) => void
}

export function CoverTool({ onToast }: CoverToolProps) {
  const { t } = useI18n()
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
      onToast({ text: t('cover.loaded'), tone: 'success' })
    } catch {
      onToast({ text: t('cover.readError'), tone: 'warning' })
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
      downloadBlob(await canvasToBlob(canvas, 'image/jpeg', 0.94), t('cover.squareFileName'))
      onToast({ text: t('cover.squareDownloaded'), tone: 'success' })
    } catch {
      onToast({ text: t('cover.squareError'), tone: 'warning' })
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
      downloadBlob(await canvasToBlob(canvas, 'image/jpeg', 0.94), t('cover.compositeFileName'))
      onToast({ text: report.reduced ? t('cover.compositeReduced') : t('cover.compositeDownloaded'), tone: report.reduced ? 'warning' : 'success' })
    } catch {
      onToast({ text: t('cover.compositeError'), tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }

  if (!source) {
    return (
      <div className="single-tool-empty">
        <div className="tool-intro">
          <div className="intro-icon"><SquareDashed size={30} /></div>
          <h1>{t('cover.heroTitle')}</h1>
          <p>{t('cover.heroBody')}</p>
        </div>
        <UploadDropzone onFiles={handleFiles} label={t('cover.choose')} />
        <p className="honest-note">{t('cover.caveat')}</p>
      </div>
    )
  }

  return (
    <div className="cover-layout">
      <section className="crop-pane">
        <CropEditor source={source} crop={crop} onChange={setCrop} aspect={1} title={t('cover.cropTitle')} hint={t('cover.cropHint')} />
        <UploadDropzone compact onFiles={handleFiles} label={t('cover.replace')} />
      </section>

      <section className="composite-pane">
        <div className="panel-heading"><div><h2>{t('cover.compositeTitle')}</h2><p>{t('cover.compositeHint')}</p></div><ScanLine size={20} /></div>
        <div className="composite-preview"><canvas ref={compositeRef} /></div>
      </section>

      <aside className="cover-actions">
        <div className="preview-square">
          <ImageIcon size={22} />
          <div><strong>{t('cover.previewTitle')}</strong><span>{t('cover.previewHint')}</span></div>
        </div>
        <div className="step-list" aria-label={t('cover.stepsAria')}>
          <p><span>1</span> {t('cover.step1')}</p>
          <p><span>2</span> {t('cover.step2')}</p>
          <p><span>3</span> {t('cover.step3')}</p>
        </div>
        <button type="button" className="primary-button wide-button" disabled={busy} onClick={() => void downloadComposite()}><Download size={18} /> {t('cover.downloadComposite')}</button>
        <button type="button" className="secondary-button wide-button" disabled={busy} onClick={() => void downloadSquare()}><SquareDashed size={18} /> {t('cover.downloadSquare')}</button>
        <p className="honest-note">{t('cover.private')}</p>
      </aside>
    </div>
  )
}
