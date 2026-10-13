const TITLE_MAX = 255;
const EXCERPT_MAX = 300;

/** First `# heading`, else the first non-empty line, else "Untitled". */
export function deriveTitle(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
  const heading = withoutFrontmatter.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
  const line = heading?.[1] ?? withoutFrontmatter.split('\n').find((l) => l.trim())?.trim();
  const title = line ? toPlainText(line) : '';
  return (title || 'Untitled').slice(0, TITLE_MAX);
}

export function makeExcerpt(markdown: string): string {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split('\n')
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l)) // headings are already shown as titles
    .join(' ');
  const plain = toPlainText(text).replace(/\s+/g, ' ').trim();
  return plain.length > EXCERPT_MAX ? plain.slice(0, EXCERPT_MAX - 1) + '…' : plain;
}

function toPlainText(md: string): string {
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
