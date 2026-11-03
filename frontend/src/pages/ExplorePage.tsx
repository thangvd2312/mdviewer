import clsx from 'clsx'
import { Clock, Compass, Eye, MessageCircle, Search, X } from 'lucide-react'
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

  // The newest doc is shown large — only on the plain, unfiltered list.
  const featureFirst = sort === 'latest' && !q && !author

  return (
    <>
      <PageHeader crumbs={[{ label: 'Explore' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24 sm:px-8 sm:pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[34px]">Explore</h1>
              <p className="mt-1 text-[14px] text-ink-muted sm:text-[15px]">
                Notes, guides and docs people have shared<span className="max-sm:hidden"> — free to read</span>.
              </p>
            </div>
            <div role="tablist" aria-label="Sort" className="inline-flex shrink-0 rounded-full bg-hover p-1">
              {(['latest', 'popular'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={sort === s}
                  onClick={() => set('sort', s === 'latest' ? null : s)}
                  className={clsx(
                    'h-8 rounded-full px-3.5 text-[13.5px] font-medium whitespace-nowrap transition sm:px-4',
                    sort === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {s === 'latest' ? 'Latest' : 'Most read'}
                </button>
              ))}
            </div>
          </div>

          <label className="relative mt-5 block sm:mt-6">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search titles and summaries"
              enterKeyHint="search"
              aria-label="Search"
              className="h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-11 text-[16px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition outline-none placeholder:text-ink-faint focus:border-ink-faint focus:ring-4 focus:ring-hover sm:text-[15px]"
            />
          </label>

          {author && (
            <button
              type="button"
              onClick={() => set('author', null)}
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full border border-line pr-2.5 pl-3.5 text-[13px] text-ink-muted hover:text-ink"
            >
              By <span className="font-medium text-ink">@{author}</span>
              <X className="size-3.5" aria-label="Show everyone" />
            </button>
          )}

          <div className="mt-6">
            {explore.isPending ? (
              <CardsSkeleton />
            ) : explore.isError ? (
              <div className="rounded-2xl border border-line px-5 py-10 text-center text-[14px] text-ink-muted">
                Couldn’t load the list.{' '}
                <button type="button" className="font-medium text-ink underline" onClick={() => explore.refetch()}>
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <Empty searching={Boolean(q || author)} signedIn={Boolean(user)} />
            ) : (
              <ul
                className={clsx(
                  'grid gap-4 transition-opacity sm:grid-cols-2',
                  explore.isPlaceholderData && 'opacity-60',
                )}
              >
                {items.map((d, i) => (
                  <li key={d.slug} className={clsx('flex', featureFirst && i === 0 && 'sm:col-span-2')}>
                    <DocCard doc={d} featured={featureFirst && i === 0} onAuthor={(login) => set('author', login)} />
                  </li>
                ))}
              </ul>
            )}
            <div ref={sentinel} />
            {isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}
            {hasNextPage && !isFetchingNextPage && (
              <div className="flex justify-center py-8">
                <Button className="h-10 rounded-full px-5" onClick={() => fetchNextPage()}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/** One published doc. The whole card opens it; the author name filters by author. */
function DocCard({
  doc,
  featured,
  onAuthor,
}: {
  doc: PublicDocSummary
  featured: boolean
  onAuthor: (login: string) => void
}) {
  const topics = doc.topics.slice(0, featured ? 4 : 3)
  return (
    <article
      className={clsx(
        'group relative flex w-full flex-col rounded-2xl border border-line bg-surface transition duration-200',
        'hover:-translate-y-0.5 hover:border-ink-faint/40 hover:shadow-[0_14px_34px_-16px_rgba(0,0,0,0.22)]',
        'focus-within:border-ink-faint/60 focus-within:ring-4 focus-within:ring-hover',
        featured ? 'p-5 sm:p-7' : 'p-5',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
        <button
          type="button"
          onClick={() => doc.author.login && onAuthor(doc.author.login)}
          disabled={!doc.author.login}
          title={doc.author.login ? `More from @${doc.author.login}` : undefined}
          className="relative z-10 flex min-w-0 items-center gap-2 rounded-full text-ink-muted transition hover:text-ink"
        >
          <Avatar name={doc.author.name} src={doc.author.avatarUrl} className="size-6" />
          <span className="truncate font-medium">{doc.author.name}</span>
        </button>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <time
          dateTime={doc.publishedAt}
          title={new Date(doc.publishedAt).toLocaleString()}
          className="shrink-0 text-ink-faint"
        >
          {timeAgo(doc.publishedAt)}
        </time>
        {featured && (
          <span className="ml-auto shrink-0 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11.5px] font-medium text-accent">
            New
          </span>
        )}
      </div>

      <h2
        className={clsx(
          'mt-3 leading-snug font-semibold tracking-tight text-ink',
          featured ? 'line-clamp-3 text-[19px] sm:text-[26px]' : 'line-clamp-2 text-[17px]',
        )}
      >
        {/* The link covers the whole card (::after), keeping one clear target for keyboards and screen readers. */}
        <Link to={`/s/${doc.slug}`} className="outline-none after:absolute after:inset-0 after:rounded-2xl">
          {doc.title}
        </Link>
      </h2>

      {doc.excerpt && (
        <p
          className={clsx(
            'mt-2 line-clamp-3 leading-relaxed text-ink-muted',
            featured ? 'max-w-3xl text-[15px]' : 'text-[14px]',
          )}
        >
          {doc.excerpt}
        </p>
      )}

      {topics.length > 0 && (
        <ul aria-label="Covers" className="mt-4 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <li
              key={t}
              className="max-w-full truncate rounded-full border border-line bg-raised px-2.5 py-1 text-[12px] text-ink-muted"
            >
              {t}
            </li>
          ))}
          {doc.topics.length > topics.length && (
            <li className="px-1 py-1 text-[12px] text-ink-faint">+{doc.topics.length - topics.length} more</li>
          )}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-4 pt-5 text-[12.5px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5" /> {doc.readMinutes} min read
        </span>
        {doc.commentCount > 0 && (
          <span className="flex items-center gap-1.5" title={`${doc.commentCount} comments`}>
            <MessageCircle className="size-3.5" /> {doc.commentCount}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5" title={`${doc.viewCount} views`}>
          <Eye className="size-3.5" /> {compact(doc.viewCount)}
        </span>
      </div>
    </article>
  )
}

const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n)

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={clsx('space-y-3 rounded-2xl border border-line p-5', i === 0 && 'sm:col-span-2')}>
          <div className="h-4 w-32 animate-pulse rounded bg-hover" />
          <div className="h-6 w-3/4 animate-pulse rounded bg-hover" />
          <div className="h-4 w-full animate-pulse rounded bg-hover" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-hover" />
        </div>
      ))}
    </div>
  )
}

function Empty({ searching, signedIn }: { searching: boolean; signedIn: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <Compass className="size-9 text-ink-faint" strokeWidth={1.5} />
      <p className="mt-3 text-[15px] font-medium">{searching ? 'Nothing matches that.' : 'Nothing published yet.'}</p>
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
