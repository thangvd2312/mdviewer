import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const COMMENT_MAX = 4000;

export class ExploreQuery {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(['latest', 'popular'])
  sort?: 'latest' | 'popular';

  /** GitHub login of the author. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_MAX)
  body: string;

  /** Reply to this comment (a reply to a reply goes under the same top-level comment). */
  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** Guests: the name to show; blank = "Anonymous". Ignored for signed-in readers. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  guestName?: string;

  /** Honeypot: a field people never see. Bots that fill every input get caught. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  /** How long the form was open before sending, ms (bots post instantly). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  elapsedMs?: number;
}

export class CommentsQuery {
  /** Cursor from the previous page (`nextCursor`). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  before?: string;
}

export class RepliesQuery {
  /** Cursor from the previous page (`moreReplies`). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  after?: string;
}

export class BlocksQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(COMMENT_MAX)
  body: string;
}

export class HideCommentDto {
  @IsBoolean()
  hidden: boolean;
}

/** Slugs are lowercase words joined by dashes (see slugify). */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export class SlugParam {
  @Matches(SLUG_PATTERN)
  slug: string;
}
