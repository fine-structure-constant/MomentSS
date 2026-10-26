import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { featureManifest, PLUGIN_IDS, PLUGIN_CACHE, pluginSnapshot, subscribePlugins, type FeatureManifest } from '../lib/featurePlugins'
import { useI18n } from '../i18n'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'

type AppManifest = FeatureManifest
export function OfflinePanel({ library }: { library: ResourceLibrary }) {
  const { t } = useI18n(), [open, setOpen] = useState(false), [online, setOnline] = useState(navigator.onLine)
  const [manifest, setManifest] = useState<AppManifest | null>(null), [ready, setReady] = useState(false), [update, setUpdate] = useState(false), [error, setError] = useState(false)
  const [progress, setProgress] = useState<number | null>(null), registration = useRef<ServiceWorkerRegistration | null>(null)
  const states = useSyncExternalStore(subscribePlugins, pluginSnapshot)
  const selectedFiles = (data: AppManifest) => [...new Set([...data.core, ...PLUGIN_IDS.filter((id) => states[id].enabled).flatMap((id) => data.plugins[id].files)])]
  const selected = manifest ? selectedFiles(manifest) : []
  const scope = PLUGIN_IDS.filter((id) => states[id].enabled).join(',')
  const latestScope = useRef(scope); latestScope.current = scope
  useEffect(() => { setReady(false) }, [scope])
  const supported = 'serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD
  useEffect(() => {
    const status = () => setOnline(navigator.onLine)
    window.addEventListener('online', status); window.addEventListener('offline', status)
    if (supported) void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(async (value) => {
      registration.current = value
      setUpdate(!!value.waiting)
      value.addEventListener('updatefound', () => { const worker = value.installing; worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdate(true) }) })
      const data = await featureManifest()
      setManifest(data)
      const cache = await caches.open('momentss-' + data.build)
      if (await cache.match('/__offline_ready__')) {
        const plugins = await caches.open(PLUGIN_CACHE)
        const matches = await Promise.all(selectedFiles(data).map(async (url) => await cache.match(url) || await plugins.match(url)))
        setReady(matches.every(Boolean))
      }
    }).catch(() => setError(true))
    return () => { window.removeEventListener('online', status); window.removeEventListener('offline', status) }
  }, [])
  const prepare = async () => {
    if (!manifest || progress !== null) return
    setProgress(0); setError(false)
    try {
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('offline-worker-timeout')), 45000))])
      await navigator.storage?.persist()
      const cache = await caches.open('momentss-' + manifest.build)
      const pluginCache = await caches.open(PLUGIN_CACHE)
      const optional = new Set(Object.values(manifest.plugins).flatMap((pack) => pack.files))
      let current = 0, next = 0
      const worker = async () => {
        while (next < selected.length) {
          const url = selected[next++]
          const target = optional.has(url) ? pluginCache : cache
          if (!await target.match(url)) {
            const response = await fetch(url, { cache: 'reload', signal: AbortSignal.timeout(45000) })
            if (!response.ok || url !== '/' && response.headers.get('Content-Type')?.includes('text/html')) throw new Error('offline-resource-missing')
            await target.put(url, response)
          }
          setProgress(++current)
        }
      }
      await Promise.all([worker(), worker()])
      await cache.put('/__offline_ready__', new Response(manifest.build)); setReady(latestScope.current === scope)
    } catch { setError(true); setReady(false) } finally { setProgress(null) }
  }
  const refresh = async () => {
    try {
      await library.flushWorkspace()
      const waiting = registration.current?.waiting
      if (waiting) { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true }); waiting.postMessage('ACTIVATE') }
      else location.reload()
    } catch { setError(true) }
  }
  return <div className="offline-control"><button className="text-button" aria-expanded={open} onClick={() => setOpen(!open)}>{t('offline.open')}</button>{open && <section className="offline-panel" aria-label={t('offline.open')}><p>{t(online ? 'offline.online' : 'offline.offline')}</p>{manifest && <p>{t('offline.version', { version: manifest.version.slice(0, 8) })}</p>}<p role="status">{!supported ? t('offline.unsupported') : error ? t('offline.error') : progress !== null ? t('offline.progress', { current: progress, total: selected.length }) : t(ready ? 'offline.ready' : 'offline.partial')}</p>{supported && <button className="secondary-button" disabled={!manifest || progress !== null || !online} onClick={() => void prepare()}>{t('offline.prepare')}</button>}{update && <><p>{t('offline.update')}</p><button className="primary-button" onClick={() => void refresh()}>{t('offline.reload')}</button></>}<p className="section-copy">{t('plugins.scope')}</p><p className="section-copy"><a href="/emoji/sources.json" target="_blank" rel="noreferrer">Twemoji · CC BY 4.0 / Fluent · MIT</a></p></section>}</div>
}
