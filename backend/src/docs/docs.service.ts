import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { Doc } from './doc.entity';
import { CreateDocDto, ListDocsQuery, UpdateDocDto } from './docs.dto';
import { deriveTitle, makeExcerpt } from './markdown.util';

const SUMMARY_COLUMNS = ['id', 'projectId', 'title', 'excerpt', 'createdAt', 'updatedAt', 'lastOpenedAt'] as const;

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
      qb.andWhere(new Brackets((w) => w.where('d.title LIKE :like', { like }).orWhere('d.content LIKE :like', { like })));
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
    return this.docs.save(
      this.docs.create({
        ownerId,
        projectId: dto.projectId ?? null,
        title: dto.title || deriveTitle(dto.content),
        content: dto.content,
        excerpt: makeExcerpt(dto.content),
        updatedAt: now,
        lastOpenedAt: now,
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpdateDocDto) {
    const doc = await this.find(ownerId, id);
    if (dto.projectId) await this.projects.get(ownerId, dto.projectId);

    if (dto.content !== undefined) {
      doc.content = dto.content;
      doc.excerpt = makeExcerpt(dto.content);
    }
    if (dto.title !== undefined) doc.title = dto.title || deriveTitle(doc.content);
    if (dto.projectId !== undefined) doc.projectId = dto.projectId;
    doc.updatedAt = doc.lastOpenedAt = new Date();
    // Drop the relation object so TypeORM uses the projectId column as-is.
    const { project: _project, ...row } = doc;
    await this.docs.save(row);
    return row;
  }

  async remove(ownerId: string, id: string) {
    const doc = await this.find(ownerId, id);
    await this.docs.delete({ id: doc.id });
  }

  private async find(ownerId: string, id: string) {
    const doc = await this.docs.findOneBy({ id, ownerId });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }
}
