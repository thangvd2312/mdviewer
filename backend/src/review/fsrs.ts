import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  GenSeedStrategyWithCardId,
  Rating as FsrsRating,
  State,
  StrategyMode,
  type Card,
  type Grade,
} from 'ts-fsrs';
import type { Rating } from './review.entity';

/**
 * The FSRS-6 scheduler (open-spaced-repetition/ts-fsrs, default parameters trained on large review
 * datasets): aims for a 90% chance of recall at the next review, with short-term learning steps
 * (1 min → 10 min for new cards, 10 min after a lapse). Fuzz spreads intervals so cards don't bunch
 * up; its seed comes from the card id and review count, so the interval shown on a button is the one
 * that gets scheduled.
 */
export const DESIRED_RETENTION = 0.9;

export const scheduler = fsrs(
  generatorParameters({
    request_retention: DESIRED_RETENTION,
    maximum_interval: 3650,
    enable_fuzz: true,
    enable_short_term: true,
  }),
).useStrategy(StrategyMode.SEED, GenSeedStrategyWithCardId('id'));

export const GRADES: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

/** The FSRS fields as stored on a card row. */
export interface MemoryState {
  due: Date;
  state: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReviewedAt: Date | null;
}

export const toFsrs = (id: string, m: MemoryState): Card & { id: string } => ({
  id,
  due: m.due,
  state: m.state as State,
  stability: m.stability,
  difficulty: m.difficulty,
  elapsed_days: m.elapsedDays,
  scheduled_days: m.scheduledDays,
  learning_steps: m.learningSteps,
  reps: m.reps,
  lapses: m.lapses,
  last_review: m.lastReviewedAt ?? undefined,
});

export const fromFsrs = (c: Card): MemoryState => ({
  due: c.due,
  state: c.state,
  stability: c.stability,
  difficulty: c.difficulty,
  elapsedDays: c.elapsed_days,
  scheduledDays: c.scheduled_days,
  learningSteps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  lastReviewedAt: c.last_review ?? null,
});

/** A brand-new card's memory state. */
export const newMemory = (now: Date): MemoryState => fromFsrs(createEmptyCard(now));

export { State };
