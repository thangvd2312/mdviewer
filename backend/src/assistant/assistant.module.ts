import { Module } from '@nestjs/common';
import { AnnotationsModule } from '../annotations/annotations.module';
import { DocsModule } from '../docs/docs.module';
import { ProjectsModule } from '../projects/projects.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [DocsModule, ProjectsModule, AnnotationsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
