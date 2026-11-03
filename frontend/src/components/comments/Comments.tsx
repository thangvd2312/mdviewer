import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import clsx from 'clsx'
import { Ban, ChevronDown, Ellipsis, EyeOff, Eye, MessageCircle, Pencil, Reply, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useLocation } from 'react-router'
import { api, ApiError, type CommentPage, type PublicComment, type PublicDoc, type Thread } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { timeAgo } from '../../lib/format'
import { guest } from '../../lib/guest'
import { keys, useComments } from '../../lib/queries'
import { useUI } from '../../lib/ui'
import { Avatar } from '../Avatar'
import { Button, ConfirmDialog, Spinner } from '../ui'

const MAX = 4000

/** What the viewer may do on this page's comments. */
type Settings = Pick<CommentPage, 'allowComments' | 'canModerate'>

/** Comments under a public page: newest conversations first, replies in order under each. */
export function Comments({ slug }: { slug: string }) {
  const query = useComments(slug)
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>(null)

  const pages = query.data?.pages
  const first = pages?.[0]
  // A thread can show up on two pages if new ones were posted while paging: keep the first.
  const threads = useMemo(() => {
    const seen = new Set<string>()
    return (pages ?? []).flatMap((p) => p.threads).filter((t) => !seen.has(t.comment.id) && seen.add(t.comment.id))
  }, [pages])

  // Links to a comment (#comment-<id>) scroll to it once the list is there, and it glows.
  const hashId = location.hash.startsWith('#comment-') ? location.hash.slice('#comment-'.length) : null
  const highlight = flash ?? hashId
  // The linked comment may be on a later page: load pages until it shows up (a bounded number).
  // Stops on an error (the reader can still press "Show more comments") and after 25 attempts.
  const scrolledTo = useRef<string | null>(null)
  const attempts = useRef(0)
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query
  useEffect(() => {
    if (!hashId || !pages || scrolledTo.current === hashId) return
    const el = document.getElementById(`comment-${hashId}`)
    if (el) {
      scrolledTo.current = hashId
      el.scrollIntoView({ block: 'center' })
    } else if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError && attempts.current < 25) {
      attempts.current += 1
      void fetchNextPage()
    }
  }, [hashId, pages, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  const focus = (id: string) => {
    setFlash(id)
    requestAnimationFrame(() =>
      document.getElementById(`comment-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }

  return (
    <section id="comments" aria-labelledby="comments-title" className="mt-16 scroll-mt-4 border-t border-line pt-8">
      <h2 id="comments-title" className="flex items-baseline gap-2 text-[19px] font-semibold tracking-tight">
        Comments
        {first && first.count > 0 && <span className="text-[15px] font-normal text-ink-faint">{first.count}</span>}
      </h2>

      {query.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : query.isError || !first ? (
        <p className="mt-4 text-[14px] text-ink-muted">
          Couldn’t load comments.{' '}
          <button type="button" className="font-medium text-ink underline" onClick={() => query.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <>
          {first.allowComments ? (
            <div className="mt-5">
              <Composer slug={slug} onPosted={focus} />
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-raised px-4 py-3 text-[13.5px] text-ink-muted">
              The author has turned off comments for this page.
            </p>
          )}

          {threads.length === 0 ? (
            first.allowComments && (
              <div className="mt-8 flex flex-col items-center py-6 text-center">
                <MessageCircle className="size-8 text-ink-faint" strokeWidth={1.5} />
                <p className="mt-2 text-[14px] font-medium">No comments yet</p>
                <p className="text-[13px] text-ink-muted">Questions, thanks, corrections — start the conversation.</p>
              </div>
            )
          ) : (
            <ol className="mt-8 space-y-7">
              {threads.map((t) => (
                <li key={t.comment.id}>
                  <CommentItem
                    slug={slug}
                    thread={t}
                    settings={first}
                    version={query.dataUpdatedAt}
                    highlight={highlight}
                    onPosted={focus}
                  />
                </li>
              ))}
            </ol>
          )}

          {query.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <Button
                className="h-10 rounded-full px-5"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? <Spinner className="size-3.5" /> : <ChevronDown className="size-4" />}
                Show more comments
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CommentItem({
  slug,
  thread,
  settings,
  version,
  highlight,
  onPosted,
}: {
  slug: string
  thread: Thread
  settings: Settings
  /** Changes whenever the comment list was re-fetched or updated. */
  version: number
  highlight: string | null
  onPosted: (id: string) => void
}) {
  const { toast } = useUI()
  const comment = thread.comment
  const [replyTo, setReplyTo] = useState<{ name: string } | null>(null)
  // Replies loaded with "Show more replies", after the ones that came with the thread.
  const [more, setMore] = useState<{ replies: PublicComment[]; cursor: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const reply = (c: PublicComment) => setReplyTo({ name: c.author.kind === 'gone' ? '' : c.author.name })

  const replies = useMemo(() => {
    const seen = new Set<string>()
    return [...thread.replies, ...(more?.replies ?? [])]
      .filter((r) => !seen.has(r.id) && seen.add(r.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  }, [thread.replies, more])
  const cursor = more ? more.cursor : thread.moreReplies

  /**
   * Whenever the comment list is refreshed (after any edit or moderation — e.g. blocking someone
   * hides their replies in every thread), re-fetch the reply pages this thread loaded with "Show more".
   */
  const reloadMore = async () => {
    if (!more) return
    const wanted = thread.replies.length + more.replies.length
    const replies: PublicComment[] = []
    let after: string | undefined
    try {
      do {
        const page = await api.public.replies(comment.id, after)
        replies.push(...page.replies)
        after = page.moreReplies ?? undefined
      } while (after && replies.length < wanted)
      setMore({ replies, cursor: after ?? null })
    } catch {
      setMore(null) // fall back to the first replies only
    }
  }

  const reloadRef = useRef(reloadMore)
  useLayoutEffect(() => {
    reloadRef.current = reloadMore
  })
  const seenVersion = useRef(version)
  useEffect(() => {
    if (version === seenVersion.current) return
    seenVersion.current = version
    void reloadRef.current()
  }, [version])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await api.public.replies(comment.id, cursor)
      setMore((m) => ({ replies: [...(m?.replies ?? []), ...page.replies], cursor: page.moreReplies }))
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t load the replies')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div>
      <SingleComment
        slug={slug}
        comment={comment}
        thread={settings}
        highlighted={highlight === comment.id}
        onReply={settings.allowComments && !comment.deleted ? () => reply(comment) : undefined}
      />
      {(replies.length > 0 || replyTo || cursor) && (
        <div className="mt-4 ml-[15px] space-y-5 border-l-2 border-line pl-4 sm:ml-[17px] sm:pl-5">
          {replies.map((r) => (
            <SingleComment
              key={r.id}
              slug={slug}
              comment={r}
              thread={settings}
              small
              highlighted={highlight === r.id}
              onReply={settings.allowComments && !comment.deleted ? () => reply(r) : undefined}
            />
          ))}
          {cursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="-ml-2 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-accent hover:bg-hover"
            >
              {loadingMore ? <Spinner className="size-3.5" /> : <ChevronDown className="size-4" />}
              Show more replies
            </button>
          )}
          {replyTo && (
            <Composer
              slug={slug}
              parentId={comment.id}
              initial={replyTo.name ? `@${replyTo.name} ` : ''}
              autoFocus
              onCancel={() => setReplyTo(null)}
              onPosted={(id) => {
                setReplyTo(null)
                onPosted(id)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SingleComment({
  slug,
  comment: c,
  thread,
  small,
  highlighted,
  onReply,
}: {
  slug: string
  comment: PublicComment
  thread: Settings
  small?: boolean
  highlighted?: boolean
  onReply?: () => void
}) {
  const { toast } = useUI()
  const queryClient = useQueryClient()
  // An unsaved edit survives a remount (e.g. signing in again after the session expired).
  const [editing, setEditing] = useState(() => readDraft(editDraftKey(c.id)) !== null)
  const [confirm, setConfirm] = useState<'delete' | 'block' | null>(null)
  const [busy, setBusy] = useState(false)
  const guestToken = c.author.kind === 'guest' ? guest.token(c.id) : undefined
  const canEdit = !c.deleted && (c.mine || Boolean(guestToken))
  const canDelete = !c.deleted && (canEdit || thread.canModerate)
  const isDocAuthorComment = c.author.kind === 'user' && c.author.isDocAuthor

  // Refreshing the list also refreshes reply pages loaded with "Show more" (see CommentItem).
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.comments(slug) })
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await action()
      toast(done)
      await refresh()
      void queryClient.invalidateQueries({ queryKey: keys.publicDoc(slug) })
      void queryClient.invalidateQueries({ queryKey: ['public', 'blocks'] })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  if (c.deleted) {
    return (
      <div id={`comment-${c.id}`} className="flex items-center gap-3 text-[13.5px] text-ink-faint italic">
        <span className={clsx('shrink-0 rounded-full bg-hover', small ? 'size-7' : 'size-8')} />
        This comment was deleted.
      </div>
    )
  }

  const name = c.author.kind === 'gone' ? 'Former member' : c.author.name
  const actions: ReactNode[] = []
  if (canEdit)
    actions.push(
      <MenuAction key="edit" icon={<Pencil />} onClick={() => setEditing(true)}>
        Edit
      </MenuAction>,
    )
  if (thread.canModerate && !isDocAuthorComment) {
    actions.push(
      <MenuAction
        key="hide"
        icon={c.hidden ? <Eye /> : <EyeOff />}
        onClick={() =>
          run(() => api.public.hideComment(c.id, !c.hidden), c.hidden ? 'Comment shown' : 'Comment hidden')
        }
      >
        {c.hidden ? 'Show to everyone' : 'Hide from others'}
      </MenuAction>,
      <MenuAction
        key="block"
        icon={<Ban />}
        onClick={() => (c.blocked ? run(() => api.public.unblockAuthor(c.id), 'Unblocked') : setConfirm('block'))}
      >
        {c.blocked ? 'Unblock this person' : 'Block this person'}
      </MenuAction>,
    )
  }
  if (canDelete)
    actions.push(
      <MenuAction key="delete" icon={<Trash2 />} danger onClick={() => setConfirm('delete')}>
        Delete
      </MenuAction>,
    )

  return (
    <article
      id={`comment-${c.id}`}
      className={clsx(
        'flex scroll-mt-24 gap-3 rounded-xl transition-[background-color,box-shadow] duration-700',
        highlighted && 'animate-[comment-flash_2.4s_ease-out]',
        c.hidden && 'opacity-60',
      )}
    >
      <Avatar
        name={name}
        src={c.author.kind === 'user' ? c.author.avatarUrl : null}
        muted={c.author.kind !== 'user'}
        className={small ? 'size-7' : 'size-8'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-7 items-center gap-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] leading-tight">
            {c.author.kind === 'user' && c.author.login ? (
              <Link
                to={`/explore?author=${encodeURIComponent(c.author.login)}`}
                className="truncate font-semibold hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="truncate font-semibold">{name}</span>
            )}
            {isDocAuthorComment && <Badge tone="accent">Author</Badge>}
            {c.author.kind === 'guest' && <Badge>Guest</Badge>}
            {c.hidden && <Badge tone="warn">Hidden</Badge>}
            {c.blocked && <Badge tone="danger">Blocked</Badge>}
            <span className="text-ink-faint">
              ·{' '}
              <a href={`#comment-${c.id}`} title={new Date(c.createdAt).toLocaleString()} className="hover:underline">
                {timeAgo(c.createdAt)}
              </a>
              {c.editedAt && <span title={`Edited ${new Date(c.editedAt).toLocaleString()}`}> · edited</span>}
            </span>
          </div>
          {actions.length > 0 && <ActionsMenu busy={busy}>{actions}</ActionsMenu>}
        </div>

        {editing ? (
          <EditBox
            comment={c}
            guestToken={guestToken}
            onDone={async (saved) => {
              setEditing(false)
              if (saved) await refresh()
            }}
          />
        ) : (
          <p className="mt-1 text-[14.5px] leading-relaxed break-words whitespace-pre-wrap">{linkify(c.body)}</p>
        )}

        {!editing && (onReply || (thread.canModerate && c.device)) && (
          <div className="mt-1 -ml-2 flex items-center gap-2">
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-ink-muted transition hover:bg-hover hover:text-ink"
              >
                <Reply className="size-3.5" /> Reply
              </button>
            )}
            {thread.canModerate && c.device && (
              <span className="truncate text-[11.5px] text-ink-faint" title="Only you see this">
                {c.device}
              </span>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete comment?"
        message={
          c.mine || guestToken ? 'Your comment will be removed.' : `${name}’s comment will be removed for everyone.`
        }
        busy={busy}
        onConfirm={() =>
          run(async () => {
            await api.public.deleteComment(c.id, guestToken)
            guest.forget(c.id)
          }, 'Comment deleted')
        }
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'block'}
        title={`Block ${name}?`}
        confirmLabel="Block"
        message={
          c.author.kind === 'guest'
            ? 'They won’t be able to comment on any of your pages from this network, and everything they wrote on your pages will be hidden.'
            : 'They won’t be able to comment on any of your pages, and everything they wrote on your pages will be hidden.'
        }
        busy={busy}
        onConfirm={() => run(() => api.public.blockAuthor(c.id), `${name} is blocked`)}
        onClose={() => setConfirm(null)}
      />
    </article>
  )
}

/** Writing a comment or a reply. Guests can pick a name; their IP and device are stored (said below the box). */
function Composer({
  slug,
  parentId,
  initial = '',
  autoFocus,
  onCancel,
  onPosted,
}: {
  slug: string
  parentId?: string
  initial?: string
  autoFocus?: boolean
  onCancel?: () => void
  onPosted: (id: string) => void
}) {
  const { user } = useAuth()
  const location = useLocation()
  const queryClient = useQueryClient()
  // The draft survives navigation and a sign-in round-trip (kept for this tab only).
  const draftKey = `viewmd.draft:${slug}:${parentId ?? 'top'}`
  const [body, setBodyState] = useState(() => readDraft(draftKey) ?? initial)
  const setBody = (text: string) => {
    setBodyState(text)
    writeDraft(draftKey, text === initial ? '' : text)
  }
  const [name, setName] = useState(() => guest.name())
  const [website, setWebsite] = useState('') // honeypot
  const [focused, setFocused] = useState(Boolean(autoFocus))
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // When the reader started writing (sent along: bots post the instant the form appears).
  const openedAt = useRef(0)
  useEffect(() => {
    openedAt.current = Date.now()
  }, [])
  const ref = useRef<HTMLTextAreaElement>(null)
  const expanded = focused || body.trim() !== '' || Boolean(parentId)

  useAutosize(ref, body)
  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus])

  const submit = async () => {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    try {
      const { comment, guestToken } = await api.public.comment(slug, {
        body: text,
        parentId,
        ...(!user && { guestName: name.trim() || undefined }),
        website,
        elapsedMs: Date.now() - openedAt.current,
      })
      if (guestToken) guest.remember(comment.id, guestToken)
      if (!user) guest.setName(name)
      queryClient.setQueryData<InfiniteData<CommentPage>>(keys.comments(slug), (data) =>
        data ? addToPages(data, comment) : data,
      )
      queryClient.setQueryData<PublicDoc>(keys.publicDoc(slug), (d) =>
        d ? { ...d, commentCount: d.commentCount + 1 } : d,
      )
      setBody('')
      setFocused(false)
      ref.current?.blur()
      onPosted(comment.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t post your comment. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      // Focus anywhere in the form (the text, the name field, the buttons) keeps it open.
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      className="relative flex gap-3"
    >
      <Avatar
        name={user?.name ?? (name || 'Guest')}
        src={user?.avatarUrl}
        muted={!user}
        className={parentId ? 'size-7' : 'size-8'}
      />
      <div className="min-w-0 flex-1">
        <div
          className={clsx(
            'rounded-xl border bg-surface transition',
            focused ? 'border-ink-faint ring-4 ring-hover' : 'border-line',
          )}
        >
          <textarea
            ref={ref}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => {
              if (!focused && !body) openedAt.current = Date.now()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                void submit()
              }
              if (e.key === 'Escape' && onCancel) onCancel()
            }}
            rows={expanded ? 3 : 1}
            maxLength={MAX}
            placeholder={parentId ? 'Write a reply…' : 'Add a comment…'}
            aria-label={parentId ? 'Reply' : 'Comment'}
            className="block max-h-80 min-h-11 w-full resize-none bg-transparent px-3.5 py-2.5 text-[16px] leading-relaxed outline-none placeholder:text-ink-faint sm:text-[14.5px]"
          />
          {!user && expanded && (
            <div className="border-t border-line px-3.5 py-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                autoComplete="nickname"
                placeholder="Your name (optional)"
                aria-label="Your name"
                className="h-8 w-full bg-transparent text-[16px] outline-none placeholder:text-ink-faint sm:text-[13.5px]"
              />
            </div>
          )}
          {/* Honeypot: hidden from people (and screen readers); bots tend to fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}

        {expanded && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="min-w-0 flex-1 basis-56 text-[12px] leading-snug text-ink-faint">
              {user ? (
                <>
                  Posting as <span className="font-medium text-ink-muted">{user.name}</span>. Your IP address and device
                  are saved to prevent spam.
                </>
              ) : (
                <>
                  Posting as a guest — your IP address and device are saved to prevent spam.{' '}
                  <Link
                    to="/login"
                    state={{ from: location.pathname + '#comments' }}
                    className="font-medium text-ink-muted underline underline-offset-2 hover:text-ink"
                  >
                    Sign in
                  </Link>{' '}
                  to comment with your name.
                </>
              )}
            </p>
            <div className="ml-auto flex shrink-0 gap-2">
              {(onCancel || body) && (
                <Button
                  variant="ghost"
                  className="h-9"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setBody('')
                    setError(null)
                    setFocused(false)
                    ref.current?.blur()
                    onCancel?.()
                  }}
                >
                  Cancel
                </Button>
              )}
              <button
                type="submit"
                disabled={!body.trim() || sending}
                onMouseDown={(e) => e.preventDefault()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-4 text-[13.5px] font-medium text-surface transition hover:opacity-90 disabled:opacity-40"
              >
                {sending && <Spinner className="size-3.5 border-surface/30 border-t-surface" />}
                {parentId ? 'Reply' : 'Comment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}

function EditBox({
  comment,
  guestToken,
  onDone,
}: {
  comment: PublicComment
  guestToken?: string
  onDone: (saved: boolean) => void
}) {
  const { toast } = useUI()
  const draftKey = editDraftKey(comment.id)
  const [body, setBodyState] = useState(() => readDraft(draftKey) ?? comment.body)
  const setBody = (text: string) => {
    setBodyState(text)
    writeDraftRaw(draftKey, text)
  }
  // Opening the editor starts a draft (so a remount resumes editing); closing ends it.
  useEffect(() => {
    if (readDraft(draftKey) === null) writeDraftRaw(draftKey, comment.body)
  }, [draftKey, comment.body])
  const finish = (saved: boolean) => {
    writeDraft(draftKey, '')
    onDone(saved)
  }
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutosize(ref, body)
  useEffect(() => {
    const el = ref.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const save = async () => {
    if (!body.trim() || saving) return
    if (body.trim() === comment.body) return finish(false)
    setSaving(true)
    try {
      await api.public.editComment(comment.id, body.trim(), guestToken)
      finish(true)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t save the comment')
      setSaving(false)
    }
  }

  return (
    <div className="mt-1.5">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
          if (e.key === 'Escape') finish(false)
        }}
        maxLength={MAX}
        aria-label="Edit comment"
        className="block max-h-80 w-full resize-none rounded-xl border border-ink-faint bg-surface px-3.5 py-2.5 text-[16px] leading-relaxed ring-4 ring-hover outline-none sm:text-[14.5px]"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" className="h-9" onClick={() => finish(false)}>
          Cancel
        </Button>
        <Button variant="primary" className="h-9" disabled={!body.trim() || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

/** "…" menu for a comment's actions. */
function ActionsMenu({ children, busy }: { children: ReactNode; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Comment actions"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'grid size-8 place-items-center rounded-lg text-ink-faint transition hover:bg-hover hover:text-ink',
          open && 'bg-hover text-ink',
        )}
      >
        {busy ? <Spinner className="size-3.5" /> : <Ellipsis className="size-4" />}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-xl border border-line bg-surface p-1 shadow-xl"
        >
          {children}
        </div>
      )}
    </div>
  )
}

function MenuAction({
  icon,
  children,
  danger,
  onClick,
}: {
  icon: ReactNode
  children: ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={clsx(
        'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] hover:bg-hover sm:h-8 sm:text-[13px] [&_svg]:size-4',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className={danger ? '' : 'text-ink-muted'}>{icon}</span>
      {children}
    </button>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'accent' | 'warn' | 'danger' }) {
  return (
    <span
      className={clsx(
        'rounded-md px-1.5 py-px text-[11px] font-medium',
        tone === 'accent'
          ? 'bg-accent/10 text-accent'
          : tone === 'warn'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
            : tone === 'danger'
              ? 'bg-danger/10 text-danger'
              : 'bg-hover text-ink-muted',
      )}
    >
      {children}
    </span>
  )
}

/** Shows a just-posted comment: a new thread at the top, or a reply at the end of its thread. */
function addToPages(data: InfiniteData<CommentPage>, comment: PublicComment): InfiniteData<CommentPage> {
  const pages = data.pages.map((page, i) => {
    let threads = page.threads
    if (!comment.parentId) {
      if (i === 0) threads = [{ comment, replies: [], moreReplies: null }, ...threads]
    } else {
      threads = threads.map((t) => (t.comment.id === comment.parentId ? { ...t, replies: [...t.replies, comment] } : t))
    }
    return { ...page, threads, count: page.count + 1 }
  })
  return { ...data, pages }
}

function readDraft(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const editDraftKey = (commentId: string) => `viewmd.edit:${commentId}`

/** Stores the text as is (even empty), so "editing" itself is remembered. */
function writeDraftRaw(key: string, text: string) {
  try {
    sessionStorage.setItem(key, text)
  } catch {
    /* private mode */
  }
}

function writeDraft(key: string, text: string) {
  try {
    if (text.trim()) sessionStorage.setItem(key, text)
    else sessionStorage.removeItem(key)
  } catch {
    /* private mode: no draft kept */
  }
}

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"])/gi

/** Plain text with web addresses turned into links (opened in a new tab, not endorsed for SEO). */
function linkify(text: string): ReactNode[] {
  const parts = text.split(URL_RE)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part.startsWith('www.') ? `https://${part}` : part}
        target="_blank"
        rel="nofollow ugc noopener noreferrer"
        className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}
