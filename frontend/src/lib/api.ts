export interface User {
  id: string
  name: string
  email: string | null
  githubLogin: string | null
  avatarUrl: string | null
}

export interface Project {
  id: string
  name: string
  description: string | null
  icon: string
  createdAt: string
  updatedAt: string
}

export interface DocSummary {
  id: string
  projectId: string | null
  title: string
  excerpt: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
}

export interface Doc extends DocSummary {
  content: string
}

export interface DocInput {
  title?: string
  content?: string
  projectId?: string | null
}

export interface ProjectInput {
  name?: string
  description?: string | null
  icon?: string
}

export type AnnotationKind = 'note' | 'important' | 'idea' | 'question' | 'todo' | 'definition'

export interface Annotation {
  id: string
  docId: string
  kind: AnnotationKind
  quote: string
  prefix: string
  suffix: string
  position: number
  body: string
  createdAt: string
  updatedAt: string
}

export type AnnotationInput = Pick<Annotation, 'kind' | 'quote' | 'prefix' | 'suffix' | 'position'> & { body?: string }

export interface AssistantContext {
  page: 'home' | 'project' | 'doc' | 'other'
  docId?: string
  projectId?: string
  sectionTitle?: string
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
  /** Passage selected when asking (user turns). */
  quote?: string | null
  /** Section being read when asking (user turns). */
  section?: string | null
  /** Answers: 'stopped' when the user stopped it, 'error' when it broke off. */
  status?: 'complete' | 'stopped' | 'error' | null
}

/** A stored chat with the assistant. */
export interface Conversation {
  id: string
  page: AssistantContext['page']
  docId: string | null
  projectId: string | null
  title: string
  createdAt: string
  updatedAt: string
}

export interface ConversationQuery {
  page?: AssistantContext['page']
  docId?: string
  projectId?: string
  limit?: number
}

/** The question sent with a chat request; earlier messages are loaded by the server. */
export interface ChatRequest {
  conversationId?: string
  message: { content: string; quote?: string; section?: string }
  retry?: boolean
  context: AssistantContext
}

export type ChatStreamEvent =
  | { type: 'conversation'; id: string }
  | { type: 'text'; text: string }
  | { type: 'done'; stopReason: string | null }
  | { type: 'error'; message: string }

const TOKEN_KEY = 'viewmd.token'
export const UNAUTHORIZED_EVENT = 'viewmd:unauthorized'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function send(method: string, path: string, body?: unknown, signal?: AbortSignal) {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  return res
}

async function errorFrom(res: Response) {
  const data = await res.json().catch(() => undefined)
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message
  return new ApiError(res.status, message ?? res.statusText)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body)
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new ApiError(res.status, message ?? res.statusText)
  }
  return data as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  return entries.length ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])) : ''
}

export const api = {
  auth: {
    /** Full-page navigation target that starts the GitHub OAuth flow. */
    githubUrl: '/api/auth/github',
    me: () => request<User>('GET', '/auth/me'),
  },
  projects: {
    list: () => request<Project[]>('GET', '/projects'),
    create: (input: ProjectInput) => request<Project>('POST', '/projects', input),
    update: (id: string, input: ProjectInput) => request<Project>('PATCH', `/projects/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/projects/${id}`),
  },
  docs: {
    list: (params: { q?: string; projectId?: string; limit?: number } = {}) =>
      request<DocSummary[]>('GET', '/docs' + qs(params)),
    get: (id: string) => request<Doc>('GET', `/docs/${id}`),
    create: (input: DocInput & { content: string }) => request<Doc>('POST', '/docs', input),
    update: (id: string, input: DocInput) => request<Doc>('PATCH', `/docs/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/docs/${id}`),
  },
  annotations: {
    list: (docId: string) => request<Annotation[]>('GET', `/docs/${docId}/annotations`),
    create: (docId: string, input: AnnotationInput) => request<Annotation>('POST', `/docs/${docId}/annotations`, input),
    update: (id: string, input: Partial<Pick<Annotation, 'kind' | 'body'>>) =>
      request<Annotation>('PATCH', `/annotations/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/annotations/${id}`),
  },
  assistant: {
    status: () => request<{ enabled: boolean; model: string }>('GET', '/assistant/status'),
    suggest: (context: AssistantContext, selection?: string) =>
      request<{ questions: string[] }>('POST', '/assistant/suggest', { context, selection }),
    conversations: (q: ConversationQuery) => {
      const params = new URLSearchParams(
        Object.entries(q)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )
      return request<Conversation[]>('GET', `/assistant/conversations?${params}`)
    },
    conversation: (id: string) =>
      request<Conversation & { messages: ChatTurn[] }>('GET', `/assistant/conversations/${id}`),
    /** Stores the question and streams the answer; resolves when the stream ends. */
    async chat(body: ChatRequest, onEvent: (e: ChatStreamEvent) => void, signal?: AbortSignal) {
      const res = await send('POST', '/assistant/chat', body, signal)
      if (!res.ok || !res.body) throw await errorFrom(res)
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        let cut: number
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)) as ChatStreamEvent)
          }
        }
      }
    },
  },
}
