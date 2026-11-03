import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, Unique } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

/**
 * A reader's comment on a public document. Replies are one level deep: `parentId` always points
 * at a top-level comment. Signed-in readers comment as themselves (`authorId`); anyone else is a
 * guest with an optional display name. IP and device are kept for every comment to fight spam;
 * they are never shown publicly.
 */
@Entity('doc_comments')
// Top-level threads of a doc, newest first (parentId IS NULL), and replies of a thread in order.
@Index(['docId', 'parentId', 'createdAt'])
@Index(['parentId', 'createdAt'])
@Index(['ip', 'createdAt'])
@Index(['authorId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  docId: string;

  @ManyToOne(() => Doc, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'docId' })
  doc: Relation<Doc>;

  /** Top-level comment this replies to; null = top-level. */
  @Column({ type: 'varchar', length: 36, nullable: true })
  parentId: string | null;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: Relation<Comment> | null;

  /** null = guest (or an account that was deleted since). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: Relation<User> | null;

  /** Guests only: the name they chose. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  guestName: string | null;

  /** Guests only: SHA-256 of the secret their browser keeps to edit or delete this comment. */
  @Column({ type: 'char', length: 64, nullable: true, select: false })
  guestTokenHash: string | null;

  @Column({ type: 'text' })
  body: string;

  /** null = erased after the retention period (see CommentsService.eraseOldClientInfo). */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 400, default: '' })
  userAgent: string;

  /** e.g. "iPhone · Safari" */
  @Column({ type: 'varchar', length: 80, default: '' })
  device: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  editedAt: Date | null;

  /** Hidden by the document's author: only they still see it. */
  @Column({ type: 'datetime', precision: 3, nullable: true })
  hiddenAt: Date | null;

  /** Deleted but kept as a placeholder because it has replies. */
  @Column({ type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}

/** A document author's block on a reader (by account, or by IP for guests): applies to all their docs. */
@Entity('comment_blocks')
@Unique(['ownerId', 'userId'])
@Unique(['ownerId', 'ip'])
export class CommentBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  /** Who it is, as shown to the author when the block was made (comments may be deleted later). */
  @Column({ type: 'varchar', length: 100, default: '' })
  label: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  device: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;
}
