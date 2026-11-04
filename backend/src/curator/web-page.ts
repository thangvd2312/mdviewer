import { Readability } from '@mozilla/readability';
import { gfm } from '@joplin/turndown-plugin-gfm';
import { parseHTML } from 'linkedom';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import TurndownService from 'turndown';

/**
 * Reading public web pages for the curator: fetching (only public addresses — the server must never
 * be tricked into calling something on its own network) and pulling out the article as Markdown.
 */

const USER_AGENT = 'Mozilla/5.0 (compatible; viewmd-curator/1.0; +https://mdviewer.thangvu.io.vn)';
const MAX_BYTES = 4_000_000;
const MAX_REDIRECTS = 5;

export class PageError extends Error {}

/** Fetches an HTML page from the public internet, following redirects (each one checked). */
export async function fetchPage(rawUrl: string, timeoutMs = 20_000): Promise<{ url: string; html: string }> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location) throw new PageError(`redirect without a location (${res.status})`);
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new PageError(`HTTP ${res.status}`);
    }
    const type = res.headers.get('content-type') ?? '';
    if (!/html|xml/i.test(type)) {
      await res.body?.cancel();
      throw new PageError(`not a web page (${type || 'unknown type'})`);
    }
    return { url: url.toString(), html: await readLimited(res, MAX_BYTES) };
  }
  throw new PageError('too many redirects');
}

async function readLimited(res: Response, max: number) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}

/** Only http(s) on the default ports, to hosts that resolve to public addresses. */
async function assertPublic(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new PageError(`unsupported scheme ${url.protocol}`);
  if (url.port && url.port !== '80' && url.port !== '443') throw new PageError('unusual port');
  if (url.username || url.password) throw new PageError('credentials in URL');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new PageError('private host');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new PageError('host not found');
  for (const { address } of addresses) if (isPrivate(address)) throw new PageError('private address');
}

export function isPrivate(ip: string): boolean {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return isPrivate(mapped);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');
}

/** The bits of a DOM element we read (the backend has no DOM typings). */
type El = { getAttribute(name: string): string | null; textContent: string | null };

export interface ExtractedArticle {
  title: string;
  markdown: string;
  words: number;
  /** Links inside the article body (absolute http(s), deduplicated). */
  links: { text: string; url: string }[];
}

/** The readable part of a page (Mozilla's Readability), as Markdown. null when there's no article. */
export function extractArticle(html: string, pageUrl: string): ExtractedArticle | null {
  const { document } = parseHTML(html);
  const article = new Readability(document as never, { charThreshold: 400 }).parse();
  if (!article?.content) return null;

  const { document: body } = parseHTML(`<!doctype html><html><body>${article.content}</body></html>`);
  const absolute = (href: string | null) => {
    if (!href) return null;
    try {
      const u = new URL(href, pageUrl);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch {
      return null;
    }
  };

  const links: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(body.querySelectorAll('a[href]')) as El[]) {
    const u = absolute(a.getAttribute('href'));
    if (!u) continue;
    u.hash = '';
    const key = u.toString();
    const page = new URL(pageUrl);
    if (key === page.origin + page.pathname || seen.has(key)) continue;
    seen.add(key);
    links.push({ text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120), url: key });
  }

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  turndown.use(gfm);
  // Images and embeds don't help the writer; keep their alt text only.
  turndown.addRule('images', {
    filter: ['img', 'picture', 'figure', 'iframe', 'video', 'svg'] as never,
    replacement: (_c, node) => {
      const alt = (node as unknown as El).getAttribute?.('alt');
      return alt ? ` (${alt}) ` : '';
    },
  });
  turndown.addRule('absoluteLinks', {
    filter: 'a',
    replacement: (content, node) => {
      const u = absolute((node as unknown as El).getAttribute('href'));
      return u && content.trim() ? `[${content.trim()}](${u.toString()})` : content;
    },
  });
  const markdown = turndown
    .turndown(body.body as never)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const words = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return { title: (article.title ?? '').trim(), markdown, words, links };
}
