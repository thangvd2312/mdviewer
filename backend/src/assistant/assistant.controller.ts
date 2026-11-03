import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatDto, ConversationQueryDto, SuggestDto } from './assistant.dto';
import { AssistantService } from './assistant.service';
import { ConversationsService } from './conversations.service';

@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get('status')
  /** Whether the assistant is set up, and the user's allowance for today. */
  status(@CurrentUser() user: AuthUser) {
    return this.assistant.status(user.id);
  }

  @Post('suggest')
  @HttpCode(200)
  suggest(@CurrentUser() user: AuthUser, @Body() dto: SuggestDto) {
    return this.assistant.suggest(user.id, dto.context, dto.selection);
  }

  /**
   * Server-sent events: `data: {"type":"conversation"|"text"|"done"|"error", ...}`.
   * 429 before the stream starts when the user is over a limit (body carries `quota` for daily limits).
   */
  @Post('chat')
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto, @Res() res: Response) {
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
