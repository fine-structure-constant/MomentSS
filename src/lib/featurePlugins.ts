import emojiAssets from './emojiAssets.json'

import { PLUGIN_IDS, type PluginId } from './featureCatalog'
export { PLUGIN_IDS, type PluginId } from './featureCatalog'
export interface PluginPack { files: string[]; bytes: number }
export interface FeatureManifest { build: string; version: string; core: string[]; files: string[]; plugins: Record<PluginId, PluginPack> }
export interface PluginState { phase: 'idle' | 'loading' | 'ready' | 'error'; enabled: boolean; completed: number; total: number }
export const PLUGIN_CACHE = 'momentss-plugins-v1'
const SETTINGS = 'momentss-feature-plugins-v1'
const preferences: Partial<Record<PluginId, boolean>> = (() => { try { const value = typeof localStorage === 'undefined' ? {} : JSON.parse(localStorage.getItem(SETTINGS) ?? '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } })()
const initial = (id: PluginId): PluginState => ({ phase: 'idle', enabled: typeof preferences[id] === 'boolean' ? preferences[id]! : id !== 'heic', completed: 0, total: 0 })
let states = Object.fromEntries(PLUGIN_IDS.map((id) => [id, initial(id)])) as Record<PluginId, PluginState>
const listeners = new Set<() => void>()
const modules = new Map<string, Promise<unknown>>(), installs = new Map<PluginId, Promise<void>>()
let manifestPromise: Promise<FeatureManifest> | undefined
const publish = (id: PluginId, patch: Partial<PluginState>) => { states = { ...states, [id]: { ...states[id], ...patch } }; listeners.forEach((listener) => listener()) }
export const subscribePlugins = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const pluginSnapshot = () => states
export const isPluginEnabled = (id: PluginId) => states[id].enabled
export function setPluginEnabled(id: PluginId, enabled: boolean) {
  preferences[id] = enabled
  try { localStorage.setItem(SETTINGS, JSON.stringify(preferences)) } catch { /* Keep the current session usable. */ }
  publish(id, { enabled })
}
export class PluginRequiredError extends Error { constructor(public pluginId: PluginId) { super(`plugin-required:${pluginId}`) } }
export function pluginErrorId(error: unknown): PluginId | undefined { return error instanceof PluginRequiredError ? error.pluginId : undefined }
/** Module and asset loaders share opt-in, deduplication, failure state and retry semantics. */
export async function loadFeature<T>(id: PluginId, loader: () => Promise<T>, key = 'module'): Promise<T> {
  if (!isPluginEnabled(id)) throw new PluginRequiredError(id)
  const token = `${id}:${key}`
  if (!modules.has(token)) {
    publish(id, { phase: 'loading' })
    const loading = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new PluginRequiredError(id)), 20000)
      Promise.resolve().then(loader).then(resolve, reject).finally(() => clearTimeout(timer))
    })
    modules.set(token, loading.then((value) => { publish(id, { phase: 'ready' }); return value }).catch(() => { modules.delete(token); publish(id, { phase: 'error' }); throw new PluginRequiredError(id) }))
  }
  return modules.get(token) as Promise<T>
}
const graphics = (style: string) => Object.values(emojiAssets).flatMap((entry) => Object.entries(entry).filter(([key]) => key === style).map(([, url]) => url))
const developmentPacks = (): Record<PluginId, PluginPack> => Object.fromEntries(PLUGIN_IDS.map((id) => [id, { files: id === 'font-rounded' ? ['/fonts/MomentRounded-v1.woff2'] : id === 'font-sans' ? ['/fonts/MomentSans-v1.woff2'] : id.startsWith('emoji-') ? graphics(id === 'emoji-twemoji' ? 'twemoji-v17' : 'fluent-v1') : [], bytes: 0 }])) as Record<PluginId, PluginPack>
export function featureManifest(): Promise<FeatureManifest> {
  if (!import.meta.env.PROD) return Promise.resolve({ build: 'development', version: 'development', core: [], files: [], plugins: developmentPacks() })
  // Older workers cache this path indefinitely. Bind requests to the running entry
  // so an old worker cannot return a previous schema to newly deployed code.
  const entry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src ?? location.href
  if (!manifestPromise) manifestPromise = fetch('/app-manifest.json?app=' + encodeURIComponent(new URL(entry).pathname), { cache: 'no-cache', signal: AbortSignal.timeout(20000) }).then(async (response) => {
    if (!response.ok) throw new Error('plugin-manifest-unavailable')
    const manifest = await response.json()
    if (manifest.schema !== 2 || !Array.isArray(manifest.core) || !PLUGIN_IDS.every((id) => Array.isArray(manifest.plugins?.[id]?.files))) throw new Error('plugin-manifest-version')
    return manifest as FeatureManifest
  }).catch((error) => { manifestPromise = undefined; throw error })
  return manifestPromise
}
export function installPlugin(id: PluginId): Promise<void> {
  if (!installs.has(id)) installs.set(id, (async () => {
    publish(id, { phase: 'loading', completed: 0 })
    const { files } = (await featureManifest()).plugins[id]
    const cache = typeof caches === 'undefined' ? null : await caches.open(PLUGIN_CACHE)
    publish(id, { total: files.length })
    for (const [index, url] of files.entries()) {
      if (!await cache?.match(url, { ignoreVary: true })) {
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) })
        if (!response.ok || response.headers.get('Content-Type')?.includes('text/html')) throw new Error('plugin-download-failed')
        if (cache) await cache.put(url, response)
      }
      publish(id, { completed: index + 1 })
    }
    setPluginEnabled(id, true); publish(id, { phase: 'ready' })
  })().catch((error) => { publish(id, { phase: 'error' }); throw error }).finally(() => installs.delete(id)))
  return installs.get(id)!
}
export async function removePluginDownload(id: PluginId): Promise<void> {
  const pack = (await featureManifest()).plugins[id]
  if (typeof caches !== 'undefined') {
    for (const name of await caches.keys()) if (name === PLUGIN_CACHE || /^momentss-[a-f0-9]{16}$/.test(name)) {
      const cache = await caches.open(name)
      for (const url of pack.files) await cache.delete(url, { ignoreVary: true })
      await cache.delete('/__offline_ready__')
    }
  }
  for (const token of modules.keys()) if (token.startsWith(id + ':')) modules.delete(token)
  setPluginEnabled(id, false); publish(id, { phase: 'idle', completed: 0 })
}
