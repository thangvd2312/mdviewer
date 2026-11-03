import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { Doc } from "../docs/doc.entity";
import { Comment } from "./comment.entity";
import { ExploreQuery } from "./public.dto";

export interface PublicAuthor {
  name: string;
  login: string | null;
  avatarUrl: string | null;
}

export interface PublicDocSummary {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
  author: PublicAuthor;
}

/** A view from the same reader counts once per this window. */
const VIEW_DEDUPE_MS = 6 * 3600_000;

/**
 * Crawlers, link-preview fetchers and scripts don't count as reads ("bot" covers Googlebot,
 * TelegramBot, Discordbot, Slackbot…). In-app browsers of chat apps (Zalo, Facebook) are real
 * readers and must not match.
 */
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|embedly|WhatsApp\/|curl\/|wget|python-|httpclient|axios|node-fetch|headless/i;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/** Published documents as the public sees them: Explore, the reading page, link previews. */
@Injectable()
export class PublicDocsService {
  private readonly recentViews = new Map<string, number>();

  constructor(@InjectRepository(Doc) private readonly docs: Repository<Doc>) {}

  async list(
    query: ExploreQuery,
  ): Promise<{ items: PublicDocSummary[]; hasMore: boolean }> {
    const limit = query.limit ?? 20;
    const qb = this.docs
      .createQueryBuilder("d")
      .innerJoin("d.owner", "u")
      .select([
        "d.slug AS slug",
        "d.title AS title",
        "d.excerpt AS excerpt",
        "d.publishedAt AS publishedAt",
        "d.updatedAt AS updatedAt",
        "d.viewCount AS viewCount",
        "u.name AS authorName",
        "u.githubLogin AS authorLogin",
        "u.avatarUrl AS authorAvatar",
      ])
      .addSelect(
        (sub) =>
          sub
            .select("COUNT(*)")
            .from(Comment, "c")
            .leftJoin(Comment, "p", "p.id = c.parentId")
            .where(
              "c.docId = d.id AND c.deletedAt IS NULL AND c.hiddenAt IS NULL AND p.hiddenAt IS NULL",
            ),
        "commentCount",
      )
      .where("d.publishedAt IS NOT NULL");

    if (query.q) {
      const like = `%${escapeLike(query.q)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where("d.title LIKE :like", { like })
            .orWhere("d.excerpt LIKE :like", { like }),
        ),
      );
    }
    if (query.author)
      qb.andWhere("u.githubLogin = :author", { author: query.author });

    if (query.sort === "popular")
      qb.orderBy("d.viewCount", "DESC").addOrderBy("d.publishedAt", "DESC");
    else qb.orderBy("d.publishedAt", "DESC");

    const rows = await qb
      .offset(query.offset ?? 0)
      .limit(limit + 1)
      .getRawMany<Record<string, unknown>>();
    return {
      items: rows.slice(0, limit).map(toSummary),
      hasMore: rows.length > limit,
    };
  }

  /** The published doc behind a slug, with its author. 404 if missing or not public. */
  async get(slug: string) {
    const doc = await this.docs.findOne({
      where: { slug },
      relations: { owner: true },
    });
    if (!doc || !doc.publishedAt)
      throw new NotFoundException(
        "This page doesn’t exist or is no longer public.",
      );
    return doc as Doc & { publishedAt: Date; slug: string };
  }

  /** The reading page: the doc plus who may do what. Counts a view (once per reader per few hours). */
  async read(
    slug: string,
    viewer: { userId?: string; ip: string; userAgent: string },
  ) {
    const doc = await this.get(slug);
    const isOwner = viewer.userId === doc.ownerId;
    if (
      !isOwner &&
      !BOT_UA.test(viewer.userAgent) &&
      this.firstViewInWindow(`${doc.id}|${viewer.userId ?? viewer.ip}`)
    ) {
      await this.docs.increment({ id: doc.id }, "viewCount", 1);
      doc.viewCount += 1;
    }
    return {
      id: doc.id,
      slug: doc.slug!,
      title: doc.title,
      excerpt: doc.excerpt,
      content: doc.content,
      publishedAt: doc.publishedAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      viewCount: doc.viewCount,
      commentCount: await this.visibleCommentCount(doc.id),
      allowComments: doc.allowComments,
      isOwner,
      author: author(doc.owner),
    };
  }

  /** Title and description for link previews (Open Graph), or null if the slug isn't public. */
  async meta(slug: string) {
    const doc = await this.docs.findOne({
      where: { slug },
      relations: { owner: true },
      select: {
        id: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        owner: { name: true },
      },
    });
    if (!doc?.publishedAt) return null;
    return {
      title: doc.title,
      description: doc.excerpt,
      author: doc.owner.name,
    };
  }

  /** Comments the public sees: not deleted, not hidden, and not replies to a hidden comment. */
  visibleCommentCount(docId: string) {
    return this.docs.manager
      .createQueryBuilder(Comment, "c")
      .leftJoin(Comment, "p", "p.id = c.parentId")
      .where(
        "c.docId = :docId AND c.deletedAt IS NULL AND c.hiddenAt IS NULL AND p.hiddenAt IS NULL",
        { docId },
      )
      .getCount();
  }

  private firstViewInWindow(key: string) {
    const now = Date.now();
    const last = this.recentViews.get(key);
    if (last && now - last < VIEW_DEDUPE_MS) return false;
    if (this.recentViews.size > 20_000) {
      for (const [k, t] of this.recentViews)
        if (now - t >= VIEW_DEDUPE_MS) this.recentViews.delete(k);
      if (this.recentViews.size > 20_000) this.recentViews.clear();
    }
    this.recentViews.set(key, now);
    return true;
  }
}

export const author = (u: {
  name: string;
  githubLogin: string | null;
  avatarUrl: string | null;
}): PublicAuthor => ({
  name: u.name,
  login: u.githubLogin,
  avatarUrl: u.avatarUrl,
});

const iso = (v: unknown) =>
  v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();

function toSummary(r: Record<string, unknown>): PublicDocSummary {
  return {
    slug: String(r.slug),
    title: String(r.title),
    excerpt: String(r.excerpt ?? ""),
    publishedAt: iso(r.publishedAt),
    updatedAt: iso(r.updatedAt),
    viewCount: Number(r.viewCount ?? 0),
    commentCount: Number(r.commentCount ?? 0),
    author: {
      name: String(r.authorName),
      login: (r.authorLogin as string | null) ?? null,
      avatarUrl: (r.authorAvatar as string | null) ?? null,
    },
  };
}
