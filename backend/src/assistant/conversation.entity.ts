import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import type { AssistantPage } from './assistant.dto';

/**
 * One chat with the assistant. Kept permanently (also after "New chat") so the questions a user
 * asked can be reviewed later — what they struggled with, what to quiz them on.
 */
@Entity('assistant_conversations')
@Index(['ownerId', 'updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  /** Where the chat was started: doc / project / home / other. */
  @Column({ type: 'varchar', length: 16 })
  page: AssistantPage;

  // Deleting the document or project keeps the conversation (only the link is cleared).
  @Column({ type: 'varchar', length: 36, nullable: true })
  docId: string | null;

  @ManyToOne(() => Doc, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'docId' })
  doc: Relation<Doc> | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId: string | null;

  @ManyToOne(() => Project, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'projectId' })
  project: Relation<Project> | null;

  /** The first question, shortened. */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;

  /** Time of the latest message. */
  @Column({ type: 'datetime', precision: 3 })
  updatedAt: Date;
}

export const MESSAGE_STATUSES = ['complete', 'stopped', 'error'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** A question or an answer in a conversation. */
@Entity('assistant_messages')
@Index(['conversationId', 'createdAt'])
@Index(['ownerId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 36 })
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Relation<Conversation>;

  /** Denormalised so a user's questions can be queried without joining conversations. */
  @Column({ length: 36 })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: Relation<User>;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'mediumtext' })
  content: string;

  /** Passage the user had selected when asking. */
  @Column({ type: 'text', nullable: true })
  quote: string | null;

  /** Section the user was reading when asking. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  section: string | null;

  /** Answers only: whether it finished, was stopped by the user, or broke off with an error. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  status: MessageStatus | null;

  /** Answers only: the model that wrote it. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'datetime', precision: 3 })
  createdAt: Date;
}
