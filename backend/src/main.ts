import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { PublicDocsService } from "./public/public-docs.service";
import { SLUG_PATTERN } from "./public/public.dto";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  // Markdown documents can be large; the default 100kb JSON limit is too small.
  app.useBodyParser("json", { limit: "5mb" });
  app.enableCors({
    origin: config.get("FRONTEND_URL", "http://localhost:5173"),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  serveFrontend(
    app,
    config.get("WEB_DIST", join(__dirname, "../../frontend/dist")),
    config.get("FRONTEND_URL", "http://localhost:5173").replace(/\/$/, ""),
  );

  const port = config.get<number>("PORT", 9000);
  const host = config.get<string>("HOST", "0.0.0.0");
  await app.listen(port, host);
  console.log(`viewmd api listening on http://${host}:${port}/api`);
}

/** In production one process serves both the API and the built React app (with SPA fallback). */
function serveFrontend(
  app: NestExpressApplication,
  webDist: string,
  siteUrl: string,
) {
  const indexHtml = join(webDist, "index.html");
  if (!existsSync(indexHtml)) return; // dev: Vite serves the frontend
  const template = readFileSync(indexHtml, "utf8");
  const publicDocs = app.get(PublicDocsService);

  // Hashed bundles never change, so they can be cached forever.
  app.useStaticAssets(join(webDist, "assets"), {
    prefix: "/assets",
    immutable: true,
    maxAge: "1y",
  });
  app.useStaticAssets(webDist, { index: false, maxAge: "1h" });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      (req.method !== "GET" && req.method !== "HEAD") ||
      req.path.startsWith("/api")
    )
      return next();
    res.setHeader("Cache-Control", "no-cache");
    // Shared links (/s/<slug>, /explore) get a real title and description, so chat apps and
    // search engines show a proper preview without running the app.
    const slug = req.path.match(/^\/s\/([^/]+)\/?$/)?.[1];
    if (slug && SLUG_PATTERN.test(slug)) {
      publicDocs
        .meta(slug)
        .then((meta) =>
          res.type("html").send(
            meta
              ? withMeta(template, {
                  title: `${meta.title} · viewmd`,
                  description:
                    meta.description || `Shared by ${meta.author} on viewmd`,
                  url: `${siteUrl}/s/${slug}`,
                  image: `${siteUrl}/apple-touch-icon.png`,
                  type: "article",
                })
              : template,
          ),
        )
        .catch(next);
      return;
    }
    if (req.path === "/explore") {
      res.type("html").send(
        withMeta(template, {
          title: "Explore · viewmd",
          description:
            "Notes, guides and documentation people have shared on viewmd.",
          url: `${siteUrl}/explore`,
          image: `${siteUrl}/apple-touch-icon.png`,
          type: "website",
        }),
      );
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
  type: "article" | "website";
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

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
  ].join("\n    ");
  return html.replace(
    /<title>[^<]*<\/title>/,
    () => `<title>${title}</title>\n    ${tags}`,
  );
}
