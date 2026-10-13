import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Markdown documents can be large; the default 100kb JSON limit is too small.
  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors({ origin: config.get('FRONTEND_URL', 'http://localhost:5173') });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  serveFrontend(app, config.get('WEB_DIST', join(__dirname, '../../frontend/dist')));

  const port = config.get<number>('PORT', 9000);
  const host = config.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);
  console.log(`viewmd api listening on http://${host}:${port}/api`);
}

/** In production one process serves both the API and the built React app (with SPA fallback). */
function serveFrontend(app: NestExpressApplication, webDist: string) {
  const indexHtml = join(webDist, 'index.html');
  if (!existsSync(indexHtml)) return; // dev: Vite serves the frontend

  // Hashed bundles never change, so they can be cached forever.
  app.useStaticAssets(join(webDist, 'assets'), { prefix: '/assets', immutable: true, maxAge: '1y' });
  app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
  console.log(`serving frontend from ${webDist}`);
}

bootstrap();
