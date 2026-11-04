import clsx from 'clsx'
import { ArrowRight, Hash, PenLine, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BlogFooter } from '../components/blog/BlogLayout'
import { FeaturedPost, PostRow, PostsSkeleton, RankedPosts, topicUrl } from '../components/blog/Posts'
import { Button, buttonClass, Spinner } from '../components/ui'
import { usePageAssistant } from '../lib/assistant'
import { useAuth } from '../lib/auth'
import { useExplore, usePublicDocs, useTopics } from '../lib/queries'

type Sort = 'latest' | 'popular'

/** The blog: every post people have published. /blog?q=&sort=&topic= */
export function BlogHome() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort: Sort = params.get('sort') === 'popular' ? 'popular' : 'latest'
  const topic = params.get('topic') ?? undefined
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

  const filtered = Boolean(q || topic)
  const feed = useExplore({ sort, topic, q: q || undefined })
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  // On the plain list the newest post leads, large.
  const featured = !filtered && sort === 'latest' ? items[0] : undefined
  const rest = featured ? items.slice(1) : items
  const popular = usePublicDocs({ sort: 'popular', limit: 5 })
  const topics = useTopics()

  // Load the next page when the end of the list comes into view.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
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

  useEffect(() => {
    document.title = topic ? `${topic} · viewmd Blog` : 'viewmd Blog'
    return () => {
      document.title = 'viewmd'
    }
  }, [topic])
  usePageAssistant(user ? { context: { page: 'other' }, title: 'Blog' } : null)

  const topicList = topics.data ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-8 sm:pt-12">
        {topic ? (
          <div className="mb-8">
            <Link to="/blog" className="text-[13px] text-ink-muted hover:text-ink">
              ← All posts
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-[28px] font-semibold tracking-tight sm:text-[34px]">
              <Hash className="size-7 text-ink-faint" /> {topic}
            </h1>
            <p className="mt-1 text-[14.5px] text-ink-muted">Posts that cover this topic.</p>
          </div>
        ) : (
          <div className="mb-5 max-w-2xl sm:mb-8">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[42px]">The viewmd Blog</h1>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted sm:mt-2 sm:text-[17px]">
              Notes, guides and docs written by the community
              <span className="max-sm:hidden"> — free to read, no account needed</span>.
            </p>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-14">
          <main className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-faint" />
                <input
                  type="search"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Search posts"
                  enterKeyHint="search"
                  aria-label="Search posts"
                  className="h-11 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-[16px] transition outline-none placeholder:text-ink-faint focus:border-ink-faint focus:ring-4 focus:ring-hover sm:text-[14.5px]"
                />
              </label>
              <div role="tablist" aria-label="Sort" className="inline-flex shrink-0 rounded-full bg-hover p-1">
                {(['latest', 'popular'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={sort === s}
                    onClick={() => set('sort', s === 'latest' ? null : s)}
                    className={clsx(
                      'h-9 rounded-full px-3 text-[13.5px] font-medium whitespace-nowrap transition sm:px-4',
                      sort === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {s === 'latest' ? 'Latest' : 'Most read'}
                  </button>
                ))}
              </div>
            </div>

            {/* Phones and tablets: topics as a swipeable row (desktop has them in the sidebar). */}
            {!topic && topicList.length > 0 && (
              <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max gap-2">
                  {topicList.slice(0, 10).map((t) => (
                    <Link
                      key={t.name}
                      to={topicUrl(t.name)}
                      className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] whitespace-nowrap text-ink-muted transition hover:text-ink"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {q && (
              <div className="mt-4 flex items-center gap-2 text-[13.5px] text-ink-muted">
                Results for <span className="font-medium text-ink">“{q}”</span>
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="ml-1 grid size-7 place-items-center rounded-full hover:bg-hover"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="mt-6">
              {feed.isPending ? (
                <PostsSkeleton />
              ) : feed.isError ? (
                <div className="rounded-2xl border border-line px-5 py-10 text-center text-[14px] text-ink-muted">
                  Couldn’t load the posts.{' '}
                  <button type="button" className="font-medium text-ink underline" onClick={() => feed.refetch()}>
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <Empty filtered={filtered} signedIn={Boolean(user)} />
              ) : (
                <div className={clsx('transition-opacity', feed.isPlaceholderData && 'opacity-60')}>
                  {featured && <FeaturedPost doc={featured} />}
                  {rest.length > 0 && (
                    <ul className={clsx('divide-y divide-line', featured && 'mt-4')}>
                      {rest.map((d) => (
                        <li key={d.slug}>
                          <PostRow doc={d} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
          </main>

          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-10">
              {(popular.data?.items.length ?? 0) > 0 && (
                <section>
                  <h2 className="mb-4 text-[12px] font-semibold tracking-wide text-ink-faint uppercase">Most read</h2>
                  <RankedPosts docs={popular.data!.items} />
                </section>
              )}
              {topicList.length > 0 && (
                <section>
                  <h2 className="mb-3 text-[12px] font-semibold tracking-wide text-ink-faint uppercase">Topics</h2>
                  <div className="flex flex-wrap gap-2">
                    {topicList.slice(0, 12).map((t) => (
                      <Link
                        key={t.name}
                        to={topicUrl(t.name)}
                        className={clsx(
                          'rounded-full border px-3 py-1 text-[12.5px] transition',
                          t.name === topic
                            ? 'border-ink bg-ink text-surface'
                            : 'border-line text-ink-muted hover:border-ink-faint/50 hover:text-ink',
                        )}
                      >
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              <WriteCard signedIn={Boolean(user)} />
            </div>
          </aside>
        </div>

        {/* Phones: the call to write sits under the list. */}
        <div className="mt-10 lg:hidden">
          <WriteCard signedIn={Boolean(user)} />
        </div>
      </div>
      <BlogFooter />
    </div>
  )
}

function WriteCard({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="rounded-2xl border border-line bg-raised p-5">
      <PenLine className="size-5 text-accent" />
      <h2 className="mt-2 text-[15px] font-semibold">{signedIn ? 'Share what you know' : 'Write on viewmd'}</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
        {signedIn
          ? 'Open any of your notes and choose Share → Public on the web to post it here.'
          : 'Keep your Markdown notes in one place, read them beautifully, and publish the ones worth sharing.'}
      </p>
      <Link to={signedIn ? '/note' : '/login'} className={buttonClass('primary', 'mt-4 h-9 rounded-full px-4')}>
        {signedIn ? 'Go to my notes' : 'Start writing — it’s free'} <ArrowRight className="size-4" />
      </Link>
    </section>
  )
}

function Empty({ filtered, signedIn }: { filtered: boolean; signedIn: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-[15px] font-medium">{filtered ? 'No posts match that.' : 'No posts yet.'}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-ink-muted">
        {filtered
          ? 'Try other words, or browse all posts.'
          : signedIn
            ? 'Be the first: open one of your notes and choose Share → Public on the web.'
            : 'Check back soon — or sign in and publish your own notes.'}
      </p>
      {filtered && (
        <Link to="/blog" className={buttonClass('secondary', 'mt-4 h-9 rounded-full px-4')}>
          All posts
        </Link>
      )}
    </div>
  )
}
