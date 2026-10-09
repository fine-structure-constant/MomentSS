import { Download, Eye, Image as ImageIcon, Plus, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ImportedAsset, SavedComposition } from '../types'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import type { ToastMessage } from './StatusToast'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useI18n } from '../i18n'
import { UploadDropzone } from './UploadDropzone'
import { StitchPreview } from './StitchPreview'
import { createTextMeasurer } from '../lib/stitchLayout'
import { compositionLayout, exportResource, resourceFileName } from '../lib/resourceExport'
import { downloadBlob } from '../lib/canvas'
import { DEFAULT_SETTINGS } from '../lib/defaults'

function BlobImage({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob)
  return url ? <img src={url} alt="" /> : <ImageIcon size={21} />
}

interface ResourcePanelProps {
  library: ResourceLibrary
  selectedSourceId: string | null
  onFiles: (files: File[]) => Promise<void>
  onText: () => void
  onAdd: (asset: ImportedAsset) => void
  onOpen: (composition: SavedComposition) => void
  onCover: (id: string) => void
  onToast: (message: ToastMessage) => void
}

export function ResourcePanel({ library, selectedSourceId, onFiles, onText, onAdd, onOpen, onCover, onToast }: ResourcePanelProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<ImportedAsset | SavedComposition | null>(null)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!library.lastSavedId) return
    const card = [...(panel.current?.querySelectorAll<HTMLElement>('[data-composition-id]') ?? [])].find((item) => item.dataset.compositionId === library.lastSavedId)
    card?.scrollIntoView({ block: 'center' })
    if (card) library.clearSavedFocus()
  }, [library.lastSavedId, library.clearSavedFocus])
  const name = (asset: ImportedAsset) => asset.type === 'photo' ? asset.name : asset.text || t('stitch.blankText')
  const download = async (resource: ImportedAsset | SavedComposition, format: 'image/png' | 'image/jpeg') => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, report } = await exportResource(resource, format)
      downloadBlob(blob, resourceFileName('blocks' in resource ? resource.name : name(resource), format))
      onToast({ text: t(report.reduced ? 'stitch.downloadReduced' : 'resource.exported', { width: report.width, height: report.height }), tone: report.reduced ? 'warning' : 'success' })
    } catch { onToast({ text: t('resource.exportError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }
  const exportButtons = (resource: ImportedAsset | SavedComposition) => <div className="resource-export-actions">
    {(['image/png', 'image/jpeg'] as const).map((format) => <button key={format} type="button" disabled={busy}
      aria-label={t('resource.exportAs', { format: format === 'image/png' ? 'PNG' : 'JPG', name: 'blocks' in resource ? resource.name : name(resource) })}
      onClick={() => void download(resource, format)}><Download size={12} />{format === 'image/png' ? 'PNG' : 'JPG'}</button>)}
  </div>
  const removeSaved = async (composition: SavedComposition) => {
    try { await library.removeComposition(composition.id) }
    catch { onToast({ text: t('resource.saveError'), tone: 'warning' }) }
  }

  return <section ref={panel} className="studio-pane studio-pane--import" role="tabpanel">
    <div className="panel-heading"><div><h2>{t('stitch.addContent')}</h2><p>{t('upload.private')}</p></div></div>
    <div className="import-actions">
      <UploadDropzone compact multiple onFiles={onFiles} label={t('stitch.addPhotos')} />
      <button type="button" className="secondary-button compact-action" onClick={onText}><Type size={17} />{t('stitch.textCard')}</button>
    </div>
    <div className="asset-library-head"><div><h3>{t('stitch.assetLibrary')}</h3><p>{t('stitch.assetCount', { count: library.assets.length })}</p></div></div>
    <p className="asset-library-hint">{t('stitch.assetLibraryHint')}</p>
    {library.assets.length ? <div className="asset-grid">{library.assets.map((asset) => <div key={asset.id}
      className={`asset-tile ${selectedSourceId === asset.id ? 'is-selected' : ''} ${asset.type === 'text' ? 'asset-tile--text' : ''}`}>
      <button type="button" className="asset-tile__add" aria-label={t('stitch.addAsset', { name: name(asset) })} onClick={() => onAdd(asset)}>
        <span className="asset-tile__preview">{asset.type === 'photo' ? <><BlobImage blob={asset.blob} />
          {asset.overlay && <span className="asset-tile__annotation" title={`${t('stitch.photoText')}: ${asset.overlay.text}`}><Type size={12} /><span>{asset.overlay.text || t('stitch.blankText')}</span></span>}
        </> : <><Type size={21} /><em>{name(asset)}</em></>}</span>
        <span className="asset-tile__add-label"><Plus size={13} />{t('stitch.addToCanvas')}</span>
      </button>
      <div className="asset-tile__caption"><span className="asset-tile__name">{name(asset)}</span><button type="button" aria-label={t('resource.viewAsset', { name: name(asset) })} title={t('resource.view')} onClick={() => setPreview(asset)}><Eye size={14} /></button></div>
      {exportButtons(asset)}
      <button type="button" className="asset-tile__remove" aria-label={t('stitch.removeImportedAsset', { name: name(asset) })} onClick={() => library.setAssets((current) => current.filter((item) => item.id !== asset.id))}><Trash2 size={14} /></button>
    </div>)}</div> : <div className="mini-empty"><ImageIcon size={26} /><p>{t('stitch.assetLibraryEmpty')}</p></div>}

    <div className="asset-library-head"><h3>{t('resource.savedHeading')}</h3><p>{t('resource.savedHint')}</p></div>
    {library.compositions.length ? <div className="composition-list">{library.compositions.map((composition) => <article key={composition.id} className="composition-card" data-composition-id={composition.id}>
      <button type="button" className="composition-card__preview" onClick={() => setPreview(composition)} aria-label={t('resource.viewNamed', { name: composition.name })}><BlobImage blob={composition.thumbnail} /></button>
      <div className="composition-card__body"><h4>{composition.name}</h4><p>{t(composition.kind === 'cover' ? 'resource.coverKind' : 'resource.collageKind')} · {composition.width} × {Math.round(composition.height)}</p>
        <div className="composition-card__actions">
          <button type="button" onClick={() => setPreview(composition)}>{t('resource.view')}</button>
          {composition.kind === 'collage' && <button type="button" onClick={() => onOpen(composition)}>{t('resource.edit')}</button>}
          <button type="button" onClick={() => onCover(composition.id)}>{t(composition.kind === 'cover' ? 'resource.adjustCover' : 'resource.makeCover')}</button>
        </div>{exportButtons(composition)}
      </div>
      <button type="button" className="composition-card__remove icon-button" aria-label={t('resource.removeNamed', { name: composition.name })} onClick={() => void removeSaved(composition)}><Trash2 size={14} /></button>
    </article>)}</div> : <div className="mini-empty"><ImageIcon size={26} /><p>{t('resource.savedEmpty')}</p></div>}
    {preview && <CompositionViewer resource={preview} onClose={() => setPreview(null)}>{exportButtons(preview)}</CompositionViewer>}
  </section>
}

function CompositionViewer({ resource, onClose, children }: { resource: ImportedAsset | SavedComposition; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dialog = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const measure = useMemo(() => createTextMeasurer(), [])
  const composition = useMemo(() => 'blocks' in resource ? resource : {
    name: resource.type === 'photo' ? resource.name : resource.text || t('stitch.blankText'),
    blocks: [resource], settings: { ...DEFAULT_SETTINGS, width: resource.type === 'photo' ? resource.width : 1080 }, cover: undefined,
  }, [resource, t])
  const layout = useMemo(() => compositionLayout(composition, measure), [composition, measure])
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true }) }
  }, [])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} className="composition-viewer" role="dialog" aria-modal="true" aria-labelledby="composition-viewer-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); if (focusedId) { setFocusedId(null); close.current?.focus() } else onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') ?? [])].filter((element) => element.offsetParent !== null)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <header><div><h2 id="composition-viewer-title">{composition.name}</h2><p>{layout.width} × {Math.round(layout.height)}</p></div><button ref={close} type="button" className="secondary-button" onClick={onClose}>{t('common.close')}</button></header>
      <div className="composition-viewer__stage"><StitchPreview layout={layout} background={composition.cover?.background ?? composition.settings.background} measure={measure} selectedId={selectedId} focusedId={focusedId} onSelect={(id, focus) => { setSelectedId(id); setFocusedId(focus) }} onFocus={(id) => { setFocusedId(id); if (!id) close.current?.focus() }} /></div>
      <footer>{children}</footer>
    </section>
  </div>
}
