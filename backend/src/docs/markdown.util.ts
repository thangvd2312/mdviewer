const TITLE_MAX = 255;
const EXCERPT_MAX = 300;

/** First `# heading`, else the first non-empty line, else "Untitled". */
export function deriveTitle(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const heading = withoutFrontmatter.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
  const line =
    heading?.[1] ??
    withoutFrontmatter
      .split("\n")
      .find((l) => l.trim())
      ?.trim();
  const title = line ? toPlainText(line) : "";
  return (title || "Untitled").slice(0, TITLE_MAX);
}

export function makeExcerpt(markdown: string): string {
  const text = markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .filter((l) => !/^\s{0,3}#{1,6}\s/.test(l)) // headings are already shown as titles
    .join(" ");
  const plain = toPlainText(text).replace(/\s+/g, " ").trim();
  return plain.length > EXCERPT_MAX
    ? plain.slice(0, EXCERPT_MAX - 1) + "…"
    : plain;
}

export function toPlainText(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/^\s*(>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\|/g, " ")
    .trim();
}

const normalize = (s: string) =>
  toPlainText(s).replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The markdown of the section that starts at the heading whose plain text is `title`,
 * up to the next heading of the same or a higher level. Null when no heading matches.
 */
export function extractSection(markdown: string, title: string): string | null {
  const wanted = normalize(title);
  if (!wanted) return null;
  const lines = markdown.split("\n");
  let inFence = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    if (start >= 0 && m[1]!.length <= level)
      return lines.slice(start, i).join("\n").trim();
    if (start < 0 && normalize(m[2]!) === wanted) {
      start = i;
      level = m[1]!.length;
    }
  }
  return start >= 0 ? lines.slice(start).join("\n").trim() : null;
}

/** The document's headings as an indented list (fenced code skipped), for giving an overview of a long document. */
export function outline(markdown: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push(`${"  ".repeat(m[1]!.length - 1)}- ${toPlainText(m[2]!)}`);
  }
  return out.join("\n");
}

/** URL-friendly words from a title: "Giai đoạn 1: Java Core" → "giai-doan-1-java-core". */
export function slugify(title: string): string {
  const slug = toPlainText(title)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return slug || "doc";
}
