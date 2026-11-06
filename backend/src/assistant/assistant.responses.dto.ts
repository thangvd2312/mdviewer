import { ApiProperty, PickType } from '@nestjs/swagger';
import { Conversation, Message } from './conversation.entity';
import { TIERS, type Tier } from './usage.entity';

export class UsageCountDto {
  used: number;
  limit: number;
}

/** The user's allowance for today. */
export class AssistantQuotaDto {
  /** No per-user allowance (the global cap still applies). */
  unlimited: boolean;
  /** Tier the next question gets; null = no questions left today. */
  @ApiProperty({ enum: TIERS, nullable: true, type: String })
  next: Tier | null;
  /** Questions on the main model today. */
  full: UsageCountDto;
  /** Questions on the cheaper model today. */
  saver: UsageCountDto;
  /** Why no questions are left: this user's allowance, or everyone's. */
  @ApiProperty({ enum: ['user', 'global'], nullable: true, type: String })
  blocked: 'user' | 'global' | null;
  /** When the allowance starts over (ISO). */
  resetAt: string;
}

export class AssistantStatusDto {
  /** The assistant is set up on this server. */
  enabled: boolean;
  model: string;
  /** null when the assistant is off. */
  quota: AssistantQuotaDto | null;
}

export class SuggestionsDto {
  questions: string[];
}

export class ConversationMessageDto extends PickType(Message, [
  'id',
  'role',
  'content',
  'quote',
  'section',
  'status',
  'tier',
  'createdAt',
] as const) {}

/** A stored conversation with all its messages, oldest first. */
export class ConversationDetailDto extends PickType(Conversation, [
  'id',
  'ownerId',
  'page',
  'docId',
  'projectId',
  'title',
  'createdAt',
  'updatedAt',
] as const) {
  messages: ConversationMessageDto[];
}
