import { useSyncExternalStore } from 'react'

/** Phone-sized screen: sticky notes and the assistant open as bottom sheets. */
export const MOBILE_QUERY = '(max-width: 639px)'
/** Touch screen without hover (phones, tablets). */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

// One MediaQueryList per query: React reads the snapshot on every render.
const mediaLists = new Map<string, MediaQueryList>()
const mediaList = (query: string) => {
  let m = mediaLists.get(query)
  if (!m) mediaLists.set(query, (m = matchMedia(query)))
  return m
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = mediaList(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => mediaList(query).matches,
  )
}

export const isTouch = () => matchMedia(TOUCH_QUERY).matches

/**
 * The part of the screen not covered by the on-screen keyboard. iOS Safari keeps the layout
 * viewport (and so `position: fixed; bottom: 0`) behind the keyboard; the visual viewport
 * tells where the visible area actually is.
 */
export interface VisibleArea {
  /** Height of the visible area, px */
  height: number
  /** Distance from the visible area's bottom to the layout viewport's bottom (≈ keyboard height on iOS), px */
  bottomInset: number
}

// Measured only when the viewport changes, never while rendering: reading innerHeight / visualViewport
// right after React changed the DOM forces a full layout of the page (very slow on long documents).
let snapshot: VisibleArea | null = null
const listeners = new Set<() => void>()
const measure = (): VisibleArea => {
  const vv = window.visualViewport
  const height = Math.round(vv?.height ?? window.innerHeight)
  const bottomInset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
  return snapshot && height === snapshot.height && bottomInset === snapshot.bottomInset
    ? snapshot
    : { height, bottomInset }
}
const update = () => {
  const next = measure()
  if (next === snapshot) return
  snapshot = next
  listeners.forEach((l) => l())
}
const getSnapshot = () => (snapshot ??= measure())

function subscribe(onChange: () => void) {
  if (listeners.size === 0) {
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update() // it may have changed while nobody was listening
  }
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size > 0) return
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  }
}

export function useVisibleArea() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
