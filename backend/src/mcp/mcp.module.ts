import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsModule } from '../docs/docs.module';
import { ProjectsModule } from '../projects/projects.module';
import { ApiToken } from '../tokens/api-token.entity';
import { TokensController } from '../tokens/tokens.controller';
import { TokensService } from '../tokens/tokens.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiToken]), DocsModule, ProjectsModule],
  controllers: [McpController, TokensController],
  providers: [McpService, TokensService],
})
export class McpModule {}
