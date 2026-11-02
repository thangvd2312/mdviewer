import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  content: string;

  /** Passage the user had selected when asking (user turns only). */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  quote?: string;

  /** Section the user was reading when asking (user turns only). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  section?: string;
}

export class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  messages: ChatTurnDto[];

  @ValidateNested()
  @Type(() => AssistantContextDto)
  context: AssistantContextDto;
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
