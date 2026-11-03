import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Doc } from "../docs/doc.entity";
import { Comment, CommentBlock } from "./comment.entity";
import { CommentsService } from "./comments.service";
import { PublicController } from "./public.controller";
import { PublicDocsService } from "./public-docs.service";
import { SameSiteWriteGuard } from "./same-site-write.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Doc, Comment, CommentBlock])],
  controllers: [PublicController],
  providers: [PublicDocsService, CommentsService, SameSiteWriteGuard],
  exports: [PublicDocsService],
})
export class PublicModule {}
