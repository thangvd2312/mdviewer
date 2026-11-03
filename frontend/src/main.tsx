import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { AppLayout } from './components/AppLayout'
import { OptionalAuthLayout } from './components/PublicLayout'
import { Spinner } from './components/ui'
import './index.css'
import { ApiError } from './lib/api'
import { AuthProvider, useAuth } from './lib/auth'
import { UIProvider } from './lib/ui'
import { AuthCallbackPage, LoginPage } from './pages/AuthPage'
import { DocPage } from './pages/DocPage'
import { EditorPage } from './pages/EditorPage'
import { ExplorePage } from './pages/ExplorePage'
import { HomePage } from './pages/HomePage'
import { NotFound } from './pages/NotFound'
import { ProjectPage } from './pages/ProjectPage'
import { PublicDocPage } from './pages/PublicDocPage'

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
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/register', element: <Navigate to="/login" replace /> },
  // Open to everyone; inside the full app when signed in.
  {
    element: <OptionalAuthLayout />,
    children: [
      { path: 'explore', element: <ExplorePage /> },
      { path: 's/:slug', element: <PublicDocPage /> },
    ],
  },
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
      { path: '*', element: <NotFound /> },
    ],
  },
])

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
