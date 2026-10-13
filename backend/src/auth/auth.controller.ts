import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthGuard, AuthUser } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { GithubOAuthService } from './github-oauth.service';

const STATE_COOKIE = 'viewmd_gh_state';
const STATE_COOKIE_PATH = '/api/auth/github';

type LoginError = 'github_not_configured' | 'access_denied' | 'invalid_state' | 'github_failed';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly auth: AuthService,
    private readonly github: GithubOAuthService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '');
  }

  /** Step 1: send the browser to GitHub, remembering a CSRF `state` in a short-lived cookie. */
  @Get('github')
  startGithub(@Res() res: Response) {
    if (!this.github.configured) return this.fail(res, 'github_not_configured');

    const state = randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.frontendUrl.startsWith('https://'),
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(this.github.authorizeUrl(state));
  }

  /** Step 2: GitHub redirects back here; hand our JWT to the frontend in the URL fragment. */
  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const expected = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });

    if (error) return this.fail(res, error === 'access_denied' ? 'access_denied' : 'github_failed');
    if (!code || !state || !expected || !safeEqual(state, expected)) return this.fail(res, 'invalid_state');

    try {
      const profile = await this.github.fetchProfile(code);
      const { accessToken } = await this.auth.loginWithGithub(profile);
      // A fragment never reaches servers or Referer headers.
      res.redirect(`${this.frontendUrl}/auth/callback#token=${encodeURIComponent(accessToken)}`);
    } catch (e) {
      this.logger.error(e instanceof Error ? e.message : e);
      this.fail(res, 'github_failed');
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private fail(res: Response, reason: LoginError) {
    res.redirect(`${this.frontendUrl}/login?error=${reason}`);
  }
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
