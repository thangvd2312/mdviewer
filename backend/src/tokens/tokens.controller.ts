import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreatedTokenDto } from './tokens.responses.dto';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTokenDto } from './tokens.dto';
import { TokensService } from './tokens.service';

/** The signed-in user's agent tokens (for MCP). */
@ApiTags('tokens')
@ApiBearerAuth()
@Controller('tokens')
@UseGuards(AuthGuard)
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  /** The user's agent tokens (never the secrets). */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tokens.list(user.id);
  }

  /** Returns the token itself once — it can't be shown again. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTokenDto): Promise<CreatedTokenDto> {
    return this.tokens.create(user.id, dto.name);
  }

  /** Revoke a token: agents using it stop working at once. */
  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tokens.revoke(user.id, id);
  }
}
