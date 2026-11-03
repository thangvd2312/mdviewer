import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import GithubSlugger from 'github-slugger'
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  MessageCircleQuestion,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { MarkdownView } from '../components/MarkdownView'
import { Button, buttonClass, Spinner } from '../components/ui'
import { api, ApiError, type ReviewCard, type ReviewRating } from '../lib/api'
import { usePageAssistant } from '../lib/assistant'
import { useUI } from '../lib/ui'
import { PageLoading } from './NotFound'

const RATINGS: { rating: ReviewRating; label: string; key: string; tone: string }[] = [
  {
    rating: 'again',
    label: 'Forgot',
    key: '1',
    tone: 'border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400',
  },
  {
    rating: 'hard',
    label: 'Hard',
    key: '2',
    tone: 'border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400',
  },
  {
    rating: 'good',
    label: 'Got it',
    key: '3',
    tone: 'border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400',
  },
  {
    rating: 'easy',
    label: 'Easy',
    key: '4',
    tone: 'border-sky-500/30 text-sky-700 hover:bg-sky-500/10 dark:text-sky-400',
  },
]

/** "10 min", "6 h", "3 days", "2 wk", "4 mo" */
function inWords(ms: number) {
  const min = ms / 60_000
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  const h = min / 60
  if (h < 24) return `${Math.round(h)} h`
  const d = h / 24
  if (d < 14) return `${Math.round(d)} ${Math.round(d) === 1 ? 'day' : 'days'}`
  if (d < 60) return `${Math.round(d / 7)} wk`
  return `${Math.round(d / 30)} mo`
}

/** Heading anchor the reader uses (rehype-slug ⇢ github-slugger). */
const sectionLink = (card: ReviewCard) =>
  `/d/${card.docId}${card.section ? `#${new GithubSlugger().slug(card.section.replace(/^#+\s*/, ''))}` : ''}`

/** One review session: due questions (or one document's, with ?doc=), one at a time. */
export function ReviewSession() {
  const [params] = useSearchParams()
  const docId = params.get('doc') ?? undefined
  const queryClient = useQueryClient()
  // Loaded once: the session is a snapshot; answering doesn't reshuffle it.
  const session = useQuery({
    queryKey: ['review', 'session', docId ?? 'due'],
    queryFn: () => api.review.session(docId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  usePageAssistant({ context: { page: 'other' }, title: 'Review' })

  if (session.isPending) return <PageLoading />
  if (session.isError) {
    return (
      <Shell>
        <p className="py-16 text-center text-[14px] text-ink-muted">Couldn’t load the questions.</p>
      </Shell>
    )
  }
  if (session.data.length === 0) {
    return (
      <Shell>
        <NothingToReview
          docId={docId}
          onCreated={() => void queryClient.invalidateQueries({ queryKey: ['review', 'session', docId ?? 'due'] })}
        />
      </Shell>
    )
  }
  return <Run key={session.dataUpdatedAt} initial={session.data} quiz={Boolean(docId)} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar crumbs={[{ label: 'Review', to: '/review' }, { label: 'Session' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24 sm:px-8">{children}</div>
      </div>
    </>
  )
}

function NothingToReview({ docId, onCreated }: { docId?: string; onCreated: () => void }) {
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  if (!docId) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" strokeWidth={1.5} />
        <h1 className="mt-4 text-[20px] font-semibold">All caught up</h1>
        <p className="mt-1 text-[14px] text-ink-muted">
          Nothing is due right now. Come back later, or quiz yourself on a document.
        </p>
        <Link to="/review" className={buttonClass('primary', 'mt-6 h-10 rounded-full px-5')}>
          Back to Review
        </Link>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Sparkles className="size-10 text-accent" strokeWidth={1.5} />
      <h1 className="mt-4 text-[20px] font-semibold">No questions for this document yet</h1>
      <p className="mt-1 max-w-sm text-[14px] text-ink-muted">
        The AI writes them from what you asked about it, your sticky notes and its key points. Takes up to a minute.
      </p>
      <Button
        variant="primary"
        className="mt-6 h-10 rounded-full px-5"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await api.review.generate(docId)
            onCreated()
          } catch (e) {
            toast(e instanceof ApiError ? e.message : 'Couldn’t create questions')
            setBusy(false)
          }
        }}
      >
        {busy ? <Spinner className="size-4 border-surface/30 border-t-surface" /> : <Sparkles className="size-4" />}
        {busy ? 'Writing questions…' : 'Create questions'}
      </Button>
    </div>
  )
}

interface Result {
  rating: ReviewRating
}

function Run({ initial, quiz }: { initial: ReviewCard[]; quiz: boolean }) {
  const { toast } = useUI()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Cards still to show; a forgotten card goes back to the end of the queue.
  const [queue, setQueue] = useState(initial)
  const [results, setResults] = useState<Result[]>([])
  const [revealed, setRevealed] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [checking, setChecking] = useState(false)
  const [verdict, setVerdict] = useState<{ verdict: 'correct' | 'partial' | 'wrong'; feedback: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const card = queue[0]
  const total = useMemo(() => new Set(initial.map((c) => c.id)).size, [initial])
  // Answered = no longer waiting (a forgotten card waits at the end of the queue).
  const doneCount = total - new Set(queue.map((c) => c.id)).size

  const next = () => {
    setRevealed(false)
    setAttempt('')
    setVerdict(null)
  }

  const rate = async (rating: ReviewRating) => {
    if (!card || saving) return
    setSaving(true)
    try {
      await api.review.answer(card.id, rating)
      setResults((r) => [...r, { rating }])
      setQueue((q) => (rating === 'again' ? [...q.slice(1), { ...card, isNew: false }] : q.slice(1)))
      next()
      void queryClient.invalidateQueries({ queryKey: ['review', 'summary'] })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t save — try again')
    } finally {
      setSaving(false)
    }
  }

  const checkAnswer = async () => {
    if (!card || !attempt.trim() || checking) return
    setChecking(true)
    try {
      setVerdict(await api.review.check(card.id, attempt.trim()))
      setRevealed(true)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t check the answer')
    } finally {
      setChecking(false)
    }
  }

  const remove = async () => {
    if (!card) return
    try {
      await api.review.remove(card.id)
      setQueue((q) => q.filter((c) => c.id !== card.id))
      next()
      toast('Question removed')
      void queryClient.invalidateQueries({ queryKey: ['review'] })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t remove it')
    }
  }

  // Keyboard: Space/Enter shows the answer, 1–4 rate it (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        setRevealed(true)
      } else if (revealed) {
        const r = RATINGS.find((x) => x.key === e.key)
        if (r) {
          e.preventDefault()
          void rate(r.rating)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!card) return <Finished results={results} quiz={quiz} onAgain={() => navigate(0)} />

  const progress = Math.round((doneCount / total) * 100)
  return (
    <>
      <TopBar
        crumbs={[{ label: 'Review', to: '/review' }, { label: quiz ? card.docTitle : 'Today’s review' }]}
        actions={
          <Link to="/review" className={buttonClass('ghost', 'px-2.5')} title="End session">
            <X className="size-4" /> <span className="max-sm:hidden">End</span>
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-4 pb-6 sm:px-8 sm:pt-8">
          <div className="flex items-center gap-3 text-[12.5px] text-ink-muted">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden>
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="tabular-nums">
              {Math.min(doneCount + 1, total)} / {total}
            </span>
          </div>

          <article className="mt-6 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <Origin card={card} />
              {!quiz && (
                <Link to={`/d/${card.docId}`} className="truncate text-ink-faint hover:text-ink">
                  {card.docTitle}
                </Link>
              )}
              {card.isNew && <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">New</span>}
            </div>
            <h1 className="mt-4 text-[21px] leading-snug font-semibold tracking-tight sm:text-[24px]">
              {card.question}
            </h1>
            {card.origin === 'asked' && card.basedOn && (
              <p className="mt-2 text-[13px] text-ink-faint">
                You asked: <span className="italic">“{card.basedOn}”</span>
              </p>
            )}

            {!revealed && (
              <div className="mt-6">
                <textarea
                  value={attempt}
                  onChange={(e) => setAttempt(e.target.value)}
                  rows={3}
                  maxLength={3000}
                  placeholder="Answer in your own words (optional) — or just think it through"
                  aria-label="Your answer"
                  className="block w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-ink-faint focus:border-ink-faint focus:ring-4 focus:ring-hover sm:text-[15px]"
                />
              </div>
            )}

            {revealed && (
              <div className="animate-pop mt-6 space-y-4">
                {verdict && (
                  <div
                    className={clsx(
                      'rounded-2xl border px-4 py-3 text-[14px] leading-relaxed',
                      verdict.verdict === 'correct'
                        ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
                        : verdict.verdict === 'partial'
                          ? 'border-amber-500/30 bg-amber-500/[0.07]'
                          : 'border-red-500/30 bg-red-500/[0.06]',
                    )}
                  >
                    <div className="font-semibold">
                      {verdict.verdict === 'correct'
                        ? 'Correct'
                        : verdict.verdict === 'partial'
                          ? 'Partly right'
                          : 'Not quite'}
                    </div>
                    <p className="mt-0.5 text-ink-muted">{verdict.feedback}</p>
                  </div>
                )}
                {attempt.trim() && !verdict && (
                  <div className="rounded-2xl bg-hover/60 px-4 py-3 text-[14px] text-ink-muted">
                    <div className="text-[12px] font-medium tracking-wide uppercase">Your answer</div>
                    <p className="mt-1 whitespace-pre-wrap">{attempt}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-line bg-raised px-4 py-3.5">
                  <div className="text-[12px] font-semibold tracking-wide text-ink-faint uppercase">Answer</div>
                  <MarkdownView content={card.answer} className="compact mt-1" />
                  <Link
                    to={sectionLink(card)}
                    className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
                  >
                    {card.section ? `Read “${card.section.replace(/^#+\s*/, '')}”` : 'Open the document'}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </article>

          <div className="sticky bottom-0 mt-8 bg-surface/95 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
            {revealed ? (
              <>
                <p className="mb-2 text-center text-[12.5px] text-ink-faint">How well did you remember it?</p>
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.rating}
                      type="button"
                      disabled={saving}
                      onClick={() => rate(r.rating)}
                      className={clsx(
                        'flex flex-col items-center rounded-2xl border bg-surface px-1 py-2.5 transition disabled:opacity-50',
                        r.tone,
                      )}
                    >
                      <span className="text-[14px] font-semibold">{r.label}</span>
                      <span className="mt-0.5 text-[11.5px] opacity-75">{inWords(card.next[r.rating])}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 hidden text-center text-[11.5px] text-ink-faint sm:block">Keys 1–4</p>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="h-12 flex-1 rounded-2xl text-[15px]"
                  disabled={!attempt.trim() || checking}
                  onClick={checkAnswer}
                  title="The AI checks your answer"
                >
                  {checking ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                  {checking ? 'Checking…' : 'Check with AI'}
                </Button>
                <Button
                  variant="primary"
                  className="h-12 flex-1 rounded-2xl text-[15px]"
                  onClick={() => setRevealed(true)}
                >
                  Show answer
                </Button>
              </div>
            )}
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={remove}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-ink-faint transition hover:text-danger"
              >
                <Trash2 className="size-3.5" /> Don’t ask me this again
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Origin({ card }: { card: ReviewCard }) {
  const o =
    card.origin === 'asked'
      ? {
          icon: <MessageCircleQuestion className="size-3.5" />,
          label: 'From your question',
          tone: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
        }
      : card.origin === 'note'
        ? {
            icon: <StickyNote className="size-3.5" />,
            label: 'From your note',
            tone: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
          }
        : {
            icon: <Sparkles className="size-3.5" />,
            label: 'Key point',
            tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
          }
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', o.tone)}>
      {o.icon}
      {o.label}
    </span>
  )
}

function Finished({ results, quiz, onAgain }: { results: Result[]; quiz: boolean; onAgain: () => void }) {
  const count = (r: ReviewRating) => results.filter((x) => x.rating === r).length
  const remembered = count('good') + count('easy') + count('hard')
  return (
    <Shell>
      <div className="flex flex-col items-center py-12 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" strokeWidth={1.5} />
        <h1 className="mt-4 text-[24px] font-semibold tracking-tight">Session done</h1>
        <p className="mt-1 text-[14.5px] text-ink-muted">
          {results.length} {results.length === 1 ? 'answer' : 'answers'} · remembered {remembered}, forgot{' '}
          {count('again')}. Each question comes back when it’s time.
        </p>
        <div className="mt-6 grid w-full max-w-sm grid-cols-4 gap-2 text-[12px]">
          {RATINGS.map((r) => (
            <div key={r.rating} className={clsx('rounded-2xl border px-2 py-3', r.tone)}>
              <div className="text-[20px] font-semibold tabular-nums">{count(r.rating)}</div>
              {r.label}
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-2">
          <Link to="/review" className={buttonClass('primary', 'h-10 rounded-full px-5')}>
            <ArrowLeft className="size-4" /> Back to Review
          </Link>
          {quiz && (
            <Button className="h-10 rounded-full px-5" onClick={onAgain}>
              Quiz again
            </Button>
          )}
        </div>
      </div>
    </Shell>
  )
}
