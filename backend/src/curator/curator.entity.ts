import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Doc } from '../docs/doc.entity';

/**
 * Where an article stands in the curator's pipeline:
 * - skipped: dropped before scoring (not an article, unreadable page, too short…)
 * - rejected: scored, not good enough
 * - approved: scored well, waiting for a free slot to be written
 * - failed: writing or publishing broke (see `reason`)
 * - draft: written, but the editor's score was under the bar — waits for an admin
 * - published: live on the blog
 */
export const CURATED_STATUSES = ['skipped', 'rejected', 'approved', 'failed', 'draft', 'published'] as const;
export type CuratedStatus = (typeof CURATED_STATUSES)[number];

export interface CuratedSource {
  title: string;
  url: string;
}

/** One daily.dev post the curator looked at, and what became of it. */
@Entity('curated_articles')
@Index(['status', 'createdAt'])
export class CuratedArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The daily.dev post id. */
  @Index({ unique: true })
  @Column({ length: 64 })
  sourceId: string;

  @Column({ length: 1000 })
  url: string;

  @Column({ length: 300 })
  title: string;

  /** Publisher name (e.g. "Netflix TechBlog"). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceName: string | null;

  /** The configured topic it was found under. */
  @Column({ length: 60 })
  topic: string;

  @Column({ type: 'json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'int', default: 0 })
  upvotes: number;

  @Column({ type: 'int', default: 0 })
  comments: number;

  /** Minutes, as daily.dev estimates it. */
  @Column({ type: 'int', default: 0 })
  readTime: number;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  sourcePublishedAt: Date | null;

  @Column({ type: 'varchar', length: 16 })
  status: CuratedStatus;

  /** Why it was skipped, rejected or failed — or the judge's one-line verdict. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** The judge's overall score, 1–10. */
  @Column({ type: 'double', nullable: true })
  score: number | null;

  /** The judge's full assessment (criteria, angle, outline, gaps). */
  @Column({ type: 'json', nullable: true })
  assessment: Record<string, unknown> | null;

  /** The editor's final score for the written post, 0–10. */
  @Column({ type: 'double', nullable: true })
  editorScore: number | null;

  @Column({ type: 'text', nullable: true })
  editorNotes: string | null;

  /** What the post was written from: the original article first, then the pages read for research. */
  @Column({ type: 'json', nullable: true })
  sources: CuratedSource[] | null;

  /** The post (owned by the system author) once written. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  docId: string | null;

  @ManyToOne(() => Doc, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'docId' })
  doc: Relation<Doc> | null;

  /** The model that wrote the post. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  /** All tokens spent on this article (judging, writing, editing). */
  @Column({ type: 'int', default: 0 })
  tokens: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}

/** One pass of the curator: automatic (daily) or started by an admin. */
@Entity('curator_runs')
@Index(['day'])
export class CuratorRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** YYYY-MM-DD in the curator's time zone. */
  @Column({ type: 'char', length: 10 })
  day: string;

  @Column({ type: 'varchar', length: 8 })
  trigger: 'auto' | 'manual';

  @Column({ type: 'varchar', length: 16 })
  status: 'running' | 'done' | 'failed';

  @Column({ type: 'int', default: 0 })
  candidates: number;

  @Column({ type: 'int', default: 0 })
  scored: number;

  @Column({ type: 'int', default: 0 })
  published: number;

  @Column({ type: 'int', default: 0 })
  drafts: number;

  /** What happened, one line per step. */
  @Column({ type: 'mediumtext', nullable: true })
  log: string | null;

  @Column({ type: 'datetime', precision: 3 })
  startedAt: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  finishedAt: Date | null;
}
