import { HttpException, HttpStatus } from '@nestjs/common';

/** Tiny in-memory sliding-window limiter, keyed per user. Enough for a single-process app. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      throw new HttpException('Too many assistant requests — try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}
