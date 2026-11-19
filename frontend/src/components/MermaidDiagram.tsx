import { Maximize2, Minus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, IconButton, Modal } from './ui'

const ZOOM_LEVELS = [10, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400]

export function MermaidDiagram({ svg }: { svg: string }) {
  const preview = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [diagram, setDiagram] = useState<{ src: string; width: number; alt: string } | null>(null)
  const [zoom, setZoom] = useState<number | null>(100)

  const expand = () => {
    const source = preview.current?.querySelector('svg')
    if (!source) return
    // Serialize the DOM so HTML inside foreignObject is valid XML even when Mermaid emits tags like <br>.
    const xml = new XMLSerializer().serializeToString(source)
    setZoom(100)
    setDiagram({
      src: `data:image/svg+xml,${encodeURIComponent(xml)}`,
      width: source.viewBox.baseVal.width || source.getBoundingClientRect().width,
      alt: source.querySelector('title')?.textContent || 'Mermaid diagram',
    })
  }

  const changeZoom = (direction: -1 | 1) => {
    if (!diagram) return
    const current = zoom ?? Math.round(((image.current?.clientWidth || diagram.width) / diagram.width) * 100)
    const next = direction > 0
      ? ZOOM_LEVELS.find((level) => level > current)
      : ZOOM_LEVELS.findLast((level) => level < current)
    if (next !== undefined) setZoom(next)
  }

  return (
    <div data-annot-skip className="mermaid-card relative rounded-2xl border border-line bg-surface">
      <div
        ref={preview}
        aria-hidden="true"
        className="flex min-h-24 justify-center overflow-hidden px-3 pt-4 pb-1 [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <button
        type="button"
        aria-label="Expand Mermaid diagram"
        aria-haspopup="dialog"
        onClick={expand}
        className="group flex min-h-9 w-full cursor-zoom-in items-center justify-end px-3 pb-1 text-ink-muted outline-none before:absolute before:inset-0 before:rounded-2xl focus-visible:before:ring-2 focus-visible:before:ring-accent"
      >
        <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium group-hover:bg-hover group-hover:text-ink">
          <Maximize2 aria-hidden="true" className="size-3.5" /> Expand
        </span>
      </button>

      <Modal open={diagram !== null} onClose={() => setDiagram(null)} title="Mermaid diagram" className="max-w-[112rem]!">
        {diagram && (
          <>
            <div className="flex items-center justify-end gap-1 border-b border-line px-3 pb-2">
              <Button variant="ghost" aria-pressed={zoom === null} onClick={() => setZoom(null)}>
                Fit width
              </Button>
              <IconButton label="Zoom out" disabled={zoom === ZOOM_LEVELS[0]} onClick={() => changeZoom(-1)} className="disabled:opacity-40">
                <Minus />
              </IconButton>
              <span aria-live="polite" className="w-12 text-center text-xs text-ink-muted tabular-nums">
                {zoom === null ? 'Fit' : `${zoom}%`}
              </span>
              <IconButton label="Zoom in" disabled={zoom === ZOOM_LEVELS.at(-1)} onClick={() => changeZoom(1)} className="disabled:opacity-40">
                <Plus />
              </IconButton>
            </div>
            <div
              role="region"
              aria-label="Diagram canvas"
              tabIndex={0}
              className="max-h-[calc(100dvh-10vh-8rem)] overflow-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:p-6"
            >
              {/* Isolate SVG IDs so markers and styles in the preview keep working while this copy is open. */}
              <img
                ref={image}
                src={diagram.src}
                alt={diagram.alt}
                className="mx-auto block h-auto max-w-none"
                style={{ width: diagram.width * (zoom ?? 100) / 100, maxWidth: zoom === null ? '100%' : undefined }}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
