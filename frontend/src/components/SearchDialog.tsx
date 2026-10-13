import clsx from 'clsx'
import { FileText, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDocs, useProjects, useSearchDocs } from '../lib/queries'
import { useUI } from '../lib/ui'
import { Modal, Spinner } from './ui'

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useUI()
  // The panel unmounts when closed, so every open starts with a fresh query.
  return (
    <Modal open={searchOpen} onClose={() => setSearchOpen(false)} className="max-w-xl">
      <SearchPanel close={() => setSearchOpen(false)} />
    </Modal>
  )
}

function SearchPanel({ close }: { close: () => void }) {
  const [q, setQ] = useState('')
  const query = useDeferredValue(q.trim())
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()
  const { data: recent = [] } = useDocs()
  const search = useSearchDocs(query)

  const results = query ? (search.data ?? []) : recent.slice(0, 8)
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const open = (id: string) => {
    close()
    navigate(`/d/${id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + delta + results.length) % Math.max(results.length, 1))
    } else if (e.key === 'Enter' && results[active]) {
      open(results[active].id)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search className="size-4 text-ink-faint" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search documents…"
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-faint"
        />
        {search.isFetching && <Spinner />}
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-2">
        <div className="px-2.5 pt-1 pb-1.5 text-[12px] font-medium text-ink-faint">{query ? 'Results' : 'Recent'}</div>
        {results.map((d, i) => {
          const project = d.projectId ? projectById.get(d.projectId) : undefined
          return (
            <button
              key={d.id}
              type="button"
              onMouseMove={() => setActive(i)}
              onClick={() => open(d.id)}
              className={clsx('flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left', i === active && 'bg-hover')}
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[13.5px] font-medium">{d.title}</span>
                  {project && (
                    <span className="shrink-0 text-[12px] text-ink-faint">
                      {project.icon} {project.name}
                    </span>
                  )}
                </span>
                {d.excerpt && <span className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-muted">{d.excerpt}</span>}
              </span>
            </button>
          )
        })}
        {query && !search.isFetching && results.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[13px] text-ink-faint">No documents match “{query}”.</p>
        )}
      </div>
    </>
  )
}
