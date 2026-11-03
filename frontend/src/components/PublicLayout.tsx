import { Compass } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'
import { AppLayout, TopBar, type Crumb } from './AppLayout'
import { ThemeToggle } from './Sidebar'
import { buttonClass, Logo, Spinner } from './ui'

/**
 * Pages anyone can open (Explore, shared docs): inside the full app (sidebar, assistant) when
 * signed in, or a light public shell otherwise.
 */
export function OptionalAuthLayout() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }
  if (user) return <AppLayout />
  return (
    <div className="flex h-dvh flex-col">
      <Outlet />
    </div>
  )
}

/** The page header: the app's top bar when signed in, the public header otherwise. */
export function PageHeader({ crumbs, actions }: { crumbs: Crumb[]; actions?: ReactNode }) {
  const { user } = useAuth()
  if (user) return <TopBar crumbs={crumbs} actions={actions} />
  return <PublicHeader actions={actions} />
}

function PublicHeader({ actions }: { actions?: ReactNode }) {
  const location = useLocation()
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-3 sm:px-5">
      <Link to="/explore" className="mr-1 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Logo className="size-6" />
        <span className="max-[380px]:hidden">viewmd</span>
      </Link>
      <NavLink
        to="/explore"
        end
        className={({ isActive }) =>
          `flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] transition-colors hover:bg-hover hover:text-ink ${
            isActive ? 'font-medium text-ink' : 'text-ink-muted'
          }`
        }
      >
        <Compass className="size-4" />
        <span className="max-sm:hidden">Explore</span>
      </NavLink>
      <div className="ml-auto flex items-center gap-1">
        {actions}
        <ThemeToggle />
        <Link
          to="/login"
          state={{ from: location.pathname + location.search + location.hash }}
          className={buttonClass('primary', 'ml-1 h-9 rounded-full px-4')}
        >
          Sign in
        </Link>
      </div>
    </header>
  )
}
