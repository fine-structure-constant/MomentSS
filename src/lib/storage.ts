import type { StitchDraft } from '../types'

const DB_NAME = 'liubai-collage'
const DB_VERSION = 1
const STORE = 'drafts'
const STITCH_KEY = 'current-stitch'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开浏览器本地草稿库'))
  })
}

export async function loadStitchDraft(): Promise<StitchDraft | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).get(STITCH_KEY)
    request.onsuccess = () => resolve((request.result as StitchDraft | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('读取本地草稿失败'))
    transaction.oncomplete = () => db.close()
  })
}

export async function saveStitchDraft(draft: StitchDraft): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(draft, STITCH_KEY)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error ?? new Error('保存本地草稿失败'))
  })
}

export async function clearStitchDraft(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(STITCH_KEY)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => reject(transaction.error ?? new Error('清除本地草稿失败'))
  })
}
