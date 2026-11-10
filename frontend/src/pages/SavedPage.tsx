import clsx from 'clsx'
import { Bookmark, Check, Clock, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { Avatar } from '../components/Avatar'
import { postUrl } from '../components/blog/Posts'
import { Button, buttonClass, IconButton, Spinner } from '../components/ui'
import type { SavedItem, SavedStatus } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useSavedList, useSaveMutations } from '../lib/queries'
import { useUI } from '../lib/ui'

const TABS: { status: SavedStatus; label: string }[] = [
  { status: 'unread', label: 'To read' },
  { status: 'read', label: 'Read' },
  { status: 'all', label: 'All' },
]

/** Public posts the user saved to read later. /saved */
export function SavedPage() {
  const [status, setStatus] = useState<SavedStatus>('unread')
  const list = useSavedList(status)
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const counts = list.data?.pages[0]?.counts

  useEffect(() => {
    document.title = 'Saved · viewmd'
    return () => {
      document.title = 'viewmd'
    }
  }, [])

  const count = (s: SavedStatus) =>
    !counts ? null : s === 'unread' ? counts.unread : s === 'read' ? counts.read : counts.unread + counts.read

  return (
    <>
      <TopBar crumbs={[{ label: 'Saved' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-24 md:px-8 md:pt-14">
          <h1 className="text-[28px] font-semibold tracking-tight">Saved</h1>
          <p className="mt-1 text-[14.5px] text-ink-muted">
            Posts you saved from the blog. A post moves to Read when you reach its end.
          </p>

          <div role="tablist" aria-label="Show" className="mt-6 flex border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.status}
                type="button"
                role="tab"
                aria-selected={status === t.status}
                onClick={() => setStatus(t.status)}
                className={clsx(
                  '-mb-px border-b-2 px-3 pb-2.5 text-[13.5px] font-medium whitespace-nowrap transition',
                  status === t.status ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {t.label}
                {count(t.status) !== null && <span className="ml-1.5 text-ink-faint tabular-nums">{count(t.status)}</span>}
              </button>
            ))}
          </div>

          {list.isPending ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <Empty status={status} />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.slug}>
                  <Row item={item} />
                </li>
              ))}
            </ul>
          )}
          {list.hasNextPage && (
            <div className="flex justify-center py-6">
              <Button className="h-9 rounded-full px-4" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Row({ item }: { item: SavedItem }) {
  const { toast } = useUI()
  const { post, read } = useSaveMutations()
  const isRead = Boolean(item.readAt)
  const remove = () =>
    post.mutate({ slug: item.slug, save: false }, { onError: () => toast('Couldn’t remove it') })
  const toggleRead = () =>
    read.mutate({ slug: item.slug, read: !isRead }, { onError: () => toast('Couldn’t update it') })

  return (
    <article className="group flex items-start gap-3 py-4">
      <div className="min-w-0 flex-1">
        {item.available ? (
          <Link
            to={postUrl(item.slug)}
            className={clsx(
              'line-clamp-2 text-[16px] leading-snug font-semibold tracking-tight hover:underline',
              isRead && 'text-ink-muted',
            )}
          >
            {item.title}
          </Link>
        ) : (
          <span className="line-clamp-2 text-[16px] leading-snug font-semibold tracking-tight text-ink-faint line-through">
            {item.title}
          </span>
        )}
        {item.available ? (
          <>
            {item.excerpt && <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-ink-muted">{item.excerpt}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-faint">
              {item.author && (
                <span className="flex items-center gap-1.5">
                  <Avatar name={item.author.name} src={item.author.avatarUrl} className="size-4" /> {item.author.name}
                </span>
              )}
              {item.readMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {item.readMinutes} min read
                </span>
              )}
              <span>{isRead ? `read ${timeAgo(item.readAt!)}` : `saved ${timeAgo(item.savedAt)}`}</span>
            </div>
          </>
        ) : (
          <p className="mt-1 text-[13px] text-ink-faint">The author no longer shares this post.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {item.available && (
          <IconButton label={isRead ? 'Mark as not read' : 'Mark as read'} onClick={toggleRead}>
            {isRead ? <RotateCcw /> : <Check />}
          </IconButton>
        )}
        <IconButton label="Remove from Saved" onClick={remove}>
          <X />
        </IconButton>
      </div>
    </article>
  )
}

function Empty({ status }: { status: SavedStatus }) {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <Bookmark className="size-8 text-ink-faint" strokeWidth={1.5} />
      <p className="mt-3 text-[15px] font-medium">
        {status === 'unread' ? 'Nothing left to read' : status === 'read' ? 'Nothing read yet' : 'Nothing saved yet'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-muted">
        Press the bookmark on any post on the blog to keep it here for later.
      </p>
      <Link to="/blog" className={buttonClass('secondary', 'mt-4 h-9 rounded-full px-4')}>
        Browse the blog
      </Link>
    </div>
  )
}
