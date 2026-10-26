/** Content-addressed immutable bytes, separate from editable JSON records. */
const hashes = new WeakMap<Blob, Promise<string>>()
export interface BlobReference { $blob: string; mime: string }
export async function encodeGraph(value: unknown, blobs = new Map<string, Blob>()): Promise<{ value: unknown; blobs: Map<string, Blob> }> {
  const walk = async (item: unknown): Promise<unknown> => {
    if (item instanceof Blob) {
      if (!hashes.has(item)) hashes.set(item, item.arrayBuffer().then((bytes) => crypto.subtle.digest('SHA-256', bytes)).then((hash) => [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('')))
      const id = await hashes.get(item)!
      blobs.set(id, item)
      return { $blob: id, mime: item.type }
    }
    if (Array.isArray(item)) return Promise.all(item.map(walk))
    if (item && typeof item === 'object') return Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key, child]) => [key, await walk(child)])))
    return item
  }
  return { value: await walk(value), blobs }
}
export function blobReferences(value: unknown, result = new Set<string>()): Set<string> {
  if (value && typeof value === 'object' && !(value instanceof Blob)) {
    if ('$blob' in value && typeof value.$blob === 'string') result.add(value.$blob)
    else Object.values(value).forEach((child) => blobReferences(child, result))
  }
  return result
}
export function decodeGraph<T>(value: unknown, blobs: Map<string, Blob>): T {
  const walk = (item: unknown): unknown => {
    if (item && typeof item === 'object' && '$blob' in item) {
      const ref = item as BlobReference, blob = blobs.get(ref.$blob)
      if (!blob) throw new Error('missing-blob')
      return blob.type === ref.mime ? blob : blob.slice(0, blob.size, ref.mime)
    }
    if (Array.isArray(item)) return item.map(walk)
    if (item && typeof item === 'object' && !(item instanceof Blob)) return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, walk(child)]))
    return item
  }
  return walk(value) as T
}
export async function hydrateGraph<T>(db: IDBDatabase, value: unknown): Promise<T> {
  const refs = [...blobReferences(value)], blobs = new Map<string, Blob>()
  if (!refs.length) return value as T
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('blobs')
    for (const ref of refs) { const request = tx.objectStore('blobs').get(ref); request.onsuccess = () => { if (request.result) blobs.set(ref, request.result) } }
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
  })
  return decodeGraph<T>(value, blobs)
}
export async function commitGraphs(db: IDBDatabase, writes: Array<{ store: string; key: string; value: unknown }>, library?: { key: string; items: Array<{ id: string }> }) {
  const blobs = new Map<string, Blob>()
  const encoded = await Promise.all(writes.map(async (write) => ({ ...write, value: (await encodeGraph(write.value, blobs)).value })))
  const items = library ? await Promise.all(library.items.map(async (item) => ({ id: item.id, value: (await encodeGraph(item, blobs)).value }))) : []
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['drafts', 'assets', 'projects', 'records', 'blobs'], 'readwrite')
    for (const [key, blob] of blobs) { const exists = tx.objectStore('blobs').getKey(key); exists.onsuccess = () => { if (exists.result === undefined) tx.objectStore('blobs').put(blob, key) } }
    const changed = (store: IDBObjectStore, key: string, value: unknown) => {
      const previous = store.get(key)
      previous.onsuccess = () => { if (value === undefined) store.delete(key); else if (JSON.stringify(previous.result) !== JSON.stringify(value)) store.put(value, key) }
    }
    for (const write of encoded) changed(tx.objectStore(write.store), write.key, write.value)
    if (library) {
      const store = tx.objectStore('assets'), previous = store.get(library.key)
      previous.onsuccess = () => {
        const old = previous.result
        if (old?.schemaVersion > 2) { tx.abort(); return }
        const keep = new Set(items.map((item) => item.id))
        for (const id of old?.ids ?? []) if (!keep.has(id)) tx.objectStore('records').delete(`${library.key}:${id}`)
        store.put({ schemaVersion: 2, ids: items.map((item) => item.id) }, library.key)
      }
      for (const item of items) changed(tx.objectStore('records'), `${library.key}:${item.id}`, item.value)
    }
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('storage-write-failed'))
  })
}
export async function readLibraryRecords(db: IDBDatabase, key: string, index: unknown): Promise<unknown[]> {
  if (Array.isArray(index)) return index
  if (!index) return []
  const entry = index as { schemaVersion: number; ids: string[] }
  if (entry.schemaVersion !== 2 || !Array.isArray(entry.ids)) throw new Error('unsupported-record-version')
  return new Promise((resolve, reject) => {
    const values: unknown[] = [], tx = db.transaction('records')
    for (const [i, id] of entry.ids.entries()) { const request = tx.objectStore('records').get(`${key}:${id}`); request.onsuccess = () => { values[i] = request.result } }
    tx.oncomplete = () => values.some((item) => !item) ? reject(new Error('missing-resource-record')) : resolve(values)
    tx.onabort = () => reject(tx.error)
  })
}
