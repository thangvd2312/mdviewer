import { Compass, Globe, MessageCircle, Pencil, Share2, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Comments } from '../components/comments/Comments'
import { OutlineNav, useActiveHeading, useHeadings } from '../components/DocOutline'
import { MarkdownView } from '../components/MarkdownView'
import { PageHeader } from '../components/PublicLayout'
import { buttonClass, IconButton } from '../components/ui'
import { ApiError, type PublicDoc } from '../lib/api'
import { usePageAssistant } from '../lib/assistant'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { readingStats, splitLeadingTitle } from '../lib/markdown'
import { usePublicDoc } from '../lib/queries'
import { useUI } from '../lib/ui'
import { PageLoading } from './NotFound'

/** A published document, readable by anyone: /s/<slug>. */
export function PublicDocPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const { toast } = useUI()
  const location = useLocation()
  const { data: doc, isLoading, error } = usePublicDoc(slug)
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)

  // Title, then the author line, then the body.
  const { title, body } = useMemo(() => splitLeadingTitle(doc?.content ?? ''), [doc?.content])
  const headings = useHeadings(articleRef, doc?.content)
  const activeId = useActiveHeading(headings, scrollRef)
  const active = headings.find((h) => h.id === activeId)
  // Signed-in readers can ask the assistant about the page.
  usePageAssistant(
    doc && user
      ? {
          context: { page: 'doc', docId: doc.id, ...(active && active.level > 1 && { sectionTitle: active.text }) },
          title: doc.title,
        }
      : null,
  )

  useEffect(() => {
    if (doc) document.title = `${doc.title} · viewmd`
    return () => {
      document.title = 'viewmd'
    }
  }, [doc])

  // Open at the linked heading, else at the top (comment links are handled by the comments).
  useEffect(() => {
    if (!doc) return
    const hash = decodeURIComponent(location.hash.slice(1))
    const target = hash && !hash.startsWith('comment-') && document.getElementById(hash)
    if (target) target.scrollIntoView()
    else if (!hash) scrollRef.current?.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id])

  if (isLoading) return <PageLoading />
  if (error || !doc) {
    return (
      <>
        <PageHeader crumbs={[{ label: 'Explore', to: '/explore' }, { label: 'Not available' }]} />
        <Unavailable missing={error instanceof ApiError && error.status === 404} />
      </>
    )
  }

  const url = `${window.location.origin}/s/${doc.slug}`
  const share = async () => {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: doc.title, url })
        return
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      toast('Couldn’t copy the link')
    }
  }
  const toComments = () => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Explore', to: '/explore' }, { label: doc.title }]}
        actions={
          <>
            <button
              type="button"
              onClick={toComments}
              className={buttonClass('ghost', 'px-2.5')}
              title="Comments"
              aria-label={`${doc.commentCount} comments`}
            >
              <MessageCircle className="size-4" />
              {doc.commentCount > 0 && doc.commentCount}
            </button>
            <IconButton label="Share" onClick={share}>
              <Share2 />
            </IconButton>
            {doc.isOwner && (
              <Link to={`/d/${doc.id}`} className={buttonClass('ghost', 'max-sm:px-2')} title="Open in your library">
                <Pencil className="size-3.5" /> <span className="max-sm:hidden">Edit</span>
              </Link>
            )}
          </>
        }
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex justify-center gap-12 px-5 pt-6 pb-32 md:px-10 md:pt-10">
          <article ref={articleRef} className="w-full max-w-[720px] min-w-0">
            {doc.isOwner && <OwnerNotice doc={doc} />}
            <div className="markdown">
              <h1>{title || doc.title}</h1>
            </div>
            <Byline doc={doc} />
            <MarkdownView content={body} />

            <div className="mt-12 flex flex-wrap items-center gap-2">
              <button type="button" onClick={share} className={buttonClass('secondary', 'h-9 rounded-full px-4')}>
                <Share2 className="size-4" /> Share
              </button>
              <Link to="/explore" className={buttonClass('ghost', 'h-9 rounded-full px-4')}>
                <Compass className="size-4" /> More on Explore
              </Link>
            </div>

            {!user && <SignInCard />}

            <Comments slug={doc.slug} />
          </article>
          {headings.length > 1 && (
            <aside className="hidden w-56 shrink-0 xl:block">
              <div className="sticky top-2">
                <OutlineNav headings={headings} active={activeId} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  )
}

/** Author, dates, reading time — under the title. */
function Byline({ doc }: { doc: PublicDoc }) {
  const { minutes } = useMemo(() => readingStats(doc.content), [doc.content])
  const edited = new Date(doc.updatedAt).getTime() - new Date(doc.publishedAt).getTime() > 60_000
  const author = doc.author
  return (
    <div className="-mt-2 mb-8 flex items-center gap-3 border-b border-line pb-6">
      <Avatar name={author.name} src={author.avatarUrl} className="size-10" />
      <div className="min-w-0 leading-snug">
        {author.login ? (
          <Link
            to={`/explore?author=${encodeURIComponent(author.login)}`}
            className="block truncate text-[14px] font-semibold hover:underline"
            title={`More from @${author.login}`}
          >
            {author.name}
          </Link>
        ) : (
          <span className="block truncate text-[14px] font-semibold">{author.name}</span>
        )}
        <div className="flex flex-wrap gap-x-1.5 text-[12.5px] text-ink-faint">
          <time dateTime={doc.publishedAt} title={new Date(doc.publishedAt).toLocaleString()}>
            {new Date(doc.publishedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </time>
          {edited && (
            <>
              <span aria-hidden>·</span>
              <span title={new Date(doc.updatedAt).toLocaleString()}>updated {timeAgo(doc.updatedAt)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{minutes} min read</span>
          <span aria-hidden className="max-[400px]:hidden">
            ·
          </span>
          <span className="max-[400px]:hidden">
            {new Intl.NumberFormat('en', { notation: 'compact' }).format(doc.viewCount)}{' '}
            {doc.viewCount === 1 ? 'view' : 'views'}
          </span>
        </div>
      </div>
    </div>
  )
}

function OwnerNotice({ doc }: { doc: PublicDoc }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3.5 py-2.5 text-[13px]">
      <Globe className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 flex-1 text-ink-muted">
        This is your page — <span className="font-medium text-ink">it’s public</span>. Your sticky notes stay private.
      </span>
      <Link to={`/d/${doc.id}?share=1`} className="shrink-0 font-medium text-ink underline underline-offset-2">
        Settings
      </Link>
    </div>
  )
}

function SignInCard() {
  const location = useLocation()
  return (
    <div className="mt-10 rounded-2xl border border-line bg-raised px-4 py-4 sm:flex sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#2f6bff] to-[#7a3cff] text-white">
          <Sparkles className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Have a question about this page?</p>
          <p className="text-[13px] text-ink-muted">
            Sign in to ask the AI assistant, comment with your name, and keep your own notes.
          </p>
        </div>
      </div>
      <Link
        to="/login"
        state={{ from: location.pathname }}
        className={buttonClass('primary', 'mt-3 h-10 w-full shrink-0 rounded-full px-4 sm:mt-0 sm:h-9 sm:w-auto')}
      >
        Sign in
      </Link>
    </div>
  )
}

function Unavailable({ missing }: { missing: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <Globe className="size-10 text-ink-faint" strokeWidth={1.5} />
      <h1 className="mt-4 text-[20px] font-semibold tracking-tight">
        {missing ? 'This page isn’t available' : 'Couldn’t load this page'}
      </h1>
      <p className="mt-1.5 max-w-sm text-[14px] text-ink-muted">
        {missing
          ? 'The link may be wrong, or the author stopped sharing it.'
          : 'Check your connection and try again in a moment.'}
      </p>
      <Link to="/explore" className={buttonClass('primary', 'mt-6 h-10 rounded-full px-5')}>
        <Compass className="size-4" /> Browse Explore
      </Link>
    </div>
  )
}
