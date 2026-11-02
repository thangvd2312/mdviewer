import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type AssistantContext, type ChatTurn } from './api'

/** What the user is looking at, as published by the current page. */
export interface PageInfo {
  context: AssistantContext
  /** e.g. the document or project name */
  title?: string
}

export interface Thread {
  turns: ChatTurn[]
  streaming: boolean
  error?: string
}

interface AssistantActions {
  setOpen: (open: boolean | ((o: boolean) => boolean)) => void
  /** Opens the assistant, optionally attaching a passage to the next question and/or sending a question. */
  ask: (opts?: { quote?: string; question?: string }) => void
  setPage: (page: PageInfo | null) => void
}

interface AssistantState {
  open: boolean
  page: PageInfo
  /** Passage attached to the next question. */
  quote: string | null
  setQuote: (quote: string | null) => void
  thread: Thread
  send: (question: string) => void
  stop: () => void
  retry: () => void
  reset: () => void
  /** Increments whenever the input should take focus. */
  focusSignal: number
}

const ActionsContext = createContext<AssistantActions | null>(null)
const StateContext = createContext<AssistantState | null>(null)

const DEFAULT_PAGE: PageInfo = { context: { page: 'other' } }
const EMPTY: Thread = { turns: [], streaming: false }

/** Conversations are kept per document / project, so each has its own chat. */
const threadKey = (ctx: AssistantContext) =>
  ctx.page === 'doc' ? `doc:${ctx.docId}` : ctx.page === 'project' ? `project:${ctx.projectId}` : 'general'

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [page, setPageState] = useState<PageInfo>(DEFAULT_PAGE)
  const [quote, setQuote] = useState<string | null>(null)
  const [threads, setThreads] = useState<Record<string, Thread>>({})
  const [focusSignal, setFocusSignal] = useState(0)
  const controllers = useRef(new Map<string, AbortController>())
  // Latest values for callbacks that must stay stable.
  const pageRef = useRef(page)
  const threadsRef = useRef(threads)
  useLayoutEffect(() => {
    pageRef.current = page
    threadsRef.current = threads
  })

  const key = threadKey(page.context)
  const thread = threads[key] ?? EMPTY

  const patch = useCallback((k: string, fn: (t: Thread) => Thread) => {
    setThreads((all) => ({ ...all, [k]: fn(all[k] ?? EMPTY) }))
  }, [])

  /** Streams an answer to `turns` (which ends with a user turn) into thread `k`. */
  const run = useCallback(
    async (k: string, turns: ChatTurn[], context: AssistantContext) => {
      controllers.current.get(k)?.abort()
      const controller = new AbortController()
      controllers.current.set(k, controller)
      patch(k, () => ({ turns: [...turns, { role: 'assistant', content: '' }], streaming: true }))

      // Batch token updates to one render per frame.
      let text = ''
      let frame = 0
      const flush = () => {
        frame = 0
        patch(k, (t) => ({ ...t, turns: [...t.turns.slice(0, -1), { role: 'assistant', content: text }] }))
      }
      let error: string | undefined
      try {
        await api.assistant.chat(
          turns,
          context,
          (e) => {
            if (e.type === 'text') text += e.text
            else if (e.type === 'error') error = e.message
            if (!frame) frame = requestAnimationFrame(flush)
          },
          controller.signal,
        )
      } catch (e) {
        if (!controller.signal.aborted) error = e instanceof ApiError ? e.message : 'Could not reach the assistant.'
      } finally {
        cancelAnimationFrame(frame)
        if (controllers.current.get(k) === controller) controllers.current.delete(k)
        patch(k, (t) => {
          const answered = text.trim() !== ''
          const rest = t.turns.slice(0, -1)
          return {
            turns: answered ? [...rest, { role: 'assistant', content: text }] : rest,
            streaming: false,
            error,
          }
        })
      }
    },
    [patch],
  )

  const send = useCallback(
    (question: string) => {
      const q = question.trim()
      if (!q) return
      const { context } = pageRef.current
      const k = threadKey(context)
      const history = threadsRef.current[k]?.turns ?? []
      if (threadsRef.current[k]?.streaming) return
      const turn: ChatTurn = {
        role: 'user',
        content: q,
        ...(quote && { quote }),
        ...(context.sectionTitle && { section: context.sectionTitle }),
      }
      setQuote(null)
      void run(k, [...history, turn], context)
    },
    [quote, run],
  )

  const stop = useCallback(() => controllers.current.get(key)?.abort(), [key])

  /** Re-asks the last question after an error. */
  const retry = useCallback(() => {
    const turns = thread.turns
    if (thread.streaming || turns.at(-1)?.role !== 'user') return
    void run(key, turns, page.context)
  }, [thread, key, page.context, run])

  const reset = useCallback(() => {
    controllers.current.get(key)?.abort()
    setThreads((all) => {
      const next = { ...all }
      delete next[key]
      return next
    })
    setQuote(null)
  }, [key])

  const setPage = useCallback((info: PageInfo | null) => setPageState(info ?? DEFAULT_PAGE), [])

  const sendRef = useRef(send)
  useLayoutEffect(() => {
    sendRef.current = send
  })

  const ask = useCallback<AssistantActions['ask']>(
    (opts = {}) => {
      setOpen(true)
      if (opts.quote !== undefined) setQuote(opts.quote)
      setFocusSignal((n) => n + 1)
      if (opts.question) setTimeout(() => sendRef.current(opts.question!), 0)
    },
    [],
  )
  // ⌘J / Ctrl+J toggles the assistant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
        setFocusSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const actions = useMemo(() => ({ setOpen, ask, setPage }), [ask, setPage])
  const state: AssistantState = { open, page, quote, setQuote, thread, send, stop, retry, reset, focusSignal }

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  )
}

/** Stable actions — safe to use in pages without re-rendering on every assistant update. */
export function useAssistant() {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useAssistant must be used inside <AssistantProvider>')
  return ctx
}

export function useAssistantState() {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useAssistantState must be used inside <AssistantProvider>')
  return ctx
}

/** Publishes what the current page is showing, so the assistant can use it as context. */
export function usePageAssistant(info: PageInfo | null) {
  const { setPage } = useAssistant()
  const serialized = JSON.stringify(info)
  useEffect(() => {
    setPage(serialized === 'null' ? null : (JSON.parse(serialized) as PageInfo))
  }, [serialized, setPage])
  useEffect(() => () => setPage(null), [setPage])
}
