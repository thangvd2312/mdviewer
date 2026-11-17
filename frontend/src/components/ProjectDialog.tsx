import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Project } from '../lib/api'
import { flattenTree, MAX_PROJECT_DEPTH, subtreeHeight, subtreeIds } from '../lib/projects'
import { useProjects, useSaveProject } from '../lib/queries'
import { Button, inputClass, Modal } from './ui'

const ICONS = ['📁', '📘', '🧠', '🚀', '🛠️', '📦', '🧪', '💡', '🔐', '🌐', '📊', '🐳', '⚙️', '📝', '🎯', '🗺️']

/** Create a project (inside `parentId` when given), or edit `project` when given. */
export function ProjectDialog({
  open,
  onClose,
  project,
  parentId: initialParentId = null,
}: {
  open: boolean
  onClose: () => void
  project?: Project
  parentId?: string | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(ICONS[0]!)
  const [parentId, setParentId] = useState<string | null>(null)
  const save = useSaveProject()
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()

  // Where it can go: not inside itself or its own sub-projects, and not deeper than the limit.
  const parents = useMemo(() => {
    const own = project ? subtreeIds(projects, project.id) : new Set<string>()
    const height = project ? subtreeHeight(projects, project.id) : 1
    return flattenTree(projects).filter(({ project: p, depth }) => !own.has(p.id) && depth + 1 + height <= MAX_PROJECT_DEPTH)
  }, [projects, project])

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
    setIcon(project?.icon ?? ICONS[0]!)
    setParentId(project ? project.parentId : initialParentId)
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, initialParentId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const saved = await save.mutateAsync({ id: project?.id, name, description: description || null, icon, parentId })
    onClose()
    if (!project) navigate(`/p/${saved.id}`)
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : initialParentId ? 'New sub-project' : 'New project'}>
      <form onSubmit={submit} className="space-y-4 px-5 pt-4 pb-5">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">Icon</label>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIcon(i)}
                className={clsx(
                  'grid size-8 place-items-center rounded-lg text-[17px] transition',
                  icon === i ? 'bg-hover ring-1 ring-ink-faint' : 'hover:bg-hover',
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="project-name" className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">
            Name
          </label>
          <input
            id="project-name"
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. hn-hotel-support"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="project-desc" className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">
            Description <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <textarea
            id="project-desc"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are these docs about?"
            className={clsx(inputClass, 'h-auto resize-none py-2')}
          />
        </div>
        {(parents.length > 0 || parentId) && (
          <div>
            <label htmlFor="project-parent" className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">
              Inside
            </label>
            <div className="relative">
              <select
                id="project-parent"
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value || null)}
                className={clsx(inputClass, 'cursor-pointer appearance-none pr-8')}
              >
                <option value="">None (top level)</option>
                {parents.map(({ project: p, depth }) => (
                  <option key={p.id} value={p.id}>
                    {'\u2003'.repeat(depth)}
                    {p.icon} {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-ink-muted" />
            </div>
          </div>
        )}
        {save.error && <p className="text-[13px] text-danger">{save.error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!name.trim() || save.isPending}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
