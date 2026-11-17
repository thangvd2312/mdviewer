import type { Project } from './api'

/** How deep projects can be nested (same limit as the server). */
export const MAX_PROJECT_DEPTH = 5

const byName = (a: Project, b: Project) => a.name.localeCompare(b.name, undefined, { numeric: true })

/** Sub-projects of each project (key null = top level), by name. A project whose parent is missing counts as top level. */
export function childrenOf(projects: Project[]) {
  const ids = new Set(projects.map((p) => p.id))
  const map = new Map<string | null, Project[]>()
  for (const p of projects) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null
    map.set(key, [...(map.get(key) ?? []), p])
  }
  map.forEach((list) => list.sort(byName))
  return map
}

/** The projects `id` sits in, outermost first (not including itself). */
export function ancestorsOf(projects: Project[], id: string | null | undefined) {
  const byId = new Map(projects.map((p) => [p.id, p]))
  const out: Project[] = []
  const seen = new Set<string>()
  for (let p = id ? byId.get(byId.get(id)?.parentId ?? '') : undefined; p && !seen.has(p.id); p = byId.get(p.parentId ?? '')) {
    seen.add(p.id)
    out.unshift(p)
  }
  return out
}

/** Every project in tree order (parents before their sub-projects), with its depth (0 = top level). */
export function flattenTree(projects: Project[]) {
  const children = childrenOf(projects)
  const out: { project: Project; depth: number }[] = []
  const seen = new Set<string>()
  const walk = (parentId: string | null, depth: number) => {
    for (const p of children.get(parentId) ?? []) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push({ project: p, depth })
      walk(p.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** `id` and every project inside it, at any depth. */
export function subtreeIds(projects: Project[], id: string) {
  const children = childrenOf(projects)
  const ids = new Set<string>()
  const walk = (pid: string) => {
    if (ids.has(pid)) return
    ids.add(pid)
    for (const c of children.get(pid) ?? []) walk(c.id)
  }
  walk(id)
  return ids
}

/** Levels in `id`'s subtree (1 = no sub-projects). */
export function subtreeHeight(projects: Project[], id: string): number {
  const children = childrenOf(projects)
  const height = (pid: string, guard: number): number =>
    guard > projects.length ? 0 : 1 + Math.max(0, ...(children.get(pid) ?? []).map((c) => height(c.id, guard + 1)))
  return height(id, 0)
}

/** "AWS / ECS": the project's name after the projects it sits in. */
export const projectPath = (projects: Project[], project: Project) =>
  [...ancestorsOf(projects, project.id), project].map((p) => p.name).join(' / ')

/**
 * Breadcrumbs for a page inside `project`: the projects it sits in (left out on phones), then itself
 * (or "Notes" when there's none).
 */
export function projectCrumbs(projects: Project[], project: Project | undefined) {
  if (!project) return [{ label: 'Notes' }]
  const path = [...ancestorsOf(projects, project.id), project]
  return path.map((p, i) => ({ label: `${p.icon} ${p.name}`, to: `/p/${p.id}`, hideOnMobile: i < path.length - 1 }))
}
