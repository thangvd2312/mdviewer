import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocsModule } from './docs/docs.module';
import { HealthController } from './health/health.controller';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', '127.0.0.1'),
        port: Number(config.get('DB_PORT', 3306)),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        charset: 'utf8mb4_unicode_ci',
        autoLoadEntities: true,
        // Dev: DB_SYNC=true creates tables from entities. Production: DB_SYNC=false + DB_MIGRATIONS_RUN=true.
        synchronize: config.get('DB_SYNC') === 'true',
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: config.get('DB_MIGRATIONS_RUN') === 'true',
      }),
    }),
    AuthModule,
    ProjectsModule,
    DocsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
