import clsx from 'clsx'
import { ClipboardCopy, Download, Ellipsis, FolderInput, PanelRight, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { MarkdownView } from '../components/MarkdownView'
import { MoveDialog } from '../components/MoveDialog'
import { buttonClass, ConfirmDialog, IconButton, Menu, MenuItem, MenuSeparator } from '../components/ui'
import type { Doc, Project } from '../lib/api'
import { timeAgo } from '../lib/format'
import { downloadMarkdown, readingStats, startsWithH1 } from '../lib/markdown'
import { useDeleteDoc, useDoc, useProjects, useSaveDoc } from '../lib/queries'
import { useStoredState } from '../lib/storage'
import { useUI } from '../lib/ui'
import { NotFound, PageLoading } from './NotFound'

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export function DocPage() {
  const { id } = useParams()
  const { data: doc, isLoading, error } = useDoc(id)
  const { data: projects = [] } = useProjects()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useUI()
  const save = useSaveDoc()
  const del = useDeleteDoc()
  const [outlineOpen, setOutlineOpen] = useStoredState('viewmd.outline', true)
  const [moving, setMoving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)

  const project = projects.find((p) => p.id === doc?.projectId)

  // Press "e" to edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      navigate(`/d/${id}/edit`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id, navigate])

  // New doc → start at the top, or at the linked heading.
  useEffect(() => {
    if (!doc) return
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (target) target.scrollIntoView()
    else scrollRef.current?.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  if (isLoading) return <PageLoading />
  if (error || !doc) return <NotFound what="document" />

  const move = async (projectId: string | null) => {
    setMoving(false)
    if (projectId === doc.projectId) return
    await save.mutateAsync({ id: doc.id, projectId })
    const target = projects.find((p) => p.id === projectId)
    toast(target ? `Moved to ${target.name}` : 'Moved out of project')
  }

  const remove = async () => {
    await del.mutateAsync(doc.id)
    setConfirmDelete(false)
    toast('Document deleted')
    navigate(project ? `/p/${project.id}` : '/', { replace: true })
  }

  return (
    <>
      <TopBar
        crumbs={[
          project ? { label: `${project.icon} ${project.name}`, to: `/p/${project.id}` } : { label: 'Notes' },
          { label: doc.title },
        ]}
        actions={
          <>
            <Link to={`/d/${doc.id}/edit`} className={buttonClass('ghost')} title="Edit (E)">
              <Pencil className="size-3.5" /> Edit
            </Link>
            <IconButton
              label={outlineOpen ? 'Hide outline' : 'Show outline'}
              active={outlineOpen}
              className="max-xl:hidden"
              onClick={() => setOutlineOpen(!outlineOpen)}
            >
              <PanelRight />
            </IconButton>
            <Menu label="More actions" icon={<Ellipsis />}>
              <MenuItem
                icon={<ClipboardCopy />}
                onClick={async () => {
                  await navigator.clipboard.writeText(doc.content)
                  toast('Markdown copied')
                }}
              >
                Copy Markdown
              </MenuItem>
              <MenuItem icon={<Download />} onClick={() => downloadMarkdown(doc.title, doc.content)}>
                Download .md
              </MenuItem>
              <MenuItem icon={<FolderInput />} onClick={() => setMoving(true)}>
                Move to project…
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} danger onClick={() => setConfirmDelete(true)}>
                Delete
              </MenuItem>
            </Menu>
          </>
        }
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex justify-center gap-12 px-5 pt-6 pb-40 md:px-10">
          <article ref={articleRef} className="w-full max-w-[760px] min-w-0">
            <DocMeta doc={doc} project={project} />
            {!startsWithH1(doc.content) && (
              <div className="markdown">
                <h1>{doc.title}</h1>
              </div>
            )}
            <MarkdownView content={doc.content} />
          </article>
          {outlineOpen && (
            <aside className="hidden w-60 shrink-0 xl:block">
              <div className="sticky top-2">
                <OutlineCard doc={doc} project={project} articleRef={articleRef} scrollRef={scrollRef} />
              </div>
            </aside>
          )}
        </div>
      </div>

      <MoveDialog open={moving} current={doc.projectId} onClose={() => setMoving(false)} onMove={move} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        message={
          <>
            “{doc.title}” will be permanently deleted. This can’t be undone.
          </>
        }
        busy={del.isPending}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

function DocMeta({ doc, project }: { doc: Doc; project?: Project }) {
  const { minutes } = useMemo(() => readingStats(doc.content), [doc.content])
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-faint">
      {project && (
        <>
          <Link to={`/p/${project.id}`} className="rounded-md bg-raised px-1.5 py-0.5 text-ink-muted hover:text-ink">
            {project.icon} {project.name}
          </Link>
          <span>·</span>
        </>
      )}
      <span title={new Date(doc.updatedAt).toLocaleString()}>Updated {timeAgo(doc.updatedAt)}</span>
      <span>·</span>
      <span>{minutes} min read</span>
    </div>
  )
}

interface Heading {
  id: string
  text: string
  level: number
}

function OutlineCard({
  doc,
  project,
  articleRef,
  scrollRef,
}: {
  doc: Doc
  project?: Project
  articleRef: RefObject<HTMLElement | null>
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<string>()
  const stats = useMemo(() => readingStats(doc.content), [doc.content])

  // Read headings from the rendered DOM so ids match rehype-slug exactly.
  useEffect(() => {
    const els = articleRef.current?.querySelectorAll<HTMLElement>('.markdown :is(h1, h2, h3)') ?? []
    setHeadings(
      [...els]
        .filter((h) => h.id)
        .map((h) => ({ id: h.id, level: Number(h.tagName[1]), text: (h.textContent ?? '').replace(/^#/, '').trim() })),
    )
  }, [doc.content, articleRef])

  // Scroll spy: the active heading is the last one above the top edge.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || headings.length === 0) return
    const onScroll = () => {
      const edge = root.getBoundingClientRect().top + 100
      let current = headings[0]!.id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top <= edge) current = h.id
        else break
      }
      // At the very bottom, highlight the last heading even if it can't reach the top.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = headings.at(-1)!.id
      setActive(current)
    }
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [headings, scrollRef])

  const minLevel = Math.min(...headings.map((h) => h.level))

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(history.state, '', `#${id}`)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.04)]">
        <div className="px-2 pb-1.5 text-[12.5px] font-medium text-ink-muted">On this page</div>
        {headings.length === 0 ? (
          <p className="px-2 pb-1 text-[12.5px] text-ink-faint">No headings</p>
        ) : (
          <nav className="max-h-[55vh] overflow-y-auto">
            {headings.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => jump(h.id)}
                style={{ paddingLeft: 8 + (h.level - minLevel) * 12 }}
                className={clsx(
                  'block w-full truncate rounded-md py-1 pr-2 text-left text-[12.5px] leading-snug transition-colors hover:text-ink',
                  active === h.id ? 'bg-hover font-medium text-ink' : 'text-ink-muted',
                )}
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </nav>
        )}
      </div>
      <div className="rounded-2xl border border-line bg-surface p-3 text-[12.5px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.04)]">
        <div className="px-2 pb-1.5 font-medium text-ink-muted">Details</div>
        <dl className="space-y-1 px-2 text-ink-muted">
          <Detail label="Project">{project ? `${project.icon} ${project.name}` : '—'}</Detail>
          <Detail label="Words">{stats.words.toLocaleString()}</Detail>
          <Detail label="Reading">{stats.minutes} min</Detail>
          <Detail label="Created">{new Date(doc.createdAt).toLocaleDateString()}</Detail>
          <Detail label="Updated">{timeAgo(doc.updatedAt)}</Detail>
        </dl>
      </div>
    </div>
  )
}

const Detail = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-ink-faint">{label}</dt>
    <dd className="truncate text-right">{children}</dd>
  </div>
)
