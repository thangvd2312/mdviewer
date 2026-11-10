import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doc } from '../docs/doc.entity';
import { Project } from '../projects/project.entity';
import { SavedPost } from './saved-post.entity';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPost, Doc, Project])],
  controllers: [SavedController],
  providers: [SavedService],
  exports: [SavedService],
})
export class SavedModule {}
