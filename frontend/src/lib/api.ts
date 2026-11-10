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
  /** Public address of the series /blog/series/<slug> (kept after unpublishing); null = never published. */
  slug: string | null
  /** Set while the project is a series on the blog; null = private. */
  publishedAt: string | null
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
  /** Public address /s/<slug> (kept after unpublishing); null = never published. */
  slug: string | null
  /** Set while the doc is public; null = private. */
  publishedAt: string | null
  allowComments: boolean
  /** Place in its project (and series), set when the author reorders; null = after those, by title. */
  position: number | null
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

/** A review question about one of the user's documents. */
export interface ReviewCard {
  id: string
  docId: string
  docTitle: string
  question: string
  answer: string
  section: string | null
  /** asked = built from a question the user asked the assistant; note = from a sticky note; key = a key point. */
  origin: 'asked' | 'key' | 'note'
  basedOn: string | null
  isNew: boolean
  /** Added automatically after the user mastered the earlier questions. */
  levelUp: boolean
  due: string
  /** FSRS: chance the user still remembers it now (0–1); null for new cards. */
  recall: number | null
  /** ms from now until it would be due again, per rating. */
  next: Record<ReviewRating, number>
}

export interface ReviewSummary {
  due: number
  total: number
  new: number
  reviewedToday: number
  streak: number
  /** Documents that got new, harder questions (not tried yet) because the earlier ones were mastered. */
  levelledUp: { docId: string; title: string; count: number }[]
  docs: {
    id: string
    title: string
    project: string | null
    /** Questions the user asked the assistant about it. */
    asked: number
    notes: number
    cards: number
    due: number
    /** Questions already mastered (FSRS: stable for 5+ days). */
    mastered: number
  }[]
}

/** A personal access token for AI agents (MCP). */
export interface ApiTokenInfo {
  id: string
  name: string
  /** First characters, e.g. "vmd_Ab3x". */
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export type SensitiveKind =
  | 'secret'
  | 'token'
  | 'private-key'
  | 'email'
  | 'phone'
  | 'ip'
  | 'card'
  | 'id-number'
  | 'marked'
  | 'hidden-block'

/** What readers won't see once the doc is public. */
export interface SensitiveReport {
  /** The title readers see. */
  title: string
  findings: { kind: SensitiveKind; value: string }[]
}

export interface SharingInput {
  public?: boolean
  allowComments?: boolean
}

export interface PublicAuthor {
  name: string
  login: string | null
  avatarUrl: string | null
}

/** A published doc as listed on the blog. */
export interface PublicDocSummary {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  updatedAt: string
  viewCount: number
  commentCount: number
  /** Main section headings. */
  topics: string[]
  readMinutes: number
  author: PublicAuthor
}

/** A published doc on its reading page. */
export interface PublicDoc extends PublicDocSummary {
  id: string
  content: string
  allowComments: boolean
  /** The viewer wrote it. */
  isOwner: boolean
  /** Its series, when its project is published as one. */
  series: SeriesNav | null
}

/** The series a post belongs to, to move between its parts. */
export interface SeriesNav {
  slug: string
  name: string
  icon: string
  /** 0-based position of this post among `parts`. */
  index: number
  parts: { slug: string; title: string }[]
}

/** A series (a project published as one) as listed on the blog. */
export interface PublicSeriesSummary {
  slug: string
  name: string
  description: string | null
  icon: string
  publishedAt: string
  /** When its latest part was published. */
  lastPublishedAt: string
  partCount: number
  readMinutes: number
  viewCount: number
  author: PublicAuthor
}

/** A series page: its published documents in order. */
export interface PublicSeries extends Omit<PublicSeriesSummary, 'lastPublishedAt' | 'partCount'> {
  parts: PublicDocSummary[]
}

/** An author's public profile. */
export interface AuthorProfile extends PublicAuthor {
  joinedAt: string
  postCount: number
  viewCount: number
  lastPublishedAt: string | null
}

export interface ExploreQuery {
  q?: string
  sort?: 'latest' | 'popular'
  author?: string
  topic?: string
  offset?: number
  limit?: number
}

export type CommentAuthor =
  | { kind: 'user'; name: string; login: string | null; avatarUrl: string | null; isDocAuthor: boolean }
  | { kind: 'guest'; name: string }
  | { kind: 'gone' }

export interface PublicComment {
  id: string
  /** Top-level comment it replies to. */
  parentId: string | null
  body: string
  createdAt: string
  editedAt: string | null
  /** Deleted but kept because it has replies. */
  deleted: boolean
  author: CommentAuthor
  /** Written by the signed-in viewer. */
  mine: boolean
  /** Page author only: */
  hidden?: boolean
  blocked?: boolean
  device?: string
}

/** A top-level comment with its first replies. */
export interface Thread {
  comment: PublicComment
  replies: PublicComment[]
  /** Cursor for more replies; null = all shown. */
  moreReplies: string | null
}

/** One page of a document's comments (newest threads first). */
export interface CommentPage {
  threads: Thread[]
  /** Cursor for older threads; null = no more. */
  nextCursor: string | null
  /** Comments everyone can see. */
  count: number
  allowComments: boolean
  /** The viewer wrote the page: may hide, delete and block. */
  canModerate: boolean
}

export interface CommentBlockInfo {
  id: string
  kind: 'user' | 'guest'
  name: string
  login: string | null
  device: string | null
  createdAt: string
}

export interface CommentInput {
  body: string
  parentId?: string
  guestName?: string
  website?: string
  elapsedMs?: number
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
  /** Answers: 'stopped' when the user stopped it, 'truncated' when cut off for length, 'error' when it broke off. */
  status?: 'complete' | 'stopped' | 'truncated' | 'error' | null
  /** Answers: written by the main model (full) or the cheaper one (saver). */
  tier?: Tier | null
}

export type Tier = 'full' | 'saver'

/** The user's assistant allowance for today. */
export interface AssistantQuota {
  /** No per-user allowance. */
  unlimited: boolean
  /** Model tier the next question gets; null = no questions left today. */
  next: Tier | null
  full: { used: number; limit: number }
  saver: { used: number; limit: number }
  blocked: 'user' | 'global' | null
  /** When the allowance starts over (ISO). */
  resetAt: string
}

export interface AssistantStatus {
  enabled: boolean
  model: string
  quota: AssistantQuota | null
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
  | { type: 'conversation'; id: string; tier: Tier }
  | { type: 'text'; text: string }
  | { type: 'done'; stopReason: string | null }
  | { type: 'error'; message: string }

/**
 * Where the API lives. Empty (production): the same site, `/api`. Set VITE_API_URL to call another one,
 * e.g. https://apimdviewer.thangvu.io.vn in frontend/.env runs the local app against production.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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

async function send(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  headers?: Record<string, string>,
) {
  const token = tokenStore.get()
  const res = await fetch(`${API_ORIGIN}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
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

async function request<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await send(method, path, body, undefined, headers)
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new ApiError(res.status, message ?? res.statusText)
  }
  return data as T
}

const guestHeader = (token?: string) => (token ? { 'X-Guest-Token': token } : undefined)

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  return entries.length ? '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])) : ''
}

export const api = {
  auth: {
    /** Full-page navigation target that starts the GitHub OAuth flow (and brings the token back here). */
    githubUrl: API_ORIGIN
      ? `${API_ORIGIN}/api/auth/github?return_to=${encodeURIComponent(window.location.origin)}`
      : '/api/auth/github',
    me: () => request<User>('GET', '/auth/me'),
  },
  projects: {
    list: () => request<Project[]>('GET', '/projects'),
    create: (input: ProjectInput) => request<Project>('POST', '/projects', input),
    update: (id: string, input: ProjectInput) => request<Project>('PATCH', `/projects/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/projects/${id}`),
    /** Publish as a series on the blog (only its public docs appear); `publishDocs` publishes the private ones too. */
    setSharing: (id: string, input: { public: boolean; publishDocs?: boolean }) =>
      request<Project>('PUT', `/projects/${id}/sharing`, input),
    /** The project's docs, first to last (also the series order). */
    reorder: (id: string, docIds: string[]) => request<void>('PUT', `/projects/${id}/order`, { docIds }),
  },
  docs: {
    list: (params: { q?: string; projectId?: string; limit?: number } = {}) =>
      request<DocSummary[]>('GET', '/docs' + qs(params)),
    get: (id: string) => request<Doc>('GET', `/docs/${id}`),
    create: (input: DocInput & { content: string }) => request<Doc>('POST', '/docs', input),
    update: (id: string, input: DocInput) => request<Doc>('PATCH', `/docs/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/docs/${id}`),
    setSharing: (id: string, input: SharingInput) => request<Doc>('PUT', `/docs/${id}/sharing`, input),
    sensitive: (id: string) => request<SensitiveReport>('GET', `/docs/${id}/sensitive`),
  },
  review: {
    summary: () => request<ReviewSummary>('GET', '/review'),
    session: (docId?: string) =>
      request<ReviewCard[]>('GET', '/review/session' + qs({ docId, limit: docId ? 20 : 15 })),
    /** The AI writes questions about a document (counts as one assistant question). */
    generate: (docId: string) => request<ReviewCard[]>('POST', '/review/generate', { docId }),
    /** Returns the card with its new FSRS schedule. */
    /** levelledUp: this answer completed the document — new, harder questions are being written. */
    answer: (id: string, rating: ReviewRating) =>
      request<ReviewCard & { levelledUp: { docId: string; docTitle: string } | null }>(
        'POST',
        `/review/cards/${id}/answer`,
        { rating },
      ),
    check: (id: string, answer: string) =>
      request<{ verdict: 'correct' | 'partial' | 'wrong'; feedback: string }>('POST', `/review/cards/${id}/check`, {
        answer,
      }),
    remove: (id: string) => request<void>('DELETE', `/review/cards/${id}`),
  },
  tokens: {
    list: () => request<ApiTokenInfo[]>('GET', '/tokens'),
    /** The token itself comes back only here. */
    create: (name: string) => request<ApiTokenInfo & { token: string }>('POST', '/tokens', { name }),
    revoke: (id: string) => request<void>('DELETE', `/tokens/${id}`),
  },
  public: {
    list: (q: ExploreQuery) =>
      request<{ items: PublicDocSummary[]; hasMore: boolean }>('GET', '/public/docs' + qs({ ...q })),
    get: (slug: string) => request<PublicDoc>('GET', `/public/docs/${encodeURIComponent(slug)}`),
    author: (login: string) => request<AuthorProfile>('GET', `/public/authors/${encodeURIComponent(login)}`),
    topics: () => request<{ name: string; count: number }[]>('GET', '/public/topics'),
    seriesList: (q: { author?: string; limit?: number } = {}) =>
      request<PublicSeriesSummary[]>('GET', '/public/series' + qs(q)),
    series: (slug: string) => request<PublicSeries>('GET', `/public/series/${encodeURIComponent(slug)}`),
    comments: (slug: string, before?: string) =>
      request<CommentPage>('GET', `/public/docs/${encodeURIComponent(slug)}/comments` + qs({ before })),
    replies: (commentId: string, after?: string) =>
      request<{ replies: PublicComment[]; moreReplies: string | null }>(
        'GET',
        `/public/comments/${commentId}/replies` + qs({ after }),
      ),
    /** Guests get a `guestToken` back: keep it to edit or delete the comment later. */
    comment: (slug: string, input: CommentInput) =>
      request<{ comment: PublicComment; guestToken?: string }>(
        'POST',
        `/public/docs/${encodeURIComponent(slug)}/comments`,
        input,
      ),
    editComment: (id: string, body: string, guestToken?: string) =>
      request<PublicComment>('PATCH', `/public/comments/${id}`, { body }, guestHeader(guestToken)),
    deleteComment: (id: string, guestToken?: string) =>
      request<void>('DELETE', `/public/comments/${id}`, undefined, guestHeader(guestToken)),
    hideComment: (id: string, hidden: boolean) => request<void>('PUT', `/public/comments/${id}/hidden`, { hidden }),
    blockAuthor: (id: string) => request<void>('POST', `/public/comments/${id}/block`),
    unblockAuthor: (id: string) => request<void>('DELETE', `/public/comments/${id}/block`),
    blocks: (offset = 0) =>
      request<{ items: CommentBlockInfo[]; hasMore: boolean }>('GET', '/public/blocks' + qs({ offset, limit: 50 })),
    removeBlock: (id: string) => request<void>('DELETE', `/public/blocks/${id}`),
  },
  annotations: {
    list: (docId: string) => request<Annotation[]>('GET', `/docs/${docId}/annotations`),
    create: (docId: string, input: AnnotationInput) => request<Annotation>('POST', `/docs/${docId}/annotations`, input),
    update: (id: string, input: Partial<Pick<Annotation, 'kind' | 'body'>>) =>
      request<Annotation>('PATCH', `/annotations/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/annotations/${id}`),
  },
  assistant: {
    status: () => request<AssistantStatus>('GET', '/assistant/status'),
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
