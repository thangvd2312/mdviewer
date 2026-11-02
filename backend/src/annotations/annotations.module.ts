import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsModule } from '../docs/docs.module';
import { Annotation } from './annotation.entity';
import { AnnotationsController } from './annotations.controller';
import { AnnotationsService } from './annotations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Annotation]), DocsModule],
  controllers: [AnnotationsController],
  providers: [AnnotationsService],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
