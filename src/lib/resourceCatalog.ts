import type { ImportedAsset, SavedComposition } from '../types'

export type LibraryResource = ImportedAsset | SavedComposition
export type ResourceSort = 'imported-desc' | 'imported-asc' | 'captured-asc' | 'captured-desc' | 'modified-desc' | 'name' | 'updated-desc'
export type DateGrouping = 'none' | 'imported' | 'captured'
export type DateGroup = 'today' | 'yesterday' | 'week' | 'month' | 'older' | 'unknown'
export const RESOURCE_SORTS: ResourceSort[] = ['imported-desc', 'imported-asc', 'captured-asc', 'captured-desc', 'modified-desc', 'name', 'updated-desc']
export const DATE_GROUPS: DateGroup[] = ['today', 'yesterday', 'week', 'month', 'older', 'unknown']
export function resourceLabel(resource: LibraryResource, blank = ''): string {
  return resource.displayName || ('blocks' in resource ? resource.name : resource.type === 'photo' ? resource.name : resource.text || blank)
}
export function resourceDate(resource: LibraryResource, basis: 'imported' | 'captured'): number | undefined {
  if (basis === 'captured') {
    if (resource.capturedAt) return resource.capturedAt
    if (resource.capturedLocalTime) {
      const date = new Date(resource.capturedLocalTime).getTime()
      if (Number.isFinite(date)) return date
    }
    return undefined
  }
  return resource.importedAt ?? ('createdAt' in resource ? resource.createdAt : undefined)
}
export function dateGroup(value: number | undefined, now = Date.now()): DateGroup {
  if (!value || !Number.isFinite(value)) return 'unknown'
  const calendarDay = (time: number) => { const d = new Date(time); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 }
  const age = calendarDay(now) - calendarDay(value)
  if (age <= 0) return 'today'
  if (age === 1) return 'yesterday'
  if (age < 7) return 'week'
  if (age < 30) return 'month'
  return 'older'
}
export function sortResources(resources: LibraryResource[], sort: ResourceSort, locale = 'zh-CN'): LibraryResource[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  const date = (item: LibraryResource) => sort.startsWith('captured') ? resourceDate(item, 'captured') : sort.startsWith('modified') ? item.fileModifiedAt : sort.startsWith('updated') ? item.updatedAt ?? resourceDate(item, 'imported') : resourceDate(item, 'imported')
  return resources.map((item, index) => ({ item, index })).sort((a, b) => {
    if (sort === 'name') return collator.compare(resourceLabel(a.item), resourceLabel(b.item)) || a.index - b.index
    const av = date(a.item), bv = date(b.item)
    if (av === undefined || bv === undefined) return av === bv ? a.index - b.index : av === undefined ? 1 : -1
    return (av - bv) * (sort.endsWith('desc') ? -1 : 1) || (a.item.importOrder ?? a.index) - (b.item.importOrder ?? b.index) || a.item.id.localeCompare(b.item.id)
  }).map(({ item }) => item)
}

/** Recover only genuine File metadata. Unknown historical import/capture dates stay unknown. */
export function normalizeResource<T extends LibraryResource>(resource: T): T {
  if (!('type' in resource) || resource.type !== 'photo' || resource.fileModifiedAt) return resource
  const modified = (resource.blob as File).lastModified
  return Number.isFinite(modified) && modified > 0 ? { ...resource, fileModifiedAt: modified } : resource
}
