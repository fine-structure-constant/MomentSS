import { ChevronDown, Download, Eye, Image as ImageIcon, LayoutGrid, Pencil, Plus, Search, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ImportedAsset, SavedComposition } from '../types'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import type { ToastMessage } from './StatusToast'
import type { ConfirmOptions } from './ConfirmDialog'
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

type KindFilter = 'all' | 'photo' | 'text' | 'collage'
const COLUMN_OPTIONS = [2, 3, 4] as const

interface ResourcePanelProps {
  library: ResourceLibrary
  selectedSourceId: string | null
  onFiles: (files: File[]) => Promise<void>
  onText: () => void
  onAdd: (asset: ImportedAsset) => void
  onOpen: (composition: SavedComposition) => void
  onCover: (id: string) => void
  onRenameAsset: (asset: ImportedAsset, name: string) => void
  onToast: (message: ToastMessage) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export function ResourcePanel({
  library, selectedSourceId, onFiles, onText, onAdd, onOpen, onCover, onRenameAsset, onToast, confirm,
}: ResourcePanelProps) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<ImportedAsset | SavedComposition | null>(null)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [columns, setColumns] = useState<number>(3)
  const [collapsed, setCollapsed] = useState<{ assets: boolean; saved: boolean }>({ assets: false, saved: false })
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!library.lastSavedId) return
    const card = [...(panel.current?.querySelectorAll<HTMLElement>('[data-composition-id]') ?? [])].find((item) => item.dataset.compositionId === library.lastSavedId)
    card?.scrollIntoView({ block: 'center' })
    if (card) library.clearSavedFocus()
  }, [library.lastSavedId, library.clearSavedFocus])

  const name = (asset: ImportedAsset) => asset.type === 'photo' ? asset.name : asset.text || t('stitch.blankText')
  const normalized = query.trim().toLocaleLowerCase()
  const matches = (text: string) => !normalized || text.toLocaleLowerCase().includes(normalized)
  const wantsAssets = kind === 'all' || kind === 'photo' || kind === 'text'
  const visibleAssets = useMemo(
    () => wantsAssets ? library.assets.filter((asset) => (kind === 'all' || asset.type === kind) && matches(name(asset))) : [],
    // `name` depends only on the asset and the active locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library.assets, kind, normalized, t],
  )
  const visibleSaved = useMemo(
    () => kind === 'all' || kind === 'collage' ? library.compositions.filter((composition) => matches(composition.name)) : [],
    [library.compositions, kind, normalized],
  )
  const filtered = visibleAssets.length + visibleSaved.length

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

  const removeAsset = async (asset: ImportedAsset) => {
    const ok = await confirm({
      title: t('resource.removeAssetTitle'),
      body: t('resource.removeAssetBody', { name: name(asset) }),
      confirmLabel: t('resource.removeConfirm'),
      tone: 'danger',
    })
    if (!ok) return
    const snapshot = library.assets
    library.setAssets((current) => current.filter((item) => item.id !== asset.id))
    onToast({
      text: t('resource.assetRemoved', { name: name(asset) }),
      tone: 'info',
      action: { label: t('common.undo'), onAction: () => library.setAssets(snapshot) },
    })
  }

  const removeSaved = async (composition: SavedComposition) => {
    const ok = await confirm({
      title: t('resource.removeCompositionTitle'),
      body: t('resource.removeCompositionBody', { name: composition.name }),
      confirmLabel: t('resource.removeConfirm'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await library.removeComposition(composition.id)
      onToast({
        text: t('resource.compositionRemoved', { name: composition.name }),
        tone: 'info',
        action: { label: t('common.undo'), onAction: () => { void library.addComposition(composition) } },
      })
    } catch { onToast({ text: t('resource.saveError'), tone: 'warning' }) }
  }

  const commitRename = () => {
    if (!renaming) return
    const next = renaming.value.trim().slice(0, 80)
    const asset = library.assets.find((item) => item.id === renaming.id)
    const composition = library.compositions.find((item) => item.id === renaming.id)
    if (next && asset) onRenameAsset(asset, next)
    else if (next && composition) {
      void library.addComposition({ ...composition, name: next })
        .then(() => onToast({ text: t('resource.renamed', { name: next }), tone: 'success' }))
        .catch(() => onToast({ text: t('resource.saveError'), tone: 'warning' }))
    }
    setRenaming(null)
  }

  const renameRow = (id: string, current: string, ariaLabel: string) => renaming?.id === id ? (
    <span className="rename-field">
      <input
        className="rename-field__input"
        value={renaming.value}
        autoFocus
        maxLength={80}
        aria-label={ariaLabel}
        onChange={(event) => setRenaming({ id, value: event.currentTarget.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitRename() }
          if (event.key === 'Escape') { event.preventDefault(); setRenaming(null) }
        }}
      />
      <button type="button" className="rename-field__save" onClick={commitRename}>{t('resource.renameSave')}</button>
    </span>
  ) : (
    <span className="asset-tile__name" title={current}>{current}</span>
  )

  const sectionHead = (label: string, count: number, key: 'assets' | 'saved', hint?: string) => (
    <div className="asset-library-head">
      <button type="button" className="section-toggle" aria-expanded={!collapsed[key]} onClick={() => setCollapsed((current) => ({ ...current, [key]: !current[key] }))}>
        <ChevronDown size={16} className={collapsed[key] ? 'is-collapsed' : ''} aria-hidden="true" />
        <h3>{label}</h3>
      </button>
      <p>{hint ?? t('resource.matchCount', { count })}</p>
    </div>
  )

  return <section ref={panel} className="studio-pane studio-pane--import" role="tabpanel">
    <div className="panel-heading"><div><h2>{t('stitch.addContent')}</h2><p>{t('upload.private')}</p></div></div>
    <div className="import-actions">
      <UploadDropzone compact multiple onFiles={onFiles} label={t('stitch.addPhotos')} />
      <button type="button" className="secondary-button compact-action" onClick={onText}><Type size={17} />{t('stitch.textCard')}</button>
    </div>

    <div className="resource-toolbar">
      <label className="search-field">
        <Search size={15} aria-hidden="true" />
        <span className="visually-hidden">{t('resource.searchLabel')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('resource.searchPlaceholder')}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        {query && <button type="button" className="search-field__clear" aria-label={t('resource.searchClear')} onClick={() => setQuery('')}>{t('common.clear')}</button>}
      </label>
      <div className="resource-filters">
        <div className="segmented resource-kind" role="group" aria-label={t('resource.filterLabel')}>
          {([['all', 'resource.filterAll'], ['photo', 'resource.filterPhoto'], ['text', 'resource.filterText'], ['collage', 'resource.filterCollage']] as const).map(([value, label]) => (
            <button key={value} type="button" className={kind === value ? 'is-active' : ''} aria-pressed={kind === value} onClick={() => setKind(value)}>{t(label)}</button>
          ))}
        </div>
        <div className="segmented resource-columns" role="group" aria-label={t('resource.columnsLabel')}>
          {COLUMN_OPTIONS.map((value) => (
            <button key={value} type="button" className={columns === value ? 'is-active' : ''} aria-pressed={columns === value} aria-label={t('resource.columnsValue', { count: value })} onClick={() => setColumns(value)}>
              <LayoutGrid size={value === 2 ? 14 : value === 3 ? 15 : 16} />
            </button>
          ))}
        </div>
      </div>
      {normalized && <p className="resource-toolbar__count">{t('resource.matchCount', { count: filtered })}</p>}
    </div>

    {sectionHead(t('stitch.assetLibrary'), visibleAssets.length, 'assets')}
    {!collapsed.assets && (
      visibleAssets.length ? <div className="asset-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{visibleAssets.map((asset) => <div key={asset.id}
        className={`asset-tile ${selectedSourceId === asset.id ? 'is-selected' : ''} ${asset.type === 'text' ? 'asset-tile--text' : ''}`}>
        <button type="button" className="asset-tile__add" aria-label={t('stitch.addAsset', { name: name(asset) })} onClick={() => onAdd(asset)}>
          <span className="asset-tile__preview">{asset.type === 'photo' ? <><BlobImage blob={asset.blob} />
            {asset.overlay && <span className="asset-tile__annotation" title={`${t('stitch.photoText')}: ${asset.overlay.text}`}><Type size={12} /><span>{asset.overlay.text || t('stitch.blankText')}</span></span>}
          </> : <><Type size={21} /><em>{name(asset)}</em></>}</span>
          <span className="asset-tile__add-label"><Plus size={13} />{t('stitch.addToCanvas')}</span>
        </button>
        <div className="asset-tile__caption">
          {renameRow(asset.id, name(asset), t('resource.renameAssetLabel', { name: name(asset) }))}
          <span className="asset-tile__tools">
            {asset.type === 'photo' && <button type="button" aria-label={t('resource.renameAsset', { name: name(asset) })} title={t('resource.rename')} onClick={() => setRenaming({ id: asset.id, value: asset.name })}><Pencil size={14} /></button>}
            <button type="button" aria-label={t('resource.viewAsset', { name: name(asset) })} title={t('resource.view')} onClick={() => setPreview(asset)}><Eye size={14} /></button>
          </span>
        </div>
        {exportButtons(asset)}
        <button type="button" className="asset-tile__remove" aria-label={t('stitch.removeImportedAsset', { name: name(asset) })} onClick={() => void removeAsset(asset)}><Trash2 size={14} /></button>
      </div>)}</div> : <div className="mini-empty"><ImageIcon size={26} /><p>{normalized ? t('resource.noMatch') : t('stitch.assetLibraryEmpty')}</p></div>
    )}
    <p className="asset-library-hint">{t('stitch.assetLibraryHint')}</p>

    {sectionHead(t('resource.savedHeading'), visibleSaved.length, 'saved', t('resource.savedHint'))}
    {!collapsed.saved && (
      visibleSaved.length ? <div className="composition-list">{visibleSaved.map((composition) => <article key={composition.id} className="composition-card" data-composition-id={composition.id}>
        <button type="button" className="composition-card__preview" onClick={() => setPreview(composition)} aria-label={t('resource.viewNamed', { name: composition.name })}><BlobImage blob={composition.thumbnail} /></button>
        <div className="composition-card__body">
          <div className="composition-card__title">
            {renameRow(composition.id, composition.name, t('resource.renameCompositionLabel', { name: composition.name }))}
            <button type="button" className="icon-button icon-button--tiny" aria-label={t('resource.renameComposition', { name: composition.name })} title={t('resource.rename')} onClick={() => setRenaming({ id: composition.id, value: composition.name })}><Pencil size={13} /></button>
          </div>
          <p>{t(composition.kind === 'cover' ? 'resource.coverKind' : 'resource.collageKind')} · {composition.width} × {Math.round(composition.height)}</p>
          <div className="composition-card__actions">
            <button type="button" onClick={() => setPreview(composition)}>{t('resource.view')}</button>
            {composition.kind === 'collage' && <button type="button" onClick={() => onOpen(composition)}>{t('resource.edit')}</button>}
            <button type="button" onClick={() => onCover(composition.id)}>{t(composition.kind === 'cover' ? 'resource.adjustCover' : 'resource.makeCover')}</button>
          </div>{exportButtons(composition)}
        </div>
        <button type="button" className="composition-card__remove icon-button" aria-label={t('resource.removeNamed', { name: composition.name })} onClick={() => void removeSaved(composition)}><Trash2 size={14} /></button>
      </article>)}</div> : <div className="mini-empty"><ImageIcon size={26} /><p>{normalized ? t('resource.noMatch') : t('resource.savedEmpty')}</p></div>
    )}
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
