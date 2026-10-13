import clsx from 'clsx'
import { Ellipsis, FilePlus2, Pencil, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { DocRow } from '../components/DocRow'
import { ProjectDialog } from '../components/ProjectDialog'
import { Button, buttonClass, ConfirmDialog, Menu, MenuItem } from '../components/ui'
import { timeAgo } from '../lib/format'
import { useDeleteProject, useDocs, useProjects } from '../lib/queries'
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

  const project = projects?.find((p) => p.id === id)
  const docs = useMemo(
    () =>
      allDocs
        .filter((d) => d.projectId === id)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })),
    [allDocs, id],
  )
  const lastUpdated = docs.reduce<string | undefined>((max, d) => (!max || d.updatedAt > max ? d.updatedAt : max), undefined)

  if (isLoading) return <PageLoading />
  if (!project) return <NotFound what="project" />

  const remove = async () => {
    await del.mutateAsync(project.id)
    toast(`Deleted ${project.name}`)
    navigate('/', { replace: true })
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
          <p className="mt-3 text-[12.5px] text-ink-faint">
            {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            {lastUpdated && ` · last updated ${timeAgo(lastUpdated)}`}
          </p>

          <div className="mt-8 border-t border-line pt-4">
            {docs.map((d) => (
              <DocRow key={d.id} doc={d} time="updated" />
            ))}
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
