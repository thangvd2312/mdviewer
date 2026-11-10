import clsx from 'clsx'
import { Clock, Eye, Layers, MessageCircle } from 'lucide-react'
import { Link } from 'react-router'
import type { PublicDocSummary, PublicSeriesSummary } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { Avatar } from '../Avatar'

export const postUrl = (slug: string) => `/blog/${slug}`
export const seriesUrl = (slug: string) => `/blog/series/${slug}`
export const authorUrl = (login: string) => `/u/${encodeURIComponent(login)}`
export const topicUrl = (topic: string) => `/blog?topic=${encodeURIComponent(topic)}`
const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n)

/** Author · date. Links to the author's page. */
function Byline({ doc, size = 'sm' }: { doc: PublicDocSummary; size?: 'sm' | 'md' }) {
  const a = doc.author
  const name = (
    <>
      <Avatar name={a.name} src={a.avatarUrl} className={size === 'md' ? 'size-7' : 'size-5'} />
      <span className="truncate font-medium text-ink-muted group-hover/author:text-ink">{a.name}</span>
    </>
  )
  return (
    <div className={clsx('flex min-w-0 items-center gap-2', size === 'md' ? 'text-[13.5px]' : 'text-[12.5px]')}>
      {a.login ? (
        <Link to={authorUrl(a.login)} className="group/author relative z-10 flex min-w-0 items-center gap-2">
          {name}
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{name}</span>
      )}
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
    </div>
  )
}

/** Topic chips; each opens the posts on that topic. */
export function Topics({ topics, max, size = 'sm' }: { topics: string[]; max?: number; size?: 'sm' | 'md' }) {
  const shown = max ? topics.slice(0, max) : topics
  if (shown.length === 0) return null
  return (
    <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
      {shown.map((t) => (
        <li key={t} className="max-w-full">
          <Link
            to={topicUrl(t)}
            className={clsx(
              'relative z-10 block max-w-full truncate rounded-full border border-line bg-raised text-ink-muted transition hover:border-ink-faint/50 hover:text-ink',
              size === 'md' ? 'px-3 py-1 text-[12.5px]' : 'px-2.5 py-0.5 text-[12px]',
            )}
          >
            {t}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Stats({ doc }: { doc: PublicDocSummary }) {
  return (
    <span className="flex shrink-0 items-center gap-3.5 text-[12.5px] text-ink-faint">
      <span className="flex items-center gap-1.5">
        <Clock className="size-3.5" /> {doc.readMinutes} min read
      </span>
      {doc.commentCount > 0 && (
        <span className="flex items-center gap-1.5" title={`${doc.commentCount} comments`}>
          <MessageCircle className="size-3.5" /> {doc.commentCount}
        </span>
      )}
      <span className="flex items-center gap-1.5" title={`${doc.viewCount} views`}>
        <Eye className="size-3.5" /> {compact(doc.viewCount)}
      </span>
    </span>
  )
}

/** The title link stretches over its whole post (one target for keyboards and screen readers). */
const stretched = 'outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:underline'

/** The lead post at the top of the blog. */
export function FeaturedPost({ doc }: { doc: PublicDocSummary }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent/[0.07] via-surface to-surface p-6 transition hover:border-ink-faint/40 hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.3)] sm:p-9">
      <div className="text-[12px] font-semibold tracking-wide text-accent uppercase">Latest post</div>
      <h2 className="mt-3 line-clamp-3 text-[24px] leading-[1.2] font-semibold tracking-tight sm:text-[32px]">
        <Link to={postUrl(doc.slug)} className={stretched}>
          {doc.title}
        </Link>
      </h2>
      {doc.excerpt && (
        <p className="mt-3 line-clamp-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted sm:text-[16px]">
          {doc.excerpt}
        </p>
      )}
      <div className="mt-5">
        <Topics topics={doc.topics} max={4} size="md" />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Byline doc={doc} size="md" />
        <Stats doc={doc} />
      </div>
    </article>
  )
}

/** One post in a list. */
export function PostRow({ doc, hideAuthor }: { doc: PublicDocSummary; hideAuthor?: boolean }) {
  return (
    <article className="group relative -mx-3 rounded-2xl px-3 py-5 transition hover:bg-hover/60 sm:-mx-4 sm:px-4">
      {hideAuthor ? (
        <time dateTime={doc.publishedAt} className="text-[12.5px] text-ink-faint">
          {timeAgo(doc.publishedAt)}
        </time>
      ) : (
        <Byline doc={doc} />
      )}
      <h3 className="mt-2 line-clamp-2 text-[18px] leading-snug font-semibold tracking-tight sm:text-[19px]">
        <Link to={postUrl(doc.slug)} className={stretched}>
          {doc.title}
        </Link>
      </h3>
      {doc.excerpt && <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-relaxed text-ink-muted">{doc.excerpt}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Topics topics={doc.topics} max={3} />
        <span className="ml-auto">
          <Stats doc={doc} />
        </span>
      </div>
    </article>
  )
}

/** Numbered short list (sidebar "Most read"). */
export function RankedPosts({ docs }: { docs: PublicDocSummary[] }) {
  return (
    <ol className="space-y-4">
      {docs.map((d, i) => (
        <li key={d.slug} className="group relative flex gap-3">
          <span className="w-6 shrink-0 text-[22px] leading-none font-semibold text-ink-faint/60 tabular-nums">
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <Link
              to={postUrl(d.slug)}
              className="line-clamp-2 text-[14px] leading-snug font-medium group-hover:underline group-hover:decoration-ink-faint group-hover:underline-offset-4"
            >
              {d.title}
            </Link>
            <div className="mt-1 truncate text-[12px] text-ink-faint">
              {d.author.name} · {compact(d.viewCount)} views
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function PostsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2.5 py-5">
          <div className="h-3.5 w-40 animate-pulse rounded bg-hover" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-hover" />
          <div className="h-4 w-full animate-pulse rounded bg-hover" />
        </div>
      ))}
    </div>
  )
}

/** A series in a list: icon, name, author and how much there is to read. */
export function SeriesCard({ series, hideAuthor }: { series: PublicSeriesSummary; hideAuthor?: boolean }) {
  return (
    <article className="group relative flex gap-3.5 rounded-2xl border border-line p-4 transition hover:border-ink-faint/40 hover:bg-hover/40">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-raised text-[22px]">
        {series.icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight">
          <Link to={seriesUrl(series.slug)} className={stretched}>
            {series.name}
          </Link>
        </h3>
        {series.description && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-muted">{series.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" /> {series.partCount} {series.partCount === 1 ? 'part' : 'parts'}
          </span>
          <span>{series.readMinutes} min read</span>
          {!hideAuthor && <span className="truncate">by {series.author.name}</span>}
        </div>
      </div>
    </article>
  )
}
