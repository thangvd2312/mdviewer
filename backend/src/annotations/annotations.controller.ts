import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateAnnotationDto, UpdateAnnotationDto } from './annotations.dto';
import { AnnotationsService } from './annotations.service';

@ApiTags('annotations')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class AnnotationsController {
  constructor(private readonly annotations: AnnotationsService) {}

  /** A document's sticky notes, in reading order. */
  @Get('docs/:docId/annotations')
  list(@CurrentUser() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.annotations.listForDoc(user.id, docId);
  }

  /** Pin a note to a passage: the quote plus some text around it, so it can be found again after edits. */
  @Post('docs/:docId/annotations')
  create(@CurrentUser() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @Body() dto: CreateAnnotationDto) {
    return this.annotations.create(user.id, docId, dto);
  }

  /** Change a note's text or colour. */
  @Patch('annotations/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnotationDto) {
    return this.annotations.update(user.id, id, dto);
  }

  /** Remove a note. */
  @Delete('annotations/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.annotations.remove(user.id, id);
  }
}
