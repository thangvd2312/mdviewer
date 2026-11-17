import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

/** How deep projects can be nested (a top-level project is level 1). */
export const MAX_PROJECT_DEPTH = 5;

@Injectable()
export class ProjectsService {
  constructor(@InjectRepository(Project) private readonly projects: Repository<Project>) {}

  list(ownerId: string) {
    return this.projects.find({ where: { ownerId }, order: { name: 'ASC' } });
  }

  async get(ownerId: string, id: string) {
    const project = await this.projects.findOneBy({ id, ownerId });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(ownerId: string, dto: CreateProjectDto) {
    const parentId = dto.parentId ?? null;
    if (parentId) this.checkParent(await this.list(ownerId), null, parentId);
    return this.projects.save(
      this.projects.create({
        ownerId,
        name: dto.name,
        description: dto.description || null,
        icon: dto.icon ?? '📁',
        parentId,
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.get(ownerId, id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description || null;
    if (dto.icon !== undefined) project.icon = dto.icon;
    if (dto.parentId !== undefined && dto.parentId !== project.parentId) {
      if (dto.parentId) this.checkParent(await this.list(ownerId), project.id, dto.parentId);
      project.parentId = dto.parentId;
    }
    return this.projects.save(project);
  }

  /**
   * Deleting a project also deletes its documents (FK cascade). Its sub-projects (with their documents)
   * are kept and move up to where it was.
   */
  async remove(ownerId: string, id: string) {
    const project = await this.get(ownerId, id);
    await this.projects.manager.transaction(async (em) => {
      await em.update(Project, { ownerId, parentId: project.id }, { parentId: project.parentId });
      await em.delete(Project, { id: project.id, ownerId });
    });
  }

  /**
   * Whether `projectId` (null = a new project) may go inside `parentId`: the parent must be the user's,
   * not the project itself or one of its sub-projects, and the result no deeper than MAX_PROJECT_DEPTH.
   */
  private checkParent(all: Project[], projectId: string | null, parentId: string) {
    const byId = new Map(all.map((p) => [p.id, p]));
    if (!byId.has(parentId)) throw new NotFoundException('Parent project not found');

    // Levels above: the parent and its ancestors (stopping at a cycle left by bad data).
    let above = 0;
    const seen = new Set<string>();
    for (let p = byId.get(parentId); p && !seen.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) {
      if (p.id === projectId) throw new BadRequestException('A project can’t go inside itself or its own sub-projects');
      seen.add(p.id);
      above++;
    }

    // Levels the moved project brings along: itself and its deepest sub-project.
    const children = new Map<string, Project[]>();
    for (const p of all) if (p.parentId) children.set(p.parentId, [...(children.get(p.parentId) ?? []), p]);
    const height = (id: string, depth = 0): number =>
      depth > all.length ? 0 : 1 + Math.max(0, ...(children.get(id) ?? []).map((c) => height(c.id, depth + 1)));
    const own = projectId ? height(projectId) : 1;

    if (above + own > MAX_PROJECT_DEPTH)
      throw new BadRequestException(`Projects can be nested at most ${MAX_PROJECT_DEPTH} levels deep`);
  }
}

/** Each project's full name with the projects it sits in, e.g. "AWS / ECS". */
export function projectPaths(all: Pick<Project, 'id' | 'name' | 'parentId'>[]) {
  const byId = new Map(all.map((p) => [p.id, p]));
  const paths = new Map<string, string>();
  for (const project of all) {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let p: typeof project | undefined = project; p && !seen.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) {
      seen.add(p.id);
      names.unshift(p.name);
    }
    paths.set(project.id, names.join(' / '));
  }
  return paths;
}
