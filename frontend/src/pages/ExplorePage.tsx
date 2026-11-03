import clsx from 'clsx'
import { Eye, MessageCircle, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PublicLayout'
import { Button, Spinner } from '../components/ui'
import type { PublicDocSummary } from '../lib/api'
import { usePageAssistant } from '../lib/assistant'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useExplore } from '../lib/queries'

type Sort = 'latest' | 'popular'

/** Everything people have published, newest or most read first. */
export function ExplorePage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort: Sort = params.get('sort') === 'popular' ? 'popular' : 'latest'
  const author = params.get('author') ?? undefined
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  // Back/forward or a link changed the search: show it (and don't write the old text back).
  const [shownQ, setShownQ] = useState(q)
  if (q !== shownQ) {
    setShownQ(q)
    setInput(q)
  }

  // Type to search: update the URL (shareable, back button works) a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      if (input.trim() === q) return
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (input.trim()) next.set('q', input.trim())
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
  }, [input, q, setParams])

  const set = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const explore = useExplore({ sort, author, q: q || undefined })
  const items = explore.data?.pages.flatMap((p) => p.items) ?? []

  // Load the next page when the end of the list comes into view.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = explore
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage()
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  usePageAssistant(user ? { context: { page: 'other' }, title: 'Explore' } : null)

  return (
    <>
      <PageHeader crumbs={[{ label: 'Explore' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
          <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">Explore</h1>
          <p className="mt-1 text-[14.5px] text-ink-muted">Notes, guides and docs people have shared.</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search titles and summaries"
                enterKeyHint="search"
                aria-label="Search"
                className="h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-[16px] outline-none transition placeholder:text-ink-faint focus:border-ink-faint focus:ring-4 focus:ring-hover sm:h-10 sm:text-[14px]"
              />
            </label>
            <div role="tablist" aria-label="Sort" className="flex shrink-0 rounded-xl bg-hover p-1">
              {(['latest', 'popular'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={sort === s}
                  onClick={() => set('sort', s === 'latest' ? null : s)}
                  className={clsx(
                    'h-9 flex-1 rounded-lg px-4 text-[13.5px] font-medium transition sm:h-8',
                    sort === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {s === 'latest' ? 'Latest' : 'Most read'}
                </button>
              ))}
            </div>
          </div>

          {author && (
            <div className="mt-3 flex">
              <button
                type="button"
                onClick={() => set('author', null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-hover pr-2 pl-3 text-[13px]"
              >
                By @{author}
                <X className="size-3.5 text-ink-muted" aria-label="Show everyone" />
              </button>
            </div>
          )}

          <div className="mt-6">
            {explore.isPending ? (
              <ListSkeleton />
            ) : explore.isError ? (
              <div className="rounded-2xl border border-line px-5 py-8 text-center text-[14px] text-ink-muted">
                Couldn’t load the list.{' '}
                <button type="button" className="font-medium text-ink underline" onClick={() => explore.refetch()}>
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <Empty searching={Boolean(q || author)} signedIn={Boolean(user)} />
            ) : (
              <ul
                className={clsx('divide-y divide-line transition-opacity', explore.isPlaceholderData && 'opacity-60')}
              >
                {items.map((d) => (
                  <li key={d.slug}>
                    <ExploreItem doc={d} onAuthor={(login) => set('author', login)} />
                  </li>
                ))}
              </ul>
            )}
            <div ref={sentinel} />
            {isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {hasNextPage && !isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Button onClick={() => fetchNextPage()}>Load more</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function ExploreItem({ doc, onAuthor }: { doc: PublicDocSummary; onAuthor: (login: string) => void }) {
  return (
    <article className="group relative py-5">
      <Link to={`/s/${doc.slug}`} className="block">
        <h2 className="line-clamp-2 text-[17px] leading-snug font-semibold tracking-tight group-hover:underline group-hover:decoration-ink-faint group-hover:underline-offset-4 sm:text-[18px]">
          {doc.title}
        </h2>
        {doc.excerpt && <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">{doc.excerpt}</p>}
      </Link>
      <div className="mt-3 flex min-w-0 items-center gap-2 text-[12.5px] text-ink-faint">
        <button
          type="button"
          onClick={() => doc.author.login && onAuthor(doc.author.login)}
          disabled={!doc.author.login}
          className="flex min-w-0 items-center gap-1.5 rounded-full text-ink-muted hover:text-ink"
          title={doc.author.login ? `More from @${doc.author.login}` : undefined}
        >
          <Avatar name={doc.author.name} src={doc.author.avatarUrl} className="size-5" />
          <span className="truncate font-medium">{doc.author.name}</span>
        </button>
        <span aria-hidden>·</span>
        <time dateTime={doc.publishedAt} title={new Date(doc.publishedAt).toLocaleString()} className="shrink-0">
          {timeAgo(doc.publishedAt)}
        </time>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {doc.commentCount > 0 && (
            <span className="flex items-center gap-1" title={`${doc.commentCount} comments`}>
              <MessageCircle className="size-3.5" /> {doc.commentCount}
            </span>
          )}
          <span className="flex items-center gap-1" title={`${doc.viewCount} views`}>
            <Eye className="size-3.5" /> {compact(doc.viewCount)}
          </span>
        </span>
      </div>
    </article>
  )
}

const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n)

function ListSkeleton() {
  return (
    <div className="divide-y divide-line" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2.5 py-5">
          <div className="h-5 w-3/4 animate-pulse rounded bg-hover" />
          <div className="h-4 w-full animate-pulse rounded bg-hover" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-hover" />
        </div>
      ))}
    </div>
  )
}

function Empty({ searching, signedIn }: { searching: boolean; signedIn: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-[15px] font-medium">{searching ? 'Nothing matches that.' : 'Nothing published yet.'}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-muted">
        {searching
          ? 'Try other words, or clear the filters.'
          : signedIn
            ? 'Open one of your documents and choose Share → Publish to put it here.'
            : 'Check back soon — or sign in and publish your own notes.'}
      </p>
    </div>
  )
}
