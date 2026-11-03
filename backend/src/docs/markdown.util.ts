const TITLE_MAX = 255;
const EXCERPT_MAX = 300;

/** First `# heading`, else the first non-empty line, else "Untitled". */
export function deriveTitle(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
  const heading = withoutFrontmatter.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
  const line =
    heading?.[1] ??
    withoutFrontmatter
      .split('\n')
      .find((l) => l.trim())
      ?.trim();
  const title = line ? toPlainText(line) : '';
  return (title || 'Untitled').slice(0, TITLE_MAX);
}

/**
 * A short summary for lists: the opening prose of the document — its first paragraphs — skipping
 * headings, quotes, lists, tables, code, images and HTML, which read badly when run together.
 * Falls back to all the text when the document has no prose paragraph.
 */
export function makeExcerpt(markdown: string): string {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/(```|~~~)[\s\S]*?\1/g, '\n\n');
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim());
  const isProse = (b: string) =>
    b !== '' &&
    !/^(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||<|!\[|\[\^|-{3,}|\*{3,}|_{3,}|=+$)/.test(b) &&
    toPlainText(b).replace(/\s+/g, ' ').length >= 20;
  let text = '';
  for (const b of blocks) {
    // The introduction is enough once there's some text: don't run on into the first section.
    if (/^#{2,6}\s/.test(b) && text.length >= 60) break;
    if (!isProse(b)) continue;
    const p = toPlainText(b).replace(/\s+/g, ' ').trim();
    text = text ? `${text} ${p}` : p;
    if (text.length >= 160) break;
  }
  if (!text) {
    text = toPlainText(blocks.filter((b) => !/^#{1,6}\s/.test(b)).join(' '))
      .replace(/\s+/g, ' ')
      .trim();
  }
  return clipWords(text, EXCERPT_MAX);
}

/** Cut at a word boundary, with an ellipsis. */
function clipWords(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, '') + '…';
}

/**
 * What the document covers, for lists: its main section headings (h2, or h3 when there are no
 * h2s), without numbering such as "1." or "Phần 2:". At most `max`, each kept short.
 */
export function topicsOf(markdown: string, max = 4): string[] {
  const levels: Record<number, string[]> = { 2: [], 3: [] };
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = toPlainText(m[2]!)
      .replace(/^(?:\d+(?:\.\d+)*[.):]?|[IVX]+\.|(?:phần|bước|chương|part|step|chapter)\s+\d+\s*[:.–-]?)\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) levels[m[1]!.length]!.push(text.length > 40 ? text.slice(0, 39).trimEnd() + '…' : text);
  }
  const pick = levels[2]!.length ? levels[2]! : levels[3]!;
  return [...new Set(pick)].slice(0, max);
}

/** Words of prose (code blocks excluded), the same way the reader counts them for reading time. */
export function countWords(markdown: string): number {
  const prose = markdown.replace(/```[\s\S]*?```/g, ' ');
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

export function toPlainText(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/^\s*(>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/\|/g, ' ')
    .trim();
}

const normalize = (s: string) => toPlainText(s).replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The markdown of the section that starts at the heading whose plain text is `title`,
 * up to the next heading of the same or a higher level. Null when no heading matches.
 */
export function extractSection(markdown: string, title: string): string | null {
  const wanted = normalize(title);
  if (!wanted) return null;
  const lines = markdown.split('\n');
  let inFence = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    if (start >= 0 && m[1]!.length <= level) return lines.slice(start, i).join('\n').trim();
    if (start < 0 && normalize(m[2]!) === wanted) {
      start = i;
      level = m[1]!.length;
    }
  }
  return start >= 0 ? lines.slice(start).join('\n').trim() : null;
}

/** The document's headings as an indented list (fenced code skipped), for giving an overview of a long document. */
export function outline(markdown: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push(`${'  '.repeat(m[1]!.length - 1)}- ${toPlainText(m[2]!)}`);
  }
  return out.join('\n');
}

/** URL-friendly words from a title: "Giai đoạn 1: Java Core" → "giai-doan-1-java-core". */
export function slugify(title: string): string {
  const slug = toPlainText(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug || 'doc';
}
