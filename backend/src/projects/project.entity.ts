import { ApiHideProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 36 })
  ownerId: string;

  @ApiHideProperty()

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ length: 16, default: '📁' })
  icon: string;

  /**
   * Public address of the series (/blog/series/<slug>), made the first time the project is published
   * and kept after unpublishing so the link stays the same. null = never published.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  slug: string | null;

  /** Set while the project is a series on the blog (its public documents, in order); null = private. */
  @Column({ type: 'datetime', precision: 3, nullable: true })
  publishedAt: Date | null;

  @ApiHideProperty()

  @OneToMany(() => Doc, (doc) => doc.project)
  docs: Relation<Doc[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
