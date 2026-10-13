import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { DocSummary } from '../lib/api'
import { useDeleteDoc } from '../lib/queries'
import { useUI } from '../lib/ui'
import { ConfirmDialog } from './ui'

/** Small trash button with its own confirmation. Meant to sit next to (not inside) a link. */
export function DeleteDocButton({ doc, className }: { doc: DocSummary; className?: string }) {
  const [open, setOpen] = useState(false)
  const del = useDeleteDoc()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useUI()

  const ask = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  const confirm = async () => {
    await del.mutateAsync(doc.id)
    setOpen(false)
    toast('Document deleted')
    // Leave the page if it was showing the deleted doc.
    if (location.pathname.startsWith(`/d/${doc.id}`)) navigate('/', { replace: true })
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete “${doc.title}”`}
        title="Delete"
        onClick={ask}
        className={clsx(
          'grid size-6 place-items-center rounded-md text-ink-faint transition hover:bg-surface hover:text-danger',
          className,
        )}
      >
        <Trash2 className="size-3.5" />
      </button>
      <ConfirmDialog
        open={open}
        title="Delete document?"
        message={<>“{doc.title}” will be permanently deleted. This can’t be undone.</>}
        busy={del.isPending}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

/** Visible on hover/focus with a mouse; always visible on touch screens. */
export const revealOnHover = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'
