import { ApiHideProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

@Entity('documents')
@Index(['ownerId', 'lastOpenedAt'])
export class Doc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ApiHideProperty()

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  /** null = standalone note that doesn't belong to any project */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId: string | null;

  @ApiHideProperty()

  @ManyToOne(() => Project, (project) => project.docs, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Relation<Project> | null;

  @Column({ length: 255 })
  title: string;

  /**
   * Place in its project, and in the series when the project is published. Set when the author
   * reorders; null = after the ordered ones, by title.
   */
  @Column({ type: 'int', nullable: true })
  position: number | null;

  @Column({ type: 'longtext' })
  content: string;

  /** Plain-text preview used in lists, derived from content on save. */
  @Column({ type: 'varchar', length: 300, default: '' })
  excerpt: string;

  @CreateDateColumn()
  createdAt: Date;

  // Managed manually (not @UpdateDateColumn) so that merely opening a doc
  // doesn't bump its "edited" time.
  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;

  @Column({ type: 'datetime', precision: 3 })
  lastOpenedAt: Date;

  /**
   * Public address (/s/<slug>), made on first publish and kept after unpublishing so a
   * re-published doc keeps its link. null = never published.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  /** Set while the doc is public (readable by anyone and listed on Explore); null = private. */
  @Index()
  @Column({ type: 'datetime', precision: 3, nullable: true })
  publishedAt: Date | null;

  /** Whether readers may comment while it's public. */
  @Column({ default: true })
  allowComments: boolean;

  /** The title as the blog shows it (sensitive parts hidden), derived on save. */
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 300, default: '' })
  publicTitle: string;

  /** The summary as the blog shows and searches it (sensitive parts hidden), derived on save. */
  @ApiHideProperty()
  @Column({ type: 'varchar', length: 400, default: '' })
  publicExcerpt: string;

  /** Words of prose (for reading time), derived from content on save. */
  @Column({ type: 'int', unsigned: true, default: 0 })
  wordCount: number;

  /** Main section headings (what the doc covers, sensitive parts hidden), derived from content on save; shown on Explore. */
  @Column({ type: 'json', nullable: true })
  topics: string[] | null;

  /** Public page views (deduplicated per reader for a while; the author's own views don't count). */
  @Column({ type: 'int', unsigned: true, default: 0 })
  viewCount: number;
}
