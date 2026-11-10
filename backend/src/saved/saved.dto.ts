import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SavedQuery {
  /** unread (default) = not read yet; read; all. */
  @IsOptional()
  @IsIn(['unread', 'read', 'all'])
  status?: 'unread' | 'read' | 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReadDto {
  /** true = read, false = back to "to read". */
  @IsBoolean()
  read: boolean;
}
