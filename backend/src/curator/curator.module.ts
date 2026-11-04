import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantModule } from '../assistant/assistant.module';
import { AuthModule } from '../auth/auth.module';
import { DocsModule } from '../docs/docs.module';
import { User } from '../users/user.entity';
import { AdminGuard, CuratorController } from './curator.controller';
import { CuratedArticle, CuratorRun } from './curator.entity';
import { CuratorService } from './curator.service';

@Module({
  imports: [TypeOrmModule.forFeature([CuratedArticle, CuratorRun, User]), AuthModule, DocsModule, AssistantModule],
  controllers: [CuratorController],
  providers: [CuratorService, AdminGuard],
})
export class CuratorModule {}
