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
}
