import clsx from 'clsx'
import { FilePlus2, Plus, Sparkles, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { DocRow } from '../components/DocRow'
import { ProjectDialog } from '../components/ProjectDialog'
import { ProjectSelect } from '../components/ProjectSelect'
import { Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import { greeting } from '../lib/format'
import { useDocs, useProjects, useSaveDoc } from '../lib/queries'
import { SAMPLE_MARKDOWN } from '../lib/sample'
import { useImportFiles } from '../lib/useImportFiles'

export function HomePage() {
  const { user } = useAuth()
  const { data: docs = [], isLoading } = useDocs()
  const { data: projects = [] } = useProjects()
  const navigate = useNavigate()
  const save = useSaveDoc()
  const { importFiles, busy: importing } = useImportFiles()
  const fileInput = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const docCount = useMemo(() => {
    const counts = new Map<string, number>()
    docs.forEach((d) => d.projectId && counts.set(d.projectId, (counts.get(d.projectId) ?? 0) + 1))
    return counts
  }, [docs])

  const saveDraft = async (content = draft) => {
    const doc = await save.mutateAsync({ content, projectId })
    navigate(`/d/${doc.id}`)
  }

  return (
    <>
      <TopBar crumbs={[{ label: 'Home' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-24 md:px-8 md:pt-16">
          <h1 className="text-[28px] font-semibold tracking-tight">
            {greeting()}, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">Paste some Markdown and read it the way it deserves.</p>

          {/* Quick paste */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              importFiles(e.dataTransfer.files, projectId)
            }}
            className={clsx(
              'mt-8 rounded-2xl border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)] transition',
              dragging ? 'border-accent ring-4 ring-accent/15' : 'border-line',
            )}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && draft.trim()) saveDraft()
              }}
              rows={draft ? 10 : 4}
              placeholder="Paste Markdown here, or drop .md files…"
              className="block w-full resize-none rounded-t-2xl bg-transparent px-5 pt-4 font-mono text-[13px] leading-relaxed outline-none placeholder:font-sans placeholder:text-[14.5px] placeholder:text-ink-faint"
            />
            <div className="flex flex-wrap items-center gap-2 px-3 pt-1 pb-3">
              <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) importFiles(e.target.files, projectId)
                  e.target.value = ''
                }}
              />
              <Button variant="ghost" onClick={() => fileInput.current?.click()} disabled={importing}>
                <Upload className="size-4" /> {importing ? 'Importing…' : 'Import files'}
              </Button>
              <ProjectSelect value={projectId} onChange={setProjectId} />
              <div className="ml-auto flex gap-2">
                <Button
                  disabled={!draft.trim()}
                  onClick={() => navigate(`/new${projectId ? `?project=${projectId}` : ''}`, { state: { content: draft } })}
                >
                  Edit first
                </Button>
                <Button variant="primary" disabled={!draft.trim() || save.isPending} onClick={() => saveDraft()}>
                  {projectId ? 'Save to project' : 'Save as note'}
                </Button>
              </div>
            </div>
          </div>

          {!isLoading && docs.length === 0 && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-line px-5 py-4 text-[14px]">
              <Sparkles className="size-5 shrink-0 text-amber-500" />
              <span className="flex-1 text-ink-muted">New here? Open a sample document to see what viewmd can render.</span>
              <Button onClick={() => saveDraft(SAMPLE_MARKDOWN)}>Open sample</Button>
            </div>
          )}

          {docs.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-2 text-[13px] font-medium text-ink-faint">Recent documents</h2>
              {docs.slice(0, 6).map((d) => (
                <DocRow key={d.id} doc={d} project={d.projectId ? projectById.get(d.projectId) : undefined} time="opened" />
              ))}
            </section>
          )}

          <section className="mt-12">
            <h2 className="mb-3 text-[13px] font-medium text-ink-faint">Projects</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/p/${p.id}`}
                  className="group rounded-2xl border border-line p-4 transition hover:border-ink-faint/50 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-xl bg-raised text-[18px]">{p.icon}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{p.name}</div>
                      <div className="text-[12px] text-ink-faint">
                        {docCount.get(p.id) ?? 0} {docCount.get(p.id) === 1 ? 'document' : 'documents'}
                      </div>
                    </div>
                  </div>
                  {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-ink-muted">{p.description}</p>}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => setCreatingProject(true)}
                className="flex min-h-[76px] items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-[13.5px] text-ink-muted transition hover:border-ink-faint hover:text-ink"
              >
                <Plus className="size-4" /> New project
              </button>
            </div>
          </section>

          <section className="mt-12">
            <Link to="/new" className="inline-flex items-center gap-2 text-[13.5px] text-ink-muted hover:text-ink">
              <FilePlus2 className="size-4" /> Or write a new note in the editor
            </Link>
          </section>
        </div>
      </div>
      <ProjectDialog open={creatingProject} onClose={() => setCreatingProject(false)} />
    </>
  )
}
