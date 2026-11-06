import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnsweredCardDto, CheckResultDto, ReviewCardDto, ReviewSummaryDto } from './review.responses.dto';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnswerDto, CheckDto, GenerateDto, SessionQuery } from './review.dto';
import { ReviewService } from './review.service';

/** Review (spaced-repetition questions about the user's documents). */
@ApiTags('review')
@ApiBearerAuth()
@Controller('review')
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** The review home: what's due, progress, streak, and documents worth making questions from. */
  @Get()
  summary(@CurrentUser() user: AuthUser): Promise<ReviewSummaryDto> {
    return this.review.summary(user.id);
  }

  /** Cards to review now (most overdue first), or a quiz on one document with `docId`. */
  @Get('session')
  session(@CurrentUser() user: AuthUser, @Query() q: SessionQuery): Promise<ReviewCardDto[]> {
    return this.review.session(user.id, q);
  }

  /** The AI writes new questions about a document (counts as one assistant question). */
  @Post('generate')
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateDto): Promise<ReviewCardDto[]> {
    return this.review.generate(user.id, dto.docId, dto.count);
  }

  /** Rate how well it was remembered; returns the card with its next due date (FSRS). */
  @Post('cards/:id/answer')
  @HttpCode(200)
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerDto,
  ): Promise<AnsweredCardDto> {
    return this.review.answer(user.id, id, dto.rating);
  }

  /** The AI checks a typed answer. */
  @Post('cards/:id/check')
  @HttpCode(200)
  check(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckDto,
  ): Promise<CheckResultDto> {
    return this.review.check(user.id, id, dto.answer);
  }

  /** Drop a question the user doesn't want. */
  @Delete('cards/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.review.remove(user.id, id);
  }
}
