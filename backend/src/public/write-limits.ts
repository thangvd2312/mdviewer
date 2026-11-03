import { createHash } from "node:crypto";

/** How often expired entries are swept, and the most writers / texts tracked at once. */
const SWEEP_EVERY_MS = 60_000;

/**
 * Comment write limits, kept in memory: production is a single Node process, so a synchronous
 * check-and-record (done before the request's first `await`) is atomic — concurrent requests can't
 * all slip through — and, unlike counting comment rows, deleting comments doesn't give quota back.
 * A restart resets the windows (an accepted trade-off; outsiders can't trigger restarts).
 *
 * Memory is bounded: expired keys are swept at most once a minute, and when `capacity` keys are
 * being tracked a *new* writer is refused (existing limits are never evicted to make room).
 */
export class WriteLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly longest: number;
  private lastSweep = 0;

  constructor(
    private readonly windows: { max: number; ms: number }[],
    private readonly capacity = 50_000,
  ) {
    this.longest = Math.max(...windows.map((w) => w.ms));
  }

  /** Records a write for `key` if every window has room; false (nothing recorded) otherwise. */
  tryConsume(key: string, now = Date.now()): boolean {
    this.sweep(now);
    const known = this.hits.get(key);
    if (!known && this.hits.size >= this.capacity) return false;
    const recent = (known ?? []).filter((t) => now - t < this.longest);
    const full = this.windows.some(
      (w) => recent.filter((t) => now - t < w.ms).length >= w.max,
    );
    if (!full) recent.push(now);
    if (recent.length) this.hits.set(key, recent);
    else this.hits.delete(key);
    return !full;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    for (const [k, times] of this.hits)
      if (!times.some((t) => now - t < this.longest)) this.hits.delete(k);
  }
}

interface Held {
  /** null = a new comment (id not known yet) */
  commentId: string | null;
  /** A write is in flight: nobody else — not even the same comment — may reserve the text meanwhile. */
  pending: boolean;
  at: number;
  /** Identifies the reservation attempt that wrote this entry. */
  token: number;
}

/** A reservation attempt: confirm it on success, release it on failure. */
export interface Reservation {
  key: string;
  token: number;
  /** The entry it replaced (e.g. a comment edited back to its earlier text), restored on release. */
  previous: Held | undefined;
}

/**
 * Remembers which comment holds which (doc, writer, text) for a day, so the same text can't be
 * posted twice — not even by deleting and re-posting it, or by editing other comments into it.
 * Reservations are made synchronously; a failed write puts back exactly what was there before.
 */
export class DuplicateGuard {
  private readonly held = new Map<string, Held>();
  private seq = 0;
  private lastSweep = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly capacity = 200_000,
  ) {}

  static key(docId: string, writer: string, body: string) {
    return createHash("sha256")
      .update(`${docId}\n${writer}\n${body.toLowerCase().replace(/\s+/g, " ")}`)
      .digest("hex");
  }

  /**
   * Reserves `key` for `commentId` (null = a new comment). Null if another comment (or another
   * in-flight write) holds it — or if the guard is full, which errs on the side of refusing.
   */
  reserve(
    key: string,
    commentId: string | null,
    now = Date.now(),
  ): Reservation | null {
    this.sweep(now);
    const current = this.held.get(key);
    const live = current && now - current.at < this.ttlMs ? current : undefined;
    if (live && (live.pending || live.commentId !== commentId)) return null;
    if (!live && this.held.size >= this.capacity) return null;
    const token = ++this.seq;
    this.held.set(key, { commentId, pending: true, at: now, token });
    return { key, token, previous: live };
  }

  /** The write succeeded: tie the reservation to the comment. */
  confirm(r: Reservation, commentId: string) {
    const current = this.held.get(r.key);
    if (current?.token === r.token) {
      current.commentId = commentId;
      current.pending = false;
    }
  }

  /** The write failed: undo this attempt — restoring what it replaced — if nothing newer took over. */
  release(r: Reservation) {
    if (this.held.get(r.key)?.token !== r.token) return;
    if (r.previous) this.held.set(r.key, r.previous);
    else this.held.delete(r.key);
  }

  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    this.lastSweep = now;
    for (const [k, v] of this.held)
      if (now - v.at >= this.ttlMs) this.held.delete(k);
  }
}
