import { useEffect, useRef, useState } from 'react'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import type { ToastMessage } from './StatusToast'
import { useI18n } from '../i18n'
import { compactStorage } from '../lib/storage'
import { downloadBlob } from '../lib/canvas'

export function ProjectStorage({ library, onToast }: { library: ResourceLibrary; onToast: (message: ToastMessage) => void }) {
  const { t } = useI18n(), file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false), [usage, setUsage] = useState<StorageEstimate | null>(null)
  useEffect(() => { void navigator.storage?.estimate().then(setUsage) }, [busy])
  const run = async (operation: () => Promise<void>) => { setBusy(true); try { await operation() } catch { onToast({ text: t('backup.failed'), tone: 'warning' }) } finally { setBusy(false) } }
  return <div className="project-storage">
    {usage && <p className="section-copy">{t('storage.usage', { used: ((usage.usage ?? 0) / 1048576).toFixed(1), quota: ((usage.quota ?? 0) / 1048576).toFixed(0) })}</p>}
    <button className="secondary-button" disabled={busy} onClick={() => void run(async () => { await library.flushWorkspace(); const { createProjectPackage } = await import('../lib/projectBackup'); const project = library.projects.find((item) => item.id === library.projectId)!; downloadBlob(await createProjectPackage(project), `${project.name || 'MomentSS'}.momentss.zip`) })}>{t('backup.export')}</button>
    <button className="secondary-button" disabled={busy} onClick={() => file.current?.click()}>{t('backup.import')}</button>
    <input ref={file} className="visually-hidden" type="file" accept=".zip" aria-label={t('backup.import')} onChange={(event) => { const selected = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (selected) void run(async () => { const { importProjectPackage } = await import('../lib/projectBackup'); let project; try { project = await importProjectPackage(selected, t('backup.name')) } catch { onToast({ text: t('backup.invalid'), tone: 'warning' }); return } await library.refreshProjects(); await library.switchProject(project.id); onToast({ text: t('backup.done'), tone: 'success' }) }) }} />
    <button className="text-button" disabled={busy} onClick={() => void run(async () => { await library.flushWorkspace(); const count = await compactStorage(); onToast({ text: t('storage.compacted', { count }), tone: 'success' }) })}>{t('storage.compact')}</button>
  </div>
}
