import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { type Rating, RATINGS } from './review.entity';
import { ReviewService } from './review.service';

class SessionQuery {
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

class GenerateDto {
  @IsUUID()
  docId: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  count?: number;
}

class AnswerDto {
  @IsIn(RATINGS)
  rating: Rating;
}

class CheckDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  answer: string;
}

/** Review (spaced-repetition questions about the user's documents). */
@Controller('review')
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.review.summary(user.id);
  }

  @Get('session')
  session(@CurrentUser() user: AuthUser, @Query() q: SessionQuery) {
    return this.review.session(user.id, q);
  }

  /** The AI writes new questions about a document (counts as one assistant question). */
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateDto) {
    return this.review.generate(user.id, dto.docId, dto.count);
  }

  @Post('cards/:id/answer')
  @HttpCode(200)
  answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswerDto) {
    return this.review.answer(user.id, id, dto.rating);
  }

  /** The AI checks a typed answer. */
  @Post('cards/:id/check')
  @HttpCode(200)
  check(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CheckDto) {
    return this.review.check(user.id, id, dto.answer);
  }

  @Delete('cards/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.review.remove(user.id, id);
  }
}
