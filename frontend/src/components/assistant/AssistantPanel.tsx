import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Folder,
  History,
  Hourglass,
  House,
  Leaf,
  Quote,
  RotateCcw,
  Sparkles,
  Square,
  SquarePen,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, type AssistantContext, type AssistantQuota, type ChatTurn } from '../../lib/api'
import { conversationQuery, useAssistant, useAssistantState, type PageInfo } from '../../lib/assistant'
import { timeAgo } from '../../lib/format'
import { useAssistantStatus } from '../../lib/queries'
import { isTouch, MOBILE_QUERY, TOUCH_QUERY, useMediaQuery, useVisibleArea } from '../../lib/viewport'
import { MarkdownView } from '../MarkdownView'
import { IconButton } from '../ui'
import { AssistiveButton, type Side } from './AssistiveButton'

/** Floating button + chat panel. Mounted once in the app layout. */
export function Assistant() {
  const { open, thread } = useAssistantState()
  const { setOpen } = useAssistant()
  const [side, setSide] = useState<Side>('right')

  return (
    <>
      {!open && (
        <AssistiveButton
          hint={thread.streaming}
          onOpen={(s) => {
            setSide(s)
            setOpen(true)
          }}
        />
      )}
      {open && <AssistantPanel side={side} onClose={() => setOpen(false)} />}
    </>
  )
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** Instant, generic suggestions shown while (or instead of) the tailored ones load. */
function starterQuestions(page: PageInfo, quote: string | null): string[] {
  const { context } = page
  if (quote)
    return ['Giải thích đoạn này dễ hiểu hơn', 'Cho mình một ví dụ cụ thể', 'Vì sao đoạn này quan trọng ở đây?']
  if (context.page === 'doc' && context.sectionTitle)
    return [`Tóm tắt mục “${context.sectionTitle}”`, 'Các ý chính của mục này là gì?', 'Đố mình vài câu về mục này']
  if (context.page === 'doc')
    return ['Tóm tắt tài liệu này', 'Những điểm cần nhớ là gì?', 'Đố mình vài câu về tài liệu này']
  if (context.page === 'project')
    return ['Project này nói về gì?', 'Nên đọc tài liệu nào trước?', 'Tóm tắt project này']
  return ['Gần đây mình đã đọc những gì?', 'Mình nên ôn lại tài liệu nào?']
}

function AssistantPanel({ side, onClose }: { side: Side; onClose: () => void }) {
  const { page, quote, setQuote, thread, send, stop, retry, reset, openConversation, focusSignal } = useAssistantState()
  const { data: status } = useAssistantStatus()
  // Phones: a bottom sheet over a dimmed page, kept above the on-screen keyboard.
  const mobile = useMediaQuery(MOBILE_QUERY)
  const touch = useMediaQuery(TOUCH_QUERY) || mobile
  const visible = useVisibleArea()
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const quota = status?.quota ?? null
  const outOfQuestions = quota?.next === null
  const enabled = (status?.enabled ?? true) && !outOfQuestions
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const empty = thread.turns.length === 0

  // Tailored suggestions for what's on screen. The section is debounced so scrolling doesn't spam requests.
  const context = useDebounced<AssistantContext>(page.context, 800)
  const suggestions = useQuery({
    queryKey: ['assistant', 'suggest', context, quote],
    queryFn: () => api.assistant.suggest(context, quote ?? undefined),
    enabled: enabled && status !== undefined && empty,
    staleTime: Infinity,
    retry: false,
  })
  const tailored = suggestions.data?.questions ?? []
  const questions = tailored.length > 0 ? tailored : starterQuestions(page, quote)

  // Don't pop up the on-screen keyboard over the suggestions on touch screens.
  useEffect(() => {
    if (!isTouch()) inputRef.current?.focus()
  }, [focusSignal])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Follow the answer as it streams, unless the user scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [thread])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const submit = (text = input) => {
    if (!text.trim() || thread.streaming || !enabled) return
    stickToBottom.current = true
    send(text)
    setInput('')
    setView('chat')
  }

  const ContextIcon = page.context.page === 'doc' ? FileText : page.context.page === 'project' ? Folder : House

  return (
    <>
      {mobile && (
        <div aria-hidden className="animate-fade fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={onClose} />
      )}
      <section
        aria-label="Assistant"
        className={clsx(
          'fixed z-40 flex flex-col overflow-hidden border-line bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_14px_rgba(0,0,0,0.08)]',
          mobile
            ? 'animate-sheet inset-x-0 rounded-t-[20px] border-t pb-[env(safe-area-inset-bottom)]'
            : clsx(
                'animate-pop bottom-4 h-[min(640px,calc(100dvh-32px))] w-[400px] rounded-2xl border',
                side === 'left' ? 'left-4' : 'right-4',
              ),
        )}
        style={
          mobile
            ? {
                bottom: visible.bottomInset,
                // Full visible height while typing, otherwise leave a strip of the page showing.
                height: visible.bottomInset > 0 ? visible.height - 8 : Math.round(visible.height * 0.9),
              }
            : undefined
        }
      >
        {mobile && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line" />}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-3">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#2f6bff] to-[#7a3cff] text-white">
            <Sparkles className="size-4" />
          </span>
          <span className="text-[14px] font-semibold">Assistant</span>
          <div className="ml-auto flex">
            <IconButton
              label="Past chats"
              onClick={() => setView((v) => (v === 'history' ? 'chat' : 'history'))}
              active={view === 'history'}
            >
              <History />
            </IconButton>
            <IconButton
              label="New chat"
              onClick={() => {
                reset()
                setView('chat')
              }}
              disabled={empty && !quote && view === 'chat'}
            >
              <SquarePen />
            </IconButton>
            <IconButton label="Close (Esc)" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        </header>

        <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-raised px-3 py-1.5 text-[12px] text-ink-muted">
          <ContextIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {page.title ?? 'Your library'}
            {page.context.sectionTitle && <span className="text-ink-faint"> › {page.context.sectionTitle}</span>}
          </span>
        </div>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        >
          {view === 'history' ? (
            <PastChats
              context={page.context}
              currentId={thread.conversationId}
              onOpen={(id) => {
                openConversation(id)
                stickToBottom.current = true
                setView('chat')
              }}
            />
          ) : thread.loading && empty ? (
            <div className="space-y-3" aria-label="Loading the conversation">
              {[70, 90, 55].map((w) => (
                <div key={w} className="h-4 animate-pulse rounded bg-hover" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : empty ? (
            <div>
              <p className="text-[15px] font-medium">What would you like to know?</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {page.context.page === 'doc'
                  ? 'I can see this document, the section you’re reading and your sticky notes.'
                  : 'Ask about your documents, or pick a suggestion.'}
              </p>
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-ink-faint uppercase">
                  {tailored.length > 0 ? (
                    <>
                      <Sparkles className="size-3" /> Suggested for{' '}
                      {quote ? 'this passage' : page.context.sectionTitle ? 'this section' : 'you'}
                    </>
                  ) : (
                    <>
                      Try asking
                      {suggestions.isFetching && <span className="animate-pulse normal-case"> · tailoring…</span>}
                    </>
                  )}
                </div>
                {questions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={!enabled}
                    onClick={() => submit(q)}
                    className="group flex w-full items-start gap-2 rounded-xl border border-line px-3 py-2 text-left text-[13.5px] leading-snug transition hover:border-ink-faint hover:bg-hover disabled:opacity-50"
                  >
                    <span className="flex-1">{q}</span>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-ink-faint transition group-hover:text-ink" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {thread.turns.map((turn, i) =>
                turn.role === 'user' ? (
                  <div key={i} className="flex flex-col items-end gap-1">
                    {turn.quote && (
                      <div className="line-clamp-3 max-w-[85%] border-r-2 border-line pr-2 text-right text-[12px] text-ink-faint italic">
                        {turn.quote}
                      </div>
                    )}
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-hover px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap">
                      {turn.content}
                    </div>
                  </div>
                ) : (
                  <AssistantMessage key={i} turn={turn} streaming={thread.streaming && i === thread.turns.length - 1} />
                ),
              )}
              {thread.error && (
                <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                  {thread.error}
                  {thread.turns.at(-1)?.role === 'user' && thread.retryable !== false && (
                    <button
                      type="button"
                      onClick={retry}
                      className="ml-2 inline-flex items-center gap-1 font-medium underline"
                    >
                      <RotateCcw className="size-3" /> Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line p-2.5">
          {outOfQuestions && quota && <OutOfQuestions quota={quota} />}
          {status && !status.enabled && (
            <p className="mb-2 rounded-lg bg-raised px-3 py-2 text-[12.5px] text-ink-muted">
              The assistant isn’t set up yet. Add <code className="font-mono">ASSISTANT_API_KEY</code> to the server’s
              .env and restart it.
            </p>
          )}
          {quote && (
            <div className="mb-2 flex items-start gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-[12.5px] text-ink-muted">
              <Quote className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2 flex-1 italic">{quote}</span>
              <button
                type="button"
                aria-label="Remove passage"
                onClick={() => setQuote(null)}
                className="text-ink-faint hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-3 py-2 transition focus-within:border-ink-faint">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={1}
              maxLength={4000}
              disabled={!enabled}
              placeholder={quote ? 'Ask about this passage…' : 'Ask anything…'}
              enterKeyHint="send"
              // 16px on phones: smaller text makes iOS zoom the page when the field is focused.
              className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[16px] leading-6 outline-none placeholder:text-ink-faint sm:text-[14px]"
            />
            {thread.streaming ? (
              <button
                type="button"
                aria-label="Stop"
                title="Stop"
                onClick={stop}
                className={clsx(
                  'grid shrink-0 place-items-center rounded-lg bg-ink text-surface',
                  touch ? 'size-9' : 'size-7',
                )}
              >
                <Square className="size-3" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Send"
                title="Send (Enter)"
                onClick={() => submit()}
                disabled={!input.trim() || !enabled}
                className={clsx(
                  'grid shrink-0 place-items-center rounded-lg bg-ink text-surface transition disabled:opacity-30',
                  touch ? 'size-9' : 'size-7',
                )}
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
          {quota && <QuotaLine quota={quota} />}
        </div>
      </section>
    </>
  )
}

/** Stored conversations for the current page, newest first. */
function PastChats({
  context,
  currentId,
  onOpen,
}: {
  context: AssistantContext
  currentId?: string
  onOpen: (id: string) => void
}) {
  const query = conversationQuery(context)
  const { data, isPending, isError } = useQuery({
    queryKey: ['assistant', 'conversations', query],
    queryFn: () => api.assistant.conversations({ ...query, limit: 50 }),
    staleTime: 0,
  })
  const where = context.page === 'doc' ? 'this document' : context.page === 'project' ? 'this project' : 'your library'
  return (
    <div>
      <p className="mb-2 text-[11.5px] font-medium tracking-wide text-ink-faint uppercase">Past chats about {where}</p>
      {isPending ? (
        <p className="text-[13px] text-ink-faint">Loading…</p>
      ) : isError ? (
        <p className="text-[13px] text-danger">Could not load past chats.</p>
      ) : data.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No past chats here yet.</p>
      ) : (
        <ul className="space-y-1">
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className={clsx(
                  'w-full rounded-xl px-3 py-2 text-left transition hover:bg-hover',
                  c.id === currentId && 'bg-hover',
                )}
              >
                <span className="line-clamp-2 text-[13.5px] leading-snug">{c.title}</span>
                <span className="text-[11.5px] text-ink-faint">{timeAgo(c.updatedAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const resetTime = (quota: AssistantQuota) =>
  new Date(quota.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Shown instead of a working input when today's questions are used up. */
function OutOfQuestions({ quota }: { quota: AssistantQuota }) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[12.5px] text-ink-muted">
      <Hourglass className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {quota.blocked === 'global'
          ? 'The assistant has reached today’s limit for everyone.'
          : 'You’ve used all of today’s questions.'}{' '}
        Back at <span className="font-medium text-ink">{resetTime(quota)}</span>. Past chats are still here to read.
      </span>
    </div>
  )
}

/** How much of today's allowance is left, under the input. */
function QuotaLine({ quota }: { quota: AssistantQuota }) {
  if (quota.next === null || (quota.next === 'full' && quota.unlimited)) return null
  if (quota.next === 'full') {
    const left = quota.full.limit - quota.full.used
    return (
      <p className={clsx('mt-1.5 px-1 text-[11.5px]', left <= 5 ? 'text-ink-muted' : 'text-ink-faint')}>
        {left} of {quota.full.limit} questions left today
        {left <= 5 && ' — then answers switch to saver mode'}
      </p>
    )
  }
  // Saver: either this user's full answers are used up, or it's a busy day for everyone.
  const busy = quota.unlimited || quota.full.used < quota.full.limit
  return (
    <p
      className="mt-1.5 flex items-center gap-1 px-1 text-[11.5px] text-ink-muted"
      title="Answers come from a lighter, faster model: fine for most questions, less thorough on hard ones."
    >
      <Leaf className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      {busy
        ? 'Saver mode — the assistant is busy today'
        : `Saver mode · ${quota.saver.limit - quota.saver.used} questions left today`}
    </p>
  )
}

function AssistantMessage({ turn, streaming }: { turn: ChatTurn; streaming: boolean }) {
  const text = turn.content
  const [copied, setCopied] = useState(false)
  if (!text && streaming) {
    return (
      <div className="flex items-center gap-1.5 text-[13px] text-ink-faint">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="size-1.5 animate-bounce rounded-full bg-ink-faint"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </span>
        Thinking…
      </div>
    )
  }
  return (
    <div className="group">
      <MarkdownView content={text} className="compact" />
      {(turn.status === 'stopped' || turn.status === 'truncated') && !streaming && (
        <p className="mt-1 text-[11.5px] text-ink-faint italic">
          {turn.status === 'stopped' ? 'Stopped' : 'Cut short — the answer got too long. Ask about a smaller part.'}
        </p>
      )}
      {turn.tier === 'saver' && !streaming && (
        <p
          className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-faint"
          title="Answered by the lighter model (saver mode)."
        >
          <Leaf className="size-3" /> Saver
        </p>
      )}
      {!streaming && (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="mt-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11.5px] text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-ink focus:opacity-100 [@media(hover:none)]:opacity-100"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}
