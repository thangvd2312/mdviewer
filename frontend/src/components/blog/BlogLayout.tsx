import { LibraryBig, PenLine } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'
import { AssistantProvider } from '../../lib/assistant'
import { useAuth } from '../../lib/auth'
import { Assistant } from '../assistant/AssistantPanel'
import { Avatar } from '../Avatar'
import { ThemeToggle } from '../Sidebar'
import { buttonClass, Logo, Spinner } from '../ui'

/**
 * The public blog — open to everyone, signed in or not (/blog, /blog/<slug>, /u/<login>). Signed-in
 * readers get a way back to their notes and the reading assistant.
 */
export function BlogLayout() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }
  const page = (
    <div className="flex h-dvh flex-col bg-surface">
      <BlogHeader />
      <Outlet />
    </div>
  )
  if (!user) return page
  return (
    <AssistantProvider>
      {page}
      <Assistant />
    </AssistantProvider>
  )
}

function BlogHeader() {
  const { user } = useAuth()
  const location = useLocation()
  return (
    <header className="z-20 shrink-0 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-8">
        <Link to="/blog" className="flex items-center gap-2" aria-label="viewmd Blog — home">
          <Logo className="size-7" />
          <span className="text-[16px] font-semibold tracking-tight">viewmd</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 text-[12px] font-medium text-ink-muted">Blog</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <>
              <Link to="/" className={buttonClass('secondary', 'ml-1 h-9 rounded-full px-3.5')}>
                <LibraryBig className="size-4" />
                <span className="max-sm:hidden">My notes</span>
              </Link>
              <Link
                to={user.githubLogin ? `/u/${user.githubLogin}` : '/'}
                className="ml-1 rounded-full"
                title="Your public profile"
              >
                <Avatar name={user.name} src={user.avatarUrl} className="size-8" />
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              state={{ from: location.pathname + location.search + location.hash }}
              className={buttonClass('primary', 'ml-1 h-9 rounded-full px-4')}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Bottom of every blog page. */
export function BlogFooter() {
  const { user } = useAuth()
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-2">
          <Logo className="size-5" />
          <span>
            <span className="font-medium text-ink">viewmd</span> — read and share Markdown beautifully.
          </span>
        </div>
        <div className="flex items-center gap-4 sm:ml-auto">
          <Link to="/blog" className="hover:text-ink">
            All posts
          </Link>
          <Link to={user ? '/' : '/login'} className="flex items-center gap-1.5 font-medium text-ink hover:underline">
            <PenLine className="size-3.5" /> {user ? 'Write a post' : 'Start writing'}
          </Link>
        </div>
      </div>
    </footer>
  )
}
