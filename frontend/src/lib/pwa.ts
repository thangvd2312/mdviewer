import { useSyncExternalStore } from 'react'

/**
 * Installing viewmd as an app (PWA): the service worker, and the browser's install prompt.
 * Chrome/Edge (Android and desktop) fire `beforeinstallprompt`, which we keep so an "Install" button can
 * show it later; Safari on iPhone/iPad has no prompt — people use Share → Add to Home Screen.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform = 'ios' | 'android' | 'desktop'

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we offer our own button instead of the browser's mini-bar
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* the site works without it */
    })
  })
}

/** Opened from the home-screen icon rather than a browser tab. */
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => (installed ? 'installed' : deferred ? 'prompt' : 'none')

/** Whether the browser can show its install dialog right now, and a function to show it. */
export function useInstallApp() {
  const state = useSyncExternalStore(subscribe, snapshot, () => 'none' as const)
  return {
    /** true when we can open the browser's own install dialog */
    canPrompt: state === 'prompt',
    /** installed during this visit, or opened as the installed app */
    installed: state === 'installed' || isStandalone(),
    platform: detectPlatform(),
    async install() {
      const e = deferred
      if (!e) return false
      deferred = null
      emit()
      await e.prompt()
      const { outcome } = await e.userChoice
      return outcome === 'accepted'
    },
  }
}
