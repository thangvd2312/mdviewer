import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Brain, CheckCircle2, Flame, MessageCircleQuestion, Play, Sparkles, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { TopBar } from '../components/AppLayout'
import { Button, buttonClass, Spinner } from '../components/ui'
import { api, ApiError, type ReviewSummary } from '../lib/api'
import { usePageAssistant } from '../lib/assistant'
import { useReviewSummary } from '../lib/queries'
import { useUI } from '../lib/ui'
import { PageLoading } from './NotFound'

/** Review home: what's due today, and which documents to make questions from. */
export function ReviewPage() {
  const summary = useReviewSummary()
  usePageAssistant({ context: { page: 'other' }, title: 'Review' })
  if (summary.isPending) return <PageLoading />
  const s = summary.data

  return (
    <>
      <TopBar crumbs={[{ label: 'Review' }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-8 sm:pt-10">
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight sm:text-[30px]">Review</h1>
          <p className="mt-1 text-[14.5px] text-ink-muted">
            Questions about what you’ve read — built from what you asked, your sticky notes, and the key points. Each
            comes back just before you’d forget it.
          </p>
          {s ? (
            <>
              <Today s={s} />
              <Documents docs={s.docs} />
            </>
          ) : (
            <p className="mt-8 text-[14px] text-ink-muted">Couldn’t load your review.</p>
          )}
        </div>
      </div>
    </>
  )
}

function Today({ s }: { s: ReviewSummary }) {
  const done = s.due === 0
  return (
    <section className="mt-6 rounded-3xl border border-line bg-gradient-to-br from-accent/[0.08] via-surface to-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div className="text-[12px] font-semibold tracking-wide text-accent uppercase">Today</div>
          {done ? (
            <div className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-tight">
              <CheckCircle2 className="size-6 text-emerald-500" />
              {s.total === 0 ? 'No questions yet' : 'All caught up'}
            </div>
          ) : (
            <div className="mt-1 text-[22px] font-semibold tracking-tight">
              <span className="text-[34px] leading-none tabular-nums">{s.due}</span>{' '}
              {s.due === 1 ? 'question' : 'questions'} to review
            </div>
          )}
          <p className="mt-1 text-[13.5px] text-ink-muted">
            {s.total === 0
              ? 'Create questions from a document below to start.'
              : done
                ? 'Come back tomorrow — or quiz yourself on a document.'
                : `${s.new > 0 ? `${s.new} new · ` : ''}about ${Math.max(1, Math.round(s.due * 0.4))} min`}
          </p>
        </div>
        <div className="flex gap-6 text-[13px] text-ink-muted">
          <Stat
            icon={<Flame className="size-4 text-orange-500" />}
            value={s.streak}
            label={s.streak === 1 ? 'day streak' : 'days streak'}
          />
          <Stat icon={<Brain className="size-4 text-violet-500" />} value={s.reviewedToday} label="reviewed today" />
          <Stat icon={<MessageCircleQuestion className="size-4 text-sky-500" />} value={s.total} label="questions" />
        </div>
      </div>
      {!done && (
        <Link
          to="/review/session"
          className={buttonClass('primary', 'mt-6 h-11 w-full rounded-full px-6 text-[14.5px] sm:w-auto')}
        >
          <Play className="size-4" fill="currentColor" /> Start review
        </Link>
      )}
    </section>
  )
}

const Stat = ({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) => (
  <div>
    <div className="flex items-center gap-1.5 text-[18px] font-semibold text-ink tabular-nums">
      {icon}
      {value}
    </div>
    <div className="text-[12px]">{label}</div>
  </div>
)

function Documents({ docs }: { docs: ReviewSummary['docs'] }) {
  const { toast } = useUI()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const generate = async (docId: string) => {
    setBusy(docId)
    try {
      const cards = await api.review.generate(docId)
      toast(`${cards.length} new questions — let’s go`)
      void queryClient.invalidateQueries({ queryKey: ['review'] })
      navigate(`/review/session?doc=${docId}`)
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Couldn’t create questions')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-[16px] font-semibold">Quiz yourself on a document</h2>
      <p className="mt-0.5 text-[13.5px] text-ink-muted">
        The ones you asked about most come first. Creating questions uses one of your daily assistant questions.
      </p>
      {docs.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] text-ink-muted">
          Read a few documents (and ask the assistant about them) — they’ll show up here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <Link to={`/d/${d.id}`} className="line-clamp-1 text-[14.5px] font-medium hover:underline">
                  {d.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                  {d.project && <span>{d.project}</span>}
                  {d.asked > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircleQuestion className="size-3.5" /> you asked {d.asked}
                    </span>
                  )}
                  {d.notes > 0 && (
                    <span className="flex items-center gap-1">
                      <StickyNote className="size-3.5" /> {d.notes} {d.notes === 1 ? 'note' : 'notes'}
                    </span>
                  )}
                  {d.cards > 0 && (
                    <span className={clsx(d.due > 0 && 'font-medium text-accent')}>
                      {d.cards} questions{d.due > 0 ? ` · ${d.due} due` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {d.cards > 0 && (
                  <Link
                    to={`/review/session?doc=${d.id}`}
                    className={buttonClass('secondary', 'h-9 rounded-full px-4')}
                  >
                    <Play className="size-3.5" /> Quiz me
                  </Link>
                )}
                <Button
                  variant={d.cards > 0 ? 'ghost' : 'primary'}
                  className="h-9 rounded-full px-4"
                  disabled={busy !== null}
                  onClick={() => generate(d.id)}
                >
                  {busy === d.id ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
                  {busy === d.id ? 'Writing questions…' : d.cards > 0 ? 'More questions' : 'Create questions'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy && (
        <p className="mt-3 text-[12.5px] text-ink-faint" role="status">
          The AI is reading the document and your questions — this takes up to a minute.
        </p>
      )}
    </section>
  )
}
