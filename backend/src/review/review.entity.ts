import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

export const ORIGINS = ['asked', 'key', 'note'] as const;
/** Why the question exists: the user asked about it, it's a key point of the doc, or they pinned a note on it. */
export type CardOrigin = (typeof ORIGINS)[number];

export const RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type Rating = (typeof RATINGS)[number];

/** A review question (flashcard) about one document, with its spaced-repetition schedule. */
@Entity('review_cards')
@Index(['ownerId', 'due'])
@Index(['docId', 'createdAt'])
export class ReviewCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ length: 36 })
  docId: string;

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

  /** origin = asked: the user's own question it was built from. */
  @Column({ type: 'text', nullable: true })
  basedOn: string | null;

  /** When it's next due (new cards: when created). */
  @Column({ type: 'datetime', precision: 3 })
  due: Date;

  @Column({ type: 'float', default: 0 })
  intervalDays: number;

  @Column({ type: 'float', default: 2.5 })
  ease: number;

  /** Successful reviews in a row. */
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

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ length: 36 })
  cardId: string;

  @ManyToOne(() => ReviewCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cardId' })
  card: Relation<ReviewCard>;

  @Column({ type: 'varchar', length: 8 })
  rating: Rating;

  @Column({ type: 'datetime', precision: 3 })
  reviewedAt: Date;
}
