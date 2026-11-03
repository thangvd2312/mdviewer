import { useSyncExternalStore } from 'react'

/** Phone-sized screen: sticky notes and the assistant open as bottom sheets. */
export const MOBILE_QUERY = '(max-width: 639px)'
/** Touch screen without hover (phones, tablets). */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => matchMedia(query).matches,
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

let snapshot: VisibleArea = { height: 0, bottomInset: 0 }
const read = (): VisibleArea => {
  const vv = window.visualViewport
  const height = Math.round(vv?.height ?? window.innerHeight)
  const bottomInset = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
  if (height !== snapshot.height || bottomInset !== snapshot.bottomInset) snapshot = { height, bottomInset }
  return snapshot
}

export function useVisibleArea() {
  return useSyncExternalStore((onChange) => {
    const vv = window.visualViewport
    vv?.addEventListener('resize', onChange)
    vv?.addEventListener('scroll', onChange)
    window.addEventListener('resize', onChange)
    return () => {
      vv?.removeEventListener('resize', onChange)
      vv?.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, read)
}
