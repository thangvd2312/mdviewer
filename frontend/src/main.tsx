import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useParams } from 'react-router'
import type { ReactNode } from 'react'
import { AppLayout } from './components/AppLayout'
import { BlogLayout } from './components/blog/BlogLayout'
import { Spinner } from './components/ui'
import './index.css'
import { ApiError } from './lib/api'
import { AuthProvider, useAuth } from './lib/auth'
import { registerServiceWorker } from './lib/pwa'
import { UIProvider } from './lib/ui'
import { AuthCallbackPage, LoginPage } from './pages/AuthPage'
import { DocPage } from './pages/DocPage'
import { EditorPage } from './pages/EditorPage'
import { AuthorPage } from './pages/AuthorPage'
import { BlogHome } from './pages/BlogHome'
import { BlogPost } from './pages/BlogPost'
import { FeaturesPage } from './pages/FeaturesPage'
import { HomePage } from './pages/HomePage'
import { NotFound } from './pages/NotFound'
import { ProjectPage } from './pages/ProjectPage'
import { ReviewPage } from './pages/ReviewPage'
import { ReviewSession } from './pages/ReviewSession'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }
  // Visitors who aren't signed in land on the public blog; other app pages ask them to sign in.
  if (!user && location.pathname === '/') return <Navigate to="/blog" replace />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

function RedirectTo({ to, keepSearch }: { to: string; keepSearch?: boolean }) {
  const { search } = useLocation()
  return <Navigate to={to + (keepSearch ? search : '')} replace />
}

function OldPostRedirect() {
  const { slug } = useParams()
  const { hash } = useLocation()
  return <Navigate to={`/blog/${slug}${hash}`} replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/register', element: <Navigate to="/login" replace /> },
  // The public blog and the product page: open to everyone, signed in or not.
  {
    element: <BlogLayout />,
    children: [
      { path: 'blog', element: <BlogHome /> },
      { path: 'blog/:slug', element: <BlogPost /> },
      { path: 'u/:login', element: <AuthorPage /> },
      { path: 'features', element: <FeaturesPage /> },
    ],
  },
  // Old addresses of the blog.
  { path: '/explore', element: <RedirectTo to="/blog" keepSearch /> },
  { path: '/s/:slug', element: <OldPostRedirect /> },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'new', element: <EditorPage /> },
      { path: 'd/:id', element: <DocPage /> },
      { path: 'd/:id/edit', element: <EditorPage /> },
      { path: 'p/:id', element: <ProjectPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'review/session', element: <ReviewSession /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </UIProvider>
    </QueryClientProvider>
  </StrictMode>,
)
