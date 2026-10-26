import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export function offlinePlugin(): Plugin {
  return { name: 'momentss-offline', apply: 'build', closeBundle() {
    const scan = (folder: string): string[] => readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? scan(join(folder, entry.name)) : [join(folder, entry.name).replace(/\\/g, '/')])
    const files = scan('dist').map((path) => '/' + path.slice(5)).filter((path) => !path.endsWith('.map'))
    const html = readFileSync('dist/index.html')
    let version = createHash('sha256').update(html).digest('hex').slice(0, 16)
    try { version = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { /* Standalone source package. */ }
    const build = createHash('sha256').update(html).update(version).digest('hex').slice(0, 16)
    const core = ['/', ...files.filter((path) => /^\/assets\/[^/]+\.(js|css)$/.test(path)), '/app-manifest.json', '/manifest.webmanifest', '/icons/app.svg']
    const manifest = { schema: 1, build, version, files: ['/', ...files.filter((path) => path !== '/index.html'), '/app-manifest.json'], core }
    writeFileSync('dist/app-manifest.json', JSON.stringify(manifest))
    writeFileSync('dist/sw.js', `const CACHE='momentss-${build}';const CORE=${JSON.stringify(core)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('momentss-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname==='/version.json'||url.pathname==='/sw.js')return;
event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreVary:true});if(cached&&event.request.mode!=='navigate')return cached;try{const response=await fetch(event.request);if(response.ok&&!(url.pathname!=='/'&&!url.pathname.endsWith('.html')&&response.headers.get('Content-Type')?.includes('text/html')))await cache.put(event.request,response.clone());return response}catch(error){if(cached)return cached;if(event.request.mode==='navigate'){const fallback=await cache.match('/',{ignoreVary:true});if(fallback)return fallback}throw error}})())});`)
  } }
}
