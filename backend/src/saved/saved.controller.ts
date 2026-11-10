import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SlugParam } from '../public/public.dto';
import { ReadDto, SavedQuery } from './saved.dto';
import { SavedPageDto, SavedSeriesDto } from './saved.responses.dto';
import { SavedService } from './saved.service';

/** Public posts the signed-in reader saved to read later. */
@ApiTags('saved')
@ApiBearerAuth()
@Controller('saved')
@UseGuards(AuthGuard)
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  /** The reader's saved posts, newest first (`status=read`: most recently read first), with counts. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: SavedQuery): Promise<SavedPageDto> {
    return this.saved.list(user.id, q);
  }

  /** Slugs of all saved posts, to mark them in lists. */
  @Get('slugs')
  slugs(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.saved.slugs(user.id);
  }

  /** Save a public post (saving it again changes nothing). */
  @Put('docs/:slug')
  @HttpCode(204)
  save(@CurrentUser() user: AuthUser, @Param() { slug }: SlugParam) {
    return this.saved.save(user.id, slug);
  }

  @Delete('docs/:slug')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param() { slug }: SlugParam) {
    return this.saved.remove(user.id, slug);
  }

  /** Mark a saved post read, or back to "to read". */
  @Put('docs/:slug/read')
  @HttpCode(204)
  setRead(@CurrentUser() user: AuthUser, @Param() { slug }: SlugParam, @Body() dto: ReadDto) {
    return this.saved.setRead(user.id, slug, dto.read);
  }

  /** Save every public part of a series. */
  @Put('series/:slug')
  saveSeries(@CurrentUser() user: AuthUser, @Param() { slug }: SlugParam): Promise<SavedSeriesDto> {
    return this.saved.saveSeries(user.id, slug);
  }

  /** Remove a series' parts from the saved list. */
  @Delete('series/:slug')
  @HttpCode(204)
  removeSeries(@CurrentUser() user: AuthUser, @Param() { slug }: SlugParam) {
    return this.saved.removeSeries(user.id, slug);
  }
}
