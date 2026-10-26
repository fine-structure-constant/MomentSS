import { PluginPanel } from './PluginPanel'
import { Archive, Copy, FolderOpen, Pencil, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { ResourceLibrary } from '../hooks/useResourceLibrary'
import type { ToastMessage } from './StatusToast'
import { useI18n } from '../i18n'
import { useConfirmDialog } from './ConfirmDialog'
import { ProjectStorage } from './ProjectStorage'
import { OfflinePanel } from './OfflinePanel'

export function ProjectManager({ library, onToast }: { library: ResourceLibrary; onToast: (toast: ToastMessage) => void }) {
  const { t } = useI18n()
  const { confirm, dialog } = useConfirmDialog()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const active = library.projects.find((project) => project.id === library.projectId)
  const label = (project: NonNullable<typeof active>) => project.name || t('project.legacy')
  const perform = async (operation: () => Promise<void>) => {
    setBusy(true)
    try { await operation() } catch { onToast({ text: t('project.switchError'), tone: 'warning' }) }
    finally { setBusy(false) }
  }
  return <div className="project-manager">
    <label><FolderOpen size={17} aria-hidden="true" /><span className="visually-hidden">{t('project.current')}</span><select value={library.projectId} disabled={busy || library.switching} onChange={(event) => { const id = event.currentTarget.value; void perform(() => library.switchProject(id)) }}>{library.projects.filter((project) => !project.archivedAt).map((project) => <option key={project.id} value={project.id}>{label(project)}</option>)}</select></label>
    <button type="button" className="icon-button" aria-label={t('project.create')} title={t('project.create')} disabled={busy || library.switching} onClick={() => void perform(() => library.createProject(t('project.newName', { number: library.projects.length + 1 })))}><Plus size={18} /></button>
    <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{t('project.manage')}</button>
    <OfflinePanel library={library} /><PluginPanel />
    {open && active && <div className="project-manager__panel">
      <div className="panel-heading"><strong>{t('project.manage')}</strong><button type="button" className="icon-button" aria-label={t('common.close')} onClick={() => setOpen(false)}><X size={16} /></button></div>
      {renaming ? <form className="project-rename" onSubmit={(event) => { event.preventDefault(); if (name.trim()) void perform(async () => { await library.updateProject({ ...active, name: name.trim().slice(0, 80), updatedAt: Date.now() }); setRenaming(false) }) }}><input autoFocus aria-label={t('project.name')} value={name} maxLength={80} onChange={(event) => setName(event.currentTarget.value)} /><button className="secondary-button" type="submit" disabled={busy || !name.trim()}>{t('common.done')}</button></form>
        : <button type="button" className="secondary-button" onClick={() => { setRenaming(true); setName(label(active)) }}><Pencil size={16} />{t('project.rename')}</button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void perform(async () => {
        const ok = await confirm({ title: t('project.archiveTitle'), body: t('project.archiveBody'), confirmLabel: t('project.archive') })
        if (!ok) return
        const next = library.projects.find((project) => project.id !== active.id && !project.archivedAt)
        if (next) await library.switchProject(next.id)
        else await library.createProject(t('project.newName', { number: library.projects.length + 1 }))
        await library.updateProject({ ...active, archivedAt: Date.now() })
      })}><Archive size={16} />{t('project.archive')}</button>
      {library.projects.filter((project) => project.id !== active.id).map((project) => <div className="project-manager__entry" key={project.id}><span>{label(project)}{project.archivedAt ? ` · ${t('project.archived')}` : ''}</span>{project.archivedAt ? <button type="button" className="text-button" disabled={busy} onClick={() => void perform(async () => { await library.updateProject({ ...project, archivedAt: undefined }); await library.switchProject(project.id) })}>{t('project.restore')}</button> : <button type="button" className="text-button" disabled={busy} onClick={() => void perform(async () => { await library.copyProjectAssets(project.id); onToast({ text: t('project.copied'), tone: 'success' }) })}><Copy size={13} />{t('project.copyAssets')}</button>}</div>)}
      <p className="section-copy">{t('project.hint')}</p>
      <ProjectStorage library={library} onToast={onToast} />
    </div>}
    {dialog}
  </div>
}
