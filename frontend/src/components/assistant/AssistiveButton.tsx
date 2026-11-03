import clsx from 'clsx'
import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useStoredState } from '../../lib/storage'

const SIZE = 54
const MARGIN = 12
/** Keep clear of the top bar and the bottom edge. */
const TOP_GAP = 64
const DRAG_THRESHOLD = 5

export type Side = 'left' | 'right'

interface Dock {
  side: Side
  /** distance from the top of the viewport, px */
  y: number
}

const clampY = (y: number) => Math.min(Math.max(y, TOP_GAP), window.innerHeight - SIZE - MARGIN)

/**
 * A floating "AssistiveTouch"-style button: drag it anywhere, it snaps to the nearest side.
 * Fades back when idle. Tap to open the assistant.
 */
export function AssistiveButton({ onOpen, hint }: { onOpen: (side: Side) => void; hint?: boolean }) {
  const [dock, setDock] = useStoredState<Dock>('viewmd.assistive', { side: 'right', y: -1 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [idle, setIdle] = useState(false)
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  /** The click that follows a drag must not open the assistant. */
  const justDragged = useRef(false)
  const idleTimer = useRef<number>(undefined)

  const y = dock.y < 0 ? window.innerHeight - SIZE - 96 : clampY(dock.y)

  // Stay inside the viewport when the window resizes.
  const [, forceRender] = useState(0)
  useEffect(() => {
    const onResize = () => forceRender((n) => n + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const wake = () => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 2500)
  }
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setIdle(true), 2500)
    return () => window.clearTimeout(idleTimer.current)
  }, [])

  const restX = dock.side === 'left' ? MARGIN : window.innerWidth - SIZE - MARGIN

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { px: e.clientX, py: e.clientY, x: restX, y, moved: false }
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.px
    const dy = e.clientY - s.py
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    s.moved = true
    setDrag({
      x: Math.min(Math.max(s.x + dx, 0), window.innerWidth - SIZE),
      y: Math.min(Math.max(s.y + dy, 0), window.innerHeight - SIZE),
    })
  }

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current
    start.current = null
    // A tap opens the assistant in onClick: opening here would let the click that follows land
    // on whatever the panel puts under the finger (the backdrop on phones) and close it again.
    if (!s || !s.moved) return
    justDragged.current = true
    const x = drag?.x ?? s.x
    setDock({ side: x + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right', y: clampY(drag?.y ?? s.y) })
    setDrag(null)
    e.currentTarget.blur()
    wake()
  }

  return (
    <button
      type="button"
      aria-label="Open assistant (⌘J)"
      title="Assistant (⌘J) — drag to move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null
        setDrag(null)
      }}
      onPointerEnter={wake}
      onClick={() => {
        if (justDragged.current) justDragged.current = false
        else onOpen(dock.side)
      }}
      className={clsx(
        'fixed z-30 grid touch-none place-items-center rounded-[18px] bg-neutral-900/75 shadow-[0_6px_20px_rgba(0,0,0,0.28)] ring-1 ring-white/10 backdrop-blur-md select-none dark:bg-neutral-800/80',
        drag ? 'scale-105 cursor-grabbing' : 'cursor-pointer transition-[left,top,opacity,transform] duration-300 ease-out hover:scale-105',
        idle && !drag ? 'opacity-55' : 'opacity-100',
      )}
      style={{ width: SIZE, height: SIZE, left: drag?.x ?? restX, top: drag?.y ?? y }}
    >
      {/* concentric rings, like the iOS virtual home button */}
      <span className="grid size-[38px] place-items-center rounded-full bg-white/15">
        <span className="grid size-[29px] place-items-center rounded-full bg-white/30">
          <span className="grid size-[21px] place-items-center rounded-full bg-white/90 text-neutral-900">
            <Sparkles className="size-3" strokeWidth={2.4} />
          </span>
        </span>
      </span>
      {hint && (
        <span className="absolute -top-1 -right-1 size-3 rounded-full bg-accent ring-2 ring-surface" aria-hidden />
      )}
    </button>
  )
}
