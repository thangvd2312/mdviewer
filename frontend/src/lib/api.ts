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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))

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
}
