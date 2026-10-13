import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore, UNAUTHORIZED_EVENT, type User } from './api'

interface AuthState {
  user: User | null
  /** true until the stored token has been validated */
  loading: boolean
  /** Stores a token received from the GitHub callback and loads the user. */
  acceptToken: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    if (!tokenStore.get()) return
    api.auth
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])

  const acceptToken = useCallback(async (token: string) => {
    tokenStore.set(token)
    try {
      setUser(await api.auth.me())
    } catch (e) {
      tokenStore.clear()
      throw e
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading, acceptToken, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
