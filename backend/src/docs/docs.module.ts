import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module';
import { Doc } from './doc.entity';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Doc]), ProjectsModule],
  controllers: [DocsController],
  providers: [DocsService],
})
export class DocsModule {}
