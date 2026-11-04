import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { adminSet, isAdmin } from '../auth/admins';
import { AuthGuard, type AuthUser } from '../auth/auth.guard';
import { User } from '../users/user.entity';
import { CuratorService } from './curator.service';

class RunDto {
  /** How many posts to write this time (defaults to the daily number). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  count?: number;
}

/** Only site admins (ADMIN_USERS) may run the curator. */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly admins: Set<string>;
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.admins = adminSet(config);
  }

  async canActivate(ctx: ExecutionContext) {
    const { user } = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const u =
      user && (await this.users.findOne({ where: { id: user.id }, select: { githubLogin: true, email: true } }));
    if (!u || !isAdmin(this.admins, u)) throw new ForbiddenException('Admins only.');
    return true;
  }
}

@Controller('curator')
@UseGuards(AuthGuard, AdminGuard)
export class CuratorController {
  constructor(private readonly curator: CuratorService) {}

  @Get()
  status() {
    return this.curator.status();
  }

  /** Start a run now (finds, judges and writes today's posts). */
  @Post('run')
  @HttpCode(202)
  async run(@Body() dto: RunDto) {
    const run = await this.curator.start('manual', { count: dto.count });
    return { runId: run.id };
  }

  @Get('articles/:id')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.curator.preview(id);
  }

  @Post('articles/:id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.curator.setPublished(id, true);
  }

  @Post('articles/:id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.curator.setPublished(id, false);
  }

  /** Research and write this article again (or for the first time, if it was rejected). */
  @Post('articles/:id/rewrite')
  @HttpCode(202)
  rewrite(@Param('id', ParseUUIDPipe) id: string) {
    return this.curator.rewrite(id);
  }
}
