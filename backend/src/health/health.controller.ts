import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthDto } from './health.dto';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: DataSource) {}

  /** `{ status: "ok" }` when the API and its database answer. */
  @Get()
  async check(): Promise<HealthDto> {
    await this.db.query('SELECT 1');
    return { status: 'ok' };
  }
}
