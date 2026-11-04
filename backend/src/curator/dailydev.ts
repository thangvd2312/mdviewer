/** A small client for the daily.dev Public API (https://api.daily.dev/public/v1, Bearer token). */

export interface DailyPost {
  id: string;
  title: string;
  url: string;
  summary?: string | null;
  type?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  commentsPermalink?: string | null;
  source?: { id?: string; name?: string; handle?: string } | null;
  tags?: string[] | null;
  readTime?: number | null;
  numUpvotes?: number | null;
  numComments?: number | null;
}

export interface DailyComment {
  id: string;
  content: string;
  numUpvotes?: number | null;
  children?: DailyComment[] | null;
}

interface Page<T> {
  data: T[];
  pagination?: { hasNextPage?: boolean; cursor?: string | null };
}

export class DailyDevError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class DailyDevClient {
  constructor(
    private readonly token: string,
    private readonly base = 'https://api.daily.dev/public/v1',
  ) {}

  /** Newest posts with a tag. */
  async tagFeed(tag: string, limit = 30) {
    return (await this.get<Page<DailyPost>>(`/feeds/tag/${encodeURIComponent(tag)}`, { limit })).data ?? [];
  }

  /** Posts with the most comments in the last `period` days. */
  async discussed(tag: string, period: 7 | 30 = 7, limit = 20) {
    return (await this.get<Page<DailyPost>>('/feeds/discussed', { tag, period, limit })).data ?? [];
  }

  /** Trending posts for some tags. */
  async popular(tags: string[], limit = 30) {
    return (await this.get<Page<DailyPost>>('/feeds/popular', { tags: tags.slice(0, 20).join(','), limit })).data ?? [];
  }

  /** The comments on a post, most upvoted first (replies flattened). */
  async comments(postId: string, limit = 30) {
    const page = await this.get<Page<DailyComment>>(`/posts/${encodeURIComponent(postId)}/comments`, { limit });
    const all: DailyComment[] = [];
    const walk = (list: DailyComment[] | null | undefined) => {
      for (const c of list ?? []) {
        all.push(c);
        walk(c.children);
      }
    };
    walk(page.data);
    return all.sort((a, b) => (b.numUpvotes ?? 0) - (a.numUpvotes ?? 0));
  }

  /** All tag names daily.dev knows. */
  async tags() {
    const res = await this.get<{ data: { name?: string; value?: string }[] }>('/tags/', {});
    return (res.data ?? []).map((t) => t.name ?? t.value ?? '').filter(Boolean);
  }

  private async get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      throw new DailyDevError(`daily.dev ${path} → ${res.status} ${body}`, res.status);
    }
    return (await res.json()) as T;
  }
}
