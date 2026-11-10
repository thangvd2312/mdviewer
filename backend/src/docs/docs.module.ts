import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { Doc } from './doc.entity';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { SeriesController } from './series.controller';
import { SeriesService } from './series.service';

@Module({
  imports: [TypeOrmModule.forFeature([Doc, Project]), ProjectsModule],
  controllers: [DocsController, SeriesController],
  providers: [DocsService, SeriesService],
  exports: [DocsService],
})
export class DocsModule {}
