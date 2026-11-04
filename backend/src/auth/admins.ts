import type { ConfigService } from '@nestjs/config';

/**
 * Site admins: GitHub logins or emails in ADMIN_USERS (comma-separated). Defaults to the people with an
 * unlimited assistant allowance (ASSISTANT_UNLIMITED_USERS).
 */
export function adminSet(config: ConfigService) {
  const raw = config.get<string>('ADMIN_USERS') ?? config.get<string>('ASSISTANT_UNLIMITED_USERS') ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isAdmin = (admins: Set<string>, u: { githubLogin: string | null; email: string | null }) =>
  Boolean((u.githubLogin && admins.has(u.githubLogin.toLowerCase())) || (u.email && admins.has(u.email.toLowerCase())));
