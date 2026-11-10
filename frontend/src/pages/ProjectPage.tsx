import clsx from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Ellipsis, FilePlus2, Globe, Library, Pencil, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { DocRow } from '../components/DocRow'
import { ProjectDialog } from '../components/ProjectDialog'
import { ProjectShareDialog } from '../components/ProjectShareDialog'
import { Button, buttonClass, ConfirmDialog, IconButton, Menu, MenuItem } from '../components/ui'
import { usePageAssistant } from '../lib/assistant'
import { timeAgo } from '../lib/format'
import type { DocSummary } from '../lib/api'
import { projectOrder, useDeleteProject, useDocs, useProjects, useReorderDocs } from '../lib/queries'
import { useUI } from '../lib/ui'
import { useImportFiles } from '../lib/useImportFiles'
import { NotFound, PageLoading } from './NotFound'

export function ProjectPage() {
  const { id } = useParams()
  const { data: projects, isLoading } = useProjects()
  const { data: allDocs = [] } = useDocs()
  const navigate = useNavigate()
  const { toast } = useUI()
  const del = useDeleteProject()
  const { importFiles, busy: importing } = useImportFiles()
  const fileInput = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [reordering, setReordering] = useState(false)

  const project = projects?.find((p) => p.id === id)
  usePageAssistant(project ? { context: { page: 'project', projectId: project.id }, title: `${project.icon} ${project.name}` } : null)
  const docs = useMemo(
    () =>
      allDocs.filter((d) => d.projectId === id).sort(projectOrder),
    [allDocs, id],
  )
  const lastUpdated = docs.reduce<string | undefined>((max, d) => (!max || d.updatedAt > max ? d.updatedAt : max), undefined)

  if (isLoading) return <PageLoading />
  if (!project) return <NotFound what="project" />

  const remove = async () => {
    await del.mutateAsync(project.id)
    toast(`Deleted ${project.name}`)
    navigate('/note', { replace: true })
  }

  return (
    <>
      <TopBar
        crumbs={[{ label: `${project.icon} ${project.name}` }]}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) importFiles(e.target.files, project.id)
                e.target.value = ''
              }}
            />
            <Button variant="ghost" onClick={() => fileInput.current?.click()} disabled={importing}>
              <Upload className="size-3.5" /> <span className="max-sm:hidden">{importing ? 'Importing…' : 'Import'}</span>
            </Button>
            <Button variant="ghost" onClick={() => setSharing(true)} title="Share as a series">
              {project.publishedAt ? (
                <Globe className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Library className="size-3.5" />
              )}
              <span className="max-sm:hidden">{project.publishedAt ? 'Series' : 'Share'}</span>
            </Button>
            <Link to={`/new?project=${project.id}`} className={buttonClass('primary')}>
              <FilePlus2 className="size-3.5" /> <span className="max-sm:hidden">New document</span>
            </Link>
            <Menu label="Project actions" icon={<Ellipsis />}>
              <MenuItem icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit project
              </MenuItem>
              <MenuItem icon={<Trash2 />} danger onClick={() => setConfirmDelete(true)}>
                Delete project
              </MenuItem>
            </Menu>
          </>
        }
      />

      <div
        className={clsx('flex-1 overflow-y-auto transition', dragging && 'bg-accent/[0.04]')}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          importFiles(e.dataTransfer.files, project.id)
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-24 md:px-8 md:pt-14">
          <div className="grid size-14 place-items-center rounded-2xl border border-line bg-raised text-[28px]">
            {project.icon}
          </div>
          <h1 className="mt-5 text-[28px] font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{project.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-faint">
            <span>
              {docs.length} {docs.length === 1 ? 'document' : 'documents'}
              {lastUpdated && ` · last updated ${timeAgo(lastUpdated)}`}
            </span>
            {project.publishedAt && project.slug && (
              <Link
                to={`/blog/series/${project.slug}`}
                className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                <Globe className="size-3.5" /> Series on the blog
              </Link>
            )}
          </div>

          <div className="mt-8 border-t border-line pt-4">
            {docs.length > 1 && (
              <div className="-mt-1 mb-2 flex justify-end">
                <Button variant="ghost" className="h-8" onClick={() => setReordering((r) => !r)}>
                  {reordering ? <Check className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
                  {reordering ? 'Done' : 'Reorder'}
                </Button>
              </div>
            )}
            {reordering ? (
              <ReorderList projectId={project.id} docs={docs} />
            ) : (
              docs.map((d) => <DocRow key={d.id} doc={d} time="updated" />)
            )}
            {docs.length === 0 && (
              <div
                className={clsx(
                  'mt-4 rounded-2xl border border-dashed px-6 py-12 text-center',
                  dragging ? 'border-accent' : 'border-line',
                )}
              >
                <p className="text-[14px] font-medium">No documents yet</p>
                <p className="mt-1 text-[13.5px] text-ink-muted">
                  Paste Markdown into a new document, or drop .md files here to import them.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button onClick={() => fileInput.current?.click()}>
                    <Upload className="size-3.5" /> Import files
                  </Button>
                  <Link to={`/new?project=${project.id}`} className={buttonClass('primary')}>
                    <FilePlus2 className="size-3.5" /> New document
                  </Link>
                </div>
              </div>
            )}
            {docs.length > 0 && (
              <p className="mt-6 text-center text-[12.5px] text-ink-faint">Tip: drop .md files anywhere on this page to add them.</p>
            )}
          </div>
        </div>
      </div>

      <ProjectDialog open={editing} onClose={() => setEditing(false)} project={project} />
      <ProjectShareDialog open={sharing} onClose={() => setSharing(false)} project={project} docs={docs} />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete project?"
        message={
          <>
            “{project.name}” and its {docs.length} {docs.length === 1 ? 'document' : 'documents'} will be permanently
            deleted. This can’t be undone.
          </>
        }
        confirmLabel="Delete project"
        busy={del.isPending}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}

/** Move documents up and down; each move is saved (the order is also the series order). */
function ReorderList({ projectId, docs }: { projectId: string; docs: DocSummary[] }) {
  const reorder = useReorderDocs()
  const { toast } = useUI()
  const move = (from: number, to: number) => {
    const ids = docs.map((d) => d.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved!)
    reorder.mutate({ projectId, docIds: ids }, { onError: () => toast('Couldn’t save the order') })
  }
  return (
    <ol className="space-y-1">
      {docs.map((d, i) => (
        <li key={d.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
          <span className="w-5 shrink-0 text-right text-[12.5px] text-ink-faint tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{d.title}</span>
          {d.publishedAt && <Globe className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Public" />}
          <IconButton className="disabled:pointer-events-none disabled:opacity-30" label={`Move ${d.title} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
            <ArrowUp />
          </IconButton>
          <IconButton className="disabled:pointer-events-none disabled:opacity-30" label={`Move ${d.title} down`} disabled={i === docs.length - 1} onClick={() => move(i, i + 1)}>
            <ArrowDown />
          </IconButton>
        </li>
      ))}
    </ol>
  )
}
