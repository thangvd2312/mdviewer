import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Doc } from '../docs/doc.entity';
import { Project } from '../projects/project.entity';
import { SavedPost } from './saved-post.entity';
import { SavedQuery } from './saved.dto';

const readMinutes = (words: number) => Math.max(1, Math.round(words / 220));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

/** Public posts a signed-in reader keeps to read later. */
@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedPost) private readonly saved: Repository<SavedPost>,
    @InjectRepository(Doc) private readonly docs: Repository<Doc>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  /** Slugs of everything the reader saved (to mark posts in lists). */
  async slugs(userId: string): Promise<string[]> {
    const rows = await this.saved.find({ where: { userId }, select: { slug: true } });
    return rows.map((r) => r.slug);
  }

  async list(userId: string, q: SavedQuery) {
    const limit = q.limit ?? 30;
    const qb = this.saved
      .createQueryBuilder('s')
      .leftJoin(Doc, 'd', 'd.id = s.docId')
      .leftJoin('d.owner', 'u')
      .select([
        's.slug AS slug',
        's.title AS savedTitle',
        's.createdAt AS savedAt',
        's.readAt AS readAt',
        'd.publishedAt AS publishedAt',
        // What the blog shows (sensitive parts hidden), never the author's original.
        'd.publicTitle AS title',
        'd.publicExcerpt AS excerpt',
        'd.wordCount AS wordCount',
        'u.name AS authorName',
        'u.githubLogin AS authorLogin',
        'u.avatarUrl AS authorAvatar',
      ])
      .where('s.userId = :userId', { userId });
    const status = q.status ?? 'unread';
    if (status === 'unread') qb.andWhere('s.readAt IS NULL');
    if (status === 'read') qb.andWhere('s.readAt IS NOT NULL');
    const rows = await qb
      .orderBy(status === 'read' ? 's.readAt' : 's.createdAt', 'DESC')
      .offset(q.offset ?? 0)
      .limit(limit + 1)
      .getRawMany<Record<string, unknown>>();

    const [unread, total] = await Promise.all([
      this.saved.count({ where: { userId, readAt: IsNull() } }),
      this.saved.count({ where: { userId } }),
    ]);
    return {
      items: rows.slice(0, limit).map((r) => {
        const available = r.publishedAt != null;
        return {
          slug: String(r.slug),
          title: available ? String(r.title) : String(r.savedTitle),
          available,
          excerpt: available ? String(r.excerpt ?? '') : null,
          readMinutes: available ? readMinutes(Number(r.wordCount ?? 0)) : null,
          author: available
            ? {
                name: String(r.authorName),
                login: (r.authorLogin as string | null) ?? null,
                avatarUrl: (r.authorAvatar as string | null) ?? null,
              }
            : null,
          savedAt: iso(r.savedAt),
          readAt: r.readAt ? iso(r.readAt) : null,
        };
      }),
      hasMore: rows.length > limit,
      counts: { unread, read: total - unread },
    };
  }

  /** Save a public post (again: nothing changes). */
  async save(userId: string, slug: string) {
    const doc = await this.docs.findOne({
      where: { slug, publishedAt: Not(IsNull()) },
      select: { id: true, slug: true, publicTitle: true },
    });
    if (!doc) throw new NotFoundException('This page doesn’t exist or is no longer public.');
    await this.insert(userId, [doc]);
  }

  async remove(userId: string, slug: string) {
    await this.saved.delete({ userId, slug });
  }

  async setRead(userId: string, slug: string, read: boolean) {
    const res = await this.saved.update({ userId, slug }, { readAt: read ? new Date() : null });
    if (!res.affected) throw new NotFoundException('That post isn’t in your saved list.');
  }

  /** Save every public part of a series. */
  async saveSeries(userId: string, seriesSlug: string) {
    const parts = await this.seriesParts(seriesSlug);
    await this.insert(userId, parts);
    return { saved: parts.length };
  }

  /** Remove the series' parts from the reader's list. */
  async removeSeries(userId: string, seriesSlug: string) {
    const parts = await this.seriesParts(seriesSlug);
    if (parts.length) await this.saved.delete({ userId, docId: In(parts.map((p) => p.id)) });
  }

  /** How many readers saved this doc (shown to its author only). */
  countFor(docId: string) {
    return this.saved.count({ where: { docId } });
  }

  private async seriesParts(seriesSlug: string) {
    const project = await this.projects.findOne({ where: { slug: seriesSlug }, select: { id: true, publishedAt: true } });
    if (!project?.publishedAt) throw new NotFoundException('This series doesn’t exist or is no longer public.');
    return this.docs.find({
      where: { projectId: project.id, publishedAt: Not(IsNull()) },
      select: { id: true, slug: true, publicTitle: true },
    });
  }

  private async insert(userId: string, docs: Pick<Doc, 'id' | 'slug' | 'publicTitle'>[]) {
    if (docs.length === 0) return;
    const now = new Date();
    await this.saved
      .createQueryBuilder()
      .insert()
      .values(docs.map((d) => ({ userId, docId: d.id, slug: d.slug!, title: d.publicTitle, createdAt: now })))
      .orIgnore() // already saved: keep the original date and read state
      .execute();
  }
}
