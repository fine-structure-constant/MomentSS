import { Download, Puzzle, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { featureManifest, installPlugin, PLUGIN_IDS, pluginSnapshot, removePluginDownload, setPluginEnabled, subscribePlugins, type FeatureManifest } from '../lib/featurePlugins'

export function PluginPanel() {
  const { t } = useI18n(), [open, setOpen] = useState(false), [manifest, setManifest] = useState<FeatureManifest | null>(null)
  const states = useSyncExternalStore(subscribePlugins, pluginSnapshot), root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    void featureManifest().then(setManifest).catch(() => {})
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return <div className="plugin-control" ref={root} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); event.stopPropagation() } }}>
    <button type="button" className="utility-button" ref={trigger} aria-expanded={open} onClick={() => setOpen(!open)}><Puzzle size={16} />{t('plugins.open')}</button>
    {open && <section className="plugin-panel" aria-label={t('plugins.open')}><div className="panel-heading"><strong>{t('plugins.open')}</strong><button className="icon-button" aria-label={t('common.close')} onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={16} /></button></div><p className="section-copy">{t('plugins.hint')}</p><ul>{PLUGIN_IDS.map((id) => {
      const state = states[id], pack = manifest?.plugins[id]
      return <li key={id}><div><strong>{t(`plugins.${id}`)}</strong><span className="plugin-size">{pack?.bytes ? `${(pack.bytes / 1048576).toFixed(1)} MB` : '—'}</span><p role="status">{state.phase === 'loading' ? `${t('editor.loading')} ${state.total ? `${state.completed}/${state.total}` : ''}` : t(state.phase === 'error' ? 'plugins.error' : state.phase === 'ready' ? 'plugins.ready' : state.enabled ? 'plugins.enabled' : 'plugins.disable')}</p></div><div className="plugin-actions"><button className="secondary-button" disabled={state.phase === 'loading'} onClick={() => { void installPlugin(id).catch(() => {}) }}><Download size={14} />{t('plugins.enable')}</button>{state.enabled && <button className="text-button" disabled={state.phase === 'loading'} onClick={() => setPluginEnabled(id, false)}>{t('plugins.disable')}</button>}<button className="icon-button" aria-label={`${t('plugins.remove')} · ${t(`plugins.${id}`)}`} disabled={state.phase === 'loading'} onClick={() => void removePluginDownload(id).catch(() => {})}><Trash2 size={14} /></button></div></li>
    })}</ul></section>}
  </div>
}
