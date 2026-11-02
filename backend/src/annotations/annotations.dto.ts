import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ANNOTATION_KINDS, type AnnotationKind } from './annotation.entity';

export const QUOTE_MAX = 2000;
export const BODY_MAX = 10_000;

export class CreateAnnotationDto {
  @IsOptional()
  @IsIn(ANNOTATION_KINDS)
  kind?: AnnotationKind;

  @IsString()
  @MinLength(1)
  @MaxLength(QUOTE_MAX)
  quote: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  prefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  suffix?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX)
  body?: string;
}

export class UpdateAnnotationDto {
  @IsOptional()
  @IsIn(ANNOTATION_KINDS)
  kind?: AnnotationKind;

  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX)
  body?: string;
}
