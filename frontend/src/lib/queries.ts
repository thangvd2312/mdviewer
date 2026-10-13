import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type DocInput, type DocSummary, type Project, type ProjectInput } from './api'

export const keys = {
  projects: ['projects'] as const,
  docs: ['docs'] as const,
  doc: (id: string) => ['doc', id] as const,
  search: (q: string) => ['search', q] as const,
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
