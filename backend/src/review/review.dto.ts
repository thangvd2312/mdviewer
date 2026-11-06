import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { type Rating, RATINGS } from './review.entity';

export class SessionQuery {
  /** Quiz on one document (any of its cards) instead of what's due. */
  @IsOptional()
  @IsUUID()
  docId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class GenerateDto {
  @IsUUID()
  docId: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  count?: number;
}

export class AnswerDto {
  /** How well the user remembered it. */
  @ApiProperty({ enum: RATINGS })
  @IsIn(RATINGS)
  rating: Rating;
}

export class CheckDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  answer: string;
}
