import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { RateLimiter } from './rate-limit';
import { Tier, Usage } from './usage.entity';

type Effort = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/** Which model answers, and how hard it thinks. */
export interface Plan {
  tier: Tier;
  model: string;
  effort: Effort;
}

export interface QuotaStatus {
  /** No per-user allowance (the global cap still applies). */
  unlimited: boolean;
  /** Tier the next question would get; null = no questions left today. */
  next: Tier | null;
  full: { used: number; limit: number };
  saver: { used: number; limit: number };
  /** Why no questions are left: this user's allowance, or everyone's (global cap). */
  blocked: 'user' | 'global' | null;
  /** When the allowances start over (midnight in the configured time zone), ISO. */
  resetAt: string;
}

/**
 * Keeps the AI bill in check:
 *  - burst: one answer at a time per user, at most N questions a minute (in memory);
 *  - per user per day: N questions on the main model, then M on the cheaper model, then none,
 *    plus a token ceiling so a few questions on huge documents can't use up the day;
 *  - everyone together per day: past a share of the global token budget everyone gets the cheaper
 *    model, past the budget the assistant pauses until midnight.
 * Daily counts come from the usage table, so they survive restarts.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);
  readonly full: Plan;
  readonly saver: Plan;
  /** Tried in order when the plan's model fails before answering (another provider's quota, an outage). */
  private readonly fallbacks: { model: string; effort: Effort }[];
  private readonly fullLimit: number;
  private readonly saverLimit: number;
  private readonly suggestLimit: number;
  private readonly userTokens: number;
  private readonly globalTokens: number;
  private readonly globalSaverShare: number;
  private readonly timeZone: string;
  private readonly unlimited: Set<string>;
  private readonly perMinute: RateLimiter;
  private readonly suggestPerMinute = new RateLimiter(12, 60_000);
  /** Users with an answer being written right now. */
  private readonly answering = new Set<string>();

  constructor(
    config: ConfigService,
    @InjectRepository(Usage) private readonly usage: Repository<Usage>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    const num = (key: string, fallback: number) => {
      const value = Number(config.get(key, fallback));
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    };
    this.full = {
      tier: 'full',
      model: config.get('ASSISTANT_MODEL', 'cx/gpt-6.1-sol'),
      effort: config.get<Effort>('ASSISTANT_EFFORT', 'high'),
    };
    this.saver = {
      tier: 'saver',
      model: config.get('ASSISTANT_SAVER_MODEL', 'cx/gpt-6-luna'),
      effort: config.get<Effort>('ASSISTANT_SAVER_EFFORT', 'low'),
    };
    // "model[:effort],…"
    this.fallbacks = config
      .get<string>(
        'ASSISTANT_FALLBACK_MODELS',
        'ag/claude-opus-5-5-high:xhigh,ag/gemini-4-argon-high:high,minimax/MiniMax-M3:high',
      )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [model, effort] = s.split(':') as [string, Effort | undefined];
        return { model, effort: effort ?? 'high' };
      });
    this.fullLimit = num('ASSISTANT_DAILY_FULL', 30);
    this.saverLimit = num('ASSISTANT_DAILY_SAVER', 50);
    this.suggestLimit = num('ASSISTANT_DAILY_SUGGEST', 100);
    this.userTokens = num('ASSISTANT_USER_DAILY_TOKENS', 2_000_000);
    this.globalTokens = num('ASSISTANT_GLOBAL_DAILY_TOKENS', 20_000_000);
    this.globalSaverShare = Math.min(1, num('ASSISTANT_GLOBAL_SAVER_AT', 0.7));
    this.timeZone = config.get('ASSISTANT_TIMEZONE', 'Asia/Ho_Chi_Minh');
    this.perMinute = new RateLimiter(num('ASSISTANT_PER_MINUTE', 5) || 5, 60_000);
    this.unlimited = new Set(
      config
        .get<string>('ASSISTANT_UNLIMITED_USERS', '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  /** Today's allowance for the user. */
  async status(ownerId: string): Promise<QuotaStatus> {
    const day = this.today();
    const [unlimited, counts, userTokens, globalTokens] = await Promise.all([
      this.isUnlimited(ownerId),
      this.countChats(ownerId, day),
      this.tokens({ ownerId, day }),
      this.tokens({ day }),
    ]);
    const globalOver = this.globalTokens > 0 && globalTokens >= this.globalTokens;
    const globalSaver = this.globalTokens > 0 && globalTokens >= this.globalTokens * this.globalSaverShare;
    let next: Tier | null;
    let blocked: QuotaStatus['blocked'] = null;
    if (globalOver) {
      next = null;
      blocked = 'global';
    } else if (unlimited) {
      next = globalSaver ? 'saver' : 'full';
    } else if (this.userTokens > 0 && userTokens >= this.userTokens) {
      next = null;
      blocked = 'user';
    } else if (!globalSaver && counts.full < this.fullLimit) {
      next = 'full';
    } else if (counts.saver < this.saverLimit) {
      next = 'saver';
    } else {
      next = null;
      blocked = 'user';
    }
    return {
      unlimited,
      next,
      full: { used: counts.full, limit: this.fullLimit },
      saver: { used: counts.saver, limit: this.saverLimit },
      blocked,
      resetAt: this.resetAt(day),
    };
  }

  /**
   * Admits a question: checks the burst limits and today's allowance, and counts the question
   * straight away (so concurrent requests can't both slip through). Call `settle` when the answer
   * is done, and `release` in all cases.
   */
  async admit(ownerId: string) {
    if (this.answering.has(ownerId)) {
      throw new HttpException('Wait for the current answer to finish (or stop it) before asking again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.perMinute.consume(ownerId, 'Too many questions in a row — wait a minute and try again.');
    this.answering.add(ownerId);
    try {
      const status = await this.status(ownerId);
      if (!status.next) throw new HttpException({ statusCode: 429, message: this.blockedMessage(status), quota: status }, 429);
      const plan = status.next === 'full' ? this.full : this.saver;
      const record = await this.usage.save(
        this.usage.create({ ownerId, kind: 'chat', tier: plan.tier, model: plan.model, day: this.today(), createdAt: new Date() }),
      );
      return { plan, record, release: () => this.answering.delete(ownerId) };
    } catch (error) {
      this.answering.delete(ownerId);
      throw error;
    }
  }

  /**
   * The plan's model followed by the fallback models (same tier). The saver tier keeps its low
   * effort on fallbacks so it stays cheap.
   */
  chain(plan: Plan): Plan[] {
    const rest = this.fallbacks
      .filter((f) => f.model !== plan.model)
      .map((f) => ({ tier: plan.tier, model: f.model, effort: plan.tier === 'saver' ? plan.effort : f.effort }));
    return [plan, ...rest];
  }

  /** Stores the tokens an answer used (and the model that wrote it) — or, when nothing was answered, un-counts the question. */
  async settle(record: Usage, tokens: { prompt: number; completion: number } | null, model?: string) {
    try {
      if (tokens) {
        await this.usage.update(record.id, {
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          ...(model && { model }),
        });
      }
      else await this.usage.delete(record.id);
    } catch (error) {
      this.logger.error(`recording usage failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * The plan for generating suggested questions, or null when they shouldn't be generated now
   * (rate or daily limit, or the global budget). Suggestions always use the cheaper model.
   */
  async suggestPlan(ownerId: string): Promise<Plan | null> {
    if (!this.suggestPerMinute.tryConsume(ownerId)) return null;
    const day = this.today();
    const [unlimited, count, globalTokens] = await Promise.all([
      this.isUnlimited(ownerId),
      this.usage.count({ where: { ownerId, day, kind: 'suggest' } }),
      this.tokens({ day }),
    ]);
    if (this.globalTokens > 0 && globalTokens >= this.globalTokens * this.globalSaverShare) return null;
    if (!unlimited && count >= this.suggestLimit) return null;
    return this.saver;
  }

  async recordSuggest(ownerId: string, plan: Plan, tokens: { prompt: number; completion: number }) {
    await this.usage
      .save(
        this.usage.create({
          ownerId,
          kind: 'suggest',
          tier: plan.tier,
          model: plan.model,
          promptTokens: tokens.prompt,
          completionTokens: tokens.completion,
          day: this.today(),
          createdAt: new Date(),
        }),
      )
      .catch((e: unknown) => this.logger.error(`recording usage failed: ${e instanceof Error ? e.message : String(e)}`));
  }

  private blockedMessage(status: QuotaStatus) {
    const at = new Intl.DateTimeFormat('en-GB', { timeZone: this.timeZone, hour: '2-digit', minute: '2-digit' }).format(
      new Date(status.resetAt),
    );
    return status.blocked === 'global'
      ? `The assistant has reached today’s limit for everyone. It’s back at ${at}.`
      : `You’ve used all of today’s assistant questions. They reset at ${at}.`;
  }

  private async countChats(ownerId: string, day: string) {
    const rows = await this.usage
      .createQueryBuilder('u')
      .select('u.tier', 'tier')
      .addSelect('COUNT(*)', 'n')
      .where('u.ownerId = :ownerId AND u.day = :day AND u.kind = :kind', { ownerId, day, kind: 'chat' })
      .groupBy('u.tier')
      .getRawMany<{ tier: Tier; n: string }>();
    const count = (tier: Tier) => Number(rows.find((r) => r.tier === tier)?.n ?? 0);
    return { full: count('full'), saver: count('saver') };
  }

  private async tokens(where: FindOptionsWhere<Usage>) {
    const qb = this.usage
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.promptTokens + u.completionTokens), 0)', 'total')
      .where('u.day = :day', { day: where.day });
    if (where.ownerId) qb.andWhere('u.ownerId = :ownerId', { ownerId: where.ownerId });
    const row = await qb.getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  private async isUnlimited(ownerId: string) {
    if (this.unlimited.size === 0) return false;
    const user = await this.users.findOne({ where: { id: ownerId }, select: { id: true, githubLogin: true, email: true } });
    return [user?.githubLogin, user?.email].some((v) => v && this.unlimited.has(v.toLowerCase()));
  }

  /** Today's date (YYYY-MM-DD) in the allowance's time zone. */
  private today(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone }).format(date);
  }

  /** Midnight after `day` in the allowance's time zone. */
  private resetAt(day: string) {
    const next = new Date(`${day}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const offset =
      new Intl.DateTimeFormat('en-US', { timeZone: this.timeZone, timeZoneName: 'longOffset' })
        .formatToParts(next)
        .find((p) => p.type === 'timeZoneName')
        ?.value.replace('GMT', '') || '+00:00';
    return new Date(`${next.toISOString().slice(0, 10)}T00:00:00${offset}`).toISOString();
  }
}
