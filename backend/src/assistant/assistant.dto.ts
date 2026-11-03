import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PAGES = ['home', 'project', 'doc', 'other'] as const;
export type AssistantPage = (typeof PAGES)[number];

/** Where the user is in the app — the assistant loads the matching data server-side. */
export class AssistantContextDto {
  @IsIn(PAGES)
  page: AssistantPage;

  @IsOptional()
  @IsUUID()
  docId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  /** Heading of the section currently in view (doc page only). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  sectionTitle?: string;
}

/** The question being asked. */
export class ChatQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  /** Passage the user had selected when asking. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quote?: string;

  /** Section the user was reading when asking. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  section?: string;
}

export class ChatDto {
  /** Continue this conversation; omitted = start a new one. Earlier messages are loaded server-side. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ValidateNested()
  @Type(() => ChatQuestionDto)
  message: ChatQuestionDto;

  /** Re-asking after a failure: don't store the question again if it is already the last message. */
  @IsOptional()
  @IsBoolean()
  retry?: boolean;

  @ValidateNested()
  @Type(() => AssistantContextDto)
  context: AssistantContextDto;
}

export class ConversationQueryDto {
  @IsOptional()
  @IsIn(PAGES)
  page?: AssistantPage;

  @IsOptional()
  @IsUUID()
  docId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SuggestDto {
  @ValidateNested()
  @Type(() => AssistantContextDto)
  context: AssistantContextDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selection?: string;
}
