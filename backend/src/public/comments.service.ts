import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Brackets, EntityManager, In, IsNull, LessThan, MoreThan, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import type { ClientInfo } from './client-info';
import { Comment, CommentBlock } from './comment.entity';
import { CreateCommentDto, UpdateCommentDto } from './public.dto';
import { PublicDocsService } from './public-docs.service';
import { DuplicateGuard, WriteLimiter } from './write-limits';

/** Who is acting: a signed-in user and/or a guest, always with their IP and device. */
export interface Actor {
  userId?: string;
  client: ClientInfo;
  /** Guests: the secret their browser got when posting (to edit or delete it). */
  guestToken?: string;
}

export type CommentAuthorView =
  | {
      kind: 'user';
      name: string;
      login: string | null;
      avatarUrl: string | null;
      isDocAuthor: boolean;
    }
  | { kind: 'guest'; name: string }
  | { kind: 'gone' };

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: CommentAuthorView;
  /** Written by the signed-in viewer. */
  mine: boolean;
  /** Document author only: */
  hidden?: boolean;
  blocked?: boolean;
  device?: string;
}

/** A top-level comment with the first of its replies. */
export interface ThreadView {
  comment: CommentView;
  replies: CommentView[];
  /** Cursor for the next replies, or null when all are shown. */
  moreReplies: string | null;
}

const MINUTE = 60_000;
const DAY_MS = 24 * 3600_000;

/** Spam limits: guests are counted by IP, signed-in readers by account. */
const LIMITS = {
  guest: { burst: 5, day: 30, links: 2, minElapsedMs: 2500 },
  user: { burst: 10, day: 100, links: 5, minElapsedMs: 0 },
};
/** Guests may edit or delete their comment for this long (while their browser keeps the secret). */
const GUEST_EDIT_MS = DAY_MS;
/** Page sizes: top-level threads, replies shown with a thread, replies per "show more". */
const THREADS_PAGE = 20;
const REPLIES_PREVIEW = 10;
const REPLIES_PAGE = 50;
/** Guest IP blocks lapse after this long: addresses get reassigned, and we shouldn't hold them forever. */
const IP_BLOCK_DAYS = 180;
const ERASE_BATCH = 1000;

const GUEST_DEFAULT_NAME = 'Anonymous';

@Injectable()
export class CommentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommentsService.name);
  /** IP addresses and user agents are erased from comments after this many days. */
  private readonly retentionDays: number;
  private readonly writes = {
    guest: new WriteLimiter([
      { max: LIMITS.guest.burst, ms: 10 * MINUTE },
      { max: LIMITS.guest.day, ms: DAY_MS },
    ]),
    user: new WriteLimiter([
      { max: LIMITS.user.burst, ms: 10 * MINUTE },
      { max: LIMITS.user.day, ms: DAY_MS },
    ]),
  };
  private readonly duplicates = new DuplicateGuard(DAY_MS);
  private startTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(CommentBlock)
    private readonly blocks: Repository<CommentBlock>,
    @InjectRepository(Doc) private readonly docs: Repository<Doc>,
    private readonly publicDocs: PublicDocsService,
    config: ConfigService,
  ) {
    this.retentionDays = Math.max(1, Number(config.get('COMMENT_IP_RETENTION_DAYS', 90)) || 90);
  }

  onModuleInit() {
    // A minute after start (not slowing startup), then daily. unref: never keeps the process alive.
    const run = () => void this.eraseOldClientInfo();
    this.startTimer = setTimeout(run, MINUTE).unref();
    this.cleanupTimer = setInterval(run, DAY_MS).unref();
  }

  onModuleDestroy() {
    clearTimeout(this.startTimer);
    clearInterval(this.cleanupTimer);
  }

  // ── Reading ────────────────────────────────────────────────────────────────────────────────

  /**
   * One page of top-level threads, newest first, each with its first replies. Hidden comments
   * (and replies under them) are shown only to the page's author; a deleted comment stays as a
   * placeholder only while it still has replies the viewer can see.
   */
  async list(slug: string, viewerId: string | undefined, before?: string) {
    const doc = await this.publicDocs.get(slug);
    const isOwner = viewerId === doc.ownerId;
    const qb = this.comments
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.author', 'author')
      .where('c.docId = :docId AND c.parentId IS NULL', { docId: doc.id })
      .andWhere(
        new Brackets((w) =>
          w
            .where('c.deletedAt IS NULL')
            .orWhere(
              `EXISTS (SELECT 1 FROM doc_comments r WHERE r.parentId = c.id AND r.deletedAt IS NULL${isOwner ? '' : ' AND r.hiddenAt IS NULL'})`,
            ),
        ),
      )
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(THREADS_PAGE + 1);
    if (!isOwner) qb.andWhere('c.hiddenAt IS NULL');
    const cursor = decodeCursor(before);
    if (cursor) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('c.createdAt < :at', { at: cursor.at })
            .orWhere('c.createdAt = :at AND c.id < :id', { id: cursor.id }),
        ),
      );
    }
    const rows = await qb.getMany();
    const roots = rows.slice(0, THREADS_PAGE);
    const replyPages = await Promise.all(roots.map((r) => this.replyPage(r.id, isOwner, undefined, REPLIES_PREVIEW)));
    const all = [...roots, ...replyPages.flatMap((p) => p.rows)];
    const blocks = isOwner ? await this.blocksFor(doc.ownerId, all) : [];
    return {
      threads: roots.map((root, i): ThreadView => ({
        comment: this.view(root, doc, viewerId, isOwner, blocks),
        replies: replyPages[i]!.rows.map((c) => this.view(c, doc, viewerId, isOwner, blocks)),
        moreReplies: replyPages[i]!.next,
      })),
      nextCursor: rows.length > THREADS_PAGE ? encodeCursor(roots.at(-1)!) : null,
      count: await this.publicDocs.visibleCommentCount(doc.id),
      allowComments: doc.allowComments,
      canModerate: isOwner,
    };
  }

  /** More replies of a top-level comment, oldest first. */
  async replies(rootId: string, viewerId: string | undefined, after?: string) {
    const { comment: root, doc } = await this.load(rootId);
    const isOwner = viewerId === doc.ownerId;
    if (root.parentId || (root.hiddenAt && !isOwner)) throw new NotFoundException('That comment is no longer here.');
    const page = await this.replyPage(root.id, isOwner, decodeCursor(after) ?? undefined, REPLIES_PAGE);
    const blocks = isOwner ? await this.blocksFor(doc.ownerId, page.rows) : [];
    return {
      replies: page.rows.map((c) => this.view(c, doc, viewerId, isOwner, blocks)),
      moreReplies: page.next,
    };
  }

  private async replyPage(rootId: string, isOwner: boolean, after: { at: Date; id: string } | undefined, size: number) {
    const qb = this.comments
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.author', 'author')
      .where('c.parentId = :rootId AND c.deletedAt IS NULL', { rootId })
      .orderBy('c.createdAt', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .take(size + 1);
    if (!isOwner) qb.andWhere('c.hiddenAt IS NULL');
    if (after) {
      qb.andWhere(
        new Brackets((w) =>
          w.where('c.createdAt > :at', { at: after.at }).orWhere('c.createdAt = :at AND c.id > :id', { id: after.id }),
        ),
      );
    }
    const rows = await qb.getMany();
    const shown = rows.slice(0, size);
    return {
      rows: shown,
      next: rows.length > size ? encodeCursor(shown.at(-1)!) : null,
    };
  }

  // ── Writing ────────────────────────────────────────────────────────────────────────────────

  async create(slug: string, dto: CreateCommentDto, actor: Actor) {
    const guest = !actor.userId;
    const limits = guest ? LIMITS.guest : LIMITS.user;
    const body = normalize(dto.body);
    // Cheap checks, then the write limiter — all before the first await, so concurrent requests
    // are admitted one at a time.
    if (!body) throw new BadRequestException('Write something first.');
    this.rejectBots(dto, guest);
    if (countLinks(body) > limits.links) throw new BadRequestException(tooManyLinks(limits.links));
    this.admitWrite(actor);

    const doc = await this.publicDocs.get(slug);
    if (!doc.allowComments) throw new ForbiddenException('Comments are turned off for this page.');
    await this.rejectBlocked(doc, actor);

    const writer = writerKey(actor);
    const reservation = this.duplicates.reserve(DuplicateGuard.key(doc.id, writer, body), null);
    if (!reservation) throw new ConflictException('You already posted this comment.');
    try {
      if (await this.isDuplicateInDb(doc.id, actor, body))
        throw new ConflictException('You already posted this comment.');
      const guestToken = guest ? randomBytes(24).toString('base64url') : undefined;
      const saved = await this.comments.manager.transaction(async (m) => {
        let parentId: string | null = null;
        if (dto.parentId) {
          // Lock the thread's top-level comment, so it can't be deleted (cascading to this reply)
          // between the check and the insert.
          const target = await m.findOne(Comment, {
            where: { id: dto.parentId, docId: doc.id },
          });
          const rootId = target?.parentId ?? target?.id;
          const root = rootId ? await lockComment(m, rootId) : null;
          // Re-check after the lock (current data): the thread and the comment being answered must
          // still be there, on this page, and visible.
          // Locking read (current data, not the transaction's snapshot), after the root lock.
          const current = root && target!.parentId ? await lockComment(m, target!.id) : root;
          const gone = (c: Comment | null) => !c || c.docId !== doc.id || c.deletedAt || c.hiddenAt;
          if (!root || gone(root) || gone(current)) throw new NotFoundException('That comment is no longer here.');
          parentId = root.id; // replies stay one level deep
        }
        return m.save(
          m.create(Comment, {
            docId: doc.id,
            parentId,
            authorId: actor.userId ?? null,
            guestName: guest ? dto.guestName?.replace(/\s+/g, ' ').slice(0, 50) || GUEST_DEFAULT_NAME : null,
            guestTokenHash: guestToken ? sha256(guestToken) : null,
            body,
            ip: actor.client.ip,
            userAgent: actor.client.userAgent,
            device: actor.client.device,
            createdAt: new Date(),
          }),
        );
      });
      this.duplicates.confirm(reservation, saved.id);
      const full = await this.comments.findOneOrFail({
        where: { id: saved.id },
        relations: { author: true },
      });
      return {
        comment: this.view(full, doc, actor.userId, actor.userId === doc.ownerId, []),
        ...(guestToken && { guestToken }),
      };
    } catch (error) {
      this.duplicates.release(reservation);
      throw error;
    }
  }

  /** By its author only, while comments are open and the author isn't blocked; limited like posting. */
  async update(id: string, dto: UpdateCommentDto, actor: Actor) {
    const limits = actor.userId ? LIMITS.user : LIMITS.guest;
    const body = normalize(dto.body);
    if (!body) throw new BadRequestException('Write something first.');
    if (countLinks(body) > limits.links) throw new BadRequestException(tooManyLinks(limits.links));
    this.admitWrite(actor);

    const { comment, doc } = await this.load(id);
    if (comment.deletedAt) throw new NotFoundException('That comment was deleted.');
    this.assertAuthor(comment, actor, 'edit');
    if (!doc.allowComments) throw new ForbiddenException('Comments are turned off for this page.');
    await this.rejectBlocked(doc, actor);
    if (body === comment.body) return this.view(comment, doc, actor.userId, actor.userId === doc.ownerId, []);

    const reservation = this.duplicates.reserve(DuplicateGuard.key(doc.id, writerKey(actor), body), comment.id);
    if (!reservation) throw new ConflictException('You already posted this comment.');
    try {
      if (await this.isDuplicateInDb(doc.id, actor, body, comment.id)) {
        throw new ConflictException('You already posted this comment.');
      }
      comment.body = body;
      comment.editedAt = new Date();
      await this.comments.update(comment.id, {
        body,
        editedAt: comment.editedAt,
      });
      this.duplicates.confirm(reservation, comment.id);
    } catch (error) {
      this.duplicates.release(reservation);
      throw error;
    }
    return this.view(comment, doc, actor.userId, actor.userId === doc.ownerId, []);
  }

  /** By its author or by the document's author. Kept as a placeholder while it has replies. */
  async remove(id: string, actor: Actor) {
    const { comment, doc } = await this.load(id);
    if (actor.userId !== doc.ownerId) this.assertAuthor(comment, actor, 'delete');
    await this.comments.manager.transaction(async (m) => {
      // Always lock the thread's top-level comment first (same order as posting a reply).
      const root = await lockComment(m, comment.parentId ?? comment.id);
      if (!root) return; // already gone
      if (!comment.parentId) {
        const replies = await liveReplyCount(m, root.id);
        if (replies > 0) await m.update(Comment, root.id, { deletedAt: new Date(), body: '' });
        else await m.delete(Comment, root.id);
        return;
      }
      await m.delete(Comment, comment.id);
      // The last reply of a deleted comment takes the placeholder with it.
      if (root.deletedAt && (await liveReplyCount(m, root.id)) === 0) await m.delete(Comment, root.id);
    });
  }

  // ── Moderation (the document's author) ─────────────────────────────────────────────────────

  async setHidden(id: string, hidden: boolean, userId: string) {
    const { comment, doc } = await this.load(id);
    if (doc.ownerId !== userId) throw new ForbiddenException('Only the author of this page can do that.');
    await this.comments.update(comment.id, {
      hiddenAt: hidden ? new Date() : null,
    });
  }

  /**
   * Blocks the comment's writer from commenting on any of the owner's pages (by account, or by IP
   * for guests) and hides everything they wrote there.
   */
  async block(id: string, userId: string) {
    const { comment, doc } = await this.load(id);
    if (doc.ownerId !== userId) throw new ForbiddenException('Only the author of this page can do that.');
    if (comment.authorId === userId) throw new BadRequestException('You can’t block yourself.');
    if (!comment.authorId && !comment.ip) {
      throw new BadRequestException('This comment is too old to block its writer. You can still hide or delete it.');
    }
    const target = comment.authorId ? { userId: comment.authorId } : { ip: comment.ip! };
    const label = comment.author?.name ?? comment.guestName ?? 'Guest';
    const exists = await this.blocks.findOneBy({ ownerId: userId, ...target });
    if (!exists) {
      await this.blocks.save(
        this.blocks.create({
          ownerId: userId,
          ...target,
          label,
          device: comment.device,
          createdAt: new Date(),
        }),
      );
    }
    const ownDocIds = (await this.docs.find({ where: { ownerId: userId }, select: { id: true } })).map((d) => d.id);
    if (ownDocIds.length) {
      await this.comments.update(
        {
          docId: In(ownDocIds),
          hiddenAt: IsNull(),
          ...(comment.authorId ? { authorId: comment.authorId } : { ip: comment.ip!, authorId: IsNull() }),
        },
        { hiddenAt: new Date() },
      );
    }
  }

  /** Lifts the block on this comment's writer (their hidden comments stay hidden until shown again). */
  async unblock(id: string, userId: string) {
    const { comment, doc } = await this.load(id);
    if (doc.ownerId !== userId) throw new ForbiddenException('Only the author of this page can do that.');
    if (comment.authorId) await this.blocks.delete({ ownerId: userId, userId: comment.authorId });
    else if (comment.ip) await this.blocks.delete({ ownerId: userId, ip: comment.ip });
  }

  /** The author's blocks, newest first — from the block records themselves, never exposing IPs. */
  async listBlocks(ownerId: string, offset = 0, limit = 50) {
    const rows = await this.blocks.find({
      where: { ownerId },
      relations: { user: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: offset,
      take: limit + 1,
    });
    return {
      items: rows.slice(0, limit).map((b) => ({
        id: b.id,
        kind: b.userId ? ('user' as const) : ('guest' as const),
        name: b.user?.name ?? (b.label || 'Guest'),
        login: b.user?.githubLogin ?? null,
        device: b.device || null,
        createdAt: b.createdAt.toISOString(),
      })),
      hasMore: rows.length > limit,
    };
  }

  async removeBlock(ownerId: string, id: string) {
    const result = await this.blocks.delete({ id, ownerId });
    if (!result.affected) throw new NotFoundException('That block is no longer there.');
  }

  // ── Retention ──────────────────────────────────────────────────────────────────────────────

  /**
   * Abuse data is kept only as long as it's useful. After the retention period a comment keeps its
   * short device label but loses its IP address (null = unavailable, which never matches anything)
   * and full user agent; guest IP blocks lapse after IP_BLOCK_DAYS. Done in small batches.
   */
  async eraseOldClientInfo() {
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
      let erased = 0;
      for (;;) {
        const result = (await this.comments.query(
          "UPDATE doc_comments SET ip = NULL, userAgent = '' WHERE createdAt < ? AND ip IS NOT NULL LIMIT ?",
          [cutoff, ERASE_BATCH],
        )) as { affectedRows?: number };
        erased += result.affectedRows ?? 0;
        if ((result.affectedRows ?? 0) < ERASE_BATCH) break;
      }
      const lapsed = await this.blocks.delete({
        ip: Not(IsNull()),
        createdAt: LessThan(new Date(Date.now() - IP_BLOCK_DAYS * DAY_MS)),
      });
      if (erased || lapsed.affected) {
        this.logger.log(`retention: erased IP data from ${erased} comments, ${lapsed.affected ?? 0} IP blocks lapsed`);
      }
    } catch (error) {
      this.logger.error(`retention cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────────────────

  /** Bots: the hidden field is filled in, or a guest's form was sent the instant it appeared. */
  private rejectBots(dto: CreateCommentDto, guest: boolean) {
    const tooFast = guest && (dto.elapsedMs === undefined || dto.elapsedMs < LIMITS.guest.minElapsedMs);
    if (dto.website || tooFast) throw new BadRequestException('Your comment couldn’t be posted. Please try again.');
  }

  /** Synchronous: records the write or refuses it. */
  private admitWrite(actor: Actor) {
    const limiter = actor.userId ? this.writes.user : this.writes.guest;
    if (!limiter.tryConsume(writerKey(actor))) {
      throw new HttpException(
        'You’re commenting very fast. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Accounts are blocked by account; guests by IP (so a guest's IP block never locks out signed-in people on that network). */
  private async rejectBlocked(doc: Doc, actor: Actor) {
    if (actor.userId === doc.ownerId) return;
    const blocked = await this.blocks.findOne({
      where: actor.userId
        ? { ownerId: doc.ownerId, userId: actor.userId }
        : { ownerId: doc.ownerId, ip: actor.client.ip },
      select: { id: true },
    });
    if (blocked) throw new ForbiddenException('The author of this page isn’t accepting your comments.');
  }

  /** Same text from the same writer on this page in the last day (survives restarts, unlike the memory guard). */
  private async isDuplicateInDb(docId: string, actor: Actor, body: string, exceptId?: string) {
    const who = actor.userId ? { authorId: actor.userId } : { ip: actor.client.ip, authorId: IsNull() };
    const found = await this.comments.findOne({
      where: {
        ...who,
        docId,
        body,
        createdAt: MoreThan(new Date(Date.now() - DAY_MS)),
        ...(exceptId && { id: Not(exceptId) }),
      },
      select: { id: true },
    });
    return Boolean(found);
  }

  /** Blocks of the owner that match the writers of these comments (for the "Blocked" badge). */
  private blocksFor(ownerId: string, comments: Comment[]) {
    const userIds = [...new Set(comments.map((c) => c.authorId).filter((v): v is string => Boolean(v)))];
    const ips = [...new Set(comments.filter((c) => !c.authorId && c.ip).map((c) => c.ip!))];
    if (!userIds.length && !ips.length) return Promise.resolve([]);
    return this.blocks.find({
      where: [
        ...(userIds.length ? [{ ownerId, userId: In(userIds) }] : []),
        ...(ips.length ? [{ ownerId, ip: In(ips) }] : []),
      ],
    });
  }

  private assertAuthor(comment: Comment, actor: Actor, action: 'edit' | 'delete') {
    if (comment.authorId) {
      if (comment.authorId !== actor.userId) throw new ForbiddenException(`You can only ${action} your own comments.`);
      return;
    }
    const hash = comment.guestTokenHash;
    const ok = Boolean(hash && actor.guestToken && safeEqual(sha256(actor.guestToken), hash));
    if (!ok) throw new ForbiddenException(`You can only ${action} your own comments.`);
    if (Date.now() - comment.createdAt.getTime() > GUEST_EDIT_MS) {
      throw new ForbiddenException(
        `Guest comments can only be changed for 24 hours. Sign in to ${action} comments any time.`,
      );
    }
  }

  /** A comment (with its secret hash) and its document, which must still be public. */
  private async load(id: string) {
    const comment = await this.comments
      .createQueryBuilder('c')
      .addSelect('c.guestTokenHash')
      .leftJoinAndSelect('c.author', 'author')
      .where('c.id = :id', { id })
      .getOne();
    if (!comment) throw new NotFoundException('That comment is no longer here.');
    const doc = await this.docs.findOneBy({ id: comment.docId });
    if (!doc?.publishedAt) throw new NotFoundException('This page is no longer public.');
    return { comment, doc };
  }

  private view(
    c: Comment,
    doc: Doc,
    viewerId: string | undefined,
    isOwner: boolean,
    blocks: CommentBlock[],
  ): CommentView {
    const author: CommentAuthorView =
      c.authorId && c.author
        ? {
            kind: 'user',
            name: c.author.name,
            login: c.author.githubLogin,
            avatarUrl: c.author.avatarUrl,
            isDocAuthor: c.authorId === doc.ownerId,
          }
        : c.guestName
          ? { kind: 'guest', name: c.guestName }
          : { kind: 'gone' };
    return {
      id: c.id,
      parentId: c.parentId,
      body: c.deletedAt ? '' : c.body,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      deleted: Boolean(c.deletedAt),
      author: c.deletedAt ? { kind: 'gone' } : author,
      mine: Boolean(viewerId && c.authorId === viewerId),
      ...(isOwner && {
        hidden: Boolean(c.hiddenAt),
        blocked: blocks.some((b) => (c.authorId ? b.userId === c.authorId : Boolean(c.ip) && b.ip === c.ip)),
        device: c.device,
      }),
    };
  }
}

/** SELECT … FOR UPDATE on one comment, inside the transaction. Reads current data (not a snapshot). */
const lockComment = (m: EntityManager, id: string) =>
  m.getRepository(Comment).createQueryBuilder('c').setLock('pessimistic_write').where('c.id = :id', { id }).getOne();

/** Replies still present, read with a lock so it reflects concurrent inserts. */
const liveReplyCount = (m: EntityManager, rootId: string) =>
  (m.getRepository(Comment).createQueryBuilder('c') as SelectQueryBuilder<Comment>)
    .setLock('pessimistic_read')
    .where('c.parentId = :rootId AND c.deletedAt IS NULL', { rootId })
    .getCount();

const writerKey = (actor: Actor) => (actor.userId ? `u:${actor.userId}` : `ip:${actor.client.ip}`);

/** Pagination cursor: the last item's (createdAt, id). */
const encodeCursor = (c: Comment) => Buffer.from(`${c.createdAt.toISOString()}|${c.id}`).toString('base64url');

function decodeCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const date = new Date(at ?? '');
  if (!id || Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/.test(id))
    throw new BadRequestException('Invalid cursor.');
  return { at: date, id };
}

/** Trim, drop control / zero-width characters, and collapse runs of blank lines. */
function normalize(text: string) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/** URLs, www. addresses and bare domains (each counted once). */
const countLinks = (text: string) =>
  (
    text.match(
      /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|vn|xyz|top|ru|cn|info|biz|me|co|app|link|click)\b/gi,
    ) ?? []
  ).length;

const tooManyLinks = (max: number) => `Too many links — at most ${max} per comment.`;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
