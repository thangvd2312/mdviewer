import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TokensService } from './tokens.service';

class CreateTokenDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

/** The signed-in user's agent tokens (for MCP). */
@Controller('tokens')
@UseGuards(AuthGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user.id);
  }

  /** Returns the token itself once — it can't be shown again. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTokenDto) {
    return this.tokens.create(user.id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tokens.revoke(user.id, id);
  }
}
