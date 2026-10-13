import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { MarkdownView } from '../components/MarkdownView'
import { Logo, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { SAMPLE_MARKDOWN } from '../lib/sample'

const RETURN_TO_KEY = 'viewmd.returnTo'

const ERRORS: Record<string, string> = {
  github_not_configured:
    'GitHub login isn’t configured yet. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env, then restart the API.',
  access_denied: 'You cancelled the GitHub authorization.',
  invalid_state: 'The login session expired or was tampered with. Please try again.',
  github_failed: 'Couldn’t sign in with GitHub. Please try again.',
}

export function LoginPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const error = params.get('error')

  if (user) return <Navigate to="/" replace />

  const start = () => {
    // Remember where the user was heading; the OAuth round-trip loses router state.
    const from = (location.state as { from?: string } | null)?.from
    try {
      if (from) sessionStorage.setItem(RETURN_TO_KEY, from)
    } catch {
      /* ignore */
    }
    setRedirecting(true)
    window.location.assign(api.auth.githubUrl)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Logo className="size-6" /> viewmd
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-[26px] font-semibold tracking-tight">Read Markdown beautifully</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">
            Paste notes, READMEs and AI answers, keep them in projects, and read them like real documentation.
          </p>

          <button
            type="button"
            onClick={start}
            disabled={redirecting}
            className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[#1f2328] text-[14.5px] font-medium text-white transition hover:bg-[#32383f] disabled:opacity-70 dark:bg-white dark:text-[#1f2328] dark:hover:bg-white/90"
          >
            {redirecting ? <Spinner className="border-white/30 border-t-white" /> : <GithubMark />}
            Continue with GitHub
          </button>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-[13px] leading-relaxed text-danger">
              {ERRORS[error] ?? ERRORS.github_failed}
            </p>
          )}

          <p className="mt-6 text-[12.5px] leading-relaxed text-ink-faint">
            We only read your public profile and primary email to create your account. Your documents stay private to you.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-line bg-sidebar lg:block" aria-hidden>
        <div className="absolute inset-x-12 top-16 rounded-2xl border border-line bg-surface px-10 py-10 shadow-xl">
          <MarkdownView content={SAMPLE_MARKDOWN} className="pointer-events-none" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-sidebar to-transparent" />
      </div>
    </div>
  )
}

/** Landing page after GitHub: `/auth/callback#token=…`. */
export function AuthCallbackPage() {
  const { acceptToken } = useAuth()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return // StrictMode runs effects twice in dev
    handled.current = true

    const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
    // Drop the token from the address bar and history right away.
    history.replaceState(null, '', window.location.pathname)
    if (!token) {
      navigate('/login?error=github_failed', { replace: true })
      return
    }

    let returnTo = '/'
    try {
      returnTo = sessionStorage.getItem(RETURN_TO_KEY) ?? '/'
      sessionStorage.removeItem(RETURN_TO_KEY)
    } catch {
      /* ignore */
    }
    acceptToken(token)
      .then(() => navigate(returnTo.startsWith('/') ? returnTo : '/', { replace: true }))
      .catch(() => navigate('/login?error=github_failed', { replace: true }))
  }, [acceptToken, navigate])

  return (
    <div className="grid h-dvh place-items-center">
      <div className="flex items-center gap-3 text-[14px] text-ink-muted">
        <Spinner /> Signing you in…
      </div>
    </div>
  )
}

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
