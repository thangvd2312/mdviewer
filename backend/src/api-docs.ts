import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Where the interactive API reference lives (outside the /api prefix): /docs, and /docs/json for the spec. */
export const API_DOCS_PATH = 'docs';

const DESCRIPTION = `
The API behind [viewmd](https://mdviewer.thangvu.io.vn): Markdown documents, projects, sticky notes,
the reading assistant, spaced-repetition review and the public blog.

## Signing in
Requests are authenticated with a **JWT** in \`Authorization: Bearer <token>\`.

- **In the browser:** open \`GET /api/auth/github\`. After GitHub, the token is handed to the app as
  \`<site>/auth/callback#token=…\`. From a local copy of the app listed in \`ALLOWED_ORIGINS\`, add
  \`?return_to=http://localhost:5173\` and the token comes back there.
- **Here:** in the app, run \`localStorage.getItem('viewmd.token')\` in the browser console, then press
  **Authorize** above and paste it (stays in this browser only).

Routes marked with a lock need the token; \`/api/public/*\` works without one (with it, the reader is
recognised: their own comments, moderation of their pages).

## Errors
Failures return \`{ "statusCode": 400, "message": "…" | ["…"], "error": "Bad Request" }\`.
\`401\` means a missing or expired token; \`429\` a usage limit (assistant, comments).

## AI agents (MCP)
\`POST /api/mcp\` is a Model Context Protocol server (streamable HTTP) for Claude Code, Cursor and others,
authenticated with a personal agent token (\`vmd_…\`, see *tokens*) instead of the JWT. It speaks
JSON-RPC, so it isn't listed below.
`;

export function setupApiDocs(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('viewmd API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'viewmd sign-in token' })
    .addTag('auth', 'Sign in with GitHub, and who is signed in')
    .addTag('docs', "The user's Markdown documents")
    .addTag('projects', 'Groups of documents')
    .addTag('annotations', 'Sticky notes and highlights on a document')
    .addTag('assistant', 'Reading assistant: questions about the documents, and the chat history')
    .addTag('review', 'Spaced-repetition questions about the documents')
    .addTag('tokens', 'Personal tokens for AI agents (MCP)')
    .addTag('public', 'Published documents (the blog), authors and comments')
    .addTag('health', 'Liveness check')
    .build();

  SwaggerModule.setup(API_DOCS_PATH, app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: `${API_DOCS_PATH}/json`,
    customSiteTitle: 'viewmd API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
