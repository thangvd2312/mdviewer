import clsx from 'clsx'
import type { Element } from 'hast'
import { toString } from 'hast-util-to-string'
import { Check, CodeXml, Copy, TriangleAlert, WrapText } from 'lucide-react'
import { memo, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'
import { stripFrontmatter } from '../lib/markdown'
import { useUI } from '../lib/ui'
import { IconButton } from './ui'

const PLAIN = ['mermaid', 'text', 'txt', 'plain', 'plaintext']

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  java: 'Java',
  kt: 'Kotlin',
  cs: 'C#',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  swift: 'Swift',
  dart: 'Dart',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  shell: 'Shell',
  console: 'Console',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  md: 'Markdown',
  markdown: 'Markdown',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
  mermaid: 'Mermaid',
}

const languageLabel = (lang?: string) =>
  !lang || PLAIN.includes(lang) ? 'Plain text' : (LANGUAGE_NAMES[lang] ?? lang[0]!.toUpperCase() + lang.slice(1))

function languageOf(pre: Element | undefined) {
  const code = pre?.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
  const classes = code?.properties.className
  const lang = (Array.isArray(classes) ? classes : []).map(String).find((c) => c.startsWith('language-'))
  return lang?.slice('language-'.length).toLowerCase()
}

export function CodeBlock({ lang, text, children }: { lang?: string; text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const [wrap, setWrap] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-card overflow-hidden rounded-2xl border border-line bg-raised">
      <div
        data-annot-skip
        className="flex h-10 items-center gap-2 pr-1.5 pl-4 text-[12.5px] text-ink-muted select-none"
      >
        <CodeXml className="size-4" />
        <span className="font-medium">{languageLabel(lang)}</span>
        <div className="ml-auto flex">
          <IconButton
            label={wrap ? 'Disable line wrap' : 'Wrap lines'}
            active={wrap}
            onClick={() => setWrap((w) => !w)}
          >
            <WrapText />
          </IconButton>
          <IconButton label={copied ? 'Copied' : 'Copy code'} onClick={copy}>
            {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
          </IconButton>
        </div>
      </div>
      <pre className={clsx(wrap && 'whitespace-pre-wrap')}>{children}</pre>
    </div>
  )
}

type MermaidResult = { svg?: string; error?: string }

// Rendering a diagram blocks the page for tens to hundreds of ms. So diagrams are rendered one at a
// time with a pause in between (clicks get through), skipped once their document is gone (switching
// docs quickly doesn't pile up work), and remembered (going back to a doc shows them at once).
const mermaidCache = new Map<string, MermaidResult>()
const MERMAID_CACHE_MAX = 200
let mermaidQueue: Promise<unknown> = Promise.resolve()
let mermaidTheme: string | undefined
let mermaidSeq = 0

function renderMermaid(code: string, theme: 'dark' | 'neutral', isCancelled: () => boolean) {
  const key = `${theme}\n${code}`
  const job = mermaidQueue.then(async (): Promise<MermaidResult | null> => {
    await new Promise((r) => setTimeout(r, 0))
    const hit = mermaidCache.get(key)
    if (hit) return hit
    if (isCancelled()) return null
    const { default: mermaid } = await import('mermaid')
    if (mermaidTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme,
        fontFamily: 'Inter, ui-sans-serif, system-ui',
      })
      mermaidTheme = theme
    }
    const id = `mmd${++mermaidSeq}`
    let result: MermaidResult
    try {
      result = { svg: (await mermaid.render(id, code)).svg }
    } catch (e) {
      document.getElementById('d' + id)?.remove() // mermaid leaves its error graphic in <body>
      result = { error: e instanceof Error ? e.message : String(e) }
    }
    if (mermaidCache.size >= MERMAID_CACHE_MAX) mermaidCache.delete(mermaidCache.keys().next().value!)
    mermaidCache.set(key, result)
    return result
  })
  mermaidQueue = job.catch(() => {})
  return job
}

function Mermaid({ code }: { code: string }) {
  const { resolvedTheme } = useUI()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'neutral'
  const [rendered, setState] = useState<MermaidResult>({})
  const cached = mermaidCache.get(`${theme}\n${code}`)
  const state = cached ?? rendered

  useEffect(() => {
    if (mermaidCache.has(`${theme}\n${code}`)) return
    let cancelled = false
    renderMermaid(code, theme, () => cancelled).then((result) => {
      if (result && !cancelled) setState(result)
    })
    return () => {
      cancelled = true
    }
  }, [code, theme])

  if (state.error) {
    return (
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-danger">
          <TriangleAlert className="size-3.5" /> Mermaid diagram could not be rendered
        </p>
        <CodeBlock lang="mermaid" text={code}>
          <code>{code}</code>
        </CodeBlock>
      </div>
    )
  }
  return (
    <div
      data-annot-skip
      className="mermaid-card flex min-h-24 justify-center overflow-x-auto rounded-2xl border border-line bg-surface p-5 [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={state.svg ? { __html: state.svg } : undefined}
    />
  )
}

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4') {
  return function Heading({ node: _node, id, children, ...rest }: ComponentPropsWithoutRef<'h1'> & { node?: Element }) {
    return (
      <Tag id={id} {...rest}>
        {id && (
          <a href={`#${id}`} className="heading-anchor" aria-hidden tabIndex={-1}>
            #
          </a>
        )}
        {children}
      </Tag>
    )
  }
}

const components: Components = {
  pre({ node, children }) {
    const lang = languageOf(node)
    const text = node ? toString(node) : ''
    // Keyed by the code: a different diagram (e.g. after switching docs) never shows the previous one.
    if (lang === 'mermaid') return <Mermaid key={text} code={text} />
    return (
      <CodeBlock lang={lang} text={text}>
        {children}
      </CodeBlock>
    )
  },
  a({ node: _node, href, children, ...rest }) {
    const external = href && /^[a-z][a-z\d+.-]*:/i.test(href)
    return (
      // Docs can be public: outside links open in a new tab and aren't endorsed for search engines.
      <a href={href} {...rest} {...(external && { target: '_blank', rel: 'nofollow ugc noopener noreferrer' })}>
        {children}
      </a>
    )
  },
  table({ node: _node, ...rest }) {
    return (
      <div className="table-wrap">
        <table {...rest} />
      </div>
    )
  },
  img({ node: _node, alt, ...rest }) {
    return <img alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" {...rest} />
  },
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
}

/** Drops the trailing newline of fenced code so blocks don't end with an empty line. */
function rehypeTrimCode() {
  const walk = (node: { type: string; tagName?: string; children?: unknown[] }, inPre: boolean) => {
    if (node.type === 'element' && node.tagName === 'code' && inPre) {
      const last = node.children?.at(-1) as { type: string; value: string } | undefined
      if (last?.type === 'text') last.value = last.value.replace(/\n$/, '')
    }
    node.children?.forEach((c) => walk(c as typeof node, node.tagName === 'pre'))
  }
  return (tree: Parameters<typeof walk>[0]) => walk(tree, false)
}

const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeSlug, rehypeTrimCode, [rehypeHighlight, { detect: false, plainText: PLAIN }] as const]

// Parsing + highlighting a long document takes a while; the last few documents are kept rendered,
// so switching back and forth between them is instant.
const renderCache = new Map<string, ReactNode>()
const RENDER_CACHE_MAX = 12

function renderMarkdown(content: string, cache: boolean) {
  const hit = cache && renderCache.get(content)
  if (hit) {
    renderCache.delete(content) // most recently used last
    renderCache.set(content, hit)
    return hit
  }
  // react-markdown's sync component is a pure function (no hooks), so its output can be reused.
  const tree = Markdown({
    remarkPlugins,
    rehypePlugins: rehypePlugins as never,
    components,
    children: stripFrontmatter(content),
  })
  if (cache) {
    if (renderCache.size >= RENDER_CACHE_MAX) renderCache.delete(renderCache.keys().next().value!)
    renderCache.set(content, tree)
  }
  return tree
}

export const MarkdownView = memo(function MarkdownView({
  content,
  className,
  cache = false,
}: {
  content: string
  className?: string
  /** Keep the rendered result for next time (whole documents; not text that changes as you type). */
  cache?: boolean
}) {
  const tree = useMemo(() => renderMarkdown(content, cache), [content, cache])
  return <div className={clsx('markdown', className)}>{tree}</div>
})
