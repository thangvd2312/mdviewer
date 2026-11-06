import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { AssistantStatusDto, ConversationDetailDto, SuggestionsDto } from './assistant.responses.dto';
import type { Response } from 'express';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChatDto, ConversationQueryDto, SuggestDto } from './assistant.dto';
import { AssistantService } from './assistant.service';
import { ConversationsService } from './conversations.service';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly conversations: ConversationsService,
  ) {}

  /** Whether the assistant is set up, and the user's allowance for today. */
  @Get('status')
  status(@CurrentUser() user: AuthUser): Promise<AssistantStatusDto> {
    return this.assistant.status(user.id);
  }

  /** A few questions worth asking about what's on screen (cached; cheap model). */
  @Post('suggest')
  @HttpCode(200)
  suggest(@CurrentUser() user: AuthUser, @Body() dto: SuggestDto): Promise<SuggestionsDto> {
    return this.assistant.suggest(user.id, dto.context, dto.selection);
  }

  /**
   * Server-sent events: `data: {"type":"conversation"|"text"|"done"|"error", ...}`.
   * 429 before the stream starts when the user is over a limit (body carries `quota` for daily limits).
   */
  @Post('chat')
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'An event stream, one JSON object per `data:` line: `{type:"conversation",id,tier}` first, then ' +
      '`{type:"text",text}` chunks, and `{type:"done",stopReason}` or `{type:"error",message}` at the end.',
  })
  @ApiTooManyRequestsResponse({ description: 'Over a limit (the body carries `quota` for daily limits).' })
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto, @Res() res: Response) {
    await this.assistant.chat(user.id, dto, res);
  }

  /** Past conversations, newest first; filter by where they were started. */
  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser, @Query() query: ConversationQueryDto) {
    return this.conversations.list(user.id, query);
  }

  /** One stored conversation with all its messages. */
  @Get('conversations/:id')
  getConversation(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<ConversationDetailDto> {
    return this.conversations.get(user.id, id);
  }
}
