import { Controller, Get, Logger, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthGuard, AuthUser } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { GithubOAuthService } from './github-oauth.service';
import { allowedOrigins, frontendUrl } from '../origins';

const STATE_COOKIE = 'viewmd_gh_state';
/** Where to send the token afterwards, when it isn't the site itself (a local copy of the app). */
const RETURN_COOKIE = 'viewmd_gh_return';
const STATE_COOKIE_PATH = '/api/auth/github';

type LoginError = 'github_not_configured' | 'access_denied' | 'invalid_state' | 'github_failed';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;
  private readonly origins: Set<string>;
  /** Host GitHub sends the browser back to; the login has to start there for its cookies to be seen. */
  private readonly callbackHost: string | undefined;

  constructor(
    private readonly auth: AuthService,
    private readonly github: GithubOAuthService,
    config: ConfigService,
  ) {
    this.frontendUrl = frontendUrl(config);
    this.origins = allowedOrigins(config);
    const callback = config.get<string>('GITHUB_CALLBACK_URL');
    this.callbackHost = callback ? new URL(callback).host : undefined;
  }

  /**
   * Step 1: send the browser to GitHub, remembering a CSRF `state` in a short-lived cookie.
   * `return_to` (an allowed origin, e.g. http://localhost:5173) gets the token instead of the site.
   */
  @Get('github')
  startGithub(@Query('return_to') returnTo: string | undefined, @Req() req: Request, @Res() res: Response) {
    if (!this.github.configured) return this.fail(res, 'github_not_configured');
    // Started on another host of this server (the API domain): continue on the callback's host.
    if (this.callbackHost && req.headers.host && req.headers.host !== this.callbackHost) {
      return res.redirect(`${this.secure ? 'https' : 'http'}://${this.callbackHost}${req.originalUrl}`);
    }

    const cookie = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.secure,
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    };
    const state = randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, cookie);
    const target = this.returnTarget(returnTo);
    if (target !== this.frontendUrl) res.cookie(RETURN_COOKIE, target, cookie);
    else res.clearCookie(RETURN_COOKIE, { path: STATE_COOKIE_PATH });
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
    const target = this.returnTarget(readCookie(req, RETURN_COOKIE));
    res.clearCookie(STATE_COOKIE, { path: STATE_COOKIE_PATH });
    res.clearCookie(RETURN_COOKIE, { path: STATE_COOKIE_PATH });

    if (error) return this.fail(res, error === 'access_denied' ? 'access_denied' : 'github_failed', target);
    if (!code || !state || !expected || !safeEqual(state, expected)) return this.fail(res, 'invalid_state', target);

    try {
      const profile = await this.github.fetchProfile(code);
      const { accessToken } = await this.auth.loginWithGithub(profile);
      // A fragment never reaches servers or Referer headers.
      res.redirect(`${target}/auth/callback#token=${encodeURIComponent(accessToken)}`);
    } catch (e) {
      this.logger.error(e instanceof Error ? e.message : e);
      this.fail(res, 'github_failed', target);
    }
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private get secure() {
    return this.frontendUrl.startsWith('https://');
  }

  /** The token only ever goes to an allowed origin; anything else means the site itself. */
  private returnTarget(origin: string | undefined) {
    const clean = origin?.trim().replace(/\/$/, '');
    return clean && this.origins.has(clean) ? clean : this.frontendUrl;
  }

  private fail(res: Response, reason: LoginError, target = this.frontendUrl) {
    res.redirect(`${target}/login?error=${reason}`);
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
