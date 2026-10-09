import { Download, Eye, Frame, Image as ImageIcon, LayoutGrid, Pencil, Plus, Search, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ComposerBlock, ImportedAsset, SavedComposition } from '../types'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import type { ToastMessage } from './StatusToast'
import type { ConfirmOptions } from './ConfirmDialog'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useI18n, type MessageKey } from '../i18n'
import { UploadDropzone } from './UploadDropzone'
import { StitchPreview } from './StitchPreview'
import { FieldGroup } from './Fields'
import { createTextMeasurer } from '../lib/stitchLayout'
import { compositionLayout, exportResource, resourceFileName } from '../lib/resourceExport'
import { downloadBlob } from '../lib/canvas'
import { DEFAULT_SETTINGS } from '../lib/defaults'
import { readResourceView, rememberResourceView, RESOURCE_COLUMNS, RESOURCE_KINDS, type ResourceKind } from '../lib/preferences'

function BlobImage({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob)
  return url ? <img src={url} alt="" /> : <ImageIcon size={21} />
}

type Resource = ImportedAsset | SavedComposition

/** Saved compositions carry their own name; text cards are named by their text. */
function resourceName(resource: Resource, blankText: string): string {
  if ('blocks' in resource) return resource.name
  return resource.type === 'photo' ? resource.name : resource.text || blankText
}

function resourceKindLabel(resource: Resource, t: (key: MessageKey) => string): string {
  if ('blocks' in resource) return t(resource.kind === 'cover' ? 'resource.coverKind' : 'resource.collageKind')
  return t(resource.type === 'photo' ? 'resource.photoKind' : 'resource.textKind')
}

/** Every piece of text the resource actually renders, for the detail card. */
function resourceText(resource: Resource): string {
  if ('blocks' in resource) {
    return resource.blocks.flatMap((block) => {
      if (block.type === 'text') return [block.text]
      if (block.type === 'photo') return block.overlay?.text ? [block.overlay.text] : []
      return block.photos.flatMap((photo) => photo.overlay?.text ? [photo.overlay.text] : [])
    }).filter(Boolean).join(' / ')
  }
  if (resource.type === 'text') return resource.text
  return resource.overlay?.text ?? ''
}

const COLUMN_ICON = { 2: 14, 3: 15, 4: 16 } as const

const KIND_LABELS: Record<ResourceKind, MessageKey> = {
  all: 'resource.filterAll',
  photo: 'resource.filterPhoto',
  text: 'resource.filterText',
  collage: 'resource.filterCollage',
}

interface ResourcePanelProps {
  library: ResourceLibrary
  selectedSourceId: string | null
  onFiles: (files: File[]) => Promise<void>
  onText: () => void
  onAdd: (asset: ImportedAsset) => void
  onSelectAsset: (asset: ImportedAsset) => void
  onOpen: (composition: SavedComposition) => void
  onCover: (id: string) => void
  onRenameAsset: (asset: ImportedAsset, name: string) => void
  onToast: (message: ToastMessage) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export function ResourcePanel({
  library, selectedSourceId, onFiles, onText, onAdd, onSelectAsset, onOpen, onCover, onRenameAsset, onToast, confirm,
}: ResourcePanelProps) {
  const { t, locale } = useI18n()
  const [busy, setBusy] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // The panel unmounts whenever another tab is opened, so the view mode is restored from storage.
  const [view, setView] = useState(() => ({ kind: 'all' as ResourceKind, columns: 3, ...readResourceView() }))
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => { rememberResourceView(view) }, [view])

  useEffect(() => {
    if (!library.lastSavedId) return
    const card = [...(panel.current?.querySelectorAll<HTMLElement>('[data-composition-id]') ?? [])].find((item) => item.dataset.compositionId === library.lastSavedId)
    card?.scrollIntoView({ block: 'center' })
    if (card) library.clearSavedFocus()
  }, [library.lastSavedId, library.clearSavedFocus])

  const name = (resource: Resource) => resourceName(resource, t('stitch.blankText'))
  // Derived from the library so renaming or editing keeps the open card in sync; a deleted
  // resource closes the card by itself.
  const detail = useMemo(
    () => detailId ? library.assets.find((asset) => asset.id === detailId) ?? library.compositions.find((composition) => composition.id === detailId) ?? null : null,
    [detailId, library.assets, library.compositions],
  )
  const normalized = query.trim().toLocaleLowerCase()
  const matches = (text: string) => !normalized || text.toLocaleLowerCase().includes(normalized)
  // Text content is searchable too, so a card can be found by what it says.
  const visibleAssets = useMemo(
    () => library.assets.filter((asset) => {
      const kind = asset.type === 'photo' ? 'photo' : 'text'
      return (view.kind === 'all' || view.kind === kind) && (matches(resourceName(asset, '')) || matches(asset.type === 'photo' ? asset.overlay?.text ?? '' : asset.text))
    }),
    // `matches` closes over the normalized query only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library.assets, view.kind, normalized],
  )
  const visibleSaved = useMemo(
    () => view.kind === 'all' || view.kind === 'collage'
      ? library.compositions.filter((composition) => matches(composition.name) || matches(resourceText(composition)))
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [library.compositions, view.kind, normalized],
  )
  const items: Resource[] = [...visibleAssets, ...visibleSaved]
  const filtered = items.length
  const searching = !!normalized || view.kind !== 'all'

  const download = async (resource: Resource, format: 'image/png' | 'image/jpeg') => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, report } = await exportResource(resource, format)
      downloadBlob(blob, resourceFileName(resourceName(resource, ''), format))
      onToast({ text: t(report.reduced ? 'stitch.downloadReduced' : 'resource.exported', { width: report.width, height: report.height }), tone: report.reduced ? 'warning' : 'success' })
    } catch { onToast({ text: t('resource.exportError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }

  const exportRow = (resource: Resource) => <div className="resource-export-actions">
    {(['image/png', 'image/jpeg'] as const).map((format) => <button key={format} type="button" disabled={busy}
      aria-label={t('resource.exportAs', { format: format === 'image/png' ? 'PNG' : 'JPG', name: name(resource) })}
      onClick={() => void download(resource, format)}><Download size={14} />{format === 'image/png' ? 'PNG' : 'JPG'}</button>)}
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

  /** Renaming lives in the detail card, so the tile stays a plain name plus a view button. */
  const nameRow = (resource: Resource) => {
    const current = name(resource)
    if (renaming?.id !== resource.id) return <span className="resource-detail__name" title={current}>{current}</span>
    return <span className="rename-field">
      <input
        className="rename-field__input"
        value={renaming.value}
        autoFocus
        maxLength={80}
        aria-label={t('resource.renameAssetLabel', { name: current })}
        onChange={(event) => setRenaming({ id: resource.id, value: event.currentTarget.value })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); commitRename() }
          if (event.key === 'Escape') { event.preventDefault(); setRenaming(null) }
        }}
      />
      <button type="button" className="rename-field__save" onClick={commitRename}>{t('resource.renameSave')}</button>
    </span>
  }

  const thumbnail = (resource: Resource) => {
    if ('blocks' in resource) return <BlobImage blob={resource.thumbnail} />
    if (resource.type === 'photo') return <BlobImage blob={resource.blob} />
    // The text itself sits under the thumbnail, so the tile only needs the card glyph.
    return <Type size={24} />
  }

  /**
   * One primary action per resource: put it on the canvas, keep working on a collage, or go
   * straight to the cover of an existing cover composition. Collages keep the cover action
   * as a secondary, so nothing that used to be reachable is lost.
   */
  const actions = (resource: Resource) => {
    if (!('blocks' in resource)) {
      return { primary: { label: t('stitch.addToCanvas'), run: () => onAdd(resource) }, cover: null }
    }
    if (resource.kind === 'collage') {
      return {
        primary: { label: t('resource.edit'), run: () => onOpen(resource) },
        cover: { label: t('resource.makeCover'), run: () => onCover(resource.id) },
      }
    }
    return { primary: { label: t('resource.adjustCover'), run: () => onCover(resource.id) }, cover: null }
  }

  /** Compositions have no layer to adjust, so a click there opens the card instead. */
  const openResource = (resource: Resource) => {
    if ('blocks' in resource) setDetailId(resource.id)
    else onSelectAsset(resource)
  }

  const removeFrom = (resource: Resource) => {
    setDetailId(null)
    if ('blocks' in resource) void removeSaved(resource)
    else void removeAsset(resource)
  }

  const renameTrigger = (resource: Resource) => <button
    type="button"
    className="icon-button icon-button--tiny"
    aria-label={t('resource.renameAsset', { name: name(resource) })}
    title={t('resource.rename')}
    onClick={() => setRenaming({ id: resource.id, value: name(resource) })}
  ><Pencil size={13} /></button>

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
          {RESOURCE_KINDS.map((value) => (
            <button key={value} type="button" className={view.kind === value ? 'is-active' : ''} aria-pressed={view.kind === value}
              onClick={() => setView((current) => ({ ...current, kind: value }))}>{t(KIND_LABELS[value])}</button>
          ))}
        </div>
        <div className="segmented resource-columns" role="group" aria-label={t('resource.columnsLabel')}>
          {RESOURCE_COLUMNS.map((value) => (
            <button key={value} type="button" className={view.columns === value ? 'is-active' : ''} aria-pressed={view.columns === value}
              aria-label={t('resource.columnsValue', { count: value })}
              onClick={() => setView((current) => ({ ...current, columns: value }))}><LayoutGrid size={COLUMN_ICON[value as keyof typeof COLUMN_ICON]} /></button>
          ))}
        </div>
      </div>
      <p className="resource-toolbar__count">{t('resource.matchCount', { count: filtered })}</p>
    </div>

    {items.length ? (
      <div className="asset-grid" style={{ gridTemplateColumns: `repeat(${view.columns}, minmax(0, 1fr))` }}>
        {items.map((resource) => {
          const isComposition = 'blocks' in resource
          const isText = !('blocks' in resource) && resource.type === 'text'
          const text = resourceText(resource)
          const primary = actions(resource).primary
          return <div
            key={resource.id}
            className={`resource-tile ${isText ? 'resource-tile--text' : ''} ${isComposition ? 'resource-tile--collage' : ''} ${!isComposition && selectedSourceId === resource.id ? 'is-selected' : ''}`}
            data-composition-id={isComposition ? resource.id : undefined}
          >
            <button type="button" className="resource-tile__open" aria-label={t('resource.selectForAdjust', { name: name(resource) })} title={name(resource)} onClick={() => openResource(resource)}>
              <span className="resource-tile__thumb">{thumbnail(resource)}</span>
            </button>
            <span className="resource-tile__caption">
              <button type="button" className="resource-tile__add" onClick={primary.run}><Plus size={13} />{primary.label}</button>
              <button type="button" className="resource-tile__eye" aria-label={t('resource.viewDetails', { name: name(resource) })} title={t('resource.view')} onClick={() => setDetailId(resource.id)}><Eye size={14} /></button>
            </span>
            {text && <p className="resource-tile__text" title={text}>{text}</p>}
          </div>
        })}
      </div>
    ) : <div className="mini-empty"><ImageIcon size={26} /><p>{searching ? t('resource.noMatch') : t('stitch.assetLibraryEmpty')}</p></div>}
    <p className="asset-library-hint">{t('stitch.assetLibraryHint')}</p>

    {detail && <ResourceDetail
      resource={detail}
      busy={busy}
      locale={locale}
      primaryLabel={actions(detail).primary.label}
      onPrimary={() => { const resource = detail; setDetailId(null); actions(resource).primary.run() }}
      coverLabel={actions(detail).cover?.label}
      onCoverAction={() => { const resource = detail; setDetailId(null); actions(resource).cover?.run() }}
      onClose={() => setDetailId(null)}
      onRemove={() => removeFrom(detail)}
      onRename={() => setRenaming({ id: detail.id, value: name(detail) })}
      nameRow={nameRow(detail)}
      renameTrigger={renameTrigger(detail)}
      exports={exportRow(detail)}
    />}
  </section>
}

interface ResourceDetailProps {
  resource: Resource
  busy: boolean
  locale: string
  primaryLabel: string
  onPrimary: () => void
  coverLabel?: string
  onCoverAction: () => void
  onClose: () => void
  onRemove: () => void
  onRename: () => void
  nameRow: ReactNode
  renameTrigger: ReactNode
  exports: ReactNode
}

/**
 * The detail card is the only place that shows the full picture: a large structured preview,
 * the text the resource actually renders, its metadata and every action that used to be
 * crammed into the grid tile.
 */
function ResourceDetail({ resource, busy, locale, primaryLabel, onPrimary, coverLabel, onCoverAction, onClose, onRemove, onRename, nameRow, renameTrigger, exports }: ResourceDetailProps) {
  const { t } = useI18n()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dialog = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const measure = useMemo(() => createTextMeasurer(), [])

  const composition = useMemo(() => 'blocks' in resource ? resource : {
    name: resourceName(resource, ''),
    blocks: [resource] as ComposerBlock[],
    settings: { ...DEFAULT_SETTINGS, width: resource.type === 'photo' ? resource.width : DEFAULT_SETTINGS.width },
    cover: undefined,
  }, [resource])
  const layout = useMemo(() => compositionLayout(composition, measure), [composition, measure])
  const text = resourceText(resource)
  const kindLabel = resourceKindLabel(resource, t)
  const size = `${layout.width} × ${Math.round(layout.height)}`
  const textLabel: MessageKey = !('blocks' in resource) && resource.type === 'photo' ? 'resource.overlayLabel' : 'resource.textLabel'

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    close.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true }) }
  }, [])

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} className="resource-detail" role="dialog" aria-modal="true" aria-labelledby="resource-detail-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); if (focusedId) { setFocusedId(null); close.current?.focus() } else onClose() }
      if (event.key !== 'Tab') return
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') ?? [])].filter((element) => element.offsetParent !== null)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <header>
        <div>
          <h2 id="resource-detail-title">{resourceName(resource, t('stitch.blankText'))}</h2>
          <p><span className="resource-detail__badge">{kindLabel}</span>{size}</p>
        </div>
        <button ref={close} type="button" className="secondary-button" onClick={onClose}>{t('common.close')}</button>
      </header>

      <div className="resource-detail__body">
        <div className="resource-detail__stage">
          <StitchPreview layout={layout} background={composition.cover?.background ?? composition.settings.background} measure={measure} selectedId={selectedId} focusedId={focusedId} onSelect={(id, focus) => { setSelectedId(id); setFocusedId(focus) }} onFocus={(id) => { setFocusedId(id); if (!id) close.current?.focus() }} />
        </div>

        <aside className="resource-detail__side">
          <FieldGroup title={t('resource.metaHeading')}>
            <dl className="resource-meta">
              <div><dt>{t('resource.nameLabel')}</dt><dd>{nameRow}{renameTrigger}</dd></div>
              <div><dt>{t('resource.typeLabel')}</dt><dd>{kindLabel}</dd></div>
              <div><dt>{t('resource.sizeLabel')}</dt><dd>{size}</dd></div>
              {text && <div><dt>{t(textLabel)}</dt><dd className="resource-meta__text">{text}</dd></div>}
              {'blocks' in resource && <div><dt>{t('resource.layersLabel')}</dt><dd>{t('resource.layerCount', { count: resource.blocks.length })}</dd></div>}
              {'blocks' in resource && <div><dt>{t('resource.createdLabel')}</dt><dd>{new Date(resource.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</dd></div>}
            </dl>
          </FieldGroup>

          <FieldGroup title={t('resource.actionsHeading')}>
            <div className="resource-detail__actions">
              <button type="button" className="primary-button" onClick={onPrimary}><Plus size={16} />{primaryLabel}</button>
              <div className="resource-detail__actions-row">
                <button type="button" className="secondary-button" onClick={onRename}><Pencil size={15} />{t('resource.rename')}</button>
                {coverLabel && <button type="button" className="secondary-button" onClick={onCoverAction}><Frame size={15} />{coverLabel}</button>}
                <button type="button" className="secondary-button secondary-button--danger" onClick={onRemove} disabled={busy}><Trash2 size={15} />{t('resource.removeConfirm')}</button>
              </div>
            </div>
          </FieldGroup>

          <FieldGroup title={t('resource.exportHeading')}>{exports}</FieldGroup>
        </aside>
      </div>
    </section>
  </div>
}
