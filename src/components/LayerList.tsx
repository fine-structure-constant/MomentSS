import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, CopyPlus, FoldVertical, GripVertical, MoreHorizontal, Plus, Trash2, Type } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { copyLayerStyle, pasteLayerStyle, type LayerStyle } from '../lib/layerStyles'
import type { ComposerBlock, ImportedAsset, PhotoBlock } from '../types'
import { findComposerAsset } from '../lib/composer'
import { useI18n } from '../i18n'
import { LazyBlobImage } from './LazyBlobImage'

interface Props {
  blocks: ComposerBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onInspect: (id: string) => void
  onChange: (blocks: ComposerBlock[]) => void
  onInsert: (index: number) => void
  onRemove: (id: string) => void
  onPair: (id: string) => void
  onStyleApply: (asset: ImportedAsset) => void
}
function Thumbnail({ photo }: { photo: PhotoBlock }) { return <LazyBlobImage blob={photo.thumbnail ?? photo.blob} /> }

export function LayerList(props: Props) {
  const { t } = useI18n()
  const list = useRef<HTMLOListElement>(null)
  const previous = useRef(new Map<string, DOMRect>())
  const [dragging, setDragging] = useState(false)
  const [overId, setOverId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [multi, setMulti] = useState(false), [checked, setChecked] = useState<string[]>([]), [copied, setCopied] = useState<LayerStyle | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const order = props.blocks.map((block) => block.id).join(',')
  const selectedAsset = findComposerAsset(props.blocks, props.selectedId)
  const paste = () => {
    if (!copied || !selectedAsset) return
    const updated = pasteLayerStyle(selectedAsset, copied) as ImportedAsset
    props.onStyleApply(updated)
    props.onChange(props.blocks.map((block) => block.type === 'photo-row' ? { ...block, photos: block.photos.map((photo) => photo.id === updated.id ? updated as PhotoBlock : photo) } : block.id === updated.id ? updated : block))
  }
  useLayoutEffect(() => {
    const nodes = list.current?.querySelectorAll<HTMLElement>('[data-layer-id]') ?? []
    const next = new Map<string, DOMRect>()
    for (const node of nodes) {
      const id = node.dataset.layerId!, rect = node.getBoundingClientRect()
      next.set(id, rect)
      const old = previous.current.get(id)
      if (!dragging && old && Math.abs(old.top - rect.top) > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        node.animate([{ transform: `translateY(${old.top - rect.top}px)` }, { transform: 'translateY(0)' }], { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })
      }
    }
    previous.current = next
  }, [order, dragging])
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false)
    if (!over || active.id === over.id) return
    const from = props.blocks.findIndex((block) => block.id === active.id), to = props.blocks.findIndex((block) => block.id === over.id)
    if (from < 0 || to < 0) return
    props.onChange(arrayMove(props.blocks, from, to))
    setAnnouncement(t('layer.moved', { from: from + 1, to: to + 1 }))
  }
  return <div className="layer-list" data-over-id={overId ?? undefined}>
    <button type="button" className="text-button" aria-pressed={multi} onClick={() => { setMulti(!multi); setChecked([]) }}>{t('layers.multi')}</button>
    {multi && <div className="layer-multi"><fieldset>{props.blocks.filter((block) => block.type === 'photo').map((block) => <label key={block.id}><input type="checkbox" checked={checked.includes(block.id)} onChange={(event) => { const checked = event.currentTarget.checked; setChecked((current) => checked ? [...current, block.id] : current.filter((id) => id !== block.id)) }} />{block.name}</label>)}</fieldset><button className="secondary-button" disabled={checked.length < 2 || checked.length > 4} onClick={() => {
      const photos = props.blocks.filter((block): block is PhotoBlock => block.type === 'photo' && checked.includes(block.id))
      if (photos.length < 2 || photos.length > 4) return
      const id = crypto.randomUUID(), index = props.blocks.findIndex((block) => block.id === photos[0].id)
      props.onChange(props.blocks.flatMap((block, i): ComposerBlock[] => i === index ? [{ id, type: 'photo-row', photos, heightRatio: 40, gap: 0 }] : checked.includes(block.id) ? [] : [block]))
      props.onSelect(id); setChecked([]); setMulti(false)
    }}>{t('layers.combine')}</button></div>}
    <div className="layer-style-actions"><button className="text-button" disabled={!selectedAsset} onClick={() => { if (selectedAsset) { setCopied(copyLayerStyle(selectedAsset)); setAnnouncement(t('style.copied')) } }}>{t('style.copy')}</button><button className="text-button" disabled={!copied || !selectedAsset || copied.kind !== selectedAsset.type} onClick={paste}>{t('style.paste')}</button></div>
    <button type="button" className="secondary-button layer-insert" onClick={() => {
      const index = props.blocks.findIndex((block) => block.id === props.selectedId || block.type === 'photo-row' && block.photos.some((photo) => photo.id === props.selectedId))
      props.onInsert(index < 0 ? props.blocks.length : index + 1)
    }}><Plus size={16} />{t('layer.insertAfter')}</button>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setDragging(true)} onDragOver={({ over }) => setOverId(over ? String(over.id) : null)} onDragCancel={() => { setDragging(false); setOverId(null) }} onDragEnd={(event) => { onDragEnd(event); setOverId(null) }}
      accessibility={{ screenReaderInstructions: { draggable: t('layer.dragHint') }, announcements: { onDragStart: () => t('layer.dragHint'), onDragOver: () => undefined, onDragEnd: () => undefined, onDragCancel: () => t('common.cancel') } }}>
      <SortableContext items={props.blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <ol ref={list} className="layer-list__items">{props.blocks.map((block, index) => <LayerRow key={block.id} {...props} block={block} index={index} />)}</ol>
      </SortableContext>
    </DndContext>
    <span className="visually-hidden" role="status">{announcement}</span>
  </div>
}

function LayerRow({ block, index, ...props }: Props & { block: ComposerBlock; index: number }) {
  const { t } = useI18n()
  const [menu, setMenu] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const selected = block.id === props.selectedId || block.type === 'photo-row' && block.photos.some((photo) => photo.id === props.selectedId)
  const label = ('displayName' in block && block.displayName) || (block.type === 'photo' ? block.name : block.type === 'text' ? block.text || t('stitch.blankText') : t('stitch.photoRow'))
  const move = (direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= props.blocks.length) return
    props.onChange(arrayMove(props.blocks, index, target))
  }
  const edge = (to: number) => { props.onChange(arrayMove(props.blocks, index, to)); setMenu(false) }
  const copy = () => {
    const duplicate = structuredClone(block)
    duplicate.id = crypto.randomUUID()
    if (duplicate.type === 'photo-row') duplicate.photos = duplicate.photos.map((photo) => ({ ...photo, id: crypto.randomUUID() })) as typeof duplicate.photos
    const next = [...props.blocks]; next.splice(index + 1, 0, duplicate); props.onChange(next); props.onSelect(duplicate.id); setMenu(false)
  }
  return <li ref={setNodeRef} data-layer-id={block.id} className={`layer-row ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <div className="layer-row__main">
      <button type="button" className="layer-row__handle" {...attributes} {...listeners} aria-label={t('layer.dragNamed', { number: index + 1 })} onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) event.currentTarget.scrollIntoView({ block: 'center', behavior: 'instant' }) }}><GripVertical size={18} /></button>
      <button type="button" className="layer-row__select" aria-pressed={selected} aria-label={t('stitch.selectLayer', { number: index + 1 })} onClick={() => props.onSelect(block.id)} onDoubleClick={() => props.onInspect(block.id)} onKeyDown={(event) => {
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); move(event.key === 'ArrowUp' ? -1 : 1) }
        if ((event.ctrlKey || event.metaKey) && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); edge(event.key === 'ArrowUp' ? 0 : props.blocks.length - 1) }
      }}>
        <span className={`layer-row__thumb ${block.type === 'photo-row' ? 'is-pair' : ''}`}>{block.type === 'text' ? <Type size={22} /> : block.type === 'photo' ? <Thumbnail photo={block} /> : block.photos.map((photo) => <Thumbnail key={photo.id} photo={photo} />)}</span>
        <span className="layer-row__label"><strong title={label}>{label}</strong><small>{t('stitch.layerNumber', { number: index + 1 })}{block.type === 'photo-row' ? ` · ${t('stitch.photoRow')}` : ''}</small></span>
      </button>
      <button type="button" className="layer-row__more" aria-label={t('layer.more', { number: index + 1 })} aria-expanded={menu} onClick={() => setMenu((value) => !value)}><MoreHorizontal size={19} /></button>
    </div>
    {selected && <div className="layer-row__actions"><button type="button" disabled={index === 0} aria-label={t('stitch.moveUp')} onClick={() => move(-1)}><ArrowUp size={16} />{t('stitch.moveUp')}</button><button type="button" disabled={index === props.blocks.length - 1} aria-label={t('stitch.moveDown')} onClick={() => move(1)}><ArrowDown size={16} />{t('stitch.moveDown')}</button>{block.type === 'photo' && props.blocks[index + 1]?.type === 'photo' && <button type="button" onClick={() => props.onPair(block.id)}><FoldVertical size={16} />{t('stitch.pairDownward')}</button>}</div>}
    {selected && block.type === 'photo-row' && <div className="layer-row__children">{block.photos.map((photo, photoIndex) => <button type="button" key={photo.id} onClick={() => props.onInspect(photo.id)}>{photoIndex + 1}. {photo.displayName || photo.name}</button>)}</div>}
    {menu && <div className="layer-row__menu" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setMenu(false) } }}>
      <button type="button" disabled={index === 0} onClick={() => edge(0)}><ChevronsUp size={16} />{t('stitch.moveTop')}</button>
      <button type="button" disabled={index === props.blocks.length - 1} onClick={() => edge(props.blocks.length - 1)}><ChevronsDown size={16} />{t('stitch.moveBottom')}</button>
      <button type="button" onClick={copy}><CopyPlus size={16} />{t('layer.duplicate')}</button>
      <button type="button" onClick={() => { props.onInsert(index); setMenu(false) }}><Plus size={16} />{t('layer.insertBefore')}</button>
      <button type="button" className="danger-text" onClick={() => props.onRemove(block.id)}><Trash2 size={16} />{t('stitch.removeFromCanvas')}</button>
    </div>}
  </li>
}
