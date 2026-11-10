import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Annotation,
  type AnnotationInput,
  type CommentPage,
  type Doc,
  type DocInput,
  type DocSummary,
  type ExploreQuery,
  type Project,
  type ProjectInput,
  type SharingInput,
} from './api'

export const keys = {
  projects: ['projects'] as const,
  docs: ['docs'] as const,
  doc: (id: string) => ['doc', id] as const,
  search: (q: string) => ['search', q] as const,
  annotations: (docId: string) => ['annotations', docId] as const,
  assistantStatus: ['assistant', 'status'] as const,
  explore: (q: ExploreQuery) => ['explore', q] as const,
  publicDoc: (slug: string) => ['public', 'doc', slug] as const,
  comments: (slug: string) => ['public', 'comments', slug] as const,
}

const EXPLORE_PAGE = 20

/** Published docs for the blog, a page at a time. */
export const useExplore = (q: Omit<ExploreQuery, 'offset' | 'limit'>) =>
  useInfiniteQuery({
    queryKey: keys.explore(q),
    queryFn: ({ pageParam }) => api.public.list({ ...q, offset: pageParam, limit: EXPLORE_PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * EXPLORE_PAGE : undefined),
    placeholderData: (prev) => prev,
  })

/** A few published docs (no paging): "Most read", "More from this author". */
export const usePublicDocs = (q: ExploreQuery, enabled = true) =>
  useQuery({ queryKey: ['explore', 'short', q], enabled, queryFn: () => api.public.list(q), staleTime: 60_000 })

export const useAuthor = (login: string | undefined) =>
  useQuery({ queryKey: ['public', 'author', login], enabled: Boolean(login), queryFn: () => api.public.author(login!) })

export const useTopics = () =>
  useQuery({ queryKey: ['public', 'topics'], queryFn: api.public.topics, staleTime: 5 * 60_000 })

/** Series on the blog (projects published as one), newest additions first. */
export const useSeriesList = (q: { author?: string; limit?: number } = {}, enabled = true) =>
  useQuery({ queryKey: ['public', 'series', 'list', q], enabled, queryFn: () => api.public.seriesList(q), staleTime: 60_000 })

export const usePublicSeries = (slug: string | undefined) =>
  useQuery({
    queryKey: ['public', 'series', slug],
    enabled: Boolean(slug),
    queryFn: () => api.public.series(slug!),
  })

/** Order of documents in a project, which is also the series order: the author's order, then by title. */
export const projectOrder = (a: DocSummary, b: DocSummary) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
  a.title.localeCompare(b.title, undefined, { numeric: true })

/** Publish / unpublish a project as a series, optionally choosing which of its docs are public. */
export function useSetProjectSharing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; public: boolean; publicDocIds?: string[] }) =>
      api.projects.setSharing(id, input),
    onSuccess: (project, input) => {
      queryClient.setQueryData<Project[]>(keys.projects, (list) => list?.map((p) => (p.id === project.id ? project : p)))
      if (input.publicDocIds) {
        queryClient.invalidateQueries({ queryKey: keys.docs })
        queryClient.invalidateQueries({ queryKey: ['doc'] })
      }
      queryClient.invalidateQueries({ queryKey: ['public'] })
      queryClient.invalidateQueries({ queryKey: ['explore'] })
    },
  })
}

/** Save the order of a project's documents; the list updates right away. */
export function useReorderDocs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, docIds }: { projectId: string; docIds: string[] }) =>
      api.projects.reorder(projectId, docIds),
    onMutate: ({ projectId, docIds }) => {
      const at = new Map(docIds.map((id, i) => [id, i]))
      queryClient.setQueryData<DocSummary[]>(keys.docs, (list) =>
        list?.map((d) => (d.projectId === projectId ? { ...d, position: at.get(d.id) ?? null } : d)),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: keys.docs })
      queryClient.invalidateQueries({ queryKey: ['public', 'series'] })
    },
  })
}

export const usePublicDoc = (slug: string | undefined) =>
  useQuery({ queryKey: keys.publicDoc(slug ?? ''), enabled: Boolean(slug), queryFn: () => api.public.get(slug!) })

/** A document's comment threads, a page at a time (newest first). */
export const useComments = (slug: string) =>
  useInfiniteQuery({
    queryKey: keys.comments(slug),
    queryFn: ({ pageParam }) => api.public.comments(slug, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: CommentPage) => last.nextCursor ?? undefined,
  })

export const useBlocks = (enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ['public', 'blocks'],
    enabled,
    queryFn: ({ pageParam }) => api.public.blocks(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * 50 : undefined),
  })

/** Publish / unpublish a doc or toggle its comments, keeping the cached doc and lists in sync. */
export function useSetSharing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: SharingInput & { id: string }) => api.docs.setSharing(id, input),
    onSuccess: (doc: Doc) => {
      queryClient.setQueryData(keys.doc(doc.id), doc)
      queryClient.setQueryData<DocSummary[]>(keys.docs, (list) =>
        list?.map((d) =>
          d.id === doc.id
            ? { ...d, slug: doc.slug, publishedAt: doc.publishedAt, allowComments: doc.allowComments }
            : d,
        ),
      )
      queryClient.invalidateQueries({ queryKey: ['explore'] })
      if (doc.slug) {
        queryClient.invalidateQueries({ queryKey: keys.publicDoc(doc.slug) })
        // Turning comments on/off changes what the comment section offers.
        queryClient.invalidateQueries({ queryKey: keys.comments(doc.slug) })
      }
    },
  })
}

export const useProjects = (enabled = true) => useQuery({ queryKey: keys.projects, queryFn: api.projects.list, enabled })

/** Summaries (no content) of every doc the user owns, most recently opened first. */
export const useDocs = () => useQuery({ queryKey: keys.docs, queryFn: () => api.docs.list({ limit: 1000 }) })

export function useDoc(id: string | undefined) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: keys.doc(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const doc = await api.docs.get(id!)
      // Opening bumps lastOpenedAt server-side; mirror it locally so "Recents" updates without a refetch.
      queryClient.setQueryData<DocSummary[]>(keys.docs, (list) =>
        list
          ?.map((d) => (d.id === doc.id ? { ...d, lastOpenedAt: doc.lastOpenedAt } : d))
          .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)),
      )
      return doc
    },
  })
}

export function useSearchDocs(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    enabled: q.trim().length > 0,
    queryFn: () => api.docs.list({ q, limit: 30 }),
    placeholderData: (prev) => prev,
  })
}

export function useSaveDoc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: DocInput & { id?: string }) =>
      id ? api.docs.update(id, input) : api.docs.create({ ...input, content: input.content ?? '' }),
    onSuccess: (doc) => {
      queryClient.setQueryData(keys.doc(doc.id), doc)
      queryClient.invalidateQueries({ queryKey: keys.docs })
    },
  })
}

export function useDeleteDoc() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.docs.remove,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.doc(id) })
      queryClient.setQueryData<DocSummary[]>(keys.docs, (list) => list?.filter((d) => d.id !== id))
    },
  })
}

export function useSaveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: ProjectInput & { id?: string }) =>
      id ? api.projects.update(id, input) : api.projects.create(input),
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(keys.projects, (list = []) =>
        [...list.filter((p) => p.id !== project.id), project].sort((a, b) => a.name.localeCompare(b.name)),
      )
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.projects.remove,
    onSuccess: (_, id) => {
      queryClient.setQueryData<Project[]>(keys.projects, (list) => list?.filter((p) => p.id !== id))
      // Its docs were deleted with it.
      queryClient.invalidateQueries({ queryKey: keys.docs })
    },
  })
}

export const useAnnotations = (docId: string | undefined) =>
  useQuery({
    queryKey: keys.annotations(docId ?? ''),
    enabled: Boolean(docId),
    queryFn: () => api.annotations.list(docId!),
  })

/** Create / update / delete sticky notes of one document, keeping the cached list in sync. */
export function useAnnotationMutations(docId: string) {
  const queryClient = useQueryClient()
  const key = keys.annotations(docId)
  const put = (a: Annotation) =>
    queryClient.setQueryData<Annotation[]>(key, (list = []) =>
      [...list.filter((x) => x.id !== a.id), a].sort((x, y) => x.position - y.position),
    )

  const create = useMutation({
    mutationFn: (input: AnnotationInput) => api.annotations.create(docId, input),
    onSuccess: put,
  })
  const update = useMutation({
    mutationFn: ({ id, ...input }: Partial<Pick<Annotation, 'kind' | 'body'>> & { id: string }) =>
      api.annotations.update(id, input),
    // Optimistic: the note UI edits in place.
    onMutate: ({ id, ...input }) =>
      queryClient.setQueryData<Annotation[]>(key, (list) => list?.map((a) => (a.id === id ? { ...a, ...input } : a))),
    onSuccess: put,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.annotations.remove(id),
    onMutate: (id) => queryClient.setQueryData<Annotation[]>(key, (list) => list?.filter((a) => a.id !== id)),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  return { create, update, remove }
}

export const useReviewSummary = () =>
  useQuery({ queryKey: ['review', 'summary'], queryFn: api.review.summary, staleTime: 60_000 })

export const useAssistantStatus = () =>
  // Carries today's allowance: refreshed after every question, and now and then (it resets at midnight).
  useQuery({ queryKey: keys.assistantStatus, queryFn: api.assistant.status, staleTime: 60_000 })
