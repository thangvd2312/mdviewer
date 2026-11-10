import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Clock, Eye, Layers, Library, Pencil } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { BlogFooter } from '../components/blog/BlogLayout'
import { authorUrl, postUrl, Topics } from '../components/blog/Posts'
import { SaveButton } from '../components/blog/SaveButton'
import { buttonClass } from '../components/ui'
import { ApiError, type PublicDocSummary, type PublicSeries } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useProjects, usePublicSeries, useSavedSlugs, useSaveMutations } from '../lib/queries'
import { useUI } from '../lib/ui'
import { PageLoading } from './NotFound'

const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact' }).format(n)

/** A series: a project published as one, its public documents in order. /blog/series/<slug> */
export function SeriesPage() {
  const { slug = '' } = useParams()
  const { data: series, isLoading, error } = usePublicSeries(slug)
  const { user } = useAuth()
  // The author gets a way back to the project (it's in their own project list).
  const { data: projects } = useProjects(Boolean(user))
  const ownProject = projects?.find((p) => p.slug === slug)

  useEffect(() => {
    if (series) document.title = `${series.name} · viewmd Blog`
    return () => {
      document.title = 'viewmd'
    }
  }, [series])

  if (isLoading) return <PageLoading />
  if (error || !series) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <Library className="size-10 text-ink-faint" strokeWidth={1.5} />
        <h1 className="mt-4 text-[20px] font-semibold tracking-tight">
          {missing ? 'This series isn’t available' : 'Couldn’t load this series'}
        </h1>
        <p className="mt-1.5 max-w-sm text-[14px] text-ink-muted">
          {missing
            ? 'The link may be wrong, or the author stopped sharing it.'
            : 'Check your connection and try again in a moment.'}
        </p>
        <Link to="/blog" className={buttonClass('primary', 'mt-6 h-10 rounded-full px-5')}>
          Browse the blog <ArrowRight className="size-4" />
        </Link>
      </div>
    )
  }

  const a = series.author
  const first = series.parts[0]
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
        <div className="flex items-center gap-1">
          <Link
            to="/blog"
            className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-[13.5px] text-ink-muted transition hover:bg-hover hover:text-ink"
          >
            <ArrowLeft className="size-4" /> All posts
          </Link>
          {ownProject && (
            <Link to={`/p/${ownProject.id}`} className={buttonClass('ghost', 'ml-auto h-9 rounded-full px-3')}>
              <Pencil className="size-3.5" /> Edit project
            </Link>
          )}
        </div>

        <header className="mt-6">
          <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-accent uppercase">
            <Layers className="size-4" /> Series
          </div>
          <div className="mt-3 flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-line bg-raised text-[28px]">
              {series.icon}
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[32px]">{series.name}</h1>
              {series.description && (
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{series.description}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-muted">
            {a.login ? (
              <Link to={authorUrl(a.login)} className="flex items-center gap-2 font-medium hover:text-ink">
                <Avatar name={a.name} src={a.avatarUrl} className="size-6" /> {a.name}
              </Link>
            ) : (
              <span className="flex items-center gap-2 font-medium">
                <Avatar name={a.name} src={a.avatarUrl} className="size-6" /> {a.name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Layers className="size-3.5" /> {series.parts.length} {series.parts.length === 1 ? 'part' : 'parts'}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" /> {series.readMinutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-3.5" /> {compact(series.viewCount)} views
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {first && (
              <Link to={postUrl(first.slug)} className={buttonClass('primary', 'h-10 rounded-full px-5')}>
                Start reading <ArrowRight className="size-4" />
              </Link>
            )}
            <SaveSeriesButton series={series} />
          </div>
        </header>

        <ol className="mt-10 border-t border-line">
          {series.parts.map((d, i) => (
            <li key={d.slug} className="border-b border-line">
              <Part doc={d} n={i + 1} />
            </li>
          ))}
        </ol>
      </div>
      <BlogFooter />
    </div>
  )
}

function Part({ doc, n }: { doc: PublicDocSummary; n: number }) {
  return (
    <article className="group relative -mx-3 flex gap-4 rounded-2xl px-3 py-5 transition hover:bg-hover/60 sm:-mx-4 sm:px-4">
      <span className="w-7 shrink-0 pt-0.5 text-[20px] leading-none font-semibold text-ink-faint/70 tabular-nums">
        {String(n).padStart(2, '0')}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="line-clamp-2 text-[17px] leading-snug font-semibold tracking-tight sm:text-[18px]">
          <Link
            to={postUrl(doc.slug)}
            className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:underline"
          >
            {doc.title}
          </Link>
        </h2>
        {doc.excerpt && <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">{doc.excerpt}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Topics topics={doc.topics} max={3} />
          <span className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-faint">
            {doc.readMinutes} min read · {timeAgo(doc.publishedAt)}
            <SaveButton slug={doc.slug} className="-my-2 -mr-2" />
          </span>
        </div>
      </div>
    </article>
  )
}

/** Save every part of the series to read later (or take them all out again). */
function SaveSeriesButton({ series }: { series: PublicSeries }) {
  const { user } = useAuth()
  const { toast } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const slugs = useSavedSlugs(Boolean(user))
  const { series: save } = useSaveMutations()
  const parts = series.parts.map((p) => p.slug)
  const all = parts.length > 0 && parts.every((p) => slugs.data?.has(p))

  const onClick = () => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } })
      return
    }
    save.mutate(
      { slug: series.slug, parts, save: !all },
      {
        onSuccess: () => toast(all ? 'Removed the series from Saved' : `Saved ${parts.length} parts — they’re in Saved`),
        onError: () => toast('Couldn’t update Saved'),
      },
    )
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={all} className={buttonClass('secondary', 'h-10 rounded-full px-5')}>
      {all ? <BookmarkCheck className="size-4 fill-current text-accent" /> : <Bookmark className="size-4" />}
      {all ? 'Series saved' : 'Save series'}
    </button>
  )
}
