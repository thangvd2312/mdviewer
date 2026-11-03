import clsx from 'clsx'
import { Check, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { KINDS, kindColor, kindInfo, paperColor } from '../../lib/annotations'
import type { Annotation, AnnotationKind } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { useVisibleArea } from '../../lib/viewport'

export const NOTE_CARD_WIDTH = 300

/**
 * The sticky note itself: pick a kind (colour), write the note, ask the assistant, delete.
 * Pops up under the passage on wide screens; on phones it is a bottom sheet that stays above
 * the on-screen keyboard.
 */
export function NoteCard({
  annotation,
  style,
  sheet = false,
  onBody,
  onKind,
  onDelete,
  onAsk,
  onClose,
}: {
  annotation: Annotation
  style?: CSSProperties
  /** Phone layout: fixed to the bottom of the screen. */
  sheet?: boolean
  onBody: (body: string) => void
  onKind: (kind: AnnotationKind) => void
  onDelete: () => void
  onAsk: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState(annotation.body)
  const [savedBody, setSavedBody] = useState(annotation.body)
  const latest = useRef({ body, savedBody, onBody })
  useLayoutEffect(() => {
    latest.current = { body, savedBody, onBody }
  })
  const info = kindInfo(annotation.kind)
  const visible = useVisibleArea()

  // Save while typing (debounced) and whatever is left when the card closes.
  useEffect(() => {
    if (body === savedBody) return
    const t = setTimeout(() => {
      setSavedBody(body)
      onBody(body)
    }, 600)
    return () => clearTimeout(t)
  }, [body, savedBody, onBody])
  useEffect(
    () => () => {
      const { body, savedBody, onBody } = latest.current
      if (body !== savedBody) onBody(body)
    },
    [],
  )

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [body])

  // Close on outside click / Escape. Markers toggle the card themselves.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element
      if (!ref.current?.contains(target) && !target.closest?.('[data-annot-marker]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const card = (
    <div
      ref={ref}
      data-annot-ui
      role="dialog"
      aria-label={`${info.label} note`}
      className={clsx(
        'z-20 shadow-[0_12px_32px_rgba(0,0,0,0.16),0_2px_6px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10',
        sheet
          ? 'animate-sheet fixed inset-x-0 z-40 flex flex-col rounded-t-[18px] pb-[env(safe-area-inset-bottom)]'
          : 'animate-pop absolute rounded-[14px]',
      )}
      style={{
        ...(sheet
          ? { bottom: visible.bottomInset, maxHeight: visible.height - 24 }
          : { ...style, width: NOTE_CARD_WIDTH }),
        background: paperColor(annotation.kind),
        color: 'var(--paper-ink)',
      }}
    >
      {/* a strip of tape, because it's a sticky note */}
      <div className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 -rotate-2 rounded-[3px] bg-white/55 shadow-sm dark:bg-white/15" />

      <div className={clsx('flex items-center px-3', sheet ? 'gap-2.5 pt-5' : 'gap-1.5 pt-3.5')}>
        {KINDS.map((k) => {
          const active = k.kind === annotation.kind
          return (
            <button
              key={k.kind}
              type="button"
              title={k.label}
              aria-label={k.label}
              aria-pressed={active}
              onClick={() => onKind(k.kind)}
              className={clsx('rounded-full transition hover:scale-110', sheet ? 'size-7' : 'size-[18px]')}
              style={{
                background: kindColor(k.kind),
                boxShadow: active ? `0 0 0 2px ${paperColor(annotation.kind)}, 0 0 0 3.5px currentColor` : undefined,
              }}
            />
          )
        })}
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase opacity-70">
          <info.icon className="size-3.5" /> {info.label}
        </span>
      </div>

      <blockquote
        className={clsx(
          'mx-3 mt-2.5 border-l-2 pl-2 leading-snug italic opacity-75',
          sheet ? 'line-clamp-2 text-[13.5px]' : 'line-clamp-3 text-[12.5px]',
        )}
        style={{ borderColor: kindColor(annotation.kind) }}
      >
        {annotation.quote}
      </blockquote>

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onClose()
        }}
        autoFocus={!annotation.body}
        rows={2}
        maxLength={10_000}
        placeholder="Write a note… (empty = highlight only)"
        // 16px on phones: smaller text makes iOS zoom the page when the field is focused.
        className={clsx(
          'block w-full resize-none bg-transparent px-3 pt-2 pb-1 leading-relaxed outline-none placeholder:text-current placeholder:opacity-40',
          sheet ? 'min-h-0 flex-1 text-[16px]' : 'text-[14px]',
        )}
      />

      <div className="flex items-center gap-1 border-t border-black/[0.06] px-2 py-1 text-[11.5px] dark:border-white/10">
        <span className="pl-1 opacity-55">
          {body !== savedBody ? 'Saving…' : `Edited ${timeAgo(annotation.updatedAt)}`}
        </span>
        <div className="ml-auto flex">
          <CardButton large={sheet} label="Ask the assistant about this" onClick={onAsk}>
            <Sparkles />
          </CardButton>
          <CardButton large={sheet} label="Delete note" onClick={onDelete}>
            <Trash2 />
          </CardButton>
          <CardButton large={sheet} label="Done (⌘↵)" onClick={onClose}>
            <Check />
          </CardButton>
        </div>
      </div>
    </div>
  )
  return sheet ? createPortal(card, document.body) : card
}

const CardButton = ({
  label,
  onClick,
  large,
  children,
}: {
  label: string
  onClick: () => void
  large?: boolean
  children: ReactNode
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={clsx(
      'grid place-items-center rounded-md opacity-65 transition hover:bg-black/[0.07] hover:opacity-100 dark:hover:bg-white/10',
      large ? 'size-10 [&_svg]:size-[18px]' : 'size-7 [&_svg]:size-[15px]',
    )}
  >
    {children}
  </button>
)
