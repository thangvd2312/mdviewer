import clsx from 'clsx'
import {
  ArrowRight,
  Bot,
  BookOpenText,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  EllipsisVertical,
  Globe,
  KeyRound,
  Laptop,
  MessageSquareText,
  MonitorDown,
  PenLine,
  Plus,
  Share,
  Smartphone,
  Sparkles,
  SquarePlus,
  StickyNote,
  Terminal,
  WifiOff,
  Zap,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AgentDialog, agentSnippets, CodeBox, type AgentClient } from '../components/AgentDialog'
import { BlogFooter } from '../components/blog/BlogLayout'
import { buttonClass, Logo } from '../components/ui'
import { usePageAssistant } from '../lib/assistant'
import { useAuth } from '../lib/auth'
import { useInstallApp, type Platform } from '../lib/pwa'
import { useUI } from '../lib/ui'

/** The product page at the site root: what viewmd does, how to connect an AI agent, and how to install it as an app. */
export function FeaturesPage() {
  const { user } = useAuth()
  usePageAssistant(user ? { context: { page: 'other' }, title: 'Features' } : null)

  useEffect(() => {
    document.title = 'viewmd — Markdown notes you read, remember and share'
    // Arriving at /#agents (e.g. back from signing in): scroll the section into view.
    const id = window.location.hash.slice(1)
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => {
      document.title = 'viewmd'
    }
  }, [])

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto">
      <Hero />
      <Overview />
      <Feature
        id="read"
        icon={<BookOpenText />}
        tone="sky"
        eyebrow="Read & write"
        title="Markdown that reads like real documentation"
        text="Paste notes, READMEs or AI answers — or drop in a folder of .md files. Tables, code with syntax highlighting, Mermaid diagrams and a live outline all come out right."
        points={[
          'Write, Split and Preview modes, Tab to indent, ⌘S to save',
          'Projects keep related notes together; ⌘K searches everything',
          'Reading time, word count and a table of contents on every page',
        ]}
        media={
          <BrowserFrame
            src="/landing/editor.webp"
            alt="The editor in split view: Markdown on the left, the rendered page on the right"
            path="/d/…/edit"
          />
        }
      />
      <Feature
        id="notes"
        icon={<StickyNote />}
        tone="amber"
        eyebrow="Sticky notes"
        title="Pin a thought to the exact words"
        text="Select any passage and leave a sticky note on it — important, idea, question, to-do or definition. The highlight stays on the text, and every note is listed beside the page."
        points={[
          'Six colour-coded kinds, filterable in the side panel',
          'Notes are always private — even on a public post',
          'They also feed your review questions',
        ]}
        media={
          <BrowserFrame
            src="/landing/notes.webp"
            alt="A note with highlighted passages and the list of sticky notes beside it"
            path="/d/redis-caching"
          />
        }
        flip
      />
      <Feature
        id="assistant"
        icon={<MessageSquareText />}
        tone="violet"
        eyebrow="Assistant"
        title="An AI that has read the page with you"
        text="Ask about the note you’re reading, or select a passage and ask about just that. Answers are written in Vietnamese, keep technical terms as they are, and point back to the right section."
        points={[
          'Knows the document, the section you’re on and your sticky notes',
          'Chats are saved per document — pick up where you left off',
          'Stays on topic: it won’t drift into recipes or travel plans',
        ]}
        media={
          <Stage tone="violet">
            <PhoneFrame
              src="/landing/assistant-phone.webp"
              alt="The assistant answering a question about the page on a phone"
              className="w-[240px] sm:w-[270px]"
            />
          </Stage>
        }
      />
      <Feature
        id="review"
        icon={<Brain />}
        tone="emerald"
        eyebrow="Review"
        title="Questions that come back right before you’d forget"
        text="viewmd writes review questions from what you asked the assistant, your sticky notes and the key points of each note. FSRS — the scheduler behind modern flashcard apps — decides when each one returns."
        points={[
          'Answer in your own words and let the AI check you',
          'Rate how well you remembered; the next review moves to match',
          'Level up: master a note and harder, scenario-style questions are added for you',
        ]}
        media={
          <div className="relative pb-10 sm:pr-16">
            <BrowserFrame
              src="/landing/review.webp"
              alt="The Review page: today’s questions, streak and documents to quiz yourself on"
              path="/review"
            />
            <PhoneFrame
              src="/landing/review-phone.webp"
              alt="A review question with its answer and the four rating buttons"
              className="absolute right-0 -bottom-2 w-[34%] max-w-[210px] min-w-[130px]"
            />
          </div>
        }
        flip
      />
      <Feature
        id="blog"
        icon={<Globe />}
        tone="rose"
        eyebrow="Blog"
        title="Publish a note in one click"
        text="Turn any note into a public post with a clean link. It shows up on the viewmd Blog with your author page and topics, and readers can comment — signed in or anonymously."
        points={[
          'Link previews in Messenger, Zalo and Slack',
          'Comments with replies; hide or block what you don’t want',
          'Unpublish any time — the link simply stops working',
        ]}
        media={
          <div className="relative pb-10 sm:pr-16">
            <BrowserFrame
              src="/landing/blog.webp"
              alt="The viewmd Blog with the latest and most-read posts"
              path="/blog"
            />
            <PhoneFrame
              src="/landing/post-phone.webp"
              alt="A blog post on a phone"
              className="absolute right-0 -bottom-2 w-[34%] max-w-[210px] min-w-[130px]"
            />
          </div>
        }
      />
      <Agents />
      <InstallSection />
      <Faq />
      <FinalCta />
      <BlogFooter />
    </div>
  )
}

/* ───────────────────────────── Hero ───────────────────────────── */

function Hero() {
  const { user } = useAuth()
  return (
    <section className="relative isolate">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_20%_0%,rgb(47_107_255/0.16),transparent_70%),radial-gradient(50%_55%_at_85%_10%,rgb(122_60_255/0.14),transparent_70%)]"
      />
      <div className="mx-auto max-w-4xl px-4 pt-12 text-center sm:px-8 sm:pt-20">
        <a
          href="#agents"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 py-1 pr-3 pl-1 text-[12.5px] font-medium text-ink-muted shadow-sm backdrop-blur transition hover:text-ink"
        >
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white dark:text-[#0f1020]">
            New
          </span>
          Your AI agents can now save notes for you
          <ArrowRight className="size-3.5" />
        </a>
        <h1 className="mt-6 text-[38px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance sm:text-[60px]">
          Read what you learn.{' '}
          <span className="bg-gradient-to-r from-[#2f6bff] to-[#7a3cff] bg-clip-text text-transparent dark:from-[#79a8ff] dark:to-[#b18cff]">
            Remember it for good.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-pretty text-ink-muted sm:text-[18px]">
          viewmd is a calm home for your Markdown notes. Read them like real documentation, pin sticky notes to the
          words that matter, ask an AI that has read the page, and review until it sticks.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link to={user ? '/note' : '/login'} className={buttonClass('primary', 'h-12 rounded-full px-7 text-[15px]')}>
            {user ? 'Open my notes' : 'Get started — it’s free'} <ArrowRight className="size-4" />
          </Link>
          <a href="#app" className={buttonClass('secondary', 'h-12 rounded-full px-6 text-[15px]')}>
            <Smartphone className="size-4" /> Install the app
          </a>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-faint">
          Sign in with GitHub · Notes stay private until you publish them
        </p>
      </div>

      <div className="relative mx-auto mt-12 max-w-6xl px-4 pb-6 sm:mt-16 sm:px-8 sm:pb-12">
        <BrowserFrame
          src="/landing/hero.webp"
          alt="A note about Redis caching patterns, with the assistant answering a question beside it"
          path="/d/redis-caching"
          eager
        />
        <PhoneFrame
          src="/landing/doc-phone.webp"
          alt="The same note on a phone"
          className="absolute -bottom-2 left-0 hidden w-[190px] md:block lg:-left-6 lg:w-[220px]"
          eager
        />
      </div>
    </section>
  )
}

/* ─────────────────────────── Overview ─────────────────────────── */

const OVERVIEW: { id: string; icon: ReactNode; title: string; text: string; tone: Tone }[] = [
  { id: 'read', icon: <BookOpenText />, title: 'Read & write', text: 'Markdown, code, diagrams', tone: 'sky' },
  { id: 'notes', icon: <StickyNote />, title: 'Sticky notes', text: 'On the exact words', tone: 'amber' },
  { id: 'assistant', icon: <MessageSquareText />, title: 'Assistant', text: 'Ask about the page', tone: 'violet' },
  { id: 'review', icon: <Brain />, title: 'Review', text: 'Spaced repetition', tone: 'emerald' },
  { id: 'blog', icon: <Globe />, title: 'Blog', text: 'Publish & discuss', tone: 'rose' },
  { id: 'agents', icon: <Bot />, title: 'AI agents', text: 'Connect over MCP', tone: 'indigo' },
]

function Overview() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-8 sm:pt-14">
      <h2 className="text-center text-[13px] font-semibold tracking-wide text-ink-faint uppercase">
        Everything in one place
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {OVERVIEW.map((f) => (
          <li key={f.id}>
            <a
              href={`#${f.id}`}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <IconBadge tone={f.tone}>{f.icon}</IconBadge>
              <span>
                <span className="block text-[14px] font-semibold">{f.title}</span>
                <span className="mt-0.5 block text-[12.5px] text-ink-muted">{f.text}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ─────────────────────────── Features ─────────────────────────── */

type Tone = 'sky' | 'amber' | 'violet' | 'emerald' | 'rose' | 'indigo'

const TONES: Record<Tone, { badge: string; stage: string }> = {
  sky: { badge: 'bg-sky-500/12 text-sky-600 dark:text-sky-300', stage: 'from-sky-400/15 to-accent/10' },
  amber: { badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', stage: 'from-amber-300/20 to-rose-300/10' },
  violet: {
    badge: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
    stage: 'from-violet-500/15 via-accent/10 to-sky-400/10',
  },
  emerald: {
    badge: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    stage: 'from-emerald-400/15 to-sky-400/10',
  },
  rose: { badge: 'bg-rose-500/12 text-rose-600 dark:text-rose-300', stage: 'from-rose-400/15 to-amber-300/10' },
  indigo: {
    badge: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300',
    stage: 'from-indigo-500/15 to-violet-500/10',
  },
}

const IconBadge = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]', TONES[tone].badge)}>
    {children}
  </span>
)

function Feature({
  id,
  icon,
  tone,
  eyebrow,
  title,
  text,
  points,
  media,
  flip,
}: {
  id: string
  icon: ReactNode
  tone: Tone
  eyebrow: string
  title: string
  text: string
  points: string[]
  media: ReactNode
  flip?: boolean
}) {
  return (
    <section
      id={id}
      className={clsx(
        'mx-auto grid max-w-6xl scroll-mt-4 items-center gap-10 px-4 py-14 sm:px-8 sm:py-20 lg:gap-16',
        flip ? 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]',
      )}
    >
      <div className={clsx(flip && 'lg:order-2')}>
        <div className="flex items-center gap-2.5">
          <IconBadge tone={tone}>{icon}</IconBadge>
          <span className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">{eyebrow}</span>
        </div>
        <h2 className="mt-4 text-[27px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[34px]">
          {title}
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-pretty text-ink-muted">{text}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[14.5px] leading-snug">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0">{media}</div>
    </section>
  )
}

/** A soft coloured backdrop for a phone screenshot. */
const Stage = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <div
    className={clsx('grid place-items-center rounded-[2rem] bg-gradient-to-br px-6 py-10 sm:py-14', TONES[tone].stage)}
  >
    {children}
  </div>
)

/* ─────────────────────────── Frames ─────────────────────────── */

function BrowserFrame({ src, alt, path, eager }: { src: string; alt: string; path: string; eager?: boolean }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_30px_70px_-30px_rgb(25_25_60/0.35)] sm:rounded-2xl dark:shadow-[0_30px_70px_-30px_rgb(0_0_0/0.8)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-line bg-raised px-3 sm:h-9 sm:px-4" aria-hidden>
        <span className="size-2 rounded-full bg-[#ff5f57] sm:size-2.5" />
        <span className="size-2 rounded-full bg-[#febc2e] sm:size-2.5" />
        <span className="size-2 rounded-full bg-[#28c840] sm:size-2.5" />
        <span className="mx-auto max-w-[60%] truncate rounded-md bg-surface px-3 py-0.5 text-[10.5px] text-ink-faint ring-1 ring-line sm:text-[11.5px]">
          {window.location.host}
          {path}
        </span>
        <span className="w-8 sm:w-10" />
      </div>
      <img
        src={src}
        alt={alt}
        width={1920}
        height={1200}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full"
      />
    </figure>
  )
}

function PhoneFrame({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <figure
      className={clsx(
        'rounded-[2rem] bg-[#16161a] p-[6px] shadow-[0_30px_60px_-24px_rgb(20_20_50/0.5)] ring-1 ring-white/10',
        className,
      )}
    >
      <div className="overflow-hidden rounded-[1.65rem] bg-white">
        <div className="relative h-5 bg-white" aria-hidden>
          <span className="absolute top-[5px] left-1/2 h-[11px] w-[32%] -translate-x-1/2 rounded-full bg-[#16161a]" />
        </div>
        <img
          src={src}
          alt={alt}
          width={780}
          height={1328}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  )
}

/* ─────────────────────────── AI agents (MCP) ─────────────────────────── */

const TOOLS: [string, string][] = [
  ['save_note', 'Save a new note, optionally in a project'],
  ['append_to_note', 'Add a section to an existing note'],
  ['update_note', 'Rewrite or rename a note'],
  ['search_notes', 'Find notes by what they say'],
  ['read_note', 'Read a note, or one section of it'],
  ['list_recent_notes', 'See what you worked on lately'],
  ['list_projects', 'List your projects'],
]

const PROMPTS = [
  'Save what we just figured out about Redis caching to viewmd, in my “Backend” project.',
  'Add this explanation to my “Java generics” note in viewmd.',
  'What did I write in viewmd about cache stampedes?',
]

function Agents() {
  const { user } = useAuth()
  const [client, setClient] = useState<AgentClient>('claude')
  const [connecting, setConnecting] = useState(false)
  const snippets = agentSnippets(`${window.location.origin}/api/mcp`, '<your token>')

  return (
    <section id="agents" className="scroll-mt-4 bg-[#0e0f1a] text-white">
      <div className="relative isolate mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(45%_50%_at_15%_10%,rgb(47_107_255/0.25),transparent_70%),radial-gradient(40%_45%_at_90%_80%,rgb(122_60_255/0.22),transparent_70%)]"
        />
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white [&_svg]:size-[18px]">
                <Bot />
              </span>
              <span className="text-[13px] font-semibold tracking-wide text-white/60 uppercase">AI agents · MCP</span>
            </div>
            <h2 className="mt-4 text-[27px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[36px]">
              Let your AI agents keep your notebook
            </h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-pretty text-white/70">
              viewmd speaks MCP, the open protocol AI agents use to work with other apps. Connect Claude Code, Codex,
              Cursor or any MCP client, then just say “save this to viewmd” — or ask what you already wrote.
            </p>
            <ul className="mt-7 grid gap-2 sm:grid-cols-2">
              {TOOLS.map(([name, what]) => (
                <li key={name} className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                  <code className="font-mono text-[12.5px] text-[#9cc0ff]">{name}</code>
                  <div className="mt-0.5 text-[12.5px] text-white/60">{what}</div>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex gap-2.5 text-[13.5px] leading-relaxed text-white/70">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-white/50" />
              Agents can create, read, add to and edit your notes — never delete or publish them. Each device gets its
              own token, and you can revoke one at any time.
            </p>
          </div>
          <AgentTranscript />
        </div>

        <div className="mt-12 rounded-3xl bg-surface p-5 text-ink shadow-2xl sm:p-8">
          <h3 className="text-[20px] font-semibold tracking-tight">Set it up in a minute</h3>
          <ol className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,4fr)] lg:gap-10">
            <SetupStep n={1} title="Create a token">
              <p>
                In viewmd, click the <Bot className="inline size-4 align-[-3px]" /> robot icon at the bottom of the
                sidebar, then <span className="font-medium text-ink">Create token</span>. Copy it — it’s shown once.
              </p>
              {user ? (
                <button
                  type="button"
                  onClick={() => setConnecting(true)}
                  className={buttonClass('primary', 'mt-4 h-10 rounded-full px-5')}
                >
                  <KeyRound className="size-4" /> Create a token
                </button>
              ) : (
                <Link
                  to="/login"
                  state={{ from: '/#agents' }}
                  className={buttonClass('primary', 'mt-4 h-10 rounded-full px-5')}
                >
                  Sign in to create a token
                </Link>
              )}
            </SetupStep>
            <SetupStep n={2} title="Add viewmd to your agent">
              <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-hover p-1" role="tablist">
                {(Object.keys(snippets) as AgentClient[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={client === c}
                    onClick={() => setClient(c)}
                    className={clsx(
                      'h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium transition',
                      client === c ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {snippets[c].label}
                  </button>
                ))}
              </div>
              <p className="mt-3">{snippets[client].hint}</p>
              <CodeBox code={snippets[client].code} multiline={client !== 'claude'} className="mt-2" />
              <p className="mt-2 text-[12.5px] text-ink-faint">
                Replace <code className="font-mono">&lt;your token&gt;</code> — the dialog in step 1 fills it in for
                you.
              </p>
            </SetupStep>
            <SetupStep n={3} title="Ask in plain words">
              <ul className="space-y-2.5">
                {PROMPTS.map((p) => (
                  <li key={p} className="flex gap-2">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-500" />“{p}”
                  </li>
                ))}
              </ul>
            </SetupStep>
          </ol>
        </div>
      </div>
      {user && <AgentDialog open={connecting} onClose={() => setConnecting(false)} />}
    </section>
  )
}

const SetupStep = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <li className="min-w-0 text-[14px] leading-relaxed text-ink-muted">
    <h4 className="mb-3 flex items-center gap-2.5 text-[15px] font-semibold text-ink">
      <span className="grid size-6 place-items-center rounded-full bg-ink text-[12px] text-surface">{n}</span>
      {title}
    </h4>
    {children}
  </li>
)

/** An illustration of an agent session using the viewmd tools. */
function AgentTranscript() {
  const host = window.location.host
  return (
    <figure
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#07080f] font-mono text-[12.5px] leading-relaxed shadow-2xl sm:text-[13px]"
      aria-label="Example: an AI agent saving and searching notes in viewmd"
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-white/10 px-4" aria-hidden>
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 flex items-center gap-1.5 font-sans text-[12px] text-white/50">
          <Terminal className="size-3.5" /> your agent
        </span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <Turn prompt="Save what we just figured out about Redis caching to viewmd, in my “Backend” project." />
        <ToolCall name="save_note" result={`Saved “Redis caching patterns” in Backend → ${host}/d/3f9c…`} />
        <p className="text-white/85">
          Done — it’s in your Backend project, with the stampede fixes as their own section.
        </p>
        <Turn prompt="What did I write about cache stampedes?" />
        <ToolCall
          name="search_notes"
          args="“cache stampede”"
          result="1 note · Redis caching patterns › Cache stampede"
        />
        <p className="text-white/85">
          You listed three fixes: request coalescing, early refresh, and a{' '}
          <span className="text-[#9cc0ff]">SET … NX</span> lock so only one worker rebuilds the key.
        </p>
      </div>
    </figure>
  )
}

const Turn = ({ prompt }: { prompt: string }) => (
  <p className="flex gap-2 text-white">
    <span className="text-[#7ee2a8]">›</span>
    <span>{prompt}</span>
  </p>
)

const ToolCall = ({ name, args, result }: { name: string; args?: string; result: string }) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
    <div className="flex flex-wrap items-center gap-x-2 text-white/80">
      <Zap className="size-3.5 text-[#febc2e]" />
      <span>
        viewmd · <span className="text-[#9cc0ff]">{name}</span>
        {args && <span className="text-white/50"> {args}</span>}
      </span>
    </div>
    <div className="mt-1 flex gap-2 text-white/55">
      <span aria-hidden>└</span>
      <span className="min-w-0 break-words">{result}</span>
    </div>
  </div>
)

/* ─────────────────────────── Install as an app ─────────────────────────── */

const PLATFORMS: { id: Platform; icon: ReactNode; title: string; browser: string; steps: ReactNode[] }[] = [
  {
    id: 'ios',
    icon: <Smartphone />,
    title: 'iPhone & iPad',
    browser: 'Safari',
    steps: [
      <>Open this site in Safari.</>,
      <>
        Tap <Share className="inline size-4 align-[-3px]" /> <b>Share</b> in the toolbar.
      </>,
      <>
        Choose <SquarePlus className="inline size-4 align-[-3px]" /> <b>Add to Home Screen</b>, then <b>Add</b>.
      </>,
    ],
  },
  {
    id: 'android',
    icon: <Smartphone />,
    title: 'Android',
    browser: 'Chrome',
    steps: [
      <>Open this site in Chrome.</>,
      <>
        Tap <b>Install</b> here — or open the <EllipsisVertical className="inline size-4 align-[-3px]" /> menu and
        choose <b>Install app</b>.
      </>,
      <>Open viewmd from your home screen like any other app.</>,
    ],
  },
  {
    id: 'desktop',
    icon: <Laptop />,
    title: 'Mac, Windows & Linux',
    browser: 'Chrome or Edge',
    steps: [
      <>Open this site in Chrome or Edge.</>,
      <>
        Click the <MonitorDown className="inline size-4 align-[-3px]" /> install icon at the right of the address bar.
      </>,
      <>viewmd gets its own window and a Dock / taskbar icon.</>,
    ],
  },
]

function InstallSection() {
  const app = useInstallApp()
  const { toast } = useUI()

  const install = async () => {
    if (await app.install()) toast('viewmd is installed — find it on your home screen')
  }

  return (
    <section id="app" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-8 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div>
          <div className="flex items-center gap-2.5">
            <IconBadge tone="sky">
              <Smartphone />
            </IconBadge>
            <span className="text-[13px] font-semibold tracking-wide text-ink-muted uppercase">On your phone</span>
          </div>
          <h2 className="mt-4 text-[27px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[36px]">
            Install it like a normal app
          </h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-pretty text-ink-muted">
            Add viewmd to your home screen and it opens full-screen with its own icon — no app store, nothing to update,
            and everything stays in sync with the web.
          </p>

          <div className="mt-7">
            {app.installed ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 text-[14px]">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                You’re using the viewmd app on this device.
              </div>
            ) : app.canPrompt ? (
              <button
                type="button"
                onClick={install}
                className={buttonClass('primary', 'h-12 w-full rounded-full px-7 text-[15px] sm:w-auto')}
              >
                <Download className="size-4" /> Install viewmd
              </button>
            ) : app.platform === 'ios' ? (
              <p className="flex items-start gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-3 text-[14px] leading-relaxed">
                <Share className="mt-0.5 size-5 shrink-0 text-accent" />
                <span>
                  On this {/iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone'}: tap <b>Share</b>, then{' '}
                  <b>Add to Home Screen</b>.
                </span>
              </p>
            ) : null}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {PLATFORMS.map((p) => {
              const here = !app.installed && p.id === app.platform
              return (
                <li
                  key={p.id}
                  className={clsx(
                    'relative rounded-2xl border p-4',
                    here ? 'border-accent/50 bg-accent/[0.04] ring-1 ring-accent/30' : 'border-line',
                  )}
                >
                  {here && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-white dark:text-[#0f1020]">
                      This device
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-[14px] font-semibold [&_svg]:size-4">
                    {p.icon}
                    {p.title}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-faint">{p.browser}</div>
                  <ol className="mt-3 space-y-2 text-[13px] leading-snug text-ink-muted">
                    {p.steps.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="grid size-4.5 shrink-0 place-items-center rounded-full bg-hover text-[10.5px] font-semibold text-ink">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              )
            })}
          </ul>

          <ul className="mt-8 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
            {[
              [<Smartphone key="i" />, 'Full screen — no browser bars'],
              [<Plus key="i" />, 'Long-press the icon for New note, Review, Blog (Android)'],
              [<PenLine key="i" />, 'Same account and notes as on the web'],
              [<WifiOff key="i" />, 'Tells you when you’re offline instead of breaking'],
            ].map(([icon, text]) => (
              <li
                key={String(text)}
                className="flex items-center gap-2.5 text-ink-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink"
              >
                {icon}
                {text}
              </li>
            ))}
          </ul>
        </div>

        <Stage tone="sky">
          <div className="relative">
            <PhoneFrame
              src="/landing/home-phone.webp"
              alt="viewmd opened as an app on a phone"
              className="w-[240px] sm:w-[270px]"
            />
            <div className="absolute bottom-24 -left-12 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface/95 py-2 pr-4 pl-2 shadow-xl backdrop-blur sm:flex">
              <Logo className="size-9" />
              <div className="leading-tight">
                <div className="text-[13px] font-semibold">viewmd</div>
                <div className="text-[11.5px] text-ink-faint">on your home screen</div>
              </div>
            </div>
          </div>
        </Stage>
      </div>
    </section>
  )
}

/* ─────────────────────────── FAQ & closing ─────────────────────────── */

const FAQ: [string, ReactNode][] = [
  [
    'Is viewmd free?',
    'Yes. Sign in with GitHub and start writing. The assistant has a daily allowance per person so it stays free for everyone; when you ask a lot, it switches to a lighter model instead of stopping.',
  ],
  [
    'Who can see my notes?',
    'Only you. A note becomes public only when you publish it, and you can unpublish at any time. Sticky notes, chats with the assistant and review questions are always private.',
  ],
  [
    'What can a connected AI agent do?',
    'Save new notes, add to or edit existing ones, search and read them, and list your projects. It can’t delete or publish anything, and revoking its token cuts it off immediately.',
  ],
  [
    'Which language does the assistant answer in?',
    'Vietnamese — even when your notes are in English. Code, commands and the usual English technical terms are kept as they are. Review questions are written the same way.',
  ],
  [
    'Do I need to install anything?',
    'No. viewmd works in any modern browser. Installing it to your home screen is optional — it just makes it feel like a native app.',
  ],
]

function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-8 sm:pb-24">
      <h2 className="text-center text-[27px] font-semibold tracking-[-0.025em] sm:text-[34px]">Questions</h2>
      <div className="mt-8 divide-y divide-line rounded-2xl border border-line">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group px-5 py-1">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-3.5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{q}</span>
              <ChevronDown className="size-4 shrink-0 text-ink-faint transition group-open:rotate-180" />
            </summary>
            <p className="pb-4 text-[14.5px] leading-relaxed text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  const { user } = useAuth()
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 sm:pb-24">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#2f6bff] to-[#7a3cff] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_80%_at_80%_0%,rgb(255_255_255/0.22),transparent_70%)]"
        />
        <h2 className="text-[27px] leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-[38px]">
          Start with one note.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-relaxed text-white/85">
          Paste something you’re learning right now. In a week, viewmd will ask you about it — right before you’d have
          forgotten.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            to={user ? '/new' : '/login'}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold text-[#1f2a5c] transition hover:bg-white/90"
          >
            {user ? 'Write a note' : 'Get started — it’s free'} <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/blog"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-6 text-[15px] font-medium text-white transition hover:bg-white/10"
          >
            Read the blog
          </Link>
        </div>
      </div>
    </section>
  )
}
