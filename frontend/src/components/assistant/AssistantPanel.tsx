import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Folder,
  House,
  Quote,
  RotateCcw,
  Sparkles,
  Square,
  SquarePen,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, type AssistantContext } from '../../lib/api'
import { useAssistant, useAssistantState, type PageInfo } from '../../lib/assistant'
import { useAssistantStatus } from '../../lib/queries'
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
      {open && <AssistantPanel side={side} />}
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
  if (quote) return ['Explain this passage simply', 'Give me a concrete example of this', 'Why does this matter here?']
  if (context.page === 'doc' && context.sectionTitle)
    return [
      `Summarize “${context.sectionTitle}”`,
      'What are the key points of this section?',
      'Quiz me on this section',
    ]
  if (context.page === 'doc')
    return ['Summarize this document', 'What are the key takeaways?', 'Quiz me on this document']
  if (context.page === 'project')
    return ['What is this project about?', 'Which document should I read first?', 'Summarize the project']
  return ['What have I been reading lately?', 'Which of my documents should I review?']
}

function AssistantPanel({ side }: { side: Side }) {
  const { page, quote, setQuote, thread, send, stop, retry, reset, focusSignal } = useAssistantState()
  const { setOpen } = useAssistant()
  const { data: status } = useAssistantStatus()
  const enabled = status?.enabled ?? true
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [focusSignal])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

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
  }

  const ContextIcon = page.context.page === 'doc' ? FileText : page.context.page === 'project' ? Folder : House

  return (
    <section
      aria-label="Assistant"
      className={clsx(
        'animate-pop fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.18),0_4px_14px_rgba(0,0,0,0.08)]',
        'inset-x-2 top-[12dvh] bottom-2 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:h-[min(640px,calc(100dvh-32px))] sm:w-[400px]',
        side === 'left' ? 'sm:left-4' : 'sm:right-4',
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-3">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#2f6bff] to-[#7a3cff] text-white">
          <Sparkles className="size-4" />
        </span>
        <span className="text-[14px] font-semibold">Assistant</span>
        <div className="ml-auto flex">
          <IconButton label="New chat" onClick={reset} disabled={empty && !quote}>
            <SquarePen />
          </IconButton>
          <IconButton label="Close (Esc)" onClick={() => setOpen(false)}>
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
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {empty ? (
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
                    <Sparkles className="size-3" /> Suggested for {quote ? 'this passage' : page.context.sectionTitle ? 'this section' : 'you'}
                  </>
                ) : (
                  <>Try asking{suggestions.isFetching && <span className="animate-pulse normal-case"> · tailoring…</span>}</>
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
                <AssistantMessage key={i} text={turn.content} streaming={thread.streaming && i === thread.turns.length - 1} />
              ),
            )}
            {thread.error && (
              <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {thread.error}
                {thread.turns.at(-1)?.role === 'user' && (
                  <button type="button" onClick={retry} className="ml-2 inline-flex items-center gap-1 font-medium underline">
                    <RotateCcw className="size-3" /> Retry
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-2.5">
        {!enabled && (
          <p className="mb-2 rounded-lg bg-raised px-3 py-2 text-[12.5px] text-ink-muted">
            The assistant isn’t set up yet. Add <code className="font-mono">ASSISTANT_API_KEY</code> to the server’s .env and
            restart it.
          </p>
        )}
        {quote && (
          <div className="mb-2 flex items-start gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-[12.5px] text-ink-muted">
            <Quote className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2 flex-1 italic">{quote}</span>
            <button type="button" aria-label="Remove passage" onClick={() => setQuote(null)} className="text-ink-faint hover:text-ink">
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
            maxLength={20_000}
            disabled={!enabled}
            placeholder={quote ? 'Ask about this passage…' : 'Ask anything…'}
            className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[14px] leading-6 outline-none placeholder:text-ink-faint"
          />
          {thread.streaming ? (
            <button
              type="button"
              aria-label="Stop"
              title="Stop"
              onClick={stop}
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-surface"
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
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-surface transition disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function AssistantMessage({ text, streaming }: { text: string; streaming: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!text && streaming) {
    return (
      <div className="flex items-center gap-1.5 text-[13px] text-ink-faint">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="size-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        Thinking…
      </div>
    )
  }
  return (
    <div className="group">
      <MarkdownView content={text} className="compact" />
      {!streaming && (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="mt-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11.5px] text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-ink focus:opacity-100"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? 'Copied' : 'Copy'}
        </button>
      )}
    </div>
  )
}
