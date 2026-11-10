import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocSummaryDto, SensitiveReportDto } from './docs.responses.dto';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateDocDto, ListDocsQuery, SharingDto, UpdateDocDto } from './docs.dto';
import { DocsService } from './docs.service';

@ApiTags('docs')
@ApiBearerAuth()
@Controller('docs')
@UseGuards(AuthGuard)
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  /** The user's documents without their content; searchable, filterable by project, sorted. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDocsQuery): Promise<DocSummaryDto[]> {
    return this.docs.list(user.id, query);
  }

  /** One document with its content; marks it as opened (for Recents). */
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.open(user.id, id);
  }

  /** New document; the title comes from the first heading when not given. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocDto) {
    return this.docs.create(user.id, dto);
  }

  /** Edit the content or title, or move it to another project (`projectId: null` = out of any). */
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocDto) {
    return this.docs.update(user.id, id, dto);
  }

  /**
   * What readers won't see once it's public: secrets, personal data (emails, phone numbers, IP
   * addresses, card and ID numbers) and the parts marked private. Shown before publishing.
   */
  @Get(':id/sensitive')
  sensitive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SensitiveReportDto> {
    return this.docs.sensitive(user.id, id);
  }

  /** Publish / unpublish the doc and turn comments on or off. */
  @Put(':id/sharing')
  setSharing(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SharingDto) {
    return this.docs.setSharing(user.id, id, dto);
  }

  /** Delete for good, with its sticky notes and review questions. */
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.remove(user.id, id);
  }
}
