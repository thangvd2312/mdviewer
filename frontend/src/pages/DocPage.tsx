import clsx from 'clsx'
import {
  Brain,
  ClipboardCopy,
  Download,
  Ellipsis,
  FolderInput,
  Globe,
  PanelRight,
  Pencil,
  Share2,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { cardClass, OutlineNav, useActiveHeading, useHeadings, type Heading } from '../components/DocOutline'
import { MoveDialog } from '../components/MoveDialog'
import { AnnotatedContent } from '../components/notes/AnnotatedContent'
import { NotesList } from '../components/notes/NotesList'
import { ShareDialog } from '../components/ShareDialog'
import { buttonClass, ConfirmDialog, IconButton, Menu, MenuItem, MenuSeparator, Modal } from '../components/ui'
import type { Doc, Project } from '../lib/api'
import { timeAgo } from '../lib/format'
import { downloadMarkdown, readingStats, startsWithH1 } from '../lib/markdown'
import { useAssistant, usePageAssistant } from '../lib/assistant'
import { useAnnotationMutations, useAnnotations, useDeleteDoc, useDoc, useProjects, useSaveDoc } from '../lib/queries'
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
  // ?share=1 (from the public page's "Settings") opens the share dialog.
  const [params, setParams] = useSearchParams()
  const sharingOpen = params.get('share') === '1'
  const setSharingOpen = (open: boolean) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (open) next.set('share', '1')
        else next.delete('share')
        return next
      },
      { replace: !open },
    )
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)

  // Sticky notes
  const { data: annotations = [] } = useAnnotations(id)
  const { remove: removeNote } = useAnnotationMutations(id ?? '')
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const [jump, setJump] = useState<{ id: string; n: number } | null>(null)
  const [orphans, setOrphans] = useState<Set<string>>(() => new Set())
  const [notesOpen, setNotesOpen] = useState(false)
  useEffect(() => setOpenNoteId(null), [id])
  const openNote = useCallback((noteId: string) => {
    setNotesOpen(false)
    setJump({ id: noteId, n: Date.now() })
  }, [])
  const deleteNote = useCallback(
    (noteId: string) => {
      removeNote.mutate(noteId)
      toast('Note deleted')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removeNote.mutate, toast],
  )

  // Tell the assistant which document and section are on screen.
  const headings = useHeadings(articleRef, doc?.content)
  const activeId = useActiveHeading(headings, scrollRef)
  const active = headings.find((h) => h.id === activeId)
  usePageAssistant(
    doc
      ? {
          context: { page: 'doc', docId: doc.id, ...(active && active.level > 1 && { sectionTitle: active.text }) },
          title: doc.title,
        }
      : null,
  )
  const { ask } = useAssistant()
  const askAbout = useCallback((quote: string) => ask({ quote }), [ask])

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
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className={clsx(buttonClass('ghost'), outlineOpen && 'xl:hidden')}
              title="Sticky notes"
            >
              <StickyNote className="size-3.5" />
              {annotations.length > 0 ? annotations.length : <span className="max-sm:hidden">Notes</span>}
            </button>
            <Link to={`/d/${doc.id}/edit`} className={buttonClass('ghost')} title="Edit (E)">
              <Pencil className="size-3.5" /> <span className="max-sm:hidden">Edit</span>
            </Link>
            <button
              type="button"
              onClick={() => setSharingOpen(true)}
              className={clsx(
                buttonClass('ghost'),
                doc.publishedAt &&
                  'text-emerald-700 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400',
              )}
              title={doc.publishedAt ? 'Public — share settings' : 'Share'}
            >
              {doc.publishedAt ? <Globe className="size-3.5" /> : <Share2 className="size-3.5" />}
              <span className="max-sm:hidden">{doc.publishedAt ? 'Public' : 'Share'}</span>
            </button>
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
              <MenuItem icon={<Brain />} onClick={() => navigate(`/review/session?doc=${doc.id}`)}>
                Quiz me on this
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
            <AnnotatedContent
              docId={doc.id}
              content={doc.content}
              annotations={annotations}
              openId={openNoteId}
              setOpenId={setOpenNoteId}
              jump={jump}
              scrollRef={scrollRef}
              onOrphans={setOrphans}
              onAsk={askAbout}
            />
          </article>
          {outlineOpen && (
            <aside className="hidden w-60 shrink-0 xl:block">
              <div className="sticky top-2 space-y-3">
                <OutlineCard doc={doc} project={project} headings={headings} active={activeId} />
                <div className={cardClass}>
                  <div className="flex items-center px-2 pb-2 text-[12.5px] font-medium text-ink-muted">
                    Sticky notes
                    {annotations.length > 0 && (
                      <span className="ml-auto font-normal text-ink-faint">{annotations.length}</span>
                    )}
                  </div>
                  <div className="max-h-[32vh] overflow-y-auto">
                    <NotesList annotations={annotations} orphanIds={orphans} onOpen={openNote} onDelete={deleteNote} />
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="Sticky notes">
        <div className="max-h-[60vh] overflow-y-auto px-4 pt-3 pb-4">
          <NotesList annotations={annotations} orphanIds={orphans} onOpen={openNote} onDelete={deleteNote} />
        </div>
      </Modal>
      <ShareDialog doc={doc} open={sharingOpen} onClose={() => setSharingOpen(false)} />
      <MoveDialog open={moving} current={doc.projectId} onClose={() => setMoving(false)} onMove={move} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        message={<>“{doc.title}” will be permanently deleted. This can’t be undone.</>}
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
      {doc.publishedAt && doc.slug && (
        <>
          <Link
            to={`/blog/${doc.slug}`}
            className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
            title="Open the public page"
          >
            <Globe className="size-3" /> Public
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

function OutlineCard({
  doc,
  project,
  headings,
  active,
}: {
  doc: Doc
  project?: Project
  headings: Heading[]
  active: string | undefined
}) {
  const stats = useMemo(() => readingStats(doc.content), [doc.content])

  return (
    <div className="space-y-3">
      <OutlineNav headings={headings} active={active} />
      <div className={clsx(cardClass, 'text-[12.5px]')}>
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
