import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

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

  create(ownerId: string, dto: CreateProjectDto) {
    return this.projects.save(
      this.projects.create({
        ownerId,
        name: dto.name,
        description: dto.description || null,
        icon: dto.icon ?? '📁',
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.get(ownerId, id);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description || null;
    if (dto.icon !== undefined) project.icon = dto.icon;
    return this.projects.save(project);
  }

  /** Deleting a project also deletes its documents (FK cascade). */
  async remove(ownerId: string, id: string) {
    const project = await this.get(ownerId, id);
    await this.projects.remove(project);
  }
}
