import { Check, FileText } from 'lucide-react'
import { useProjects } from '../lib/queries'
import { Modal } from './ui'

export function MoveDialog({
  open,
  current,
  onClose,
  onMove,
}: {
  open: boolean
  current: string | null
  onClose: () => void
  onMove: (projectId: string | null) => void
}) {
  const { data: projects = [] } = useProjects()
  const options = [{ id: null, name: 'No project', icon: null }, ...projects]

  return (
    <Modal open={open} onClose={onClose} title="Move to…">
      <div className="max-h-80 overflow-y-auto p-2 pt-3">
        {options.map((p) => (
          <button
            key={p.id ?? 'none'}
            type="button"
            onClick={() => onMove(p.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-hover"
          >
            <span className="grid w-5 place-items-center">
              {p.icon ?? <FileText className="size-4 text-ink-muted" />}
            </span>
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === current && <Check className="size-4 text-ink-muted" />}
          </button>
        ))}
      </div>
    </Modal>
  )
}
