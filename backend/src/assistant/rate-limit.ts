import { HttpException, HttpStatus } from '@nestjs/common';

/** Tiny in-memory sliding-window limiter, keyed per user. Enough for a single-process app. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Counts a hit; false (and nothing counted) when the limit is reached. */
  tryConsume(key: string) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    // Forget idle users now and then so the map doesn't grow forever.
    if (this.hits.size > 1000) for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
    return true;
  }

  consume(key: string, message = 'Too many requests — try again in a moment.') {
    if (!this.tryConsume(key)) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
