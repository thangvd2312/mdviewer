import clsx from 'clsx'
import { useEffect, useState, type RefObject } from 'react'

export const cardClass =
  'rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_20px_rgba(0,0,0,0.04)]'

export interface Heading {
  id: string
  text: string
  level: number
}

/** h1–h3 of the rendered document, read from the DOM so ids match rehype-slug exactly. */
export function useHeadings(articleRef: RefObject<HTMLElement | null>, content: string | undefined) {
  const [headings, setHeadings] = useState<Heading[]>([])
  useEffect(() => {
    const els = articleRef.current?.querySelectorAll<HTMLElement>('.markdown :is(h1, h2, h3)') ?? []
    setHeadings(
      [...els]
        .filter((h) => h.id)
        .map((h) => ({ id: h.id, level: Number(h.tagName[1]), text: (h.textContent ?? '').replace(/^#/, '').trim() })),
    )
  }, [content, articleRef])
  return headings
}

/** Scroll spy: the active heading is the last one above the top edge. */
export function useActiveHeading(headings: Heading[], scrollRef: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState<string>()
  useEffect(() => {
    const root = scrollRef.current
    if (!root || headings.length === 0) return setActive(undefined)
    const onScroll = () => {
      const edge = root.getBoundingClientRect().top + 100
      let current = headings[0]!.id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top <= edge) current = h.id
        else break
      }
      // At the very bottom, highlight the last heading even if it can't reach the top.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = headings.at(-1)!.id
      setActive(current)
    }
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [headings, scrollRef])
  return active
}

/** "On this page": the headings, with the one being read highlighted. */
export function OutlineNav({ headings, active }: { headings: Heading[]; active: string | undefined }) {
  const minLevel = Math.min(...headings.map((h) => h.level))
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(history.state, '', `#${id}`)
  }
  return (
    <div className={cardClass}>
      <div className="px-2 pb-1.5 text-[12.5px] font-medium text-ink-muted">On this page</div>
      {headings.length === 0 ? (
        <p className="px-2 pb-1 text-[12.5px] text-ink-faint">No headings</p>
      ) : (
        <nav className="max-h-[45vh] overflow-y-auto">
          {headings.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => jump(h.id)}
              style={{ paddingLeft: 8 + (h.level - minLevel) * 12 }}
              className={clsx(
                'block w-full truncate rounded-md py-1 pr-2 text-left text-[12.5px] leading-snug transition-colors hover:text-ink',
                active === h.id ? 'bg-hover font-medium text-ink' : 'text-ink-muted',
              )}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
