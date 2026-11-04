import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { User } from '../users/user.entity';

export const TIERS = ['full', 'saver'] as const;
/** full = the main model; saver = the cheaper model used once the full allowance is spent. */
export type Tier = (typeof TIERS)[number];

/**
 * One call to the AI service, with the tokens it used. Daily allowances are counted from this
 * table, and it shows who uses how much.
 */
@Entity('assistant_usage')
@Index(['ownerId', 'day'])
@Index(['day'])
export class Usage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  /** chat = a question answered; suggest = suggested questions generated; curate = a blog post the system wrote. */
  @Column({ type: 'varchar', length: 16 })
  kind: 'chat' | 'suggest' | 'curate';

  @Column({ type: 'varchar', length: 16 })
  tier: Tier;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ type: 'int', default: 0 })
  promptTokens: number;

  /** Includes reasoning tokens. */
  @Column({ type: 'int', default: 0 })
  completionTokens: number;

  /** The day (YYYY-MM-DD, in the allowance's time zone) this call counts towards. */
  @Column({ type: 'char', length: 10 })
  day: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;
}
