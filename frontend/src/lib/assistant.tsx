import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type AssistantContext, type ChatRequest, type ChatTurn, type ConversationQuery } from './api'

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
  /** The stored conversation this thread continues (none yet = the next question starts one). */
  conversationId?: string
  /** Restoring the last conversation from the server. */
  loading?: boolean
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
  /** Shows a stored conversation (from the history list) for the current page. */
  openConversation: (id: string) => void
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

/** Which stored conversations belong to the chat for this context. */
export const conversationQuery = (ctx: AssistantContext): ConversationQuery =>
  ctx.page === 'doc'
    ? { page: 'doc', docId: ctx.docId }
    : ctx.page === 'project'
      ? { page: 'project', projectId: ctx.projectId }
      : { page: 'home' }

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

  /** Shows `turns` (ending with the question) in thread `k` and streams the answer into it. */
  const run = useCallback(
    async (k: string, turns: ChatTurn[], body: ChatRequest) => {
      controllers.current.get(k)?.abort()
      const controller = new AbortController()
      controllers.current.set(k, controller)
      patch(k, (t) => ({
        ...t,
        turns: [...turns, { role: 'assistant', content: '' }],
        streaming: true,
        loading: false,
        error: undefined,
      }))

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
          body,
          (e) => {
            if (e.type === 'conversation') patch(k, (t) => ({ ...t, conversationId: e.id }))
            else if (e.type === 'text') text += e.text
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
            ...t,
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
      const current = threadsRef.current[k]
      if (current?.streaming) return
      const message = {
        content: q,
        ...(quote && { quote }),
        ...(context.sectionTitle && { section: context.sectionTitle }),
      }
      setQuote(null)
      void run(k, [...(current?.turns ?? []), { role: 'user', ...message }], {
        conversationId: current?.conversationId,
        message,
        context,
      })
    },
    [quote, run],
  )

  const stop = useCallback(() => controllers.current.get(key)?.abort(), [key])

  /** Re-asks the last question after an error (the server doesn't store it twice). */
  const retry = useCallback(() => {
    const last = thread.turns.at(-1)
    if (thread.streaming || last?.role !== 'user') return
    void run(key, thread.turns, {
      conversationId: thread.conversationId,
      message: {
        content: last.content,
        ...(last.quote && { quote: last.quote }),
        ...(last.section && { section: last.section }),
      },
      retry: true,
      context: page.context,
    })
  }, [thread, key, page.context, run])

  /** New chat: the old one stays stored (and in the history list). */
  const reset = useCallback(() => {
    controllers.current.get(key)?.abort()
    setThreads((all) => ({ ...all, [key]: EMPTY }))
    setQuote(null)
  }, [key])

  const load = useCallback(
    async (k: string, id: string) => {
      const conversation = await api.assistant.conversation(id)
      // Only if nothing was asked meanwhile.
      patch(k, (t) =>
        !t.loading
          ? t
          : {
              turns: conversation.messages.map(({ role, content, quote, section, status }) => ({
                role,
                content,
                quote,
                section,
                status,
              })),
              streaming: false,
              conversationId: conversation.id,
            },
      )
    },
    [patch],
  )

  const openConversation = useCallback(
    (id: string) => {
      controllers.current.get(key)?.abort()
      patch(key, () => ({ ...EMPTY, loading: true }))
      load(key, id).catch(() => patch(key, () => ({ ...EMPTY, error: 'Could not load that conversation.' })))
    },
    [key, load, patch],
  )

  // When the assistant opens on a page for the first time, continue its latest stored conversation.
  useEffect(() => {
    if (!open || threadsRef.current[key]) return
    const k = key
    patch(k, () => ({ ...EMPTY, loading: true }))
    api.assistant
      .conversations({ ...conversationQuery(pageRef.current.context), limit: 1 })
      .then(async ([latest]) => {
        if (latest) await load(k, latest.id)
      })
      .catch(() => {})
      .finally(() => patch(k, (t) => ({ ...t, loading: false })))
  }, [open, key, load, patch])

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
  const state: AssistantState = {
    open,
    page,
    quote,
    setQuote,
    thread,
    send,
    stop,
    retry,
    reset,
    openConversation,
    focusSignal,
  }

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
