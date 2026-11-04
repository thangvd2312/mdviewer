import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ArrowUpRight,
  ChevronDown,
  Eye,
  Globe,
  Lock,
  MessageCircle,
  Newspaper,
  Play,
  RefreshCw,
  ThumbsUp,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { postUrl } from '../components/blog/Posts'
import { MarkdownView } from '../components/MarkdownView'
import { Button, buttonClass, Modal, Spinner } from '../components/ui'
import { api, ApiError, type CuratedStatus, type CuratorArticle, type CuratorStatus } from '../lib/api'
import { useAuth } from '../lib/auth'
import { timeAgo } from '../lib/format'
import { useUI } from '../lib/ui'
import { PageLoading } from './NotFound'

const KEY = ['curator'] as const

/** Admin page for the blog curator: what it found, how it scored, what it published. /admin/curator */
export function CuratorPage() {
  const { user } = useAuth()
  const status = useQuery({
    queryKey: KEY,
    queryFn: api.curator.status,
    enabled: Boolean(user?.isAdmin),
    // Follow a run while it's going.
    refetchInterval: (q) => (q.state.data?.running ? 4000 : false),
  })
  if (!user?.isAdmin) return <Navigate to="/note" replace />
  if (status.isPending) return <PageLoading />
  const s = status.data

  return (
    <>
      <TopBar crumbs={[{ label: 'Blog curator' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-24 sm:px-8 sm:pt-10">
          <h1 className="flex items-center gap-2.5 text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">
            <Newspaper className="size-7 text-violet-500" /> Blog curator
          </h1>
          <p className="mt-1 text-[14.5px] text-ink-muted">
            Finds the best articles on daily.dev, researches them and writes an original Vietnamese post. Posts the
            editor scores high enough go straight to the blog; the rest wait here as drafts.
          </p>
          {s ? (
            <>
              <Overview s={s} />
              <Runs s={s} />
              <Articles articles={s.articles} running={Boolean(s.running)} />
            </>
          ) : (
            <p className="mt-8 text-[14px] text-ink-muted">Couldn’t load the curator.</p>
          )}
        </div>
      </div>
    </>
  )
}

function useAction() {
  const { toast } = useUI()
  const queryClient = useQueryClient()
  return (fn: () => Promise<unknown>, done: string) =>
    fn()
      .then(() => {
        toast(done)
        void queryClient.invalidateQueries({ queryKey: KEY })
      })
      .catch((e: unknown) => toast(e instanceof ApiError ? e.message : 'Something went wrong'))
}

function Overview({ s }: { s: CuratorStatus }) {
  const act = useAction()
  const [count, setCount] = useState(s.settings.dailyPosts || 2)
  const run = useMutation({
    mutationFn: () => act(() => api.curator.run(count), `Writing up to ${count} posts — follow the run below`),
  })
  const published = s.articles.filter((a) => a.status === 'published').length
  const drafts = s.articles.filter((a) => a.status === 'draft').length
  return (
    <section className="mt-6 rounded-3xl border border-line bg-gradient-to-br from-violet-500/[0.07] via-surface to-surface p-5 sm:p-6">
      {!s.tokenSet && (
        <p className="mb-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-2.5 text-[13.5px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          Set <code className="font-mono">DAILYDEV_TOKEN</code> on the server to start the curator.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Stat value={published} label="published" />
        <Stat value={drafts} label="drafts to review" />
        <Stat value={s.settings.dailyPosts} label={`posts a day at ${s.settings.hour}:00`} />
        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="curator-count">
            Posts to write
          </label>
          <select
            id="curator-count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={Boolean(s.running)}
            className="h-10 rounded-full border border-line bg-surface px-3 text-[13.5px]"
          >
            {[1, 2, 3, 5, 10, 20, 30].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'post' : 'posts'}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            className="h-10 rounded-full px-5"
            disabled={!s.configured || Boolean(s.running) || run.isPending}
            onClick={() => run.mutate()}
          >
            {s.running ? <Spinner className="size-4 border-white/30 border-t-white" /> : <Play className="size-4" />}
            {s.running ? 'Running…' : 'Run now'}
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5 text-[12px]">
        {s.settings.topics.map((t) => (
          <span key={t} className="rounded-full bg-hover px-2.5 py-1 text-ink-muted">
            #{t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-ink-faint">
        Judge picks ≥ {s.settings.minScore}/10 · publishes when the editor gives ≥ {s.settings.publishScore}/10 ·{' '}
        {s.autoRun ? `runs daily (${s.settings.timeZone})` : 'automatic runs are off'}
      </p>
    </section>
  )
}

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div>
    <div className="text-[24px] leading-none font-semibold tabular-nums">{value}</div>
    <div className="mt-1 text-[12.5px] text-ink-muted">{label}</div>
  </div>
)

function Runs({ s }: { s: CuratorStatus }) {
  const [open, setOpen] = useState<string | null>(s.running)
  if (s.runs.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-semibold">Runs</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {s.runs.slice(0, 8).map((r) => {
          const expanded = open === r.id || (r.status === 'running' && open === null)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? '' : r.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px]"
                aria-expanded={expanded}
              >
                <span
                  className={clsx(
                    'size-2 shrink-0 rounded-full',
                    r.status === 'running'
                      ? 'animate-pulse bg-accent'
                      : r.status === 'done'
                        ? 'bg-emerald-500'
                        : 'bg-red-500',
                  )}
                />
                <span className="font-medium">{new Date(r.startedAt).toLocaleString()}</span>
                <span className="text-ink-faint">{r.trigger}</span>
                <span className="ml-auto text-[12.5px] text-ink-muted tabular-nums max-sm:hidden">
                  {r.candidates} found · {r.scored} judged · {r.published} published · {r.drafts} drafts
                </span>
                <ChevronDown className={clsx('size-4 shrink-0 text-ink-faint transition', expanded && 'rotate-180')} />
              </button>
              {expanded && (
                <pre className="mx-4 mb-4 max-h-80 overflow-auto rounded-xl bg-raised p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-muted">
                  {r.log || 'Starting…'}
                </pre>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const FILTERS: { id: 'all' | CuratedStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'failed', label: 'Failed' },
  { id: 'skipped', label: 'Skipped' },
]

const TONE: Record<CuratedStatus, string> = {
  published: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  draft: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  approved: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  rejected: 'bg-hover text-ink-muted',
  failed: 'bg-red-500/12 text-red-700 dark:text-red-300',
  skipped: 'bg-hover text-ink-faint',
}

function Articles({ articles, running }: { articles: CuratorArticle[]; running: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [previewing, setPreviewing] = useState<CuratorArticle | null>(null)
  const act = useAction()
  const shown = filter === 'all' ? articles : articles.filter((a) => a.status === filter)
  const count = (id: (typeof FILTERS)[number]['id']) =>
    id === 'all' ? articles.length : articles.filter((a) => a.status === id).length

  return (
    <section className="mt-8">
      <h2 className="text-[16px] font-semibold">Articles</h2>
      <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
        {FILTERS.filter((f) => f.id === 'all' || count(f.id) > 0).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={clsx(
              'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition',
              filter === f.id ? 'bg-ink text-surface' : 'text-ink-muted hover:bg-hover hover:text-ink',
            )}
          >
            {f.label} <span className="tabular-nums opacity-60">{count(f.id)}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] text-ink-muted">
          Nothing here yet. Press <b>Run now</b> to look for articles.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {shown.map((a) => (
            <li key={a.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className={clsx('rounded-full px-2 py-0.5 font-semibold capitalize', TONE[a.status])}>
                  {a.status}
                </span>
                {a.score !== null && <span className="text-ink-muted tabular-nums">judge {a.score}</span>}
                {a.editorScore !== null && (
                  <span className="text-ink-muted tabular-nums">· editor {a.editorScore}</span>
                )}
                <span className="text-ink-faint">· #{a.topic}</span>
                <span className="ml-auto text-ink-faint">{timeAgo(a.updatedAt)}</span>
              </div>
              <div className="mt-1.5 text-[14.5px] leading-snug font-medium">{a.docTitle ?? a.title}</div>
              {a.docTitle && a.docTitle !== a.title && (
                <div className="mt-0.5 text-[12.5px] text-ink-faint">from “{a.title}”</div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                {a.sourceName && <span>{a.sourceName}</span>}
                <span className="flex items-center gap-1">
                  <ThumbsUp className="size-3" /> {a.upvotes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-3" /> {a.comments}
                </span>
                {a.tokens > 0 && <span className="tabular-nums">{Math.round(a.tokens / 1000)}k tokens</span>}
              </div>
              {(a.editorNotes || a.reason) && (
                <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
                  {a.status === 'draft' || a.status === 'published' ? a.editorNotes || a.reason : a.reason}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {a.docId && (
                  <Button variant="secondary" className="h-8 rounded-full px-3" onClick={() => setPreviewing(a)}>
                    <Eye className="size-3.5" /> Read
                  </Button>
                )}
                {a.slug && (
                  <Link to={postUrl(a.slug)} className={buttonClass('secondary', 'h-8 rounded-full px-3')}>
                    <Globe className="size-3.5" /> On the blog
                  </Link>
                )}
                {a.status === 'draft' && a.docId && (
                  <Button
                    variant="primary"
                    className="h-8 rounded-full px-3"
                    onClick={() => act(() => api.curator.publish(a.id), 'Published on the blog')}
                  >
                    <Globe className="size-3.5" /> Publish
                  </Button>
                )}
                {a.status === 'published' && (
                  <Button
                    variant="ghost"
                    className="h-8 rounded-full px-3"
                    onClick={() => act(() => api.curator.unpublish(a.id), 'Taken off the blog')}
                  >
                    <Lock className="size-3.5" /> Unpublish
                  </Button>
                )}
                {a.status !== 'published' && a.status !== 'skipped' && (
                  <Button
                    variant="ghost"
                    className="h-8 rounded-full px-3"
                    disabled={running}
                    onClick={() => act(() => api.curator.rewrite(a.id), 'Writing it now — follow the run above')}
                  >
                    <RefreshCw className="size-3.5" /> {a.docId ? 'Write again' : 'Write it anyway'}
                  </Button>
                )}
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass('ghost', 'h-8 rounded-full px-3')}
                >
                  Source <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Preview article={previewing} onClose={() => setPreviewing(null)} />
    </section>
  )
}

function Preview({ article, onClose }: { article: CuratorArticle | null; onClose: () => void }) {
  const preview = useQuery({
    queryKey: ['curator', 'preview', article?.id],
    queryFn: () => api.curator.preview(article!.id),
    enabled: Boolean(article),
  })
  return (
    <Modal open={Boolean(article)} onClose={onClose} title={article?.docTitle ?? 'Post'} className="max-w-3xl">
      <div className="max-h-[75dvh] overflow-y-auto px-5 pt-1 pb-6">
        {preview.isPending ? (
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        ) : preview.data ? (
          <>
            {preview.data.editorNotes && (
              <p className="mb-5 rounded-xl bg-raised px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
                <b className="text-ink">Editor {preview.data.editorScore}/10:</b> {preview.data.editorNotes}
              </p>
            )}
            <MarkdownView content={preview.data.content} />
          </>
        ) : (
          <p className="text-[14px] text-ink-muted">Couldn’t load the post.</p>
        )}
      </div>
    </Modal>
  )
}
