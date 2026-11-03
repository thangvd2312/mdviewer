import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnotationsModule } from '../annotations/annotations.module';
import { DocsModule } from '../docs/docs.module';
import { ProjectsModule } from '../projects/projects.module';
import { User } from '../users/user.entity';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { Conversation, Message } from './conversation.entity';
import { ConversationsService } from './conversations.service';
import { QuotaService } from './quota.service';
import { Usage } from './usage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Usage, User]), DocsModule, ProjectsModule, AnnotationsModule],
  controllers: [AssistantController],
  providers: [AssistantService, ConversationsService, QuotaService],
})
export class AssistantModule {}
