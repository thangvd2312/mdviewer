import clsx from 'clsx'
import { Check, Copy, ExternalLink, Globe, Library, Lock } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type DocSummary, type Project } from '../lib/api'
import { useSetProjectSharing } from '../lib/queries'
import { useUI } from '../lib/ui'
import { Button, buttonClass, Modal } from './ui'

/**
 * Publish a project as a series: one page on the blog listing its public documents in the
 * project's order, with links between them. The author ticks which documents are public, all in
 * one go, and can make them all private again when the series stops.
 */
export function ProjectShareDialog({
  project,
  docs,
  open,
  onClose,
}: {
  project: Project
  /** The project's documents, in order. */
  docs: DocSummary[]
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Share as a series" className="max-w-lg">
      {/* Fresh choices every time it opens. */}
      {open && <Body project={project} docs={docs} onClose={onClose} />}
    </Modal>
  )
}

function Body({ project, docs, onClose }: { project: Project; docs: DocSummary[]; onClose: () => void }) {
  const { toast } = useUI()
  const sharing = useSetProjectSharing()
  const [copied, setCopied] = useState(false)
  const isPublic = Boolean(project.publishedAt)
  const url = project.slug ? `${window.location.origin}/blog/series/${project.slug}` : null
  const publicNow = docs.filter((d) => d.publishedAt).map((d) => d.id)

  // Publishing: everything ticked to start with. Already public: as the documents are now.
  const [selected, setSelected] = useState(() => new Set(isPublic ? publicNow : docs.map((d) => d.id)))
  const [stopping, setStopping] = useState(false)
  const [alsoPrivate, setAlsoPrivate] = useState(true)
  const dirty = selected.size !== publicNow.length || publicNow.some((id) => !selected.has(id))
  const allSelected = selected.size === docs.length

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async (input: { public: boolean; publicDocIds?: string[] }, done: string) => {
    if (sharing.isPending) return
    try {
      await sharing.mutateAsync({ id: project.id, ...input })
      toast(done)
      if (!input.public) onClose()
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t update sharing')
    }
  }
  const ids = () => docs.filter((d) => selected.has(d.id)).map((d) => d.id)
  const docsLabel = (n: number) => `${n} ${n === 1 ? 'document' : 'documents'}`

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('Couldn’t copy the link')
    }
  }

  return (
    <div className="px-5 pt-3 pb-5">
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            isPublic ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-hover text-ink-muted',
          )}
        >
          {isPublic ? <Library className="size-5" /> : <Lock className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">{isPublic ? 'Series on the blog' : 'Private project'}</div>
          <p className="text-[13px] leading-snug text-ink-muted">
            {isPublic
              ? 'One page lists the ticked documents in order, and each of them links to the next.'
              : 'Tick the documents to publish. They go on the blog together, as a series with one link.'}
          </p>
        </div>
      </div>

      {isPublic && url && (
        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={url}
            aria-label="Series link"
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 font-mono text-[12.5px] text-ink-muted outline-none focus:border-ink-faint"
          />
          <Button className="h-10 w-24" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {publicNow.length > 0 && (
            <a href={url} target="_blank" rel="noopener" className={buttonClass('secondary', 'h-10 px-3')} title="Open series page">
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[13.5px] font-medium">
            Public documents{' '}
            <span className="font-normal text-ink-faint">
              {selected.size}/{docs.length}
            </span>
          </div>
          {docs.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(new Set(allSelected ? [] : docs.map((d) => d.id)))}
              className="text-[12.5px] font-medium text-ink-muted hover:text-ink"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">This project has no documents yet.</p>
        ) : (
          <ol className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {docs.map((d, i) => {
              const on = selected.has(d.id)
              return (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13.5px] hover:bg-hover">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(d.id)}
                      className="size-4 shrink-0 accent-emerald-600"
                    />
                    <span className="w-5 shrink-0 text-right text-[12px] text-ink-faint tabular-nums">{i + 1}</span>
                    <span className={clsx('min-w-0 flex-1 truncate', !on && 'text-ink-muted')}>{d.title}</span>
                    {d.publishedAt ? (
                      <Globe className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Public now" />
                    ) : (
                      <Lock className="size-3.5 shrink-0 text-ink-faint" aria-label="Private now" />
                    )}
                  </label>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {stopping ? (
        <div className="mt-4 rounded-xl border border-line bg-raised p-3.5">
          <div className="text-[13.5px] font-medium">Stop sharing the series?</div>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">The series page goes away. Its link comes back if you publish again.</p>
          {publicNow.length > 0 && (
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={alsoPrivate}
                onChange={(e) => setAlsoPrivate(e.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Also make its {docsLabel(publicNow.length)} private
            </label>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button className="h-9" onClick={() => setStopping(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="h-9"
              disabled={sharing.isPending}
              onClick={() =>
                save(
                  { public: false, ...(alsoPrivate && publicNow.length > 0 && { publicDocIds: [] }) },
                  alsoPrivate && publicNow.length > 0 ? 'Series and its documents are private again' : 'The series is private again',
                )
              }
            >
              Stop sharing
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          {isPublic && (
            <Button variant="ghost" className="h-9 text-ink-muted" onClick={() => setStopping(true)}>
              Stop sharing
            </Button>
          )}
          <span className="flex-1" />
          {isPublic ? (
            <Button
              variant="primary"
              className="h-9"
              disabled={!dirty || sharing.isPending}
              onClick={() => save({ public: true, publicDocIds: ids() }, 'Saved')}
            >
              Save changes
            </Button>
          ) : (
            <Button
              variant="primary"
              className="h-9"
              disabled={selected.size === 0 || sharing.isPending}
              onClick={() =>
                save({ public: true, publicDocIds: ids() }, `Published the series with ${docsLabel(selected.size)}`)
              }
            >
              <Globe className="size-4" /> Publish series
            </Button>
          )}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-snug text-ink-faint">
        Ticked documents are public on their own too, each with its own link. Sensitive details in them are hidden from
        readers. New documents stay private until you tick them. Reorder on the project page.
      </p>
    </div>
  )
}
