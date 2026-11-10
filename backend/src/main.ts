import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_DOCS_PATH, setupApiDocs } from './api-docs';
import { AppModule } from './app.module';
import { allowedOrigins } from './origins';
import { PublicDocsService } from './public/public-docs.service';
import { SLUG_PATTERN } from './public/public.dto';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Markdown documents can be large; the default 100kb JSON limit is too small.
  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors({ origin: [...allowedOrigins(config)] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  setupApiDocs(app);
  serveFrontend(
    app,
    config.get('WEB_DIST', join(__dirname, '../../frontend/dist')),
    config.get('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, ''),
  );

  const port = config.get<number>('PORT', 9000);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
  console.log(`viewmd api listening on http://${host}:${port}/api`);
}

const isApiDocs = (path: string) => path === `/${API_DOCS_PATH}` || path.startsWith(`/${API_DOCS_PATH}/`);

/** In production one process serves both the API and the built React app (with SPA fallback). */
function serveFrontend(app: NestExpressApplication, webDist: string, siteUrl: string) {
  const indexHtml = join(webDist, 'index.html');
  if (!existsSync(indexHtml)) return; // dev: Vite serves the frontend
  const template = readFileSync(indexHtml, 'utf8');
  const publicDocs = app.get(PublicDocsService);

  // Hashed bundles never change, so they can be cached forever.
  app.useStaticAssets(join(webDist, 'assets'), {
    prefix: '/assets',
    immutable: true,
    maxAge: '1y',
  });
  app.useStaticAssets(webDist, {
    index: false,
    maxAge: '1h',
    // The service worker and the app manifest must update as soon as a new version is deployed.
    setHeaders: (res, path) => {
      if (/(?:sw\.js|\.webmanifest)$/.test(path)) res.setHeader('Cache-Control', 'no-cache');
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api') || isApiDocs(req.path)) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    // Old addresses of the blog keep working (and pass their ranking on to the new ones).
    if (req.path === '/explore') return res.redirect(301, `/blog${query}`);
    const oldSlug = req.path.match(/^\/s\/([^/]+)\/?$/)?.[1];
    if (oldSlug && SLUG_PATTERN.test(oldSlug)) return res.redirect(301, `/blog/${oldSlug}${query}`);

    // Blog pages get a real title and description, so chat apps and search engines show a proper
    // preview without running the app.
    const page = (meta: PageMeta) => res.type('html').send(withMeta(template, meta));
    const image = `${siteUrl}/apple-touch-icon.png`;
    if (req.path === '/blog' || req.path === '/blog/') {
      return page({
        title: 'viewmd Blog',
        description: 'Notes, guides and docs people have shared on viewmd — free to read.',
        url: `${siteUrl}/blog`,
        image,
        type: 'website',
      });
    }
    // The site root is the product page; its old address keeps working.
    if (req.path === '/features' || req.path === '/features/') return res.redirect(301, `/${query}`);
    if (req.path === '/') {
      return page({
        title: 'viewmd — Markdown notes you read, remember and share',
        description:
          'Read Markdown beautifully, pin sticky notes, ask an AI about the page, review with spaced repetition, publish to the blog — and let AI agents save notes over MCP. Installs like an app on your phone.',
        url: `${siteUrl}/`,
        image: `${siteUrl}/landing/og.jpg`,
        type: 'website',
      });
    }
    const seriesSlug = req.path.match(/^\/blog\/series\/([^/]+)\/?$/)?.[1];
    if (seriesSlug && SLUG_PATTERN.test(seriesSlug)) {
      publicDocs
        .seriesMeta(seriesSlug)
        .then((meta) =>
          meta
            ? page({
                title: `${meta.title} · viewmd Blog`,
                description: meta.description || `A series by ${meta.author} on viewmd`,
                url: `${siteUrl}/blog/series/${seriesSlug}`,
                image,
                type: 'website',
              })
            : res.type('html').send(template),
        )
        .catch(next);
      return;
    }
    const slug = req.path.match(/^\/blog\/([^/]+)\/?$/)?.[1];
    if (slug && SLUG_PATTERN.test(slug)) {
      publicDocs
        .meta(slug)
        .then((meta) =>
          meta
            ? page({
                title: `${meta.title} · viewmd Blog`,
                description: meta.description || `Written by ${meta.author} on viewmd`,
                url: `${siteUrl}/blog/${slug}`,
                image,
                type: 'article',
              })
            : res.type('html').send(template),
        )
        .catch(next);
      return;
    }
    const login = req.path.match(/^\/u\/([A-Za-z0-9-]{1,100})\/?$/)?.[1];
    if (login) {
      publicDocs
        .author(login)
        .then((a) =>
          page({
            title: `${a.name} · viewmd Blog`,
            description: `${a.postCount} ${a.postCount === 1 ? 'post' : 'posts'} by ${a.name}${a.login ? ` (@${a.login})` : ''} on viewmd.`,
            url: `${siteUrl}/u/${login}`,
            image: a.avatarUrl ?? image,
            type: 'website',
          }),
        )
        .catch(() => res.type('html').send(template));
      return;
    }
    res.sendFile(indexHtml);
  });
  console.log(`serving frontend from ${webDist}`);
}

bootstrap();

interface PageMeta {
  title: string;
  description: string;
  url: string;
  image: string;
  type: 'article' | 'website';
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** index.html with the page's <title> and Open Graph / Twitter tags. */
function withMeta(html: string, meta: PageMeta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description.slice(0, 300));
  const tags = [
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    `<meta property="og:site_name" content="viewmd" />`,
    `<meta property="og:type" content="${meta.type}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}" />`,
    `<meta property="og:image" content="${escapeHtml(meta.image)}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].join('\n    ');
  return html.replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>\n    ${tags}`);
}
