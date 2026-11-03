import clsx from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Check, Copy, ExternalLink, Globe, Lock, MessageCircle, Share2 } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError, type Doc } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useBlocks, useSetSharing } from '../lib/queries'
import { Avatar } from './Avatar'
import { useUI } from '../lib/ui'
import { Button, buttonClass, Modal, Switch } from './ui'

/** Publish a document to the web (its own link + Explore), and choose whether readers can comment. */
export function ShareDialog({ doc, open, onClose }: { doc: Doc; open: boolean; onClose: () => void }) {
  const { toast } = useUI()
  const sharing = useSetSharing()
  const [copied, setCopied] = useState(false)
  const isPublic = Boolean(doc.publishedAt)
  const url = doc.slug ? `${window.location.origin}/s/${doc.slug}` : null

  // Taps while a change is saving are ignored (the switch isn't disabled: that would drop keyboard focus).
  const update = async (input: { public?: boolean; allowComments?: boolean }) => {
    if (sharing.isPending) return
    try {
      const saved = await sharing.mutateAsync({ id: doc.id, ...input })
      if (input.public !== undefined)
        toast(saved.publishedAt ? 'Published — anyone with the link can read it' : 'Unpublished')
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
    <Modal open={open} onClose={onClose} title="Share" className="max-w-lg">
      <div className="px-5 pt-3 pb-5">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              isPublic ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-hover text-ink-muted',
            )}
          >
            {isPublic ? <Globe className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium">{isPublic ? 'Public on the web' : 'Private'}</div>
            <p className="text-[13px] leading-snug text-ink-muted">
              {isPublic
                ? 'Anyone with the link can read it, and it’s listed on Explore.'
                : 'Only you can see it. Publish to give it a link anyone can open.'}
            </p>
          </div>
          <Switch label="Publish to the web" checked={isPublic} onChange={(on) => update({ public: on })} />
        </div>

        {isPublic && url && (
          <>
            <div className="mt-5 flex gap-2">
              <input
                readOnly
                value={url}
                aria-label="Public link"
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 font-mono text-[12.5px] text-ink-muted outline-none focus:border-ink-faint"
              />
              <Button variant="primary" className="h-10 w-24" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noopener" className={buttonClass('secondary', 'h-9')}>
                <ExternalLink className="size-4" /> Open public page
              </a>
              {typeof navigator.share === 'function' && (
                <Button
                  className="h-9"
                  onClick={() => navigator.share({ title: doc.title, url }).catch(() => undefined)}
                >
                  <Share2 className="size-4" /> Send…
                </Button>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
              <MessageCircle className="size-4.5 shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">Allow comments</div>
                <p className="text-[12.5px] text-ink-muted">Readers can comment, signed in or as guests.</p>
              </div>
              <Switch
                label="Allow comments"
                checked={doc.allowComments}
                onChange={(on) => update({ allowComments: on })}
              />
            </div>
          </>
        )}

        <BlockedPeople enabled={open} />

        <p className="mt-5 text-[12px] text-ink-faint">
          Your sticky notes and AI chats always stay private.
          {!isPublic && doc.slug && ' Publishing again keeps the same link.'}
        </p>
      </div>
    </Modal>
  )
}

/** People the author blocked from commenting (on all their pages), with a way to undo it. */
function BlockedPeople({ enabled }: { enabled: boolean }) {
  const { toast } = useUI()
  const queryClient = useQueryClient()
  const blocks = useBlocks(enabled)
  const [busy, setBusy] = useState<string | null>(null)
  const items = blocks.data?.pages.flatMap((p) => p.items) ?? []
  if (items.length === 0) return null

  const unblock = async (id: string, name: string) => {
    setBusy(id)
    try {
      await api.public.removeBlock(id)
      toast(`${name} can comment again`)
      await queryClient.invalidateQueries({ queryKey: ['public'] })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t unblock')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center gap-2 text-[13.5px] font-medium">
        <Ban className="size-4 text-ink-muted" /> Blocked from commenting
        <span className="font-normal text-ink-faint">{items.length}</span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">
        On all your public pages. Their earlier comments stay hidden.
      </p>
      <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto">
        {items.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-2">
            <Avatar name={b.name} muted={b.kind === 'guest'} className="size-7" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13.5px]">
                {b.name}
                {b.kind === 'guest' && <span className="text-ink-faint"> · guest</span>}
              </div>
              <div className="truncate text-[12px] text-ink-faint">
                {[b.device, `blocked ${timeAgo(b.createdAt)}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button className="h-8 shrink-0" disabled={busy === b.id} onClick={() => unblock(b.id, b.name)}>
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      {blocks.hasNextPage && (
        <Button variant="ghost" className="mt-1 h-8" onClick={() => blocks.fetchNextPage()}>
          Show more
        </Button>
      )}
    </div>
  )
}
