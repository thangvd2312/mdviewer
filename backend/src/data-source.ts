// TypeORM CLI entry (migrations only). The app itself configures TypeORM in app.module.ts.
//   npm run migration:generate -- src/migrations/<Name>   (against a database that matches the current schema)
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Doc } from './docs/doc.entity';
import { Project } from './projects/project.entity';
import { User } from './users/user.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4_unicode_ci',
  entities: [User, Project, Doc],
  migrations: [__dirname + '/migrations/*.js'],
});
