import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { DocsService } from '../docs/docs.service';
import { ProjectsService } from '../projects/projects.service';
import { AssistantContextDto, ConversationQueryDto } from './assistant.dto';
import { Conversation, Message, MessageStatus } from './conversation.entity';
import type { Tier } from './usage.entity';

/** At most this many earlier messages are sent back to the model with each question… */
const HISTORY_LIMIT = 40;
/** …and at most this much text: long chats keep their latest part. */
const HISTORY_MAX_CHARS = 40_000;

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly docs: DocsService,
    private readonly projects: ProjectsService,
  ) {}

  async list(ownerId: string, q: ConversationQueryDto) {
    const where: FindOptionsWhere<Conversation> = { ownerId };
    if (q.page === 'doc') Object.assign(where, { page: 'doc', ...(q.docId && { docId: q.docId }) });
    else if (q.page === 'project') Object.assign(where, { page: 'project', ...(q.projectId && { projectId: q.projectId }) });
    // Home and other pages share one "general" chat, not tied to a doc or project.
    else if (q.page) Object.assign(where, { page: In(['home', 'other']) });
    return this.conversations.find({ where, order: { updatedAt: 'DESC' }, take: q.limit ?? 30 });
  }

  async get(ownerId: string, id: string) {
    const conversation = await this.findOwned(ownerId, id);
    const messages = await this.messages.find({
      where: { conversationId: id },
      order: { createdAt: 'ASC' },
      select: { id: true, role: true, content: true, quote: true, section: true, status: true, tier: true, createdAt: true },
    });
    return { ...conversation, messages };
  }

  async findOwned(ownerId: string, id: string) {
    const conversation = await this.conversations.findOne({ where: { id, ownerId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  /** Starts a conversation in the given context (checks the user owns the doc/project). */
  async create(ownerId: string, ctx: AssistantContextDto, firstQuestion: string) {
    if (ctx.page === 'doc' && ctx.docId) await this.docs.findReadable(ownerId, ctx.docId);
    if (ctx.page === 'project' && ctx.projectId) await this.projects.get(ownerId, ctx.projectId);
    const now = new Date();
    return this.conversations.save(
      this.conversations.create({
        ownerId,
        page: ctx.page,
        docId: ctx.page === 'doc' ? (ctx.docId ?? null) : null,
        projectId: ctx.page === 'project' ? (ctx.projectId ?? null) : null,
        title: clip(firstQuestion.replace(/\s+/g, ' ').trim(), 200),
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  /**
   * Records the user's question. When `retry` is set and the last message is the same,
   * unanswered question, it is reused instead of stored twice.
   */
  async addQuestion(
    conversation: Conversation,
    turn: { content: string; quote?: string; section?: string },
    retry = false,
  ) {
    const last = await this.messages.findOne({
      where: { conversationId: conversation.id },
      order: { createdAt: 'DESC' },
    });
    if (retry && last?.role === 'user' && last.content === turn.content) return last;
    return this.save(conversation, {
      role: 'user',
      content: turn.content,
      quote: turn.quote ?? null,
      section: turn.section ?? null,
    });
  }

  async addAnswer(conversation: Conversation, content: string, status: MessageStatus, by: { model: string; tier: Tier }) {
    return this.save(conversation, { role: 'assistant', content, status, model: by.model, tier: by.tier });
  }

  /** The conversation so far, oldest first, ending with the question being answered. */
  async history(conversationId: string) {
    const recent = await this.messages.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    // Newest first: keep messages until the text budget is used (always the question itself).
    let size = 0;
    const kept = recent.filter((m, i) => {
      size += m.content.length + (m.quote?.length ?? 0);
      return i === 0 || size <= HISTORY_MAX_CHARS;
    });
    const list = kept.reverse();
    // Always start with a question.
    while (list.length && list[0]!.role !== 'user') list.shift();
    if (list.at(-1)?.role !== 'user') throw new BadRequestException('Nothing to answer');
    return list;
  }

  private async save(conversation: Conversation, data: Partial<Message>) {
    const now = new Date();
    const message = await this.messages.save(
      this.messages.create({ ...data, conversationId: conversation.id, ownerId: conversation.ownerId, createdAt: now }),
    );
    await this.conversations.update(conversation.id, { updatedAt: now });
    return message;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
