import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GithubProfile {
  id: string;
  login: string;
  name: string;
  email: string | null;
  avatarUrl: string;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

@Injectable()
export class GithubOAuthService {
  constructor(private readonly config: ConfigService) {}

  get configured() {
    return Boolean(this.config.get('GITHUB_CLIENT_ID') && this.config.get('GITHUB_CLIENT_SECRET'));
  }

  authorizeUrl(state: string) {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: this.config.getOrThrow('GITHUB_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow('GITHUB_CALLBACK_URL'),
      scope: 'read:user user:email',
      state,
    }).toString();
    return url.toString();
  }

  /** Exchanges the callback `code` for the user's GitHub profile. */
  async fetchProfile(code: string): Promise<GithubProfile> {
    const token = await this.exchangeCode(code);
    const user = await this.api<{ id: number; login: string; name: string | null; email: string | null; avatar_url: string }>(
      '/user',
      token,
    );
    // The public profile email is often hidden; ask for the primary verified one.
    const emails = await this.api<GithubEmail[]>('/user/emails', token).catch(() => []);
    const email = emails.find((e) => e.primary && e.verified)?.email ?? null;

    return {
      id: String(user.id),
      login: user.login,
      name: user.name?.trim() || user.login,
      email: email?.toLowerCase() ?? null,
      avatarUrl: user.avatar_url,
    };
  }

  private async exchangeCode(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.getOrThrow('GITHUB_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GITHUB_CLIENT_SECRET'),
        redirect_uri: this.config.getOrThrow('GITHUB_CALLBACK_URL'),
        code,
      }),
    });
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(`GitHub token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
    }
    return data.access_token;
  }

  private async api<T>(path: string, token: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'viewmd',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) throw new Error(`GitHub API ${path} returned ${res.status}`);
    return (await res.json()) as T;
  }
}
