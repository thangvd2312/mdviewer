import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Brackets, IsNull, Not, QueryFailedError, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { Doc } from './doc.entity';
import { CreateDocDto, ListDocsQuery, SharingDto, UpdateDocDto } from './docs.dto';
import { countWords, deriveTitle, makeExcerpt, slugify } from './markdown.util';
import { publicFields, redactedContent, redactMarkdown } from './redact';

const SUMMARY_COLUMNS = [
  'id',
  'projectId',
  'title',
  'excerpt',
  'createdAt',
  'updatedAt',
  'lastOpenedAt',
  'slug',
  'publishedAt',
  'allowComments',
] as const;

/** Fields computed on every save: summary and length, and what the blog shows (sensitive parts hidden). */
export const derived = (title: string, content: string) => ({
  excerpt: makeExcerpt(content),
  wordCount: countWords(content),
  ...publicFields(title, content),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

@Injectable()
export class DocsService {
  constructor(
    @InjectRepository(Doc) private readonly docs: Repository<Doc>,
    private readonly projects: ProjectsService,
  ) {}

  list(ownerId: string, query: ListDocsQuery) {
    const qb = this.docs
      .createQueryBuilder('d')
      .select(SUMMARY_COLUMNS.map((c) => `d.${c}`))
      .where('d.ownerId = :ownerId', { ownerId });

    if (query.projectId) qb.andWhere('d.projectId = :projectId', { projectId: query.projectId });
    else if (query.scope === 'loose') qb.andWhere('d.projectId IS NULL');

    if (query.q) {
      const like = `%${escapeLike(query.q)}%`;
      qb.andWhere(
        new Brackets((w) => w.where('d.title LIKE :like', { like }).orWhere('d.content LIKE :like', { like })),
      );
    }

    switch (query.sort ?? 'recent') {
      case 'recent':
        qb.orderBy('d.lastOpenedAt', 'DESC');
        break;
      case 'updated':
        qb.orderBy('d.updatedAt', 'DESC');
        break;
      case 'title':
        qb.orderBy('d.title', 'ASC');
        break;
    }
    return qb.take(query.limit ?? 500).getMany();
  }

  /** Returns the full document and records that it was opened. */
  async open(ownerId: string, id: string) {
    const doc = await this.find(ownerId, id);
    doc.lastOpenedAt = new Date();
    await this.docs.update({ id }, { lastOpenedAt: doc.lastOpenedAt });
    return doc;
  }

  async create(ownerId: string, dto: CreateDocDto) {
    if (dto.projectId) await this.projects.get(ownerId, dto.projectId);
    const now = new Date();
    const title = dto.title || deriveTitle(dto.content);
    return this.docs.save(
      this.docs.create({
        ownerId,
        projectId: dto.projectId ?? null,
        title,
        content: dto.content,
        ...derived(title, dto.content),
        updatedAt: now,
        lastOpenedAt: now,
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpdateDocDto) {
    const doc = await this.find(ownerId, id);
    if (dto.projectId) await this.projects.get(ownerId, dto.projectId);

    // Write only the fields an edit changes. Saving the whole loaded entity would write back stale
    // sharing state (e.g. re-publish a doc that was unpublished while it was being edited).
    const patch: Partial<Doc> = {};
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.title !== undefined) patch.title = dto.title || deriveTitle(dto.content ?? doc.content);
    if (patch.content !== undefined || patch.title !== undefined) {
      Object.assign(patch, derived(patch.title ?? doc.title, patch.content ?? doc.content));
    }
    if (dto.projectId !== undefined) patch.projectId = dto.projectId;
    patch.updatedAt = patch.lastOpenedAt = new Date();
    await this.docs.update({ id, ownerId }, patch);
    return this.find(ownerId, id);
  }

  /** Publish / unpublish, and turn comments on or off. Each change is a conditional, single-column write. */
  async setSharing(ownerId: string, id: string, dto: SharingDto) {
    const doc = await this.find(ownerId, id);
    if (dto.allowComments !== undefined) await this.docs.update({ id, ownerId }, { allowComments: dto.allowComments });
    if (dto.public === false) await this.docs.update({ id, ownerId }, { publishedAt: null });
    if (dto.public === true) {
      // First publish: assign a slug only if none exists yet, so concurrent publishes agree on one link.
      // Random suffix keeps slugs unique and unguessable from the title alone; retry on the rare clash.
      for (let attempt = 0; !doc.slug; attempt++) {
        // From the public title: a link must not carry what the page hides.
        const slug = `${slugify(doc.publicTitle || 'doc')}-${randomBytes(4).toString('hex').slice(0, 6)}`;
        try {
          await this.docs.update({ id, ownerId, slug: IsNull() }, { slug });
          break;
        } catch (error) {
          if (attempt < 3 && error instanceof QueryFailedError && /Duplicate entry/.test(error.message)) continue;
          throw error;
        }
      }
      // Keep the original publish date when it's already public.
      await this.docs.update({ id, ownerId, publishedAt: IsNull() }, { publishedAt: new Date() });
    }
    return this.find(ownerId, id);
  }

  /**
   * A doc the user may read: their own, or anyone's public one — then as the public sees it, with
   * sensitive parts hidden (it goes to the reading assistant). 404 otherwise.
   */
  async findReadable(userId: string, id: string) {
    const doc = await this.docs.findOne({
      where: [
        { id, ownerId: userId },
        { id, publishedAt: Not(IsNull()) },
      ],
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId === userId) return doc;
    return {
      ...doc,
      title: doc.publicTitle,
      excerpt: doc.publicExcerpt,
      content: redactedContent(`${doc.id}:${doc.updatedAt.getTime()}`, doc.content),
    };
  }

  /** What publishing hides from readers: secrets, personal data and the parts marked private. */
  async sensitive(ownerId: string, id: string) {
    const doc = await this.find(ownerId, id);
    const { findings } = redactMarkdown(doc.content);
    return { title: doc.publicTitle, findings };
  }

  async remove(ownerId: string, id: string) {
    const doc = await this.find(ownerId, id);
    await this.docs.delete({ id: doc.id });
  }

  /** Full document, without touching `lastOpenedAt`. Throws 404 unless the user owns it. */
  findOwned(ownerId: string, id: string) {
    return this.find(ownerId, id);
  }

  private async find(ownerId: string, id: string) {
    const doc = await this.docs.findOneBy({ id, ownerId });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
}
