import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Not, Repository } from 'typeorm';
import { AssistantService } from '../assistant/assistant.service';
import type { Plan } from '../assistant/quota.service';
import { DocsService } from '../docs/docs.service';
import { User } from '../users/user.entity';
import { CuratedArticle, type CuratedSource, CuratorRun } from './curator.entity';
import { DailyDevClient, type DailyPost } from './dailydev';
import {
  type Assessment,
  cleanPost,
  editorMessages,
  type EditorReview,
  judgeMessages,
  parseJson,
  type Research,
  reviseMessages,
  type SourceBundle,
  triageMessages,
  writerMessages,
} from './prompts';
import { extractArticle, fetchPage } from './web-page';

const DEFAULT_TOPICS =
  'java,spring-boot,system-design,architecture,database,redis,kafka,kubernetes,backend,javascript,typescript,react,nodejs,ai';
const DAY_MS = 86_400_000;

/**
 * The blog curator. Once a day (and whenever an admin asks) it looks at daily.dev's posts for the
 * configured topics, has a judge pick the very best, researches each one (the original article, the
 * pages it links to, the discussion) and writes an original Vietnamese explainer. An editor model
 * checks the draft against the sources and sends it back once; posts that clear the bar are
 * published on the blog under the system author, the rest wait as drafts for an admin.
 */
@Injectable()
export class CuratorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CuratorService.name);
  private readonly client: DailyDevClient | null;
  private readonly topics: string[];
  private readonly dailyPosts: number;
  private readonly hour: number;
  private readonly timeZone: string;
  private readonly minScore: number;
  private readonly publishScore: number;
  private readonly shortlist: number;
  private readonly concurrency: number;
  private readonly maxGlobalShare: number;
  private readonly minSignal: number;
  private readonly authorLogin: string;
  private readonly siteUrl: string;
  private readonly autoRun: boolean;
  private timer: NodeJS.Timeout | null = null;
  private current: { runId: string; promise: Promise<void> } | null = null;

  constructor(
    config: ConfigService,
    @InjectRepository(CuratedArticle) private readonly articles: Repository<CuratedArticle>,
    @InjectRepository(CuratorRun) private readonly runs: Repository<CuratorRun>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly docs: DocsService,
    private readonly assistant: AssistantService,
  ) {
    const num = (key: string, fallback: number) => {
      const v = Number(config.get(key, fallback));
      return Number.isFinite(v) ? v : fallback;
    };
    const token = config.get<string>('DAILYDEV_TOKEN')?.trim();
    this.client = token ? new DailyDevClient(token) : null;
    this.topics = config
      .get<string>('CURATOR_TOPICS', DEFAULT_TOPICS)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    this.dailyPosts = Math.max(0, num('CURATOR_DAILY_POSTS', 2));
    this.hour = Math.min(23, Math.max(0, num('CURATOR_HOUR', 7)));
    this.timeZone = config.get('CURATOR_TIMEZONE', config.get('ASSISTANT_TIMEZONE', 'Asia/Ho_Chi_Minh'));
    this.minScore = num('CURATOR_MIN_SCORE', 8);
    this.publishScore = num('CURATOR_PUBLISH_SCORE', 8.5);
    this.shortlist = Math.max(1, num('CURATOR_SHORTLIST', 6));
    this.concurrency = Math.min(5, Math.max(1, num('CURATOR_CONCURRENCY', 3)));
    this.maxGlobalShare = num('CURATOR_MAX_GLOBAL_SHARE', 0.5);
    this.minSignal = num('CURATOR_MIN_SIGNAL', 5);
    this.authorLogin = config.get('CURATOR_AUTHOR_LOGIN', 'viewmd-editorial');
    this.siteUrl = config.get('FRONTEND_URL', 'http://localhost:5173').replace(/\/$/, '');
    this.autoRun = config.get('CURATOR_ENABLED', 'true') !== 'false';
  }

  get configured() {
    return this.client !== null && this.assistant.enabled;
  }

  onApplicationBootstrap() {
    if (!this.configured || !this.autoRun) {
      this.logger.log(`curator idle (${this.client ? 'auto runs off' : 'DAILYDEV_TOKEN not set'})`);
      return;
    }
    // Check every 10 minutes whether today's run is due (after CURATOR_HOUR, once a day).
    this.timer = setInterval(() => void this.tick(), 10 * 60_000);
    setTimeout(() => void this.tick(), 90_000).unref();
    this.logger.log(
      `curator on: ${this.dailyPosts} posts/day at ${this.hour}:00 ${this.timeZone}, topics ${this.topics.join(', ')}`,
    );
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.current) return;
    const now = new Date();
    if (this.localHour(now) < this.hour) return;
    const day = this.day(now);
    if (await this.runs.existsBy({ day, trigger: 'auto' })) return;
    await this.start('auto').catch((e: unknown) => this.logger.error(`auto run failed to start: ${describe(e)}`));
  }

  /** Starts a run in the background. One at a time. */
  async start(trigger: 'auto' | 'manual', opts: { articleId?: string; count?: number } = {}) {
    if (!this.client) throw new ServiceUnavailableException('Set DAILYDEV_TOKEN on the server to use the curator.');
    if (!this.assistant.enabled) throw new ServiceUnavailableException('The AI service is not configured.');
    if (this.current) throw new ConflictException('The curator is already running.');
    const run = await this.runs.save(
      this.runs.create({ day: this.day(new Date()), trigger, status: 'running', startedAt: new Date(), log: '' }),
    );
    const promise = this.execute(run, opts)
      .then(async () => {
        run.status = 'done';
      })
      .catch(async (e: unknown) => {
        run.status = 'failed';
        await this.log(run, `✗ run failed: ${describe(e)}`);
        this.logger.error(`run ${run.id} failed: ${describe(e)}`);
      })
      .finally(async () => {
        run.finishedAt = new Date();
        await this.runs.save(run).catch(() => undefined);
        this.current = null;
      });
    this.current = { runId: run.id, promise };
    return run;
  }

  /** For tests and shutdown: wait for the run in progress. */
  async idle() {
    await this.current?.promise;
  }

  // ───────────────────────────── the pipeline ─────────────────────────────

  private async execute(run: CuratorRun, opts: { articleId?: string; count?: number }) {
    const author = await this.systemAuthor();
    if (opts.articleId) {
      const article = await this.articles.findOneBy({ id: opts.articleId });
      if (!article) throw new NotFoundException();
      await this.log(run, `rewriting “${article.title}”`);
      await this.writeAndPublish(run, article, author);
      return;
    }

    let want = opts.count ?? this.dailyPosts;
    if (run.trigger === 'auto') {
      const today = await this.articles.countBy({ status: 'published', updatedAt: MoreThan(this.startOfDay()) });
      want = Math.max(0, this.dailyPosts - today);
    }
    if (want === 0) return this.log(run, 'nothing to do: today’s posts are out');

    // Good articles judged on earlier days come first; then today's candidates.
    const backlog = await this.articles.find({
      where: { status: 'approved', createdAt: MoreThan(new Date(Date.now() - 30 * DAY_MS)) },
      order: { score: 'DESC', createdAt: 'DESC' },
      take: want,
    });
    if (backlog.length) await this.log(run, `${backlog.length} approved from earlier runs`);
    if (backlog.length < want) {
      await this.budgetCheck(run);
      const candidates = await this.discover(run, want);
      run.candidates = candidates.length;
      let approved = 0;
      for (const c of candidates) {
        // Enough good ones for this run: leave the rest for another day.
        if (backlog.length + approved >= want) break;
        await this.budgetCheck(run);
        try {
          const verdict = await this.judge(run, c.post, c.topic);
          if (verdict) run.scored++;
          if (verdict === 'approved') approved++;
        } catch (e) {
          // Not saved: the article can be judged on a later run.
          await this.log(run, `couldn’t judge “${c.post.title}”: ${describe(e)}`);
        }
      }
      await this.runs.save(run);
      backlog.push(
        ...(await this.articles.find({
          where: backlog.length ? { status: 'approved', id: NotInIds(backlog) } : { status: 'approved' },
          order: { score: 'DESC' },
          take: want - backlog.length,
        })),
      );
    }
    if (!backlog.length) return this.log(run, 'no article was good enough today');
    // A few posts are written at once; each takes several minutes of model time.
    const queue = backlog.slice(0, want);
    const worker = async () => {
      for (let article = queue.shift(); article; article = queue.shift()) {
        await this.budgetCheck(run);
        await this.writeAndPublish(run, article, author);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, queue.length) }, worker));
  }

  /** Candidates from daily.dev, best signals first: articles, recent, read and discussed, not seen before. */
  private async discover(run: CuratorRun, want: number) {
    // Read and judge a few more than we need: some pages can't be read, some aren't good enough.
    const size = Math.min(75, Math.max(this.shortlist, Math.ceil(want * 2.5)));
    const found = new Map<string, { post: DailyPost; topic: string }>();
    for (const topic of this.topics) {
      try {
        // New posts in a tag have no votes yet, so the signal comes from the most discussed posts of
        // the last week and month (the tag feed adds the rest of the month's posts).
        const [week, month, fresh] = await Promise.all([
          this.client!.discussed(topic, 7, 20),
          this.client!.discussed(topic, 30, 30),
          this.client!.tagFeed(topic, 50),
        ]);
        for (const post of [...week, ...month, ...fresh]) if (!found.has(post.id)) found.set(post.id, { post, topic });
      } catch (e) {
        await this.log(run, `topic ${topic}: ${describe(e)}`);
      }
      await sleep(250);
    }
    const ids = [...found.keys()];
    const seen = new Set(
      ids.length
        ? (await this.articles.find({ where: { sourceId: In(ids) }, select: { sourceId: true } })).map(
            (a) => a.sourceId,
          )
        : [],
    );
    const now = Date.now();
    const pool = [...found.values()]
      .filter(({ post }) => !seen.has(post.id) && post.url && (!post.type || post.type === 'article'))
      .filter(({ post }) => (post.readTime ?? 0) >= 4)
      .filter(({ post }) => {
        const at = Date.parse(post.publishedAt ?? post.createdAt ?? '');
        return !Number.isFinite(at) || now - at <= 35 * DAY_MS;
      })
      .map((c) => ({ ...c, signal: (c.post.numUpvotes ?? 0) + 2 * (c.post.numComments ?? 0) }))
      .filter((c) => c.signal >= this.minSignal)
      .sort((a, b) => b.signal - a.signal)
      .slice(0, Math.min(200, Math.max(60, size * 3)));
    // A quick pass over titles and summaries weeds out releases, launches, news and opinion before
    // the (more expensive) full reading.
    let list = pool.slice(0, size);
    if (pool.length > size) {
      try {
        const reply = await this.assistant.completeSystem(
          (await this.systemAuthor()).id,
          triageMessages(
            pool.map(({ post }) => ({
              title: post.title,
              publisher: post.source?.name ?? null,
              tags: post.tags ?? [],
              readTime: post.readTime ?? 0,
              upvotes: post.numUpvotes ?? 0,
              comments: post.numComments ?? 0,
              summary: post.summary ?? '',
            })),
            size,
          ),
          this.chain('judge'),
          180_000,
        );
        const picks = parseJson<{ picks?: unknown }>(reply.text)?.picks;
        if (Array.isArray(picks)) {
          const chosen = picks
            .filter((i): i is number => Number.isInteger(i) && i >= 0 && i < pool.length)
            .map((i) => pool[i]);
          if (chosen.length) list = [...new Set(chosen)].slice(0, size);
        }
      } catch (e) {
        await this.log(run, `triage failed (${describe(e)}); using the most discussed`);
      }
    }
    await this.log(
      run,
      `${found.size} posts across ${this.topics.length} topics → ${pool.length} with signal → ${list.length} shortlisted`,
    );
    return list;
  }

  /** Reads the article and has the judge score it. Saves the verdict either way. */
  private async judge(run: CuratorRun, post: DailyPost, topic: string) {
    const article = this.articles.create({
      sourceId: post.id,
      url: post.url,
      title: post.title.slice(0, 300),
      sourceName: post.source?.name?.slice(0, 120) ?? null,
      topic,
      tags: post.tags ?? null,
      upvotes: post.numUpvotes ?? 0,
      comments: post.numComments ?? 0,
      readTime: post.readTime ?? 0,
      sourcePublishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
      status: 'skipped',
      tokens: 0,
      updatedAt: new Date(),
    });
    let bundle: SourceBundle;
    try {
      bundle = await this.bundle(article);
    } catch (e) {
      article.reason = `couldn’t read the article: ${describe(e)}`;
      await this.articles.save(article);
      await this.log(run, `skip “${article.title}”: ${article.reason}`);
      return null;
    }
    const reply = await this.assistant.completeSystem(
      (await this.systemAuthor()).id,
      judgeMessages(bundle),
      this.chain('judge'),
      180_000,
    );
    article.tokens += reply.tokens;
    const a = parseJson<Assessment>(reply.text);
    if (!a || typeof a.overall !== 'number') {
      article.reason = 'the judge’s reply couldn’t be read';
      await this.articles.save(article);
      return null;
    }
    article.score = Math.round(a.overall * 10) / 10;
    article.assessment = { ...a, links: (a.links ?? []).map((i) => bundle.links[i]?.url).filter(Boolean) };
    article.reason = a.why?.slice(0, 1000) ?? null;
    article.status = a.verdict === 'write' && a.overall >= this.minScore ? 'approved' : 'rejected';
    article.updatedAt = new Date();
    await this.articles.save(article);
    await this.log(
      run,
      `${article.status === 'approved' ? '✓' : '·'} ${article.score} “${article.title}” — ${article.reason ?? ''}`,
    );
    return article.status;
  }

  /** Research, write, edit (once more if needed), then publish or keep as a draft. */
  private async writeAndPublish(run: CuratorRun, article: CuratedArticle, author: User) {
    try {
      const bundle = await this.bundle(article);
      const a = article.assessment as unknown as Assessment | null;
      const brief: Assessment = {
        overall: article.score ?? 0,
        scores: a?.scores ?? {},
        verdict: 'write',
        why: a?.why ?? '',
        angle: a?.angle ?? 'Explain the core idea of the article clearly, with examples.',
        audience: a?.audience ?? 'developers with 1–3 years of experience',
        outline: Array.isArray(a?.outline) ? a.outline : [],
        gaps: Array.isArray(a?.gaps) ? a.gaps : [],
        links: [],
        titleVi: a?.titleVi ?? '',
      };
      const researchUrls = Array.isArray(a?.links) ? (a.links as unknown as string[]).slice(0, 4) : [];
      const research: Research[] = [];
      for (const url of researchUrls) {
        try {
          const page = await fetchPage(url);
          const extracted = extractArticle(page.html, page.url);
          if (extracted && extracted.words >= 150)
            research.push({ title: extracted.title || url, url: page.url, markdown: extracted.markdown });
        } catch (e) {
          await this.log(run, `  research ${url}: ${describe(e)}`);
        }
      }
      await this.log(run, `writing “${article.title}” (${research.length} research pages)`);

      const writer = this.chain('writer');
      const draftReply = await this.assistant.completeSystem(
        author.id,
        writerMessages(bundle, research, brief),
        writer,
      );
      article.tokens += draftReply.tokens;
      article.model = draftReply.model;
      let post = cleanPost(draftReply.text);
      if (!post) throw new Error('the writer didn’t return a post');

      let review = await this.review(article, author, bundle, research, post, draftReply.model);
      for (let round = 0; round < 2 && (review.score < this.publishScore || review.mustFix.length); round++) {
        await this.log(run, `  editor ${review.score}/10 → revising (${review.mustFix.length} must-fix)`);
        const revised = await this.assistant.completeSystem(
          author.id,
          reviseMessages(bundle, research, post, review),
          writer,
        );
        article.tokens += revised.tokens;
        post = cleanPost(revised.text) ?? post;
        review = await this.review(article, author, bundle, research, post, draftReply.model);
      }

      const doc = await this.docs.create(author.id, { content: post });
      const publish = review.score >= this.publishScore && review.mustFix.length === 0;
      if (publish) await this.docs.setSharing(author.id, doc.id, { public: true, allowComments: true });
      article.docId = doc.id;
      article.reason = null;
      article.status = publish ? 'published' : 'draft';
      article.editorScore = review.score;
      article.editorNotes = [review.summary, ...review.mustFix.map((m) => `Must fix: ${m}`)].filter(Boolean).join('\n');
      article.sources = [
        { title: article.title, url: article.url },
        ...research.map((r): CuratedSource => ({ title: r.title.slice(0, 200), url: r.url })),
      ];
      article.updatedAt = new Date();
      await this.articles.save(article);
      if (publish) run.published++;
      else run.drafts++;
      await this.runs.save(run);
      await this.log(run, `${publish ? '★ published' : '✎ draft'} “${doc.title}” — editor ${review.score}/10`);
    } catch (e) {
      article.status = 'failed';
      article.reason = describe(e).slice(0, 1000);
      article.updatedAt = new Date();
      await this.articles.save(article);
      await this.log(run, `✗ “${article.title}”: ${article.reason}`);
    }
  }

  private async review(
    article: CuratedArticle,
    author: User,
    bundle: SourceBundle,
    research: Research[],
    post: string,
    writerModel: string,
  ): Promise<EditorReview> {
    // A second opinion: prefer a different model from the one that wrote it.
    const chain = this.chain('editor');
    const ordered = [...chain.filter((p) => p.model !== writerModel), ...chain.filter((p) => p.model === writerModel)];
    const reply = await this.assistant.completeSystem(
      author.id,
      editorMessages(bundle, research, post),
      ordered,
      300_000,
    );
    article.tokens += reply.tokens;
    const r = parseJson<EditorReview>(reply.text);
    const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    return {
      score: typeof r?.score === 'number' ? Math.round(r.score * 10) / 10 : 0,
      verdict: r?.verdict === 'publish' ? 'publish' : 'revise',
      accuracy: list(r?.accuracy),
      clarity: list(r?.clarity),
      language: list(r?.language),
      structure: list(r?.structure),
      mustFix: list(r?.mustFix),
      summary: typeof r?.summary === 'string' ? r.summary : r ? '' : 'the editor’s reply couldn’t be read',
    };
  }

  /** The original article, read again, plus its daily.dev discussion. */
  private async bundle(article: CuratedArticle): Promise<SourceBundle> {
    const page = await fetchPage(article.url);
    const extracted = extractArticle(page.html, page.url);
    if (!extracted) throw new Error('no readable article on the page');
    if (extracted.words < 300) throw new Error(`too short (${extracted.words} words)`);
    let discussion: string[] = [];
    try {
      discussion = (await this.client!.comments(article.sourceId, 30))
        .map((c) => c.content?.trim() ?? '')
        .filter((c) => c.length >= 60)
        .slice(0, 8);
    } catch {
      /* comments are a bonus */
    }
    return {
      title: article.title,
      url: page.url,
      publisher: article.sourceName,
      tags: article.tags ?? [],
      upvotes: article.upvotes,
      comments: article.comments,
      readTime: article.readTime,
      publishedAt: article.sourcePublishedAt?.toISOString() ?? null,
      markdown: extracted.markdown,
      links: extracted.links,
      discussion,
    };
  }

  /** judge: the cheap model, thinking a bit more than usual; writer/editor: the main model and its fallbacks. */
  private chain(role: 'judge' | 'writer' | 'editor'): Plan[] {
    const { full, saver } = this.assistant.systemChains();
    if (role === 'judge') return saver.map((p) => ({ ...p, effort: 'medium' as Plan['effort'] }));
    return full;
  }

  private async budgetCheck(run: CuratorRun) {
    const share = await this.assistant.globalShare();
    if (share >= this.maxGlobalShare) {
      await this.log(run, `stopping: ${Math.round(share * 100)}% of today’s AI budget is used`);
      throw new Error('daily AI budget reserved for readers');
    }
  }

  /** The account curated posts are published under (created on first use). */
  async systemAuthor(): Promise<User> {
    const existing = await this.users.findOneBy({ githubLogin: this.authorLogin, isSystem: true });
    if (existing) return existing;
    return this.users.save(
      this.users.create({
        githubLogin: this.authorLogin,
        githubId: null,
        email: null,
        name: 'viewmd Editorial',
        avatarUrl: `${this.siteUrl}/icon-192.png`,
        isSystem: true,
      }),
    );
  }

  // ───────────────────────────── admin ─────────────────────────────

  async status() {
    const [runs, articles] = await Promise.all([
      this.runs.find({ order: { startedAt: 'DESC' }, take: 20 }),
      this.articles.find({ order: { updatedAt: 'DESC' }, take: 120, relations: { doc: true } }),
    ]);
    return {
      configured: this.configured,
      tokenSet: this.client !== null,
      autoRun: this.autoRun,
      running: this.current?.runId ?? null,
      settings: {
        topics: this.topics,
        dailyPosts: this.dailyPosts,
        hour: this.hour,
        timeZone: this.timeZone,
        minScore: this.minScore,
        publishScore: this.publishScore,
      },
      runs: runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        candidates: r.candidates,
        scored: r.scored,
        published: r.published,
        drafts: r.drafts,
        log: r.log ?? '',
      })),
      articles: articles.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.url,
        sourceName: a.sourceName,
        topic: a.topic,
        status: a.status,
        score: a.score,
        editorScore: a.editorScore,
        reason: a.reason,
        editorNotes: a.editorNotes,
        upvotes: a.upvotes,
        comments: a.comments,
        tokens: a.tokens,
        model: a.model,
        docId: a.docId,
        docTitle: a.doc?.title ?? null,
        slug: a.doc?.publishedAt ? a.doc.slug : null,
        updatedAt: a.updatedAt.toISOString(),
      })),
    };
  }

  async setPublished(id: string, publish: boolean) {
    const article = await this.articles.findOneBy({ id });
    if (!article?.docId) throw new NotFoundException('This article has no post yet.');
    const author = await this.systemAuthor();
    await this.docs.setSharing(author.id, article.docId, { public: publish, ...(publish && { allowComments: true }) });
    article.status = publish ? 'published' : 'draft';
    article.updatedAt = new Date();
    await this.articles.save(article);
    return { status: article.status };
  }

  /** The written post, for an admin to read before publishing. */
  async preview(id: string) {
    const article = await this.articles.findOneBy({ id });
    if (!article?.docId) throw new NotFoundException('This article has no post yet.');
    const doc = await this.docs.open((await this.systemAuthor()).id, article.docId);
    return {
      title: doc.title,
      content: doc.content,
      slug: doc.publishedAt ? doc.slug : null,
      sources: article.sources ?? [],
      editorScore: article.editorScore,
      editorNotes: article.editorNotes,
    };
  }

  /** Write (again) one article now — e.g. a rejected one an admin likes, or a draft to redo. */
  async rewrite(id: string) {
    const article = await this.articles.findOneBy({ id });
    if (!article) throw new NotFoundException();
    const run = await this.start('manual', { articleId: id });
    return { runId: run.id };
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private async log(run: CuratorRun, line: string) {
    const stamp = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());
    run.log = `${run.log ?? ''}${stamp} ${line}\n`.slice(-200_000);
    this.logger.log(line);
    await this.runs.update(run.id, { log: run.log }).catch(() => undefined);
  }

  private day(date: Date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone }).format(date);
  }

  private localHour(date: Date) {
    return Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: this.timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date),
    );
  }

  /** Midnight today in the curator's time zone. */
  private startOfDay() {
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: this.timeZone }));
    return new Date(now.getTime() - (local.getHours() * 3600 + local.getMinutes() * 60 + local.getSeconds()) * 1000);
  }
}

const NotInIds = (list: CuratedArticle[]) => Not(In(list.map((a) => a.id)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));
