import type { ConfigService } from '@nestjs/config';

const clean = (origin: string) => origin.trim().replace(/\/$/, '');

/** The site itself. */
export const frontendUrl = (config: ConfigService) => clean(config.get('FRONTEND_URL', 'http://localhost:5173'));

/**
 * Sites allowed to use the API from a browser: the site itself plus ALLOWED_ORIGINS (comma-separated),
 * e.g. `http://localhost:5173` so a local copy of the app can run against the production API.
 */
export function allowedOrigins(config: ConfigService): Set<string> {
  const extra = (config.get<string>('ALLOWED_ORIGINS') ?? '').split(',');
  return new Set([frontendUrl(config), ...extra].map(clean).filter(Boolean));
}
