import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Bot, Check, Copy, KeyRound, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError, type ApiTokenInfo } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useUI } from '../lib/ui'
import { Button, ConfirmDialog, inputClass, Modal } from './ui'

const TOKENS_KEY = ['tokens'] as const

export type AgentClient = 'claude' | 'codex' | 'other'
type Client = AgentClient

/** The one-time setup for each kind of MCP client (also shown on the Features page). */
export function agentSnippets(
  url: string,
  token: string,
): Record<AgentClient, { label: string; hint: string; code: string }> {
  return {
    claude: {
      label: 'Claude Code',
      hint: 'Run in a terminal:',
      code: `claude mcp add --transport http viewmd ${url} --header "Authorization: Bearer ${token}"`,
    },
    codex: {
      label: 'Codex',
      hint: 'Put the token in your shell profile (e.g. ~/.zshrc), then add the server:',
      code: `export VIEWMD_TOKEN=${token}\ncodex mcp add viewmd --url ${url} --bearer-token-env-var VIEWMD_TOKEN`,
    },
    other: {
      label: 'Cursor & others',
      hint: 'Any MCP client with streamable HTTP — e.g. in Cursor’s mcp.json:',
      code: JSON.stringify({ mcpServers: { viewmd: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2),
    },
  }
}

/**
 * Connect an AI agent (Claude Code, Codex, Cursor… — anything that speaks MCP) to the user's notes:
 * create a token, copy the setup line for their client, manage tokens.
 */
export function AgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useUI()
  const queryClient = useQueryClient()
  const tokens = useQuery({ queryKey: TOKENS_KEY, queryFn: api.tokens.list, enabled: open })
  const [name, setName] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [client, setClient] = useState<Client>('claude')
  const [revoking, setRevoking] = useState<ApiTokenInfo | null>(null)
  const url = `${window.location.origin}/api/mcp`
  const token = created ?? '<your token>'

  const create = useMutation({
    mutationFn: () => api.tokens.create(name.trim() || defaultName()),
    onSuccess: (t) => {
      setCreated(t.token)
      setName('')
      void queryClient.invalidateQueries({ queryKey: TOKENS_KEY })
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t create a token'),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.tokens.revoke(id),
    onSuccess: () => {
      toast('Token revoked — agents using it lose access')
      void queryClient.invalidateQueries({ queryKey: TOKENS_KEY })
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Couldn’t revoke the token'),
  })

  const close = () => {
    setCreated(null) // the secret is never shown again once the dialog closes
    onClose()
  }

  const snippets = agentSnippets(url, token)

  return (
    <Modal open={open} onClose={close} title="Connect an AI agent" className="max-w-2xl">
      <div className="space-y-6 px-5 pt-2 pb-6">
        <p className="text-[14px] leading-relaxed text-ink-muted">
          Let Claude Code, Codex, Cursor or any MCP client save what you learn straight into your notes — and look up
          what you’ve already written. Agents can create, add to and edit notes; they can’t delete or publish anything.
        </p>

        <Step n={1} title="Create a token">
          {created ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-amber-800 dark:text-amber-300">
                <TriangleAlert className="size-4" /> Copy it now — you won’t be able to see it again.
              </div>
              <CodeBox code={created} className="mt-2.5" />
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                create.mutate()
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder={defaultName()}
                aria-label="Token name"
                className={clsx(inputClass, 'h-10 min-w-0 flex-1 text-[16px] sm:text-[14px]')}
              />
              <Button type="submit" variant="primary" className="h-10 shrink-0" disabled={create.isPending}>
                <KeyRound className="size-4" /> {create.isPending ? 'Creating…' : 'Create token'}
              </Button>
            </form>
          )}
          <p className="mt-2 text-[12.5px] text-ink-faint">
            One token per device or agent, so you can revoke it on its own. Anyone with the token can read and edit your
            notes.
          </p>
        </Step>

        <Step n={2} title="Add viewmd to your agent">
          <div role="tablist" aria-label="Client" className="inline-flex rounded-full bg-hover p-1">
            {(Object.keys(snippets) as Client[]).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={client === c}
                onClick={() => setClient(c)}
                className={clsx(
                  'h-8 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition',
                  client === c ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {snippets[c].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-muted">{snippets[client].hint}</p>
          {/* Commands wrap (long lines on phones); JSON keeps its layout and scrolls. */}
          <CodeBox code={snippets[client].code} className="mt-1.5" multiline={client === 'other'} />
          {!created && (
            <p className="mt-2 text-[12.5px] text-ink-faint">Create a token above and it’s filled in for you.</p>
          )}
        </Step>

        <Step n={3} title="Ask your agent">
          <ul className="space-y-1.5 text-[13.5px] text-ink-muted">
            {[
              'Save what we just figured out about Redis caching to viewmd, in my “Backend” project.',
              'Add this explanation to my “Java Core” note in viewmd.',
              'What did I write in viewmd about the JVM memory model?',
            ].map((p) => (
              <li key={p} className="flex gap-2">
                <Bot className="mt-0.5 size-4 shrink-0 text-ink-faint" />“{p}”
              </li>
            ))}
          </ul>
        </Step>

        {(tokens.data?.length ?? 0) > 0 && (
          <section className="border-t border-line pt-4">
            <h3 className="text-[13.5px] font-medium">Your tokens</h3>
            <ul className="mt-2 divide-y divide-line">
              {tokens.data!.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <KeyRound className="size-4 shrink-0 text-ink-faint" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13.5px]">{t.name}</div>
                    <div className="truncate text-[12px] text-ink-faint">
                      <span className="font-mono">{t.prefix}…</span> · created {timeAgo(t.createdAt)} ·{' '}
                      {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : 'never used'}
                    </div>
                  </div>
                  <Button variant="ghost" className="h-8 shrink-0 text-danger" onClick={() => setRevoking(t)}>
                    <Trash2 className="size-3.5" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={revoking !== null}
        title="Revoke token?"
        confirmLabel="Revoke"
        message={`Agents using “${revoking?.name}” will lose access to your notes right away.`}
        busy={revoke.isPending}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking.id)
          setRevoking(null)
        }}
        onClose={() => setRevoking(null)}
      />
    </Modal>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold">
        <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-surface">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function CodeBox({ code, className, multiline }: { code: string; className?: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className={clsx('relative rounded-xl border border-line bg-raised', className)}>
      <pre
        className={clsx(
          'overflow-x-auto py-3 pr-12 pl-3.5 font-mono text-[12.5px] leading-relaxed text-ink',
          multiline ? 'whitespace-pre' : 'break-all whitespace-pre-wrap',
        )}
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
        title={copied ? 'Copied' : 'Copy'}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg bg-surface text-ink-muted shadow-sm ring-1 ring-line transition hover:text-ink"
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

/** "Claude Code on Mac" style default from the browser's platform. */
function defaultName() {
  const ua = navigator.userAgent
  const device = /iPhone|iPad/.test(ua)
    ? 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'my computer'
  return `Agent on ${device}`
}
