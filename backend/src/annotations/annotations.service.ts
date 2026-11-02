import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocsService } from '../docs/docs.service';
import { Annotation } from './annotation.entity';
import { CreateAnnotationDto, UpdateAnnotationDto } from './annotations.dto';

@Injectable()
export class AnnotationsService {
  constructor(
    @InjectRepository(Annotation) private readonly annotations: Repository<Annotation>,
    private readonly docs: DocsService,
  ) {}

  async listForDoc(ownerId: string, docId: string) {
    await this.docs.findOwned(ownerId, docId);
    return this.annotations.find({ where: { ownerId, docId }, order: { position: 'ASC', createdAt: 'ASC' } });
  }

  async create(ownerId: string, docId: string, dto: CreateAnnotationDto) {
    await this.docs.findOwned(ownerId, docId);
    const now = new Date();
    return this.annotations.save(
      this.annotations.create({
        ownerId,
        docId,
        kind: dto.kind ?? 'note',
        quote: dto.quote,
        prefix: dto.prefix ?? '',
        suffix: dto.suffix ?? '',
        position: dto.position ?? 0,
        body: dto.body ?? '',
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async update(ownerId: string, id: string, dto: UpdateAnnotationDto) {
    const annotation = await this.find(ownerId, id);
    if (dto.kind !== undefined) annotation.kind = dto.kind;
    if (dto.body !== undefined) annotation.body = dto.body;
    annotation.updatedAt = new Date();
    return this.annotations.save(annotation);
  }

  async remove(ownerId: string, id: string) {
    const annotation = await this.find(ownerId, id);
    await this.annotations.delete({ id: annotation.id });
  }

  private async find(ownerId: string, id: string) {
    const annotation = await this.annotations.findOneBy({ id, ownerId });
    if (!annotation) throw new NotFoundException('Note not found');
    return annotation;
  }
}
