/** Rough word count that also handles CJK text and ignores code fences. */
export function readingStats(markdown: string) {
  const prose = markdown.replace(/```[\s\S]*?```/g, ' ')
  const words = prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
  return { words, minutes: Math.max(1, Math.round(words / 220)) }
}

/** Whether the document opens with its own `# Title`, so we don't render the title twice. */
export function startsWithH1(markdown: string) {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').trimStart()
  return /^#\s/.test(body) || /^[^\n]+\n=+\s*(\n|$)/.test(body)
}

export function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '')
}

export function downloadMarkdown(filename: string, content: string) {
  const safe = filename.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document'
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${safe}.md` })
  a.click()
  URL.revokeObjectURL(url)
}

/** Mirrors the backend: first `# heading`, else the first non-empty line. */
export function deriveTitle(markdown: string) {
  const body = stripFrontmatter(markdown)
  const heading = body.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m)
  const line = heading?.[1] ?? body.split('\n').find((l) => l.trim())?.trim()
  const title = (line ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/^\s*(>|[-*+]|\d+\.)\s+/, '')
    .trim()
  return (title || 'Untitled').slice(0, 255)
}

export const isMarkdownFile = (f: File) => /\.(md|markdown|mdx|txt)$/i.test(f.name) || f.type.startsWith('text/')
