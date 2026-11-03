import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { ApiToken } from './api-token.entity';

const PREFIX = 'vmd_';
const MAX_TOKENS = 20;
/** lastUsedAt is written at most this often per token. */
const TOUCH_EVERY_MS = 60_000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class TokensService {
  private readonly touched = new Map<string, number>();

  constructor(@InjectRepository(ApiToken) private readonly tokens: Repository<ApiToken>) {}

  list(ownerId: string) {
    return this.tokens.find({ where: { ownerId }, order: { createdAt: 'DESC' } });
  }

  /** Creates a token; the secret is returned only here. */
  async create(ownerId: string, name: string) {
    if ((await this.tokens.count({ where: { ownerId } })) >= MAX_TOKENS) {
      throw new BadRequestException(`You can have at most ${MAX_TOKENS} tokens. Revoke one you no longer use.`);
    }
    const token = PREFIX + randomBytes(32).toString('base64url');
    const saved = await this.tokens.save(
      this.tokens.create({
        ownerId,
        name: name.trim().slice(0, 100) || 'Agent',
        tokenHash: sha256(token),
        prefix: token.slice(0, PREFIX.length + 4),
        createdAt: new Date(),
        lastUsedAt: null,
      }),
    );
    const { tokenHash: _hash, ...meta } = saved;
    return { ...meta, token };
  }

  async revoke(ownerId: string, id: string) {
    const result = await this.tokens.delete({ id, ownerId });
    if (!result.affected) throw new NotFoundException('That token is no longer there.');
  }

  /** The token's id and owner, or null if it's unknown or revoked. */
  async verify(token: string): Promise<{ id: string; ownerId: string } | null> {
    if (!token.startsWith(PREFIX) || token.length > 100) return null;
    const found = await this.tokens.findOne({
      where: { tokenHash: sha256(token) },
      select: { id: true, ownerId: true },
    });
    if (!found) return null;
    const now = Date.now();
    if (now - (this.touched.get(found.id) ?? 0) > TOUCH_EVERY_MS) {
      this.touched.set(found.id, now);
      if (this.touched.size > 10_000) this.touched.clear();
      void this.tokens.update(found.id, { lastUsedAt: new Date(now) }).catch(() => undefined);
    }
    return found;
  }
}
