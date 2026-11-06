import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { AuthInfo } from '@modelcontextprotocol/server';
import type { Request, Response } from 'express';
import { WriteLimiter } from '../public/write-limits';
import { TokensService } from '../tokens/tokens.service';
import { McpService } from './mcp.service';

/**
 * MCP over streamable HTTP: POST /api/mcp with `Authorization: Bearer <viewmd token>`.
 * The token is checked here; the MCP handler only ever runs for a verified caller.
 */
@ApiExcludeController() // JSON-RPC (MCP), described in the API overview instead
@Controller('mcp')
export class McpController {
  /** All MCP requests per token (reads included): a looping agent can't hammer the database. */
  private readonly requests = new WriteLimiter([
    { max: 300, ms: 5 * 60_000 },
    { max: 5000, ms: 24 * 3600_000 },
  ]);

  constructor(
    private readonly mcp: McpService,
    private readonly tokens: TokensService,
  ) {}

  @All()
  async handle(@Req() req: Request & { auth?: AuthInfo }, @Res() res: Response) {
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    const caller = type === 'Bearer' && token ? await this.tokens.verify(token) : null;
    if (!caller) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="viewmd", error="invalid_token"');
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Missing or invalid viewmd token. Create one in viewmd → Connect an agent.',
      });
      return;
    }
    if (!this.requests.tryConsume(caller.id)) {
      res.setHeader('Retry-After', '60');
      res
        .status(429)
        .json({
          error: 'too_many_requests',
          error_description: 'Too many requests — slow down and retry in a minute.',
        });
      return;
    }
    req.auth = {
      token: token!,
      clientId: caller.id,
      scopes: ['notes'],
      extra: { userId: caller.ownerId, tokenId: caller.id },
    };
    await this.mcp.node(req, res, req.body);
  }
}
