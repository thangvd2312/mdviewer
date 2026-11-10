import { ApiHideProperty } from '@nestjs/swagger';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

/**
 * A public post a reader saved to read later. Kept when the author unpublishes or deletes the post
 * (then shown as no longer available), with the title and link it had when saved.
 */
@Entity('saved_posts')
@Index(['userId', 'docId'], { unique: true })
@Index(['userId', 'createdAt'])
export class SavedPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  userId: string;

  @ApiHideProperty()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  /** null once the author deleted the post. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  docId: string | null;

  @ApiHideProperty()
  @ManyToOne(() => Doc, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'docId' })
  doc: Relation<Doc> | null;

  /** The post's public title and slug when it was saved. */
  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  /** When the reader finished it (or marked it read); null = still to read. */
  @Column({ type: 'datetime', precision: 3, nullable: true })
  readAt: Date | null;
}
