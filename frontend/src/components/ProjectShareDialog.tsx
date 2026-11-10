import clsx from 'clsx'
import { Check, Copy, ExternalLink, Globe, Library, Lock } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type DocSummary, type Project } from '../lib/api'
import { useSetProjectSharing } from '../lib/queries'
import { useUI } from '../lib/ui'
import { Button, buttonClass, Modal, Switch } from './ui'

/**
 * Publish a project as a series: one page on the blog listing its public documents in the
 * project's order, with links between them. Documents stay public or private one by one.
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
  const { toast } = useUI()
  const sharing = useSetProjectSharing()
  const [copied, setCopied] = useState(false)
  const isPublic = Boolean(project.publishedAt)
  const url = project.slug ? `${window.location.origin}/blog/series/${project.slug}` : null
  const published = docs.filter((d) => d.publishedAt)
  const drafts = docs.length - published.length

  const update = async (input: { public: boolean; publishDocs?: boolean }) => {
    if (sharing.isPending) return
    try {
      const saved = await sharing.mutateAsync({ id: project.id, ...input })
      if (input.publishDocs) toast(`Published ${drafts} ${drafts === 1 ? 'document' : 'documents'}`)
      else toast(saved.publishedAt ? 'The series is on the blog' : 'The series is private again')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t update sharing')
    }
  }

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
    <Modal open={open} onClose={onClose} title="Share as a series" className="max-w-lg">
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
                ? 'One page lists its public documents in order, and each of them links to the next.'
                : 'Publish to group its public documents into a series, with one link for all of them.'}
            </p>
          </div>
          <Switch label="Publish as a series" checked={isPublic} onChange={(on) => update({ public: on })} />
        </div>

        {isPublic && url && (
          <>
            <div className="mt-5 flex gap-2">
              <input
                readOnly
                value={url}
                aria-label="Series link"
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 font-mono text-[12.5px] text-ink-muted outline-none focus:border-ink-faint"
              />
              <Button variant="primary" className="h-10 w-24" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {published.length > 0 && (
              <a href={url} target="_blank" rel="noopener" className={buttonClass('secondary', 'mt-2.5 h-9')}>
                <ExternalLink className="size-4" /> Open series page
              </a>
            )}
          </>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13.5px] font-medium">
              In the series <span className="font-normal text-ink-faint">{published.length}</span>
            </div>
            {drafts > 0 && (
              <Button className="h-8" disabled={sharing.isPending} onClick={() => update({ public: true, publishDocs: true })}>
                <Globe className="size-3.5" /> Publish {drafts} private {drafts === 1 ? 'doc' : 'docs'}
              </Button>
            )}
          </div>
          {isPublic && published.length === 0 && (
            <p className="mt-1 text-[12.5px] text-amber-700 dark:text-amber-400">
              None of its documents are public yet, so the series page isn’t shown.
            </p>
          )}
          <ol className="mt-2 max-h-60 space-y-0.5 overflow-y-auto">
            {docs.map((d, i) => (
              <li key={d.id} className="flex items-center gap-2.5 py-1 text-[13px]">
                <span className="w-5 shrink-0 text-right text-ink-faint tabular-nums">{i + 1}</span>
                <span className={clsx('min-w-0 flex-1 truncate', !d.publishedAt && 'text-ink-faint')}>{d.title}</span>
                {d.publishedAt ? (
                  <Globe className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Public" />
                ) : (
                  <Lock className="size-3.5 shrink-0 text-ink-faint" aria-label="Private" />
                )}
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-4 text-[12px] leading-snug text-ink-faint">
          Private documents stay out of the series. Reorder them on the project page. New documents stay private until
          you publish them.{!isPublic && project.slug && ' Publishing again keeps the same link.'}
        </p>
      </div>
    </Modal>
  )
}
