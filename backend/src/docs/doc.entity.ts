import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

@Entity('documents')
@Index(['ownerId', 'lastOpenedAt'])
export class Doc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  /** null = standalone note that doesn't belong to any project */
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, (project) => project.docs, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Relation<Project> | null;

  @Column({ length: 255 })
  title: string;

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

  /** Public page views (deduplicated per reader for a while; the author's own views don't count). */
  @Column({ type: 'int', unsigned: true, default: 0 })
  viewCount: number;
}
