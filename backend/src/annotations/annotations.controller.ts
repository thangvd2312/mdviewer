import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateAnnotationDto, UpdateAnnotationDto } from './annotations.dto';
import { AnnotationsService } from './annotations.service';

@Controller()
@UseGuards(AuthGuard)
export class AnnotationsController {
  constructor(private readonly annotations: AnnotationsService) {}

  @Get('docs/:docId/annotations')
  list(@CurrentUser() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string) {
    return this.annotations.listForDoc(user.id, docId);
  }

  @Post('docs/:docId/annotations')
  create(@CurrentUser() user: AuthUser, @Param('docId', ParseUUIDPipe) docId: string, @Body() dto: CreateAnnotationDto) {
    return this.annotations.create(user.id, docId, dto);
  }

  @Patch('annotations/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAnnotationDto) {
    return this.annotations.update(user.id, id, dto);
  }

  @Delete('annotations/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.annotations.remove(user.id, id);
  }
}
