import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatDto, ConversationQueryDto, SuggestDto } from './assistant.dto';
import { AssistantService } from './assistant.service';
import { ConversationsService } from './conversations.service';
import { RateLimiter } from './rate-limit';

const chatLimit = new RateLimiter(40, 10 * 60_000);
const suggestLimit = new RateLimiter(60, 10 * 60_000);

@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get('status')
  status() {
    return this.assistant.status();
  }

  @Post('suggest')
  @HttpCode(200)
  suggest(@CurrentUser() user: AuthUser, @Body() dto: SuggestDto) {
    suggestLimit.consume(user.id);
    return this.assistant.suggest(user.id, dto.context, dto.selection);
  }

  /** Server-sent events: `data: {"type":"conversation"|"text"|"done"|"error", ...}` */
  @Post('chat')
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto, @Res() res: Response) {
    chatLimit.consume(user.id);
    await this.assistant.chat(user.id, dto, res);
  }

  /** Past conversations, newest first; filter by where they were started. */
  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser, @Query() query: ConversationQueryDto) {
    return this.conversations.list(user.id, query);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.get(user.id, id);
  }
}
