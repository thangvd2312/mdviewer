import { ApiHideProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

export const ORIGINS = ['asked', 'key', 'note'] as const;
/** Why the question exists: the user asked about it, it's a key point of the doc, or they pinned a note on it. */
export type CardOrigin = (typeof ORIGINS)[number];

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

/**
 * A review question (flashcard) about one document, with its FSRS memory state (see ReviewService):
 * stability (days until recall drops to 90%), difficulty (1–10), state (0 new, 1 learning,
 * 2 review, 3 relearning) and the current (re)learning step.
 */
@Entity('review_cards')
@Index(['ownerId', 'due'])
@Index(['docId', 'createdAt'])
export class ReviewCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ApiHideProperty()

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ length: 36 })
  docId: string;

  @ApiHideProperty()

  @ManyToOne(() => Doc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docId' })
  doc: Relation<Doc>;

  @Column({ type: 'text' })
  question: string;

  /** Short model answer, Markdown. */
  @Column({ type: 'text' })
  answer: string;

  /** Heading of the section it comes from, to jump back to it. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  section: string | null;

  @Column({ type: 'varchar', length: 16 })
  origin: CardOrigin;

  /** user = the user asked for questions; auto = added because they had mastered the earlier ones. */
  @Column({ type: 'varchar', length: 8, default: 'user' })
  addedBy: 'user' | 'auto';

  /** origin = asked: the user's own question it was built from. */
  @Column({ type: 'text', nullable: true })
  basedOn: string | null;

  /** When it's next due (new cards: when created). */
  @Column({ type: 'datetime', precision: 3 })
  due: Date;

  /** FSRS: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  state: number;

  /** FSRS stability, in days. */
  @Column({ type: 'double', default: 0 })
  stability: number;

  /** FSRS difficulty, 1–10. */
  @Column({ type: 'double', default: 0 })
  difficulty: number;

  @Column({ type: 'int', default: 0 })
  elapsedDays: number;

  /** Days until the next review, as last scheduled (0 while learning). */
  @Column({ type: 'int', default: 0 })
  scheduledDays: number;

  /** Current (re)learning step. */
  @Column({ type: 'int', default: 0 })
  learningSteps: number;

  /** Reviews so far. */
  @Column({ type: 'int', default: 0 })
  reps: number;

  /** Times forgotten. */
  @Column({ type: 'int', default: 0 })
  lapses: number;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastReviewedAt: Date | null;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;
}

/** One answer given during review (for streaks and progress). */
@Entity('review_events')
@Index(['ownerId', 'reviewedAt'])
export class ReviewEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ApiHideProperty()

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ length: 36 })
  cardId: string;

  @ApiHideProperty()

  @ManyToOne(() => ReviewCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  card: Relation<ReviewCard>;

  @Column({ type: 'varchar', length: 8 })
  rating: Rating;

  @Column({ type: 'datetime', precision: 3 })
  reviewedAt: Date;

  // FSRS review log — what an optimizer needs to fit personal parameters later.
  /** Card state before this review. */
  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  state: number;

  /** Days since the previous review. */
  @Column({ type: 'int', default: 0 })
  elapsedDays: number;

  /** Stability / difficulty / interval after this review. */
  @Column({ type: 'double', default: 0 })
  stability: number;

  @Column({ type: 'double', default: 0 })
  difficulty: number;

  @Column({ type: 'int', default: 0 })
  scheduledDays: number;
}
