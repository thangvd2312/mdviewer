import clsx from 'clsx'
import { ChevronRight, PanelLeft } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router'
import { AssistantProvider } from '../lib/assistant'
import { useUI } from '../lib/ui'
import { Assistant } from './assistant/AssistantPanel'
import { SearchDialog } from './SearchDialog'
import { Sidebar } from './Sidebar'
import { IconButton } from './ui'

export function AppLayout() {
  const { sidebarOpen, setSidebarOpen } = useUI()
  return (
    <AssistantProvider>
    <div className="flex h-dvh overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <aside
        className={clsx(
          'z-30 w-[272px] shrink-0 border-r border-line bg-sidebar transition-[margin] duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0',
          !sidebarOpen && '-ml-[272px] max-md:invisible',
        )}
      >
        <Sidebar />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <SearchDialog />
      <Assistant />
    </div>
    </AssistantProvider>
  )
}

export interface Crumb {
  label: ReactNode
  to?: string
  /** Left out on phones (e.g. the outer projects of a nested one), to leave room for the rest. */
  hideOnMobile?: boolean
}

/** Page header: sidebar toggle (when collapsed), breadcrumbs and page actions. */
export function TopBar({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useUI()
  const firstOnMobile = crumbs.findIndex((c) => !c.hideOnMobile)
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 px-3">
      {!sidebarOpen && (
        <IconButton label="Open sidebar" onClick={() => setSidebarOpen(true)}>
          <PanelLeft />
        </IconButton>
      )}
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 pl-1 text-[13.5px]">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <ChevronRight
                className={clsx('size-3.5 shrink-0 text-ink-faint', (c.hideOnMobile || i <= firstOnMobile) && 'max-sm:hidden')}
              />
            )}
            {c.to ? (
              <Link
                to={c.to}
                className={clsx(
                  'max-w-56 min-w-0 shrink-[0.5] truncate rounded-md px-1 text-ink-muted hover:text-ink',
                  c.hideOnMobile && 'max-sm:hidden',
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span className={clsx('truncate px-1 font-medium', c.hideOnMobile && 'max-sm:hidden')}>{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
