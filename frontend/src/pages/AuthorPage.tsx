import clsx from 'clsx'
import { ArrowLeft, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { BlogFooter } from '../components/blog/BlogLayout'
import { AiBadge, PostRow, PostsSkeleton } from '../components/blog/Posts'
import { Button, buttonClass, Spinner } from '../components/ui'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useAuthor, useExplore } from '../lib/queries'
import { PageLoading } from './NotFound'

/** An author's public page: who they are and everything they've published. /u/<login> */
export function AuthorPage() {
  const { login = '' } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') === 'popular' ? 'popular' : 'latest'
  const profile = useAuthor(login)
  const feed = useExplore({ author: login, sort })
  const items = feed.data?.pages.flatMap((p) => p.items) ?? []
  const isMe = user?.githubLogin === login

  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && !isFetchingNextPage && void fetchNextPage(), {
      rootMargin: '400px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const a = profile.data
  useEffect(() => {
    if (a) document.title = `${a.name} · viewmd Blog`
    return () => {
      document.title = 'viewmd'
    }
  }, [a])

  if (profile.isPending) return <PageLoading />
  if (!a) {
    const missing = profile.error instanceof ApiError && profile.error.status === 404
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <UserRound className="size-10 text-ink-faint" strokeWidth={1.5} />
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">
          {missing ? 'No such author' : 'Couldn’t load this profile'}
        </h1>
        <Link to="/blog" className={buttonClass('primary', 'mt-6 h-10 rounded-full px-5')}>
          Browse the blog
        </Link>
      </div>
    )
  }

  const since = new Date(a.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const views = new Intl.NumberFormat('en', { notation: 'compact' }).format(a.viewCount)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
        <Link
          to="/blog"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13.5px] text-ink-muted transition hover:bg-hover hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All posts
        </Link>

        <header className="mt-6 flex flex-wrap items-center gap-4 sm:gap-5">
          <Avatar
            name={a.name}
            src={a.avatarUrl}
            className="size-16 sm:size-20"
            initialsClass="text-[22px] sm:text-[26px]"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">
              {a.name}
              {a.system && <AiBadge className="ml-2 align-[5px]" />}
            </h1>
            {a.system ? (
              <p className="text-[14px] text-ink-muted">
                In-depth Vietnamese explainers, researched and written by AI from the best articles on daily.dev.
              </p>
            ) : (
              a.login && (
                <a
                  href={`https://github.com/${a.login}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-ink-muted hover:text-ink hover:underline"
                >
                  @{a.login}
                </a>
              )
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-muted">
              <span>
                <span className="font-semibold text-ink">{a.postCount}</span> {a.postCount === 1 ? 'post' : 'posts'}
              </span>
              <span>
                <span className="font-semibold text-ink">{views}</span> views
              </span>
              <span>Writing since {since}</span>
            </div>
          </div>
          {isMe && (
            <Link to="/note" className={buttonClass('secondary', 'h-9 rounded-full px-4')}>
              Publish a note
            </Link>
          )}
        </header>

        <div className="mt-10 flex items-center justify-between gap-3 border-b border-line">
          <h2 className="pb-3 text-[15px] font-semibold">Posts</h2>
          <div role="tablist" aria-label="Sort" className="-mb-px flex">
            {(['latest', 'popular'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={sort === s}
                onClick={() => setParams(s === 'latest' ? {} : { sort: s })}
                className={clsx(
                  'border-b-2 px-3 pb-3 text-[13.5px] font-medium whitespace-nowrap transition',
                  sort === s ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {s === 'latest' ? 'Latest' : 'Most read'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2">
          {feed.isPending ? (
            <PostsSkeleton rows={3} />
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-[14px] text-ink-muted">
              {isMe
                ? 'You haven’t published anything yet. Open a note and choose Share → Public on the web.'
                : `${a.name} hasn’t published anything yet.`}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((d) => (
                <li key={d.slug}>
                  <PostRow doc={d} hideAuthor />
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
      <BlogFooter />
    </div>
  )
}
