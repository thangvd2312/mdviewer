import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * A personal access token an AI agent uses to reach the user's notes over MCP. Only a SHA-256
 * hash is stored; the token itself is shown once, when it's created.
 */
@Entity('api_tokens')
export class ApiToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  /** What the user called it, e.g. "Claude Code on my laptop". */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64, select: false })
  tokenHash: string;

  /** The first characters, to recognise the token in a list (e.g. "vmd_Ab3x"). */
  @Column({ type: 'varchar', length: 16 })
  prefix: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  lastUsedAt: Date | null;
}
