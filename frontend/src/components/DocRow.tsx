import clsx from 'clsx'
import { FileText } from 'lucide-react'
import { Link } from 'react-router'
import type { DocSummary, Project } from '../lib/api'
import { timeAgo } from '../lib/format'
import { DeleteDocButton, revealOnHover } from './DeleteDocButton'

export function DocRow({ doc, project, time }: { doc: DocSummary; project?: Project; time: 'opened' | 'updated' }) {
  return (
    <div className="group relative -mx-3">
      <Link
        to={`/d/${doc.id}`}
        className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors group-hover:bg-hover"
      >
        <FileText className="mt-[3px] size-4 shrink-0 text-ink-faint group-hover:text-ink-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[14px] font-medium">{doc.title}</span>
            {project && (
              <span className="shrink-0 truncate text-[12px] text-ink-faint">
                {project.icon} {project.name}
              </span>
            )}
          </div>
          {doc.excerpt && <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-muted">{doc.excerpt}</p>}
        </div>
        <span className="shrink-0 pt-0.5 pr-8 text-[12px] text-ink-faint">
          {timeAgo(time === 'opened' ? doc.lastOpenedAt : doc.updatedAt)}
        </span>
      </Link>
      {/* Sibling of the link, not inside it: a button can't be nested in an <a>. */}
      <DeleteDocButton doc={doc} className={clsx('absolute top-2.5 right-2.5', revealOnHover)} />
    </div>
  )
}
