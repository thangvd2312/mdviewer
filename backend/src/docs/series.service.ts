import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Doc } from './doc.entity';
import { DocsService } from './docs.service';
import { slugify } from './markdown.util';
import { redactText } from './redact';
import { ReorderDto, SeriesSharingDto } from './series.dto';

/** A project published as a series: its public documents, in the project's order, on one page of the blog. */
@Injectable()
export class SeriesService {
  constructor(
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
    @InjectRepository(Doc) private readonly docsRepo: Repository<Doc>,
    private readonly projects: ProjectsService,
    private readonly docs: DocsService,
  ) {}

  async setSharing(ownerId: string, id: string, dto: SeriesSharingDto) {
    const project = await this.projects.get(ownerId, id);
    if (dto.publicDocIds) {
      // Publish the chosen documents and unpublish the rest; ids from outside the project are ignored.
      const want = new Set(dto.publicDocIds);
      const docs = await this.docsRepo.find({
        where: { ownerId, projectId: id },
        select: { id: true, publishedAt: true },
      });
      for (const d of docs) {
        const isPublic = d.publishedAt !== null;
        if (want.has(d.id) !== isPublic) await this.docs.setSharing(ownerId, d.id, { public: !isPublic });
      }
    }
    if (!dto.public) {
      await this.projectsRepo.update({ id, ownerId }, { publishedAt: null });
      return this.projects.get(ownerId, id);
    }
    // First publish: a slug from the name as the public sees it, kept for good (same as docs).
    for (let attempt = 0; !project.slug; attempt++) {
      const slug = `${slugify(redactText(project.name))}-${randomBytes(4).toString('hex').slice(0, 6)}`;
      try {
        await this.projectsRepo.update({ id, ownerId, slug: IsNull() }, { slug });
        break;
      } catch (error) {
        if (attempt < 3 && error instanceof QueryFailedError && /Duplicate entry/.test(error.message)) continue;
        throw error;
      }
    }
    await this.projectsRepo.update({ id, ownerId, publishedAt: IsNull() }, { publishedAt: new Date() });
    return this.projects.get(ownerId, id);
  }

  /** Puts the given documents first, in this order; the rest follow by title. */
  async reorder(ownerId: string, id: string, dto: ReorderDto) {
    await this.projects.get(ownerId, id);
    const ids = [...new Set(dto.docIds)];
    await this.docsRepo.manager.transaction(async (m) => {
      await m.update(Doc, { ownerId, projectId: id }, { position: null });
      // Only this project's documents: ids from elsewhere match nothing.
      for (const [i, docId] of ids.entries()) await m.update(Doc, { id: docId, ownerId, projectId: id }, { position: i });
    });
  }
}
