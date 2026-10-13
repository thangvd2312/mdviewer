import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateDocDto, ListDocsQuery, UpdateDocDto } from './docs.dto';
import { DocsService } from './docs.service';

@Controller('docs')
@UseGuards(AuthGuard)
export class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListDocsQuery) {
    return this.docs.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.open(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocDto) {
    return this.docs.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocDto) {
    return this.docs.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.remove(user.id, id);
  }
}
