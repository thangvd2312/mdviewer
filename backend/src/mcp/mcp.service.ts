import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DocsService } from '../docs/docs.service';
import { ProjectsService } from '../projects/projects.service';
import { WriteLimiter } from '../public/write-limits';

const MINUTE = 60_000;
const CONTENT_MAX = 2_000_000;
/** read_note returns at most this much text (very long docs are cut, with a note). */
const READ_MAX = 200_000;

const INSTRUCTIONS = `viewmd is the user's personal Markdown notebook. Use these tools to save what the user learns, and to look up what they already wrote.
- When the user asks you to save, remember or note something, write it as clean, well-structured Markdown (a # title, ## sections, lists, code blocks) and call save_note. Put it in a project when one fits (list_projects shows them).
- To add to an existing note (e.g. "add this to my Java notes"), find it with search_notes, then use append_to_note — don't overwrite it.
- Before saving a topic, search_notes for an existing note on it and offer to append instead of creating a duplicate.
- Notes are private to the user; nothing you save is published.
- After saving, tell the user the note's title and link.`;

const ok = (text: string): CallToolResult => ({ content: [{ type: 'text', text }] });
const fail = (text: string): CallToolResult => ({ content: [{ type: 'text', text }], isError: true });

/** Signed-in agent: who it acts for (from the verified token). */
interface Caller {
  userId: string;
  tokenId: string;
}

/**
 * The MCP endpoint's tools. One handler for the process; each request gets a fresh server bound to
 * the caller, so every tool only ever sees the token owner's notes.
 */
@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly siteUrl: string;
  /** Writes per token: a runaway agent can't flood the notebook. */
  private readonly writes = new WriteLimiter([
    { max: 60, ms: 10 * MINUTE },
    { max: 500, ms: 24 * 60 * MINUTE },
  ]);
  private readonly handler = createMcpHandler(({ authInfo }) => this.server(callerOf(authInfo?.extra)), {
    onerror: () => undefined,
  });
  /** Node/Express adapter: forwards `req.auth` as the request's authInfo. */
  readonly node = toNodeHandler(this.handler);

  constructor(
    config: ConfigService,
    private readonly docs: DocsService,
    private readonly projects: ProjectsService,
  ) {
    this.siteUrl = config.get('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '');
  }

  async onModuleDestroy() {
    await this.handler.close();
  }

  private noteUrl = (id: string) => `${this.siteUrl}/d/${id}`;

  private server(caller: Caller | null) {
    const server = new McpServer({ name: 'viewmd', version: '1.0.0' }, { instructions: INSTRUCTIONS });
    const run = async (write: boolean, fn: (c: Caller) => Promise<CallToolResult>): Promise<CallToolResult> => {
      if (!caller) return fail('Not signed in: connect with a viewmd token.');
      if (write && !this.writes.tryConsume(caller.tokenId)) {
        return fail('Too many changes in a short time — wait a few minutes and try again.');
      }
      try {
        return await fn(caller);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return fail(/not found/i.test(message) ? 'No note with that id (or it isn’t yours).' : message);
      }
    };

    server.registerTool(
      'save_note',
      {
        title: 'Save a note',
        description:
          'Save a new Markdown note to the user’s viewmd notebook. Use a clear "# Title" line or pass title. Optionally file it in a project by name (created if it doesn’t exist yet). Returns the note id and link.',
        inputSchema: z.object({
          content: z.string().min(1).max(CONTENT_MAX).describe('The note, in Markdown.'),
          title: z.string().max(255).optional().describe('Title; defaults to the first heading.'),
          project: z.string().max(120).optional().describe('Project (folder) name to file it under.'),
        }),
      },
      ({ content, title, project }) =>
        run(true, async ({ userId }) => {
          const projectId = project?.trim() ? await this.projectId(userId, project.trim()) : null;
          const doc = await this.docs.create(userId, { content, title, projectId });
          return ok(
            `Saved “${doc.title}”${project?.trim() ? ` in project “${project.trim()}”` : ''}.\nid: ${doc.id}\nlink: ${this.noteUrl(doc.id)}`,
          );
        }),
    );

    server.registerTool(
      'append_to_note',
      {
        title: 'Add to a note',
        description:
          'Add Markdown to the end of an existing note (find its id with search_notes or list_recent_notes). Optionally start the addition with a "## heading". Keeps everything already in the note.',
        inputSchema: z.object({
          note_id: z.uuid().describe('The note’s id.'),
          content: z.string().min(1).max(CONTENT_MAX).describe('Markdown to add.'),
          heading: z.string().max(200).optional().describe('Section heading to put above the addition.'),
        }),
      },
      ({ note_id, content, heading }) =>
        run(true, async ({ userId }) => {
          const doc = await this.docs.findOwned(userId, note_id);
          const addition = (heading?.trim() ? `## ${heading.trim()}\n\n` : '') + content.trim();
          const next = `${doc.content.trimEnd()}\n\n${addition}\n`;
          if (next.length > CONTENT_MAX) return fail('The note would get too long — save this as a new note instead.');
          const saved = await this.docs.update(userId, note_id, { content: next });
          return ok(`Added to “${saved.title}”.\nlink: ${this.noteUrl(saved.id)}`);
        }),
    );

    server.registerTool(
      'update_note',
      {
        title: 'Rewrite a note',
        description:
          'Replace a note’s title and/or its whole content. This overwrites what is there — prefer append_to_note to add to a note, and only rewrite when the user asks for it.',
        inputSchema: z.object({
          note_id: z.uuid(),
          content: z.string().min(1).max(CONTENT_MAX).optional().describe('New full Markdown content.'),
          title: z.string().min(1).max(255).optional(),
        }),
        annotations: { destructiveHint: true },
      },
      ({ note_id, content, title }) =>
        run(true, async ({ userId }) => {
          if (content === undefined && title === undefined) return fail('Pass content and/or title.');
          const saved = await this.docs.update(userId, note_id, { content, title });
          return ok(`Updated “${saved.title}”.\nlink: ${this.noteUrl(saved.id)}`);
        }),
    );

    server.registerTool(
      'search_notes',
      {
        title: 'Search notes',
        description:
          'Find the user’s notes whose title or text contains the query. Returns ids, titles, projects and summaries.',
        inputSchema: z.object({
          query: z.string().min(1).max(200),
          limit: z.number().int().min(1).max(25).optional().describe('Default 10.'),
        }),
        annotations: { readOnlyHint: true },
      },
      ({ query, limit }) =>
        run(false, async ({ userId }) => {
          const found = await this.docs.list(userId, { q: query, sort: 'updated', limit: limit ?? 10 });
          if (found.length === 0) return ok(`No notes match “${query}”.`);
          return ok(await this.describeList(userId, found));
        }),
    );

    server.registerTool(
      'read_note',
      {
        title: 'Read a note',
        description: 'Get a note’s full Markdown by id.',
        inputSchema: z.object({ note_id: z.uuid() }),
        annotations: { readOnlyHint: true },
      },
      ({ note_id }) =>
        run(false, async ({ userId }) => {
          const doc = await this.docs.findOwned(userId, note_id);
          const project = doc.projectId ? await this.projects.get(userId, doc.projectId).catch(() => null) : null;
          const cut = doc.content.length > READ_MAX;
          return ok(
            [
              `title: ${doc.title}`,
              `id: ${doc.id}`,
              project ? `project: ${project.name}` : null,
              `updated: ${doc.updatedAt.toISOString()}`,
              `link: ${this.noteUrl(doc.id)}`,
              '',
              cut
                ? doc.content.slice(0, READ_MAX) + `\n\n[… cut: the note is ${doc.content.length} characters long]`
                : doc.content,
            ]
              .filter((l) => l !== null)
              .join('\n'),
          );
        }),
    );

    server.registerTool(
      'list_recent_notes',
      {
        title: 'Recent notes',
        description: 'The user’s most recently edited notes.',
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional().describe('Default 10.') }),
        annotations: { readOnlyHint: true },
      },
      ({ limit }) =>
        run(false, async ({ userId }) => {
          const recent = await this.docs.list(userId, { sort: 'updated', limit: limit ?? 10 });
          return ok(recent.length ? await this.describeList(userId, recent) : 'No notes yet.');
        }),
    );

    server.registerTool(
      'list_projects',
      {
        title: 'List projects',
        description: 'The user’s projects (folders of notes), to file a new note in the right place.',
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      () =>
        run(false, async ({ userId }) => {
          const projects = await this.projects.list(userId);
          if (projects.length === 0) return ok('No projects yet (save_note with a project name creates one).');
          return ok(projects.map((p) => `- ${p.name}${p.description ? ` — ${p.description}` : ''}`).join('\n'));
        }),
    );

    return server;
  }

  /** Project id by name (case-insensitive), creating the project when it doesn't exist. */
  private async projectId(userId: string, name: string) {
    const existing = (await this.projects.list(userId)).find((p) => p.name.toLowerCase() === name.toLowerCase());
    return existing ? existing.id : (await this.projects.create(userId, { name })).id;
  }

  private async describeList(
    userId: string,
    docs: { id: string; title: string; excerpt: string; projectId: string | null; updatedAt: Date }[],
  ) {
    const names = new Map((await this.projects.list(userId)).map((p) => [p.id, p.name]));
    return docs
      .map((d) =>
        [
          `- ${d.title}`,
          `  id: ${d.id}`,
          d.projectId && names.get(d.projectId) ? `  project: ${names.get(d.projectId)}` : null,
          `  updated: ${d.updatedAt.toISOString().slice(0, 10)}`,
          d.excerpt ? `  ${d.excerpt.slice(0, 160)}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n');
  }
}

/** The caller carried in authInfo.extra by McpController (only set for verified tokens). */
function callerOf(extra: unknown): Caller | null {
  const e = extra as { userId?: unknown; tokenId?: unknown } | undefined;
  return typeof e?.userId === 'string' && typeof e.tokenId === 'string'
    ? { userId: e.userId, tokenId: e.tokenId }
    : null;
}
