import { Download, Grid2X2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadBlob, exportGridTiles, fileToSourceImage, inspectImage } from '../lib/canvas'
import { DEFAULT_CROP } from '../lib/defaults'
import { gridDimensions } from '../lib/geometry'
import type { CropState, SourceImage } from '../types'
import { CropEditor } from '../components/CropEditor'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ToastMessage } from '../components/StatusToast'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import { useI18n } from '../i18n'
import { loadToolState, saveToolState } from '../lib/storage'
import { exportResource } from '../lib/resourceExport'

interface GridState { source: SourceImage | null; crop: CropState; count: 4 | 6 | 9; size: number; format: 'image/jpeg' | 'image/png'; sourceId: string }
export function GridTool({ onToast, library }: { onToast: (message: ToastMessage) => void; library: ResourceLibrary }) {
  const { t } = useI18n()
  const [state, setState] = useState<GridState>({ source: null, crop: DEFAULT_CROP, count: 9, size: 1440, format: 'image/jpeg', sourceId: '' })
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [tiles, setTiles] = useState<Blob[]>([])
  const latest = useRef(state); latest.current = state
  const queue = useRef(Promise.resolve())
  const write = (value: GridState) => { queue.current = queue.current.catch(() => {}).then(() => saveToolState('grid', library.projectId, value)); return queue.current }
  useEffect(() => {
    let active = true
    void loadToolState<GridState>('grid', library.projectId).then((saved) => { if (active) { if (saved) setState(saved); setReady(true) } }).catch(() => onToast({ text: t('resource.readError'), tone: 'warning' }))
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (!ready) return
    setTiles([])
    const timer = setTimeout(() => { void write(state).catch(() => onToast({ text: t('resource.saveError'), tone: 'warning' })) }, 300)
    return () => clearTimeout(timer)
  }, [state, ready])
  const canSave = useRef(false); canSave.current = ready
  useEffect(() => { if (ready) return library.registerToolSave(() => write(latest.current)) }, [ready, library.registerToolSave])
  useEffect(() => () => { if (canSave.current) void write(latest.current).catch(() => {}) }, [])
  const dimensions = useMemo(() => gridDimensions(state.count), [state.count])
  const sources = [...library.assets.filter((item) => item.type === 'photo'), ...library.compositions]
  const choose = async (id: string) => {
    const item = sources.find((entry) => entry.id === id)
    if (!item || busy) return
    setBusy(true)
    try {
      const blob = 'blocks' in item ? (await exportResource(item, 'image/png')).blob : item.blob
      const source = { blob, name: item.displayName || item.name, ...await inspectImage(blob) }
      setState((value) => ({ ...value, source, sourceId: id, crop: DEFAULT_CROP }))
    } catch { onToast({ text: t('grid.readError'), tone: 'warning' }) } finally { setBusy(false) }
  }
  const handleFiles = async (files: File[]) => {
    if (!files[0]) return
    try { const source = await fileToSourceImage(files[0]); setState((value) => ({ ...value, source, sourceId: '', crop: DEFAULT_CROP })) }
    catch { onToast({ text: t('grid.readError'), tone: 'warning' }) }
  }
  const create = async (): Promise<Blob[]> => {
    if (!state.source || busy) return []
    if (tiles.length) return tiles
    setBusy(true)
    try { const result = await exportGridTiles(state.source, state.crop, state.count, state); setTiles(result); return result }
    catch { onToast({ text: t('grid.exportError'), tone: 'warning' }); return [] } finally { setBusy(false) }
  }
  const name = (index: number) => `MomentSS-${String(index + 1).padStart(2, '0')}.${state.format === 'image/png' ? 'png' : 'jpg'}`
  const downloadAll = async () => { (await create()).forEach((blob, index) => setTimeout(() => downloadBlob(blob, name(index)), index * 120)) }
  const downloadZip = async () => {
    const results = await create()
    if (!results.length) return
    setBusy(true)
    try {
      const { zipSync } = await import('fflate'), files: Record<string, Uint8Array> = {}
      let size = 0
      for (const [index, blob] of results.entries()) { size += blob.size; if (size > 200 * 1048576) throw new Error('zip-budget'); files[name(index)] = new Uint8Array(await blob.arrayBuffer()) }
      downloadBlob(new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), 'MomentSS-grid.zip')
    } catch { onToast({ text: t('grid.exportError'), tone: 'warning' }) } finally { setBusy(false) }
  }
  if (!ready) return <div role="status" className="resource-loading">{t('resource.loading')}</div>
  return <div className="grid-layout">
    <section className="grid-main">{state.source ? <CropEditor source={state.source} crop={state.crop} onChange={(crop) => setState({ ...state, crop })} aspect={dimensions.columns / dimensions.rows} grid={dimensions} title={t('grid.cropTitle')} hint={t('grid.cropHint')} /> : <div className="tool-intro"><Grid2X2 size={30} /><h1>{t('grid.heroTitle')}</h1><p>{t('grid.heroBody')}</p></div>}</section>
    <aside className="grid-actions">
      <label className="field"><span className="field__label">{t('grid.source')}</span><select disabled={busy} value={state.sourceId} onChange={(event) => void choose(event.currentTarget.value)}><option value="">{t('grid.chooseSource')}</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.displayName || source.name}</option>)}</select></label>
      <UploadDropzone compact onFiles={handleFiles} label={t('grid.choose')} />
      <div className="count-picker" aria-label={t('grid.countAria')}>{([4, 6, 9] as const).map((count) => <button type="button" key={count} aria-pressed={state.count === count} className={state.count === count ? 'is-active' : ''} onClick={() => setState({ ...state, count })}><strong>{count}</strong></button>)}</div>
      <label className="field"><span className="field__label">{t('grid.size')}</span><select value={state.size} onChange={(event) => setState({ ...state, size: Number(event.currentTarget.value) })}>{[720, 1080, 1440, 2160].map((size) => <option key={size} value={size}>{size}px</option>)}</select></label>
      <label className="field"><span className="field__label">{t('grid.format')}</span><select value={state.format} onChange={(event) => setState({ ...state, format: event.currentTarget.value as GridState['format'] })}><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
      <button type="button" className="primary-button wide-button" disabled={busy || !state.source} onClick={() => void downloadZip()}><Download size={17} />{t('grid.zip')}</button>
      <button type="button" className="secondary-button" disabled={busy || !state.source} onClick={() => void downloadAll()}>{t('grid.downloadAll', { count: state.count })}</button>
      <div className="grid-single-actions">{Array.from({ length: state.count }, (_, index) => <button className="text-button" key={index} disabled={busy || !state.source} onClick={() => void create().then((result) => { if (result[index]) downloadBlob(result[index], name(index)) })}>{t('grid.single', { number: index + 1 })}</button>)}</div>
      <p className="honest-note">{t('grid.orderHint')}</p>
    </aside>
  </div>
}
