import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnotationsModule } from '../annotations/annotations.module';
import { Message } from '../assistant/conversation.entity';
import { AssistantModule } from '../assistant/assistant.module';
import { Doc } from '../docs/doc.entity';
import { DocsModule } from '../docs/docs.module';
import { ReviewController } from './review.controller';
import { ReviewCard, ReviewEvent } from './review.entity';
import { ReviewService } from './review.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewCard, ReviewEvent, Message, Doc]),
    DocsModule,
    AnnotationsModule,
    AssistantModule,
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
