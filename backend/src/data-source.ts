// TypeORM CLI entry (migrations only). The app itself configures TypeORM in app.module.ts.
//   npm run migration:generate -- src/migrations/<Name>   (against a database that matches the current schema)
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Annotation } from './annotations/annotation.entity';
import { Conversation, Message } from './assistant/conversation.entity';
import { Usage } from './assistant/usage.entity';
import { Comment, CommentBlock } from './public/comment.entity';
import { ApiToken } from './tokens/api-token.entity';
import { ReviewCard, ReviewEvent } from './review/review.entity';
import { Doc } from './docs/doc.entity';
import { Project } from './projects/project.entity';
import { SavedPost } from './saved/saved-post.entity';
import { User } from './users/user.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_unicode_ci',
  entities: [User, Project, Doc, Annotation, Conversation, Message, Usage, Comment, CommentBlock, ApiToken, ReviewCard, ReviewEvent, SavedPost],
  migrations: [__dirname + '/migrations/*.js'],
});
