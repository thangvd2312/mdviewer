import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { User } from '../users/user.entity';

/** Sticky-note kinds. Each kind has its own paper colour in the UI. */
export const ANNOTATION_KINDS = ['note', 'important', 'idea', 'question', 'todo', 'definition'] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

/**
 * A highlight + note attached to a passage of a document.
 *
 * The passage is anchored by its text (quote + a little surrounding context + an
 * approximate offset), not by DOM position, so it survives re-rendering and most edits.
 */
@Entity('annotations')
@Index(['docId', 'position'])
export class Annotation {
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

  @Column({ type: 'varchar', length: 16, default: 'note' })
  kind: AnnotationKind;

  /** The highlighted text, as rendered (plain text). */
  @Column({ type: 'text' })
  quote: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  prefix: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  suffix: string;

  /** Character offset of the quote in the rendered text; tie-breaker when the quote occurs more than once. */
  @Column({ type: 'int', default: 0 })
  position: number;

  /** The note itself. Empty = plain highlight. */
  @Column({ type: 'text' })
  body: string;

  // Set by the app (like Doc.updatedAt) rather than by MySQL's CURRENT_TIMESTAMP, so the
  // values are written and read in the same timezone.
  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}
