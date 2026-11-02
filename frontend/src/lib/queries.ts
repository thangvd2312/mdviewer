import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Annotation, type AnnotationInput, type DocInput, type DocSummary, type Project, type ProjectInput } from './api'

export const keys = {
  projects: ['projects'] as const,
  docs: ['docs'] as const,
  doc: (id: string) => ['doc', id] as const,
  search: (q: string) => ['search', q] as const,
  annotations: (docId: string) => ['annotations', docId] as const,
  assistantStatus: ['assistant', 'status'] as const,
}

export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.projects.list })

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
  useQuery({ queryKey: keys.annotations(docId ?? ''), enabled: Boolean(docId), queryFn: () => api.annotations.list(docId!) })

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

export const useAssistantStatus = () =>
  useQuery({ queryKey: keys.assistantStatus, queryFn: api.assistant.status, staleTime: Infinity })
