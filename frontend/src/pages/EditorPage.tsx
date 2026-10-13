import clsx from 'clsx'
import { ClipboardPaste, Columns2, Eye, FileUp, PenLine } from 'lucide-react'
import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { MarkdownView } from '../components/MarkdownView'
import { ProjectSelect } from '../components/ProjectSelect'
import { Button, ConfirmDialog } from '../components/ui'
import type { Doc } from '../lib/api'
import { deriveTitle, isMarkdownFile } from '../lib/markdown'
import { useDoc, useProjects, useSaveDoc } from '../lib/queries'
import { useStoredState } from '../lib/storage'
import { useUI } from '../lib/ui'
import { NotFound, PageLoading } from './NotFound'

type Mode = 'write' | 'split' | 'preview'

/** `/new` (optionally `?project=<id>` and `state.content`) or `/d/:id/edit`. */
export function EditorPage() {
  const { id } = useParams()
  const location = useLocation()
  const [params] = useSearchParams()
  const { data: doc, isLoading, error } = useDoc(id)

  if (id) {
    if (isLoading) return <PageLoading />
    if (error || !doc) return <NotFound what="document" />
    return <Editor key={doc.id} doc={doc} />
  }
  const initial = (location.state as { content?: string } | null)?.content ?? ''
  return <Editor key={location.key} initialContent={initial} initialProjectId={params.get('project')} />
}

function Editor({
  doc,
  initialContent = '',
  initialProjectId = null,
}: {
  doc?: Doc
  initialContent?: string
  initialProjectId?: string | null
}) {
  // A title equal to the derived one is "automatic": leave the field blank so it keeps following the first heading.
  const initialTitle = doc && doc.title !== deriveTitle(doc.content) ? doc.title : ''
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(doc?.content ?? initialContent)
  const [projectId, setProjectId] = useState<string | null>(doc?.projectId ?? initialProjectId)
  const [saved, setSaved] = useState({ title: initialTitle, content: doc?.content ?? '', projectId: doc?.projectId ?? initialProjectId })
  const [storedMode, setMode] = useStoredState<Mode>('viewmd.editorMode', 'split')
  const [dragging, setDragging] = useState(false)
  const preview = useDeferredValue(content)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = useSaveDoc()
  const navigate = useNavigate()
  const { toast } = useUI()
  const { data: projects = [] } = useProjects()
  const project = projects.find((p) => p.id === projectId)

  const narrow = useNarrow()
  const mode: Mode = narrow && storedMode === 'split' ? 'write' : storedMode

  const dirty = title !== saved.title || content !== saved.content || projectId !== saved.projectId
  const dirtyRef = useRef(dirty)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const submit = async (thenView: boolean) => {
    if (!content.trim()) {
      toast('Add some Markdown first')
      return
    }
    const result = await save.mutateAsync({ id: doc?.id, title: title.trim(), content, projectId })
    setSaved({ title, content, projectId })
    dirtyRef.current = false
    if (thenView) navigate(`/d/${result.id}`, { replace: !doc })
    else {
      toast('Saved')
      if (!doc) navigate(`/d/${result.id}/edit`, { replace: true })
    }
  }
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })

  // ⌘S / Ctrl+S saves and keeps editing.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        submitRef.current(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const insertText = (text: string) => {
    const el = textarea.current
    if (!el) return setContent((c) => c + text)
    el.focus()
    // execCommand keeps the browser's undo stack intact.
    if (!document.execCommand('insertText', false, text)) {
      el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end')
      setContent(el.value)
    }
  }

  const loadFiles = async (files: FileList | null) => {
    const file = files && [...files].find(isMarkdownFile)
    if (!file) return toast('Drop a .md, .markdown or .txt file')
    const text = await file.text()
    if (!content.trim()) setContent(text)
    else insertText((content.endsWith('\n') ? '\n' : '\n\n') + text)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setContent(text)
    } catch {
      toast('Clipboard access was blocked — paste with ⌘V instead')
      setMode('write')
    }
  }

  const onTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      insertText('  ')
    }
  }

  const effectiveTitle = title.trim() || (content.trim() ? deriveTitle(content) : doc ? doc.title : 'New document')

  return (
    <>
      <TopBar
        crumbs={[
          project ? { label: `${project.icon} ${project.name}`, to: `/p/${project.id}` } : { label: 'Notes' },
          { label: effectiveTitle, to: doc ? `/d/${doc.id}` : undefined },
          { label: doc ? 'Edit' : 'Draft' },
        ]}
        actions={
          <>
            <div className="mr-1 flex rounded-lg bg-hover p-0.5">
              <ModeButton mode="write" current={mode} onClick={setMode} icon={<PenLine />} label="Write" />
              {!narrow && <ModeButton mode="split" current={mode} onClick={setMode} icon={<Columns2 />} label="Split" />}
              <ModeButton mode="preview" current={mode} onClick={setMode} icon={<Eye />} label="Preview" />
            </div>
            <ProjectSelect value={projectId} onChange={setProjectId} />
            <Button variant="ghost" onClick={() => (doc ? navigate(`/d/${doc.id}`) : navigate(-1))}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => submit(true)} disabled={save.isPending} title="Save and view (⌘S to save and keep editing)">
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <div
        className={clsx('relative flex min-h-0 flex-1 border-t border-line', dragging && 'ring-4 ring-accent/20 ring-inset')}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setDragging(false)
          loadFiles(e.dataTransfer.files)
        }}
      >
        {mode !== 'preview' && (
          <section className="flex min-w-0 flex-1 flex-col">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              placeholder={content.trim() ? deriveTitle(content) : 'Title (optional — taken from the first heading)'}
              className="h-14 shrink-0 border-b border-line bg-transparent px-6 text-[18px] font-semibold tracking-tight outline-none placeholder:font-normal placeholder:text-ink-faint"
            />
            <textarea
              ref={textarea}
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              spellCheck={false}
              placeholder={'Paste or type Markdown here…\n\nYou can also drop a .md file onto this window.'}
              className="min-h-0 flex-1 resize-none bg-transparent px-6 py-5 font-mono text-[13px] leading-[1.75] outline-none placeholder:text-ink-faint"
            />
            <div className="flex h-9 shrink-0 items-center gap-3 border-t border-line px-4 text-[12px] text-ink-faint">
              <input
                ref={fileInput}
                type="file"
                accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
                hidden
                onChange={(e) => {
                  loadFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <button type="button" onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 hover:text-ink">
                <FileUp className="size-3.5" /> Open file
              </button>
              <span className="ml-auto">
                {content.length.toLocaleString()} chars · {dirty ? 'Unsaved changes' : 'Saved'} · ⌘S to save
              </span>
            </div>
          </section>
        )}

        {mode === 'split' && <div className="w-px shrink-0 bg-line" />}

        {mode !== 'write' && (
          <section className="min-w-0 flex-1 overflow-y-auto bg-surface">
            {preview.trim() ? (
              <div className="mx-auto max-w-[760px] px-8 pt-8 pb-32">
                <MarkdownView content={preview} />
              </div>
            ) : (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <p className="text-[14px] text-ink-muted">The preview appears here as you type.</p>
                  <Button className="mt-4" onClick={pasteFromClipboard}>
                    <ClipboardPaste className="size-4" /> Paste from clipboard
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Discard unsaved changes?"
        message="You have edits that haven’t been saved. If you leave now they’ll be lost."
        confirmLabel="Discard"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      />
    </>
  )
}

function ModeButton({
  mode,
  current,
  onClick,
  icon,
  label,
}: {
  mode: Mode
  current: Mode
  onClick: (m: Mode) => void
  icon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(mode)}
      aria-pressed={current === mode}
      title={label}
      className={clsx(
        'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition [&_svg]:size-3.5',
        current === mode ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
      )}
    >
      {icon}
      <span className="max-sm:hidden">{label}</span>
    </button>
  )
}

function useNarrow() {
  const query = '(max-width: 900px)'
  const [narrow, setNarrow] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const onChange = () => setNarrow(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return narrow
}
