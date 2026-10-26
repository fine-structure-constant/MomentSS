import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { PLUGIN_IDS, type PluginId } from '../src/lib/featureCatalog.ts'

export function offlinePlugin(): Plugin {
  let groups: Partial<Record<PluginId, string[]>> = {}
  return { name: 'momentss-offline', apply: 'build', generateBundle(_, bundle) {
    const chunks = Object.values(bundle).filter((entry) => entry.type === 'chunk')
    const closure = (name: string, seen = new Set<string>()): Set<string> => {
      if (seen.has(name)) return seen
      seen.add(name)
      const chunk = bundle[name]
      if (chunk?.type === 'chunk') chunk.imports.forEach((item) => closure(item, seen))
      return seen
    }
    const initial = new Set(chunks.filter((chunk) => chunk.isEntry).flatMap((chunk) => [...closure(chunk.fileName)]))
    const patterns: Partial<Record<PluginId, RegExp>> = { 'rich-text': /\/components\/RichTextEditor\.tsx$/, markdown: /\/lib\/markdownParser\.ts$/, heic: /\/heic-to\//, 'photo-metadata': /\/exifr\// }
    groups = Object.fromEntries(Object.entries(patterns).map(([id, pattern]) => [id, [...new Set(chunks.filter((chunk) => pattern.test(chunk.facadeModuleId?.replace(/\\/g, '/') ?? '')).flatMap((chunk) => [...closure(chunk.fileName)]))].filter((file) => !initial.has(file)).map((file) => '/' + file)]))
  }, closeBundle() {
    const scan = (folder: string): string[] => readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? scan(join(folder, entry.name)) : [join(folder, entry.name).replace(/\\/g, '/')])
    const files = scan('dist').map((path) => '/' + path.slice(5)).filter((path) => !path.endsWith('.map'))
    const html = readFileSync('dist/index.html')
    let version = createHash('sha256').update(html).digest('hex').slice(0, 16)
    try { version = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { /* Standalone source package. */ }
    const build = createHash('sha256').update(html).update(version).digest('hex').slice(0, 16)
    const plugins = Object.fromEntries(PLUGIN_IDS.map((id) => {
      const paths = groups[id] ?? files.filter((file) => id === 'font-rounded' ? file === '/fonts/MomentRounded-v1.woff2' : id === 'font-sans' ? file === '/fonts/MomentSans-v1.woff2' : id === 'emoji-twemoji' ? file.startsWith('/emoji/twemoji-v17/') : id === 'emoji-fluent' ? file.startsWith('/emoji/fluent-v1/') : false)
      return [id, { files: paths, bytes: paths.reduce((sum, path) => sum + readFileSync('dist' + path).length, 0) }]
    }))
    const optional = new Set(Object.values(plugins).flatMap((pack) => pack.files))
    const core = ['/', ...files.filter((path) => /^\/assets\/[^/]+\.(js|css)$/.test(path) && !optional.has(path)), '/app-manifest.json', '/manifest.webmanifest', '/icons/app.svg']
    const manifest = { schema: 2, build, version, files: ['/', ...files.filter((path) => path !== '/index.html'), '/app-manifest.json'], core, plugins }
    writeFileSync('dist/app-manifest.json', JSON.stringify(manifest))
    writeFileSync('dist/sw.js', `const CACHE='momentss-${build}';const PLUGINS='momentss-plugins-v1';const CORE=${JSON.stringify(core)};const OPTIONAL=new Set(${JSON.stringify([...optional])});
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(/^momentss-[a-f0-9]{16}$/.test(key)&&key!==CACHE)await caches.delete(key);const plugins=await caches.open(PLUGINS);for(const request of await plugins.keys()){const path=new URL(request.url).pathname;if(path.startsWith('/assets/')&&!OPTIONAL.has(path))await plugins.delete(request)}await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname==='/version.json'||url.pathname==='/sw.js')return;
event.respondWith((async()=>{const cache=await caches.open(OPTIONAL.has(url.pathname)?PLUGINS:CACHE);const cached=await cache.match(event.request,{ignoreVary:true,ignoreSearch:url.pathname==='/app-manifest.json'});if(cached&&event.request.mode!=='navigate'&&event.request.cache!=='reload')return cached;try{const response=await fetch(event.request);if(response.ok&&!(url.pathname!=='/'&&!url.pathname.endsWith('.html')&&response.headers.get('Content-Type')?.includes('text/html')))await cache.put(event.request,response.clone());return response}catch(error){if(cached)return cached;if(event.request.mode==='navigate'){const fallback=await cache.match('/',{ignoreVary:true});if(fallback)return fallback}throw error}})())});`)
  } }
}
