import clsx from 'clsx'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Project } from '../lib/api'
import { useSaveProject } from '../lib/queries'
import { Button, inputClass, Modal } from './ui'

const ICONS = ['📁', '📘', '🧠', '🚀', '🛠️', '📦', '🧪', '💡', '🔐', '🌐', '📊', '🐳', '⚙️', '📝', '🎯', '🗺️']

/** Create a project, or edit `project` when given. */
export function ProjectDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState(ICONS[0]!)
  const save = useSaveProject()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
    setIcon(project?.icon ?? ICONS[0]!)
    save.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const saved = await save.mutateAsync({ id: project?.id, name, description: description || null, icon })
    onClose()
    if (!project) navigate(`/p/${saved.id}`)
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
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
