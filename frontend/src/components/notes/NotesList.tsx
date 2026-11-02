import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { KINDS, kindColor, kindInfo, paperColor } from '../../lib/annotations'
import type { Annotation, AnnotationKind } from '../../lib/api'

/** All sticky notes of a document, filterable by kind. Click one to jump to it. */
export function NotesList({
  annotations,
  orphanIds,
  onOpen,
  onDelete,
  className,
}: {
  annotations: Annotation[]
  orphanIds: Set<string>
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  className?: string
}) {
  const [filter, setFilter] = useState<AnnotationKind | null>(null)
  const counts = new Map<AnnotationKind, number>()
  for (const a of annotations) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1)
  const shown = filter ? annotations.filter((a) => a.kind === filter) : annotations

  if (annotations.length === 0) {
    return (
      <p className="px-2 pb-1 text-[12.5px] leading-relaxed text-ink-faint">
        Select any text in the document to pin a sticky note on it.
      </p>
    )
  }

  return (
    <div className={className}>
      {counts.size > 1 && (
        <div className="flex flex-wrap gap-1 px-1 pb-2">
          {KINDS.filter((k) => counts.has(k.kind)).map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => setFilter(filter === k.kind ? null : k.kind)}
              className={clsx(
                'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition',
                filter === k.kind ? 'border-ink-faint text-ink' : 'border-line text-ink-muted hover:text-ink',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: kindColor(k.kind) }} />
              {k.label} <span className="text-ink-faint">{counts.get(k.kind)}</span>
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {shown.map((a) => {
          const orphan = orphanIds.has(a.id)
          const info = kindInfo(a.kind)
          return (
            <li key={a.id} className="group relative">
              <button
                type="button"
                onClick={() => !orphan && onOpen(a.id)}
                className={clsx(
                  'block w-full rounded-lg px-2.5 py-2 text-left text-[12.5px] leading-snug transition',
                  orphan ? 'cursor-default opacity-70' : 'hover:brightness-[0.97] dark:hover:brightness-110',
                )}
                style={{ background: paperColor(a.kind), color: 'var(--paper-ink)' }}
              >
                <span className="mb-0.5 flex items-center gap-1 text-[10.5px] font-semibold tracking-wide uppercase opacity-65">
                  <info.icon className="size-3" style={{ color: kindColor(a.kind) }} /> {info.label}
                  {orphan && <span className="font-normal normal-case">· text no longer in document</span>}
                </span>
                <span className="line-clamp-2 italic opacity-70">“{a.quote}”</span>
                {a.body.trim() && <span className="mt-1 line-clamp-3 block whitespace-pre-line">{a.body}</span>}
              </button>
              <button
                type="button"
                aria-label="Delete note"
                title="Delete note"
                onClick={() => onDelete(a.id)}
                className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-md opacity-0 transition group-hover:opacity-60 hover:bg-black/10 hover:!opacity-100 focus:opacity-100 dark:hover:bg-white/10"
                style={{ color: 'var(--paper-ink)' }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
