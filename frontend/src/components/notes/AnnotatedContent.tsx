import { Sparkles, StickyNote } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  buildTextIndex,
  KINDS,
  kindColor,
  kindInfo,
  QUOTE_MAX,
  rangeContainsPoint,
  rangeToAnchor,
  resolveAnchor,
  type Anchor,
  type TextIndex,
} from '../../lib/annotations'
import type { Annotation, AnnotationKind } from '../../lib/api'
import { useAnnotationMutations } from '../../lib/queries'
import { useUI } from '../../lib/ui'
import { MarkdownView } from '../MarkdownView'
import { NOTE_CARD_WIDTH, NoteCard } from './NoteCard'

interface Box {
  top: number
  bottom: number
  left: number
}

interface PendingSelection {
  anchor: Anchor
  top: number
  bottom: number
  center: number
  below: boolean
}

const TOOLBAR_WIDTH = 252
const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * Renders a document with its sticky notes: coloured highlights over the text, a marker
 * in the right margin for each note, a toolbar on text selection to add one, and the
 * note card itself.
 */
export const AnnotatedContent = memo(function AnnotatedContent({
  docId,
  content,
  annotations,
  openId,
  setOpenId,
  jump,
  scrollRef,
  onOrphans,
  onAsk,
}: {
  docId: string
  content: string
  annotations: Annotation[]
  openId: string | null
  setOpenId: (id: string | null) => void
  /** Bump `n` to scroll to (and open) a note. */
  jump: { id: string; n: number } | null
  scrollRef: RefObject<HTMLDivElement | null>
  onOrphans: (ids: Set<string>) => void
  onAsk: (quote: string) => void
}) {
  const { toast } = useUI()
  const { create, update, remove } = useAnnotationMutations(docId)
  const { mutate: updateNote } = update
  const layerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef<TextIndex | null>(null)
  const [indexVersion, setIndexVersion] = useState(0)

  // Index the rendered text whenever the document changes.
  useLayoutEffect(() => {
    indexRef.current = buildTextIndex(contentRef.current!)
    setIndexVersion((v) => v + 1)
  }, [content])

  // Where each note's passage is now. Anchors never change, so only re-resolve on add/remove.
  const anchorKey = annotations.map((a) => a.id).join()
  const resolved = useMemo(() => {
    const map = new Map<string, Range>()
    const index = indexRef.current
    if (!index) return map
    for (const a of annotations) {
      const range = resolveAnchor(index, a)
      if (range) map.set(a.id, range)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, indexVersion])

  useEffect(() => {
    onOrphans(new Set(annotations.filter((a) => !resolved.has(a.id)).map((a) => a.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])

  // Paint highlights (CSS Custom Highlight API — no DOM changes).
  useEffect(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
    const byKind = new Map<AnnotationKind, Range[]>()
    for (const a of annotations) {
      const range = resolved.get(a.id)
      if (range) byKind.set(a.kind, [...(byKind.get(a.kind) ?? []), range])
    }
    for (const { kind } of KINDS) {
      const ranges = byKind.get(kind)
      if (ranges) CSS.highlights.set(`annot-${kind}`, new Highlight(...ranges))
      else CSS.highlights.delete(`annot-${kind}`)
    }
    const active = openId ? resolved.get(openId) : undefined
    if (active) CSS.highlights.set('annot-active', new Highlight(active))
    else CSS.highlights.delete('annot-active')
  }, [annotations, resolved, openId])
  useEffect(
    () => () => {
      if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
      for (const { kind } of KINDS) CSS.highlights.delete(`annot-${kind}`)
      CSS.highlights.delete('annot-active')
    },
    [],
  )

  // Positions of the passages, relative to the layer, for markers and the open card.
  const [layout, setLayout] = useState<{ boxes: Map<string, Box>; width: number }>({ boxes: new Map(), width: 0 })
  const relayout = useCallback(() => {
    const layer = layerRef.current
    if (!layer) return
    const base = layer.getBoundingClientRect()
    const boxes = new Map<string, Box>()
    for (const [id, range] of resolved) {
      const rects = range.getClientRects()
      if (rects.length === 0) continue // e.g. inside a closed <details>
      const first = rects[0]!
      const last = rects[rects.length - 1]!
      boxes.set(id, { top: first.top - base.top, bottom: last.bottom - base.top, left: first.left - base.left })
    }
    setLayout({ boxes, width: base.width })
  }, [resolved])
  useLayoutEffect(() => {
    relayout()
    const observer = new ResizeObserver(relayout)
    observer.observe(layerRef.current!)
    return () => observer.disconnect()
  }, [relayout])

  const markers = useMemo(() => {
    const list = annotations
      .filter((a) => layout.boxes.has(a.id))
      .map((a) => ({ a, top: layout.boxes.get(a.id)!.top }))
      .sort((x, y) => x.top - y.top)
    let prev = -Infinity
    for (const m of list) {
      m.top = Math.max(m.top + 3, prev + 24)
      prev = m.top
    }
    return list
  }, [annotations, layout])

  // ── Text selection → toolbar ──
  const [selection, setSelection] = useState<PendingSelection | null>(null)
  const selectionRef = useRef(selection)
  useLayoutEffect(() => {
    selectionRef.current = selection
  })

  useEffect(() => {
    let pointerDown = false
    let onToolbar = false
    let raf = 0
    const evaluate = () => {
      const sel = getSelection()
      const contentEl = contentRef.current
      const layer = layerRef.current
      const index = indexRef.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !contentEl || !layer || !index) return setSelection(null)
      const range = sel.getRangeAt(0)
      if (!contentEl.contains(range.commonAncestorContainer)) return setSelection(null)
      const anchor = rangeToAnchor(index, range)
      if (!anchor) return setSelection(null)
      const rect = range.getBoundingClientRect()
      const base = layer.getBoundingClientRect()
      const half = TOOLBAR_WIDTH / 2
      setSelection({
        anchor,
        top: rect.top - base.top,
        bottom: rect.bottom - base.top,
        center: Math.min(Math.max(rect.left + rect.width / 2 - base.left, half), Math.max(half, base.width - half)),
        // Touch devices show their own menu above the selection.
        below: rect.top < 120 || matchMedia('(pointer: coarse)').matches,
      })
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(evaluate)
    }
    const onChange = () => {
      if (onToolbar) return
      if (pointerDown) setSelection(null)
      else schedule()
    }
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('[data-annot-ui]')) onToolbar = true
      else pointerDown = true
    }
    const onUp = () => {
      if (onToolbar) setTimeout(() => (onToolbar = false), 400)
      if (!pointerDown) return
      pointerDown = false
      schedule()
    }
    document.addEventListener('selectionchange', onChange)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', onChange)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const addNote = useCallback(
    async (kind: AnnotationKind) => {
      const pending = selectionRef.current
      if (!pending) return
      if (pending.anchor.quote.length > QUOTE_MAX) {
        toast('That selection is too long for a note')
        return
      }
      getSelection()?.removeAllRanges()
      setSelection(null)
      try {
        const created = await create.mutateAsync({ ...pending.anchor, kind })
        setOpenId(created.id)
      } catch {
        toast('Could not save the note')
      }
    },
    [create, setOpenId, toast],
  )

  const ask = () => {
    const pending = selectionRef.current
    if (!pending) return
    setSelection(null)
    onAsk(pending.anchor.quote.slice(0, QUOTE_MAX))
  }

  // "N" with text selected → pin a note.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      if (!selectionRef.current) return
      e.preventDefault()
      void addNote('note')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addNote])

  // ── Clicking a highlight opens its note ──
  const hitTest = (x: number, y: number) => {
    let best: string | null = null
    let shortest = Infinity
    for (const a of annotations) {
      const range = resolved.get(a.id)
      if (range && a.quote.length < shortest && rangeContainsPoint(range, x, y)) {
        best = a.id
        shortest = a.quote.length
      }
    }
    return best
  }
  const hoverRaf = useRef(0)

  // ── Jump from the notes list ──
  useEffect(() => {
    if (!jump) return
    const range = resolved.get(jump.id)
    const scroller = scrollRef.current
    if (!range || !scroller) return
    const rect = range.getBoundingClientRect()
    const viewport = scroller.getBoundingClientRect()
    scroller.scrollTo({ top: scroller.scrollTop + rect.top - viewport.top - viewport.height / 3, behavior: 'smooth' })
    setOpenId(jump.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump])

  const open = openId ? annotations.find((a) => a.id === openId) : undefined
  const openBox = openId ? layout.boxes.get(openId) : undefined
  const closeCard = useCallback(() => setOpenId(null), [setOpenId])
  const openKey = open?.id
  const saveBody = useCallback((body: string) => openKey && updateNote({ id: openKey, body }), [openKey, updateNote])

  return (
    <div ref={layerRef} className="relative">
      <div
        ref={contentRef}
        onClick={(e) => {
          if (!getSelection()?.isCollapsed || (e.target as Element).closest('a, button, summary')) return
          const id = hitTest(e.clientX, e.clientY)
          if (id) setOpenId(id)
        }}
        onMouseMove={(e) => {
          if (annotations.length === 0) return
          const { clientX, clientY } = e
          const el = e.currentTarget
          cancelAnimationFrame(hoverRaf.current)
          hoverRaf.current = requestAnimationFrame(() => {
            el.style.cursor = hitTest(clientX, clientY) ? 'pointer' : ''
          })
        }}
      >
        <MarkdownView content={content} />
      </div>

      {markers.map(({ a, top }) => {
        const info = kindInfo(a.kind)
        const hasBody = a.body.trim() !== ''
        return (
          <button
            key={a.id}
            type="button"
            data-annot-marker
            data-annot-ui
            onClick={() => setOpenId(openId === a.id ? null : a.id)}
            title={hasBody ? a.body.slice(0, 200) : `${info.label} (highlight)`}
            aria-label={`${info.label} note`}
            className="absolute -right-8 grid size-[18px] -rotate-6 place-items-center rounded-[5px] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition hover:scale-115 hover:rotate-0 max-md:-right-[18px]"
            style={{ top, background: kindColor(a.kind), outline: openId === a.id ? '2px solid var(--ink-faint)' : undefined }}
          >
            {hasBody ? (
              <StickyNote className="size-[11px]" strokeWidth={2.6} />
            ) : (
              <span className="size-1.5 rounded-full bg-white/90" />
            )}
          </button>
        )
      })}

      {selection && (
        <div
          data-annot-ui
          role="toolbar"
          aria-label="Add a sticky note"
          onMouseDown={(e) => e.preventDefault()}
          className="animate-pop absolute z-20 flex h-9 items-center gap-0.5 rounded-full bg-ink px-1.5 text-surface shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
          style={{
            width: TOOLBAR_WIDTH,
            left: selection.center - TOOLBAR_WIDTH / 2,
            top: selection.below ? selection.bottom + 10 : selection.top - 46,
          }}
        >
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => addNote(k.kind)}
              title={k.kind === 'note' ? `${k.label} (N)` : k.label}
              aria-label={`Add ${k.label} note`}
              className="grid size-7 place-items-center rounded-full transition hover:bg-white/10 dark:hover:bg-black/10"
            >
              <span
                className="size-[15px] rounded-full ring-2 ring-white/25 transition hover:scale-110 dark:ring-black/20"
                style={{ background: kindColor(k.kind) }}
              />
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-white/20 dark:bg-black/20" />
          <button
            type="button"
            onClick={ask}
            className="flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium transition hover:bg-white/10 dark:hover:bg-black/10"
          >
            <Sparkles className="size-3.5" /> Ask
          </button>
        </div>
      )}

      {open && openBox && (
        <NoteCard
          key={open.id}
          annotation={open}
          style={{
            top: openBox.bottom + 12,
            left: Math.max(0, Math.min(openBox.left - 12, layout.width - NOTE_CARD_WIDTH)),
          }}
          onBody={saveBody}
          onKind={(kind) => updateNote({ id: open.id, kind })}
          onDelete={() => {
            remove.mutate(open.id)
            setOpenId(null)
            toast('Note deleted')
          }}
          onAsk={() => onAsk(open.quote)}
          onClose={closeCard}
        />
      )}
    </div>
  )
})
