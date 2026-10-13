import clsx from 'clsx'
import {
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  SquarePen,
  Sun,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { DeleteDocButton, revealOnHover } from './DeleteDocButton'
import type { DocSummary } from '../lib/api'
import { useAuth } from '../lib/auth'
import { initials } from '../lib/format'
import { useDocs, useProjects } from '../lib/queries'
import { useStoredState } from '../lib/storage'
import { useUI, type ThemePref } from '../lib/ui'
import { ProjectDialog } from './ProjectDialog'
import { IconButton, Logo } from './ui'

const byTitle = (a: DocSummary, b: DocSummary) => a.title.localeCompare(b.title, undefined, { numeric: true })

const rowClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex h-8 min-w-0 items-center gap-2 rounded-lg px-2 text-[13.5px] transition-colors',
    isActive ? 'bg-hover font-medium text-ink' : 'text-ink/85 hover:bg-hover',
  )

export function Sidebar() {
  const { user, logout } = useAuth()
  const { setSidebarOpen, setSearchOpen } = useUI()
  const { data: projects = [] } = useProjects()
  const { data: docs = [] } = useDocs()
  const [expanded, setExpanded] = useStoredState<string[]>('viewmd.expanded', [])
  const [creatingProject, setCreatingProject] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const location = useLocation()

  const { byProject, loose, recents } = useMemo(() => {
    const byProject = new Map<string, DocSummary[]>()
    const loose: DocSummary[] = []
    for (const d of docs) {
      if (d.projectId) byProject.set(d.projectId, [...(byProject.get(d.projectId) ?? []), d])
      else loose.push(d)
    }
    byProject.forEach((list) => list.sort(byTitle))
    return { byProject, loose: loose.sort(byTitle), recents: docs.slice(0, 8) }
  }, [docs])

  // Reveal the project that contains the doc being viewed.
  const activeDocId = location.pathname.match(/^\/d\/([^/]+)/)?.[1]
  const activeProjectId = docs.find((d) => d.id === activeDocId)?.projectId
  useEffect(() => {
    if (activeProjectId && !expanded.includes(activeProjectId)) setExpanded((e) => [...e, activeProjectId])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  // Close the drawer after navigating on phones.
  useEffect(() => {
    if (matchMedia('(max-width: 767px)').matches) setSidebarOpen(false)
  }, [location.pathname, setSidebarOpen])

  const toggle = (id: string) => setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]))

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 pr-2 pl-4">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Logo className="size-5.5" />
          viewmd
        </Link>
        <div className="ml-auto flex">
          <IconButton label="Search (⌘K)" onClick={() => setSearchOpen(true)}>
            <Search />
          </IconButton>
          <IconButton label="Collapse sidebar" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose />
          </IconButton>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        <NavLink to="/new" end className={rowClass}>
          <SquarePen className="size-4 text-ink-muted" />
          New note
        </NavLink>

        <Section
          title="Projects"
          action={
            <button
              type="button"
              aria-label="New project"
              title="New project"
              onClick={() => setCreatingProject(true)}
              className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-hover hover:text-ink"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          {projects.length === 0 && <Empty>Group related docs into a project.</Empty>}
          {projects.map((p) => {
            const open = expanded.includes(p.id)
            const items = byProject.get(p.id) ?? []
            return (
              <div key={p.id}>
                <div className="group relative flex items-center">
                  <button
                    type="button"
                    aria-label={open ? 'Collapse' : 'Expand'}
                    onClick={() => toggle(p.id)}
                    className="absolute left-1 z-10 grid size-6 place-items-center rounded-md text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink"
                  >
                    <ChevronRight className={clsx('size-3.5 transition-transform', open && 'rotate-90')} />
                  </button>
                  <NavLink to={`/p/${p.id}`} onClick={() => !open && toggle(p.id)} className={(s) => clsx(rowClass(s), 'flex-1 pr-8')}>
                    <span className="grid w-4 place-items-center text-[13px] transition-opacity group-hover:opacity-0">
                      {p.icon === '📁' ? (
                        open ? <FolderOpen className="size-4 text-ink-muted" /> : <FolderClosed className="size-4 text-ink-muted" />
                      ) : (
                        p.icon
                      )}
                    </span>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11.5px] text-ink-faint group-hover:opacity-0">{items.length || ''}</span>
                  </NavLink>
                  <Link
                    to={`/new?project=${p.id}`}
                    aria-label={`New document in ${p.name}`}
                    title="New document in this project"
                    className={clsx(
                      'absolute right-1 grid size-6 place-items-center rounded-md text-ink-faint hover:bg-surface hover:text-ink',
                      revealOnHover,
                    )}
                  >
                    <Plus className="size-3.5" />
                  </Link>
                </div>
                {open && (
                  <div className="mb-1 ml-[15px] border-l border-line pl-2">
                    {items.map((d) => (
                      <DocLink key={d.id} doc={d} />
                    ))}
                    {items.length === 0 && <Empty>No documents</Empty>}
                  </div>
                )}
              </div>
            )
          })}
        </Section>

        <Section
          title="Notes"
          action={
            <Link
              to="/new"
              aria-label="New note"
              title="New note (not in any project)"
              className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-hover hover:text-ink"
            >
              <Plus className="size-3.5" />
            </Link>
          }
        >
          {loose.length === 0 && (
            <Link to="/new" className="block rounded-lg px-2 py-1 text-[12.5px] text-ink-faint hover:bg-hover hover:text-ink">
              Quick notes that don’t belong to a project. <span className="underline underline-offset-2">Create one</span>
            </Link>
          )}
          {loose.map((d) => (
            <DocLink key={d.id} doc={d} icon />
          ))}
        </Section>

        {recents.length > 0 && (
          <Section title="Recents">
            {recents.map((d) => (
              <DocLink key={d.id} doc={d} />
            ))}
          </Section>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5">
        {user?.avatarUrl && !avatarFailed ? (
          <img
            src={user.avatarUrl}
            alt=""
            onError={() => setAvatarFailed(true)}
            className="size-7 shrink-0 rounded-full border border-line"
          />
        ) : (
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-[11px] font-semibold text-white">
            {user ? initials(user.name) : ''}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-medium">{user?.name}</div>
          <div className="truncate text-[11.5px] text-ink-faint">
            {user?.githubLogin ? `@${user.githubLogin}` : user?.email}
          </div>
        </div>
        <ThemeToggle />
        <IconButton label="Sign out" onClick={logout}>
          <LogOut />
        </IconButton>
      </div>

      <ProjectDialog open={creatingProject} onClose={() => setCreatingProject(false)} />
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-0.5 flex h-6 items-center justify-between pr-1 pl-2 text-[12px] font-medium text-ink-faint">
        {title}
        {action}
      </div>
      {children}
    </section>
  )
}

function DocLink({ doc, icon }: { doc: DocSummary; icon?: boolean }) {
  return (
    <div className="group relative">
      <NavLink to={`/d/${doc.id}`} className={(s) => clsx(rowClass(s), 'pr-8')} title={doc.title}>
        {icon && <FileText className="size-4 shrink-0 text-ink-muted" />}
        <span className="truncate">{doc.title}</span>
      </NavLink>
      <DeleteDocButton doc={doc} className={clsx('absolute top-1 right-1', revealOnHover)} />
    </div>
  )
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="px-2 py-1 text-[12.5px] text-ink-faint">{children}</p>
)

const THEMES: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Light theme', icon: <Sun /> },
  { value: 'dark', label: 'Dark theme', icon: <Moon /> },
  { value: 'system', label: 'System theme', icon: <Monitor /> },
]

function ThemeToggle() {
  const { theme, setTheme } = useUI()
  const i = THEMES.findIndex((t) => t.value === theme)
  const next = THEMES[(i + 1) % THEMES.length]!
  return (
    <IconButton label={`${THEMES[i]!.label} — switch to ${next.label.toLowerCase()}`} onClick={() => setTheme(next.value)}>
      {THEMES[i]!.icon}
    </IconButton>
  )
}
