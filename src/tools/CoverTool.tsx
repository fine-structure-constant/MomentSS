import { FolderOpen, Save, SquareDashed } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CoverRecipe, CropState, PhotoBlock } from '../types'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import { DEFAULT_CROP } from '../lib/defaults'
import { buildStitchLayout, createTextMeasurer } from '../lib/stitchLayout'
import { buildCoverLayout, suggestCoverBoundary } from '../lib/coverLayout'
import { createComposition } from '../lib/resourceExport'
import { CropEditor } from '../components/CropEditor'
import { PhotoPlacementPreview, StitchPreview } from '../components/StitchPreview'
import { FieldGroup, RangeField } from '../components/Fields'
import type { ToastMessage } from '../components/StatusToast'
import { useI18n } from '../i18n'

interface CoverToolProps {
  library: ResourceLibrary
  initialCompositionId: string | null
  onResources: () => void
  onToast: (message: ToastMessage) => void
}

export function CoverTool({ library, initialCompositionId, onResources, onToast }: CoverToolProps) {
  const { t } = useI18n()
  const [compositionId, setCompositionId] = useState(initialCompositionId ?? library.compositions[0]?.id ?? '')
  const [photoId, setPhotoId] = useState('')
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP)
  const [insertAt, setInsertAt] = useState(0)
  const [spacing, setSpacing] = useState(0)
  const [background, setBackground] = useState('#ffffff')
  const [busy, setBusy] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const stage = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focusedId) return
    stage.current?.scrollTo({ top: 0 })
    if (window.matchMedia('(max-width: 900px)').matches) stage.current?.scrollIntoView({ block: 'start' })
  }, [focusedId])
  const measure = useMemo(() => createTextMeasurer(), [])
  const photos = library.assets.filter((asset): asset is PhotoBlock => asset.type === 'photo')
  const composition = library.compositions.find((item) => item.id === compositionId)
  const archivedPhotoId = `archived:${compositionId}`
  const photo = photoId === archivedPhotoId ? composition?.cover?.photo : photos.find((item) => item.id === photoId)
  const baseLayout = useMemo(() => composition ? buildStitchLayout(composition.blocks, composition.settings, measure) : null, [composition, measure])

  useEffect(() => {
    if (!composition) return
    setInsertAt(composition.cover?.insertAt ?? (baseLayout ? suggestCoverBoundary(baseLayout) : 0))
    setSpacing(composition.cover?.spacing ?? 0)
    setBackground(composition.cover?.background ?? composition.settings.background)
    setCrop(composition.cover?.crop ?? DEFAULT_CROP)
    setPhotoId(composition.cover ? `archived:${composition.id}` : library.assets.find((asset) => asset.type === 'photo')?.id ?? '')
    setFocusedId(null)
    setSelectedId(null)
    // Reset parameters only when the chosen saved composition changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition])

  const recipe = useMemo<CoverRecipe | null>(() => photo ? { photo, crop, insertAt, spacing, background } : null, [photo, crop, insertAt, spacing, background])
  const result = useMemo(() => composition && recipe ? buildCoverLayout(composition.blocks, composition.settings, recipe, measure) : null, [composition, recipe, measure])
  const coverPlacement = result?.layout.items.find((item) => item.block.id === result.coverId)?.photos[0]
  const choosePhoto = (id: string) => {
    const next = id === archivedPhotoId ? composition?.cover?.photo : photos.find((item) => item.id === id)
    setPhotoId(id)
    setCrop(next ? { zoom: next.cropZoom ?? 1, x: next.cropX ?? 0, y: next.cropY ?? 0 } : DEFAULT_CROP)
  }
  const saveCover = async () => {
    if (!composition || !recipe || busy) return
    setBusy(true)
    try {
      const saved = await createComposition(t('resource.coverName', { number: library.compositions.length + 1 }), composition.blocks, composition.settings, recipe)
      await library.addComposition(saved)
      onToast({ text: t('cover.savedResource'), tone: 'success' })
      onResources()
    } catch { onToast({ text: t('resource.saveError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }

  return <div className="cover-composer">
    <section className="cover-composer__sources">
      <FieldGroup title={t('cover.chooseResources')}>
        <label className="field"><span className="field__label">{t('cover.savedLongImage')}</span><select value={compositionId} onChange={(event) => setCompositionId(event.currentTarget.value)}>
          <option value="">{t('cover.chooseLongImage')}</option>{library.compositions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field"><span className="field__label">{t('cover.coverPhoto')}</span><select value={photoId} onChange={(event) => choosePhoto(event.currentTarget.value)}>
          <option value="">{t('cover.choosePhoto')}</option>
          {composition?.cover && <option value={archivedPhotoId}>{composition.cover.photo.name} · {t('cover.savedPhotoVersion')}</option>}
          {photos.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <button type="button" className="text-button" onClick={onResources}><FolderOpen size={15} />{t('resource.open')}</button>
      </FieldGroup>
    </section>
    <main ref={stage} className="cover-composer__stage">
      <div className="panel-heading"><div><h2>{t('cover.composeTitle')}</h2><p>{t('cover.composeHint')}</p></div>{result && <button type="button" className="secondary-button" onClick={() => { setSelectedId(result.coverId); setFocusedId(result.coverId) }}>{t('cover.inspectCover')}</button>}</div>
      {result ? <StitchPreview layout={result.layout} background={background} measure={measure} selectedId={selectedId} focusedId={focusedId}
        onSelect={(id, focus) => { setSelectedId(id); setFocusedId(focus) }} onFocus={setFocusedId} />
        : <div className="cover-composer__empty"><SquareDashed size={34} /><h2>{t('cover.resourceEmptyTitle')}</h2><p>{t('cover.resourceEmptyBody')}</p><button type="button" className="primary-button" onClick={onResources}><FolderOpen size={17} />{t('resource.open')}</button></div>}
    </main>
    <aside className="cover-composer__settings">
      {composition && <FieldGroup title={t('cover.placement')}>
        <label className="field"><span className="field__label">{t('cover.insertPosition')}</span><select value={insertAt} onChange={(event) => setInsertAt(Number(event.currentTarget.value))}>
          <option value={0}>{t('cover.beforeFirst')}</option>{composition.blocks.map((block, index) => <option key={block.id} value={index + 1}>{t('cover.afterLayer', { number: index + 1 })} · {block.type === 'photo' ? block.name : block.type === 'photo-row' ? t('stitch.photoRow') : block.text.slice(0, 20) || t('stitch.blankText')}</option>)}
        </select></label>
        <RangeField label={t('cover.spacing')} value={spacing} min={0} max={Math.round(composition.settings.width / 2)} suffix="px" onChange={setSpacing} />
        <label className="field color-field"><span className="field__label">{t('cover.blankColor')}</span><input type="color" value={background} onChange={(event) => setBackground(event.currentTarget.value)} /></label>
        {result && <dl className="cover-whitespace"><div><dt>{t('cover.topBlank')}</dt><dd>{Math.round(result.topBlank)} px</dd></div><div><dt>{t('cover.bottomBlank')}</dt><dd>{Math.round(result.bottomBlank)} px</dd></div></dl>}
        <p className="asset-library-hint">{t('cover.autoBalanceHint')}</p>
      </FieldGroup>}
      {photo && <FieldGroup title={t('cover.cropTitle')}><CropEditor source={photo} crop={crop} onChange={setCrop} aspect={1} title={t('cover.cropTitle')} hint={t('cover.cropHint')} /></FieldGroup>}
      {coverPlacement && <FieldGroup title={t('cover.previewTitle')}><PhotoPlacementPreview placement={coverPlacement} measure={measure} /><p className="honest-note">{t('cover.caveat')}</p></FieldGroup>}
      <div className="cover-save-actions"><button type="button" className="primary-button wide-button" disabled={!result || busy} onClick={() => void saveCover()}><Save size={17} />{t(busy ? 'resource.saving' : 'cover.saveResource')}</button><p>{t('cover.exportFromResources')}</p></div>
    </aside>
  </div>
}
