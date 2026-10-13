import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useStoredState } from './storage'

export type ThemePref = 'light' | 'dark' | 'system'

interface UIState {
  theme: ThemePref
  resolvedTheme: 'light' | 'dark'
  setTheme: (t: ThemePref) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  toast: (message: string) => void
}

const UIContext = createContext<UIState | null>(null)

const THEME_KEY = 'viewmd.theme' // raw string; also read by the inline script in index.html
const media = matchMedia('(prefers-color-scheme: dark)')
const subscribeMedia = (cb: () => void) => {
  media.addEventListener('change', cb)
  return () => media.removeEventListener('change', cb)
}
const isNarrow = () => matchMedia('(max-width: 767px)').matches

export function UIProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => {
    const raw = localStorage.getItem(THEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  })
  const systemDark = useSyncExternalStore(subscribeMedia, () => media.matches)
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  // On phones the sidebar is an overlay drawer and starts closed.
  const [desktopSidebar, setDesktopSidebar] = useStoredState('viewmd.sidebar', true)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const narrow = isNarrow()
  const sidebarOpen = narrow ? mobileSidebar : desktopSidebar
  const setSidebarOpen = useCallback(
    (open: boolean) => (isNarrow() ? setMobileSidebar(open) : setDesktopSidebar(open)),
    [setDesktopSidebar],
  )

  const [searchOpen, setSearchOpen] = useState(false)

  const [toastMsg, setToastMsg] = useState<{ id: number; text: string } | null>(null)
  const timer = useRef<number>(undefined)
  const toast = useCallback((text: string) => {
    window.clearTimeout(timer.current)
    setToastMsg({ id: Date.now(), text })
    timer.current = window.setTimeout(() => setToastMsg(null), 2200)
  }, [])

  // Global shortcut: ⌘K / Ctrl+K opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <UIContext.Provider
      value={{ theme, resolvedTheme, setTheme, sidebarOpen, setSidebarOpen, searchOpen, setSearchOpen, toast }}
    >
      {children}
      {toastMsg && (
        <div
          key={toastMsg.id}
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-surface shadow-lg"
        >
          {toastMsg.text}
        </div>
      )}
    </UIContext.Provider>
  )
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
