import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const CONTENT_MAX = 2_000_000;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateDocDto {
  /** Optional: derived from the first heading when blank. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  @MaxLength(CONTENT_MAX)
  content: string;

  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}

export class UpdateDocDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_MAX)
  content?: string;

  /** `null` moves the doc out of its project. */
  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}

export class ListDocsQuery {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  /** `loose` = only docs without a project. */
  @IsOptional()
  @IsIn(['all', 'loose'])
  scope?: 'all' | 'loose';

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(['recent', 'updated', 'title'])
  sort?: 'recent' | 'updated' | 'title';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
