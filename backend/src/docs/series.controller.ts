import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Project } from '../projects/project.entity';
import { ReorderDto, SeriesSharingDto } from './series.dto';
import { SeriesService } from './series.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(AuthGuard)
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  /**
   * Publish the project as a series on the blog (/blog/series/<slug>), or stop. Only its public
   * documents appear, in the project's order; `publishDocs` also publishes the private ones.
   */
  @Put(':id/sharing')
  setSharing(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SeriesSharingDto,
  ): Promise<Project> {
    return this.series.setSharing(user.id, id, dto);
  }

  /** Order of the project's documents, which is also the series order. */
  @Put(':id/order')
  @HttpCode(204)
  reorder(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderDto) {
    return this.series.reorder(user.id, id, dto);
  }
}
