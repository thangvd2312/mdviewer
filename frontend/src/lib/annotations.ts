import { BookOpen, CircleHelp, Lightbulb, ListTodo, StickyNote, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { Annotation, AnnotationKind } from './api'

export interface KindInfo {
  kind: AnnotationKind
  label: string
  icon: LucideIcon
}

/** Order = order of the colour dots in the UI. Colours live in index.css (--kind-*, --paper-*, --hl-*). */
export const KINDS: KindInfo[] = [
  { kind: 'note', label: 'Note', icon: StickyNote },
  { kind: 'important', label: 'Important', icon: TriangleAlert },
  { kind: 'idea', label: 'Idea', icon: Lightbulb },
  { kind: 'question', label: 'Question', icon: CircleHelp },
  { kind: 'todo', label: 'To-do', icon: ListTodo },
  { kind: 'definition', label: 'Definition', icon: BookOpen },
]

export const kindInfo = (kind: AnnotationKind) => KINDS.find((k) => k.kind === kind) ?? KINDS[0]!
export const kindColor = (kind: AnnotationKind) => `var(--kind-${kind})`
export const paperColor = (kind: AnnotationKind) => `var(--paper-${kind})`

// ───────────────────────── Text anchoring ─────────────────────────
//
// A note is anchored to the *rendered text* of the document: the quoted passage, up to
// 32 characters of context on each side, and its approximate offset. When the document is
// rendered again (or edited) we search for the quote and use the context to pick the
// right occurrence — the same idea as the W3C TextQuoteSelector.

const CONTEXT = 32
/** UI chrome inside the rendered Markdown that isn't document text. */
const SKIP = '.heading-anchor, [data-annot-skip], svg, button, input, textarea, select'

export interface TextIndex {
  nodes: Text[]
  starts: number[]
  text: string
  lookup: Map<Node, number>
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes: Text[] = []
  const starts: number[] = []
  const lookup = new Map<Node, number>()
  let text = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    lookup.set(n, nodes.length)
    nodes.push(n as Text)
    starts.push(text.length)
    text += (n as Text).data
  }
  return { nodes, starts, text, lookup }
}

/** Character offset in the index of a DOM boundary point. */
function pointToOffset(index: TextIndex, container: Node, offset: number): number {
  const i = index.lookup.get(container)
  if (i !== undefined) return index.starts[i]! + offset
  // Element (or skipped text) boundary: the first indexed text node at/after the point.
  const point = document.createRange()
  point.setStart(container, offset)
  let lo = 0
  let hi = index.nodes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (point.comparePoint(index.nodes[mid]!, 0) >= 0) hi = mid
    else lo = mid + 1
  }
  return lo < index.nodes.length ? index.starts[lo]! : index.text.length
}

/** Index of the text node containing `offset`; at a boundary, `preferNext` picks the following node. */
function nodeAt(index: TextIndex, offset: number, preferNext: boolean) {
  let lo = 0
  let hi = index.nodes.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (index.starts[mid]! < offset || (index.starts[mid] === offset && preferNext)) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function offsetsToRange(index: TextIndex, start: number, end: number): Range | null {
  if (index.nodes.length === 0 || start >= end) return null
  const a = nodeAt(index, start, true)
  const b = nodeAt(index, end, false)
  const range = document.createRange()
  range.setStart(index.nodes[a]!, Math.min(start - index.starts[a]!, index.nodes[a]!.length))
  range.setEnd(index.nodes[b]!, Math.min(end - index.starts[b]!, index.nodes[b]!.length))
  return range
}

export interface Anchor {
  quote: string
  prefix: string
  suffix: string
  position: number
}

export const QUOTE_MAX = 2000

/** Anchor for a selection inside the indexed root; null when it holds no document text. */
export function rangeToAnchor(index: TextIndex, range: Range): Anchor | null {
  let start = pointToOffset(index, range.startContainer, range.startOffset)
  let end = pointToOffset(index, range.endContainer, range.endOffset)
  const { text } = index
  while (start < end && /\s/.test(text[start]!)) start++
  while (end > start && /\s/.test(text[end - 1]!)) end--
  if (end <= start) return null
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    position: start,
  }
}

const commonSuffix = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
const commonPrefix = (a: string, b: string) => {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

/** Finds where an annotation's quote is now. Null when the text no longer exists. */
export function resolveAnchor(index: TextIndex, a: Pick<Annotation, 'quote' | 'prefix' | 'suffix' | 'position'>) {
  const { text } = index
  let best = -1
  let bestScore = -Infinity
  for (let i = text.indexOf(a.quote); i >= 0; i = text.indexOf(a.quote, i + 1)) {
    const end = i + a.quote.length
    const score =
      commonSuffix(text.slice(Math.max(0, i - CONTEXT), i), a.prefix) +
      commonPrefix(text.slice(end, end + CONTEXT), a.suffix) -
      Math.abs(i - a.position) / 100_000
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best < 0 ? null : offsetsToRange(index, best, best + a.quote.length)
}

/** Whether (x, y) is over the painted text of `range`. */
export function rangeContainsPoint(range: Range, x: number, y: number) {
  for (const r of range.getClientRects()) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true
  }
  return false
}
