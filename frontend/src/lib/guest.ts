/**
 * What a guest (not signed in) commenter's browser remembers: the name they used last, and the
 * secret for each comment they posted, which lets them edit or delete it for 24 hours.
 */
const NAME_KEY = 'viewmd.guestName'
const TOKENS_KEY = 'viewmd.guestComments'
const TOKEN_TTL_MS = 24 * 3600_000

type Tokens = Record<string, { token: string; at: number }>

function read(): Tokens {
  try {
    const all = JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '{}') as Tokens
    const now = Date.now()
    return Object.fromEntries(Object.entries(all).filter(([, v]) => now - v.at < TOKEN_TTL_MS))
  } catch {
    return {}
  }
}

function write(tokens: Tokens) {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  } catch {
    /* private mode: the guest just can't edit later */
  }
}

export const guest = {
  name(): string {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  },
  setName(name: string) {
    try {
      if (name.trim()) localStorage.setItem(NAME_KEY, name.trim())
    } catch {
      /* ignore */
    }
  },
  /** The secret for a comment this browser posted (still within 24 hours), if any. */
  token(commentId: string): string | undefined {
    return read()[commentId]?.token
  },
  remember(commentId: string, token: string) {
    write({ ...read(), [commentId]: { token, at: Date.now() } })
  },
  forget(commentId: string) {
    const tokens = read()
    delete tokens[commentId]
    write(tokens)
  },
}
