/**
 * Hides sensitive information in what the public sees of a document. Covers:
 * - secrets: API keys and tokens, passwords, private keys, credentials in URLs;
 * - personal data: emails, phone numbers, IP addresses, card and ID numbers;
 * - whatever the author marks as private: `<!-- private -->…<!-- /private -->` hides a whole part,
 *   `||text||` hides a few words.
 *
 * The stored document never changes. Its owner always sees it whole; the blog, link previews and
 * other readers' assistant get the masked copy.
 */

import { deriveTitle, makeExcerpt, topicsOf } from './markdown.util';

export type SensitiveKind =
  | 'secret'
  | 'token'
  | 'private-key'
  | 'email'
  | 'phone'
  | 'ip'
  | 'card'
  | 'id-number'
  | 'marked'
  | 'hidden-block';

export interface Finding {
  kind: SensitiveKind;
  /** What gets hidden (shown to the author only, before publishing). */
  value: string;
}

export interface Redaction {
  text: string;
  findings: Finding[];
}

type Hit = (kind: SensitiveKind, value: string) => void;

/** Stands for a hidden value while the rules run; swapped for the visible mask at the end. */
const M = '\u0000';
const MASK = '***';
/** In Markdown prose the mask is escaped, so it shows as "***" instead of turning into emphasis or a rule. */
const PROSE_MASK = '\\*\\*\\*';

// ---------------------------------------------------------------------------------------------
// What looks like a placeholder, a reference in code, or a real credential

const PLACEHOLDER_WORDS = new Set([
  'true',
  'false',
  'null',
  'none',
  'nil',
  'undefined',
  'required',
  'optional',
  'string',
  'number',
  'boolean',
  'str',
  'int',
  'any',
  'empty',
  'secret',
  'password',
  'passwd',
  'token',
  'changeme',
  'placeholder',
  'redacted',
  'hidden',
  'example',
  'xxx',
  'todo',
  'value',
  'foo',
  'bar',
  'baz',
  'test',
  'demo',
  'dummy',
  'sample',
]);

function isPlaceholder(raw: string): boolean {
  const v = raw.trim();
  if (v.length < 3) return true;
  if (v.includes(M)) return true;
  if (PLACEHOLDER_WORDS.has(v.toLowerCase())) return true;
  if (/^([*xX.…_#-])\1*$/.test(v)) return true;
  // <your-key>, [token], {secret}, ${VAR}, $(cmd), %VAR%, {{ var }}, $VAR, ?, :name, @param
  if (/^(?:<.*>|\[.*\]|\{.*\}|\$\{.*\}|\$\(.*\)|%[^%]+%|\{\{.*\}\})$/.test(v)) return true;
  if (/^(?:\$[A-Za-z_{(]|[?:@]\w*$)/.test(v)) return true;
  if (/^(?:your|my|some|a|an|the)[-_ ]/i.test(v)) return true;
  if (/^(?:process\.env|import\.meta\.env|os\.environ|os\.getenv|env\(|getenv|System\.getenv)/i.test(v)) return true;
  return false;
}

/** A value in code that refers to something else (a variable, a call), not a literal credential. */
const isCodeRef = (v: string) =>
  /[()<>[\]]/.test(v) ||
  /^(?:\/\/|https?:|#|\*|_)/.test(v) ||
  /^(?:await|new|this|self|typeof|function|async|require|import)\b/.test(v) ||
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(v);

/**
 * Looks like a real password or key rather than an ordinary word or name: has a digit, or symbols
 * (then at least 6 characters). Words alone, even in camelCase (`privateKeyStream`), don't count.
 */
const credentialish = (v: string) =>
  v.length >= 3 && !isCodeRef(v) && (/\d/.test(v) || (/[^\p{L}\p{N}_]/u.test(v) && v.length >= 6));

/** Strip what usually follows a value in prose: punctuation, a closing quote or bracket. */
const trimValue = (v: string) => v.replace(/^[`"'([{<]+/, '').replace(/[`"')\]}>.,;:!?]+$/, '');

// ---------------------------------------------------------------------------------------------
// Names of things that hold secrets: PASSWORD, apiKey, client_secret, X-Auth-Token…

const SECRET_WORDS = new Set([
  'password',
  'passwd',
  'pass',
  'pwd',
  'passphrase',
  'passcode',
  'secret',
  'secrets',
  'token',
  'tokens',
  'apikey',
  'credential',
  'credentials',
  'cookie',
  'cookies',
  'salt',
  'dsn',
  'otp',
  'privatekey',
  'pat',
]);
const SECRET_PAIRS = new Set([
  'api key',
  'access key',
  'private key',
  'secret key',
  'client secret',
  'auth key',
  'session id',
  'session key',
  'signing key',
  'encryption key',
  'master key',
  'webhook url',
  'pin code',
  'account key',
  'connection string',
]);
/** Settings about a secret rather than the secret itself: TOKEN_EXPIRES_IN, password_min_length… */
const NOT_SECRET_WORDS = new Set([
  'expires',
  'expire',
  'expiry',
  'expiration',
  'ttl',
  'length',
  'len',
  'size',
  'max',
  'min',
  'timeout',
  'count',
  'limit',
  'type',
  'types',
  'label',
  'placeholder',
  'header',
  'endpoint',
  'path',
  'file',
  'prefix',
  'hint',
  'field',
  'policy',
  'rounds',
  'algorithm',
  'algo',
  'enabled',
  'required',
  'issuer',
  'audience',
  'url',
  'uri',
  'name',
  'reset',
  'forgot',
  'confirm',
  'confirmation',
  'strength',
  'input',
  'form',
  'mode',
  'format',
]);

const words = (name: string) =>
  name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean);

function isSecretName(name: string): boolean {
  const w = words(name);
  const pairs = w.slice(1).map((x, i) => `${w[i]} ${x}`);
  if (pairs.some((p) => SECRET_PAIRS.has(p))) return true;
  if (!w.some((x) => SECRET_WORDS.has(x))) return false;
  return !w.some((x) => NOT_SECRET_WORDS.has(x));
}

// ---------------------------------------------------------------------------------------------
// Rules: each takes text and returns it with what it found replaced by M

type Rule = (text: string, hit: Hit) => string;

/** A regex rule whose whole match is the secret. */
const whole =
  (kind: SensitiveKind, re: RegExp, keep: (match: string) => boolean = () => true): Rule =>
  (text, hit) =>
    text.replace(re, (m) => {
      if (!keep(m)) return m;
      hit(kind, m);
      return M;
    });

const PRIVATE_KEY: Rule = (text, hit) =>
  text.replace(
    /(-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----)([\s\S]*?)(-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
    (_, begin: string, body: string, end: string) => {
      if (!body.trim() || body.includes(M)) return _;
      hit('private-key', `${begin}…`);
      return `${begin}\n${M}\n${end}`;
    },
  );

/** scheme://user:password@host — the password goes, the user and host stay. */
const URL_CREDENTIALS: Rule = (text, hit) =>
  text.replace(
    /\b([a-z][a-z0-9+.-]{1,20}:\/\/)([^\s:/@'"`<>()[\]]*):([^\s@/'"`<>()[\]]+)@/gi,
    (m, scheme: string, user: string, password: string) => {
      if (isPlaceholder(password)) return m;
      hit('secret', password);
      return `${scheme}${user}:${M}@`;
    },
  );

/** Formats of well-known keys and tokens. */
const TOKENS: RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g, // GitHub
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g, // GitLab
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, // Slack
  /\bxapp-[A-Za-z0-9-]{10,}/g,
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g,
  /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/[\w/-]+/g,
  /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[A-Z0-9]{16}\b/g, // AWS
  /\bAIza[0-9A-Za-z_-]{35}/g, // Google
  /\bya29\.[0-9A-Za-z_-]{20,}/g,
  /\bGOCSPX-[0-9A-Za-z_-]{20,}/g,
  /\bsk-(?:ant-|proj-|svcacct-|admin-|or-)?[A-Za-z0-9_-]{20,}/g, // OpenAI, Anthropic, OpenRouter…
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, // Stripe
  /\bwhsec_[A-Za-z0-9]{20,}/g,
  /\bcf[a-z]{2,4}_[A-Za-z0-9]{30,}/g, // Cloudflare
  /\bnpm_[A-Za-z0-9]{30,}/g,
  /\bpypi-[A-Za-z0-9_-]{40,}/g,
  /\bhf_[A-Za-z0-9]{30,}/g, // Hugging Face
  /\bSG\.[\w-]{16,}\.[\w-]{16,}/g, // SendGrid
  /\bdop_v1_[a-f0-9]{40,}/g, // DigitalOcean
  /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}/g, // Shopify
  /\bxai-[A-Za-z0-9]{40,}/g,
  /\bgsk_[A-Za-z0-9]{40,}/g, // Groq
  /\bEAA[A-Za-z0-9]{50,}/g, // Facebook
  /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}/g, // Telegram bot
  /\bvmd_[A-Za-z0-9_-]{20,}/g, // viewmd agent tokens
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
];
const KNOWN_TOKENS: Rule = (text, hit) => TOKENS.reduce((t, re) => whole('token', re)(t, hit), text);

/** Authorization: Bearer <token> */
const AUTH_HEADER: Rule = (text, hit) =>
  text.replace(/\b(Bearer|Basic|Token)([ \t]+)([A-Za-z0-9._~+/=-]{16,})/g, (m, scheme: string, sp: string, value: string) => {
    if (!/\d/.test(value) || isPlaceholder(value)) return m;
    hit('token', value);
    return `${scheme}${sp}${M}`;
  });

/** ?access_token=…&api_key=… */
const QUERY_SECRETS: Rule = (text, hit) =>
  text.replace(/([?&])([\w.-]{1,40})=([^&\s#'"`<>)\]]+)/g, (m, sep: string, name: string, value: string) => {
    if (!(isSecretName(name) || /^(?:key|sig|signature|code|auth|access_token|apikey)$/i.test(name))) return m;
    if (isPlaceholder(value)) return m;
    hit('secret', value);
    return `${sep}${name}=${M}`;
  });

/**
 * Assignments in config and code: `DB_PASSWORD=…`, `apiKey: "…"`, `"token": "…"`, `--password …`.
 * Quoted values and env-style names (SCREAMING_CASE) always count; elsewhere the value must look
 * like a credential, so `password: string` or `token = getToken()` stay.
 */
const ASSIGNMENTS: Rule = (text, hit) =>
  text
    .replace(
      /(^|[\s,;{([]|\bexport[ \t]+|\bset[ \t]+)(["'`]?)([A-Za-z_][\w.-]{0,60})\2([ \t]*(?::=|=>|:|=)[ \t]*)(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`|([^\s,;'"`)}\]]+))/gm,
      (m, lead: string, q: string, name: string, sep: string, dq?: string, sq?: string, bq?: string, bare?: string) => {
        if (!isSecretName(name)) return m;
        const quoted = dq ?? sq ?? bq;
        const value = quoted ?? bare ?? '';
        if (!value || /^[=>]/.test(value) || isPlaceholder(value)) return m;
        // "password for the user, if required": a description, not a password.
        if (quoted !== undefined && /\s/.test(value) && !/\d/.test(value)) return m;
        const envStyle = /^[A-Z][A-Z\d_]*$/.test(name) && /=/.test(sep);
        if (quoted === undefined && !envStyle && !credentialish(value)) return m;
        hit('secret', value);
        const shown =
          quoted !== undefined
            ? `${dq !== undefined ? '"' : sq !== undefined ? "'" : '`'}${M}${dq !== undefined ? '"' : sq !== undefined ? "'" : '`'}`
            : (bare ?? '').replace(value, M);
        return `${lead}${q}${name}${q}${sep}${shown}`;
      },
    )
    .replace(
      /(?<=^|[\s'"])(--(?:password|passwd|pass|token|api-key|apikey|secret|client-secret|auth-token)(?:=|[ \t]+))("[^"\n]*"|'[^'\n]*'|[^\s'"`]+)/gi,
      (m, flag: string, raw: string) => {
        const value = raw.replace(/^["']|["']$/g, '');
        if (isPlaceholder(value)) return m;
        hit('secret', value);
        return `${flag}${M}`;
      },
    );

/** In sentences: "mật khẩu: 123456", "pass ssh là abc123", "password is hunter2". */
const LABELLED_SECRETS: Rule = (text, hit) =>
  text.replace(
    /(?<![\p{L}\p{N}_])(mật khẩu|mat khau|mật mã|mã bảo mật|khóa bí mật|khoá bí mật|password|passwd|passcode|pass|pwd|mk|mã pin|pin|mã otp|otp|secret|token|api key)(?![\p{L}\p{N}_-])([\p{L}\p{N} \t]{0,24}?)([ \t]*(?::|=|(?<=\s)là(?=\s)|(?<=\s)is(?=\s))[ \t]*)(`?)([^\s`]+)/giu,
    (m, label: string, middle: string, sep: string, tick: string, raw: string) => {
      const value = trimValue(raw);
      if (!value || isPlaceholder(value) || !credentialish(value)) return m;
      hit('secret', value);
      return `${label}${middle}${sep}${tick}${raw.replace(value, M)}`;
    },
  );

/** Numbers that identify a person, given with their label: CCCD, passport, bank account, tax code… */
const ID_NUMBERS: Rule = (text, hit) =>
  text.replace(
    /(?<![\p{L}\p{N}_])(cccd|cmnd|cmt|căn cước(?: công dân)?|hộ chiếu|passport(?: no\.?| number)?|stk|số tài khoản|số tk|tài khoản ngân hàng|tk ngân hàng|account (?:no\.?|number)|iban|mst|mã số thuế|bhxh|số bhxh|ssn|tax id|national id)(?![\p{L}\p{N}_])([^\n\d]{0,24}?)((?:[A-Z]{1,3}[ -]?)?\d[\d .-]{4,30}\d)/giu,
    (m, label: string, middle: string, value: string) => {
      if ((value.match(/\d/g) ?? []).length < 6) return m;
      hit('id-number', value);
      return `${label}${middle}${M}`;
    },
  );

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
};

const CARDS = whole('card', /(?<![\d.,-])[3-6]\d{3}(?:[ -]?\d){9,15}(?![\d-])/g, (m) => {
  const digits = m.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 && luhn(digits);
});

/** Addresses written as examples (example.com, *.test) and git remotes (git@github.com) aren't anyone's email. */
const NOT_EMAIL_DOMAIN =
  /(?:^|\.)(?:example\.(?:com|org|net)|example|test|invalid|localhost|local|domain\.com|yourdomain\.com|email\.com|mail\.com)$/i;
const FILE_EXTENSIONS =
  /^(?:png|jpe?g|gif|svg|webp|avif|ico|js|mjs|cjs|ts|tsx|jsx|css|scss|json|md|html?|xml|ya?ml|txt|pdf|zip|gz|mp[34]|wasm|map)$/i;

const EMAILS = whole(
  'email',
  /(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}(?![\w-]|\.[A-Za-z])/g,
  (m) => {
    const [local, domain] = [m.slice(0, m.lastIndexOf('@')), m.slice(m.lastIndexOf('@') + 1)];
    if (NOT_EMAIL_DOMAIN.test(domain)) return false;
    if (local === 'git' && /(?:^|\.)(?:github|gitlab|bitbucket)\.(?:com|org)$/i.test(domain)) return false;
    return !FILE_EXTENSIONS.test(domain.slice(domain.lastIndexOf('.') + 1));
  },
);

/**
 * Phone numbers: Vietnamese mobiles (09x, 03x…, +84) and landlines (02x), and international numbers
 * written with a +. Not part of a longer number, a version or a decimal.
 */
const PHONES: Rule = (text, hit) => {
  const vn = whole(
    'phone',
    /(?<![\w+.\-/:])(?:(?:\+84|\(\+84\)|0084)[ .-]?|0)(?:[35789]\d(?:[ .-]?\d){7}|2\d(?:[ .-]?\d){8})(?!\d|[.-]\d)/g,
  );
  const intl = whole(
    'phone',
    /(?<![\w+])\+\d{1,3}[ .-]?(?:\(\d{1,4}\)[ .-]?)?\d{2,4}(?:[ .-]?\d{2,4}){1,4}(?!\d|[.-]\d)/g,
    (m) => {
      const n = m.replace(/\D/g, '').length;
      return n >= 9 && n <= 15;
    },
  );
  return intl(vn(text, hit), hit);
};

/** Well-known public addresses and documentation ranges are fine to show. */
const PUBLIC_IPS = new Set(['0.0.0.0', '8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '255.255.255.255']);
const IPV4: Rule = (text, hit) =>
  text.replace(
    /(?<![\w./-])((?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3})(?!\w|\.\d)/g,
    (m, ip: string, offset: number, all: string) => {
      if (PUBLIC_IPS.has(ip) || /^(?:127|0|255)\./.test(ip)) return m;
      if (/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./.test(ip)) return m;
      const before = all.slice(Math.max(0, offset - 40), offset);
      if (/(?:\b(?:v|ver|version|release|section|chapter|mục|điều)|§)[ \t]*$/i.test(before)) return m;
      hit('ip', ip);
      return M;
    },
  );

const IPV6 = whole('ip', /(?<![\w:.])(?:[0-9A-Fa-f]{0,4}:){3,7}[0-9A-Fa-f]{0,4}(?![\w:])/g, (m) => {
  if (/^2001:0?db8:/i.test(m)) return false;
  if (m === '::' || /^::1?$/.test(m) || /^(?:0{0,4}:){2,}0{0,4}1?$/.test(m)) return false;
  const hex = m.replace(/:/g, '');
  return hex.length >= 8 && (/[a-f]/i.test(hex) || m.includes('::') || (m.match(/:/g) ?? []).length >= 5);
});

const RULES: Rule[] = [
  PRIVATE_KEY,
  URL_CREDENTIALS,
  KNOWN_TOKENS,
  AUTH_HEADER,
  QUERY_SECRETS,
  ASSIGNMENTS,
  LABELLED_SECRETS,
  ID_NUMBERS,
  CARDS,
  EMAILS,
  PHONES,
  IPV4,
  IPV6,
];

const runRules = (text: string, hit: Hit) => RULES.reduce((t, rule) => rule(t, hit), text);

// ---------------------------------------------------------------------------------------------
// Markdown structure

/** `<!-- private -->…<!-- /private -->` (to the end of the document when it isn't closed). */
const PRIVATE_BLOCK = /<!--\s*private\s*-->[\s\S]*?(?:<!--\s*\/\s*private\s*-->|$)/gi;
const INLINE_CODE = /(`+)(?!`)[\s\S]*?[^`]\1(?!`)/;

/** Splits off fenced code blocks and front matter, where the mask isn't escaped and `||…||` means "or". */
function splitCode(md: string): { code: boolean; text: string }[] {
  const parts: { code: boolean; text: string }[] = [];
  let rest = md;
  const front = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(rest);
  if (front) {
    parts.push({ code: true, text: front[0] });
    rest = rest.slice(front[0].length);
  }
  let prose = '';
  let block = '';
  let fence: { ch: string; len: number } | null = null;
  for (const line of rest.split(/(?<=\n)/)) {
    if (!fence) {
      const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (!open) {
        prose += line;
        continue;
      }
      if (prose) parts.push({ code: false, text: prose });
      prose = '';
      fence = { ch: open[1]![0]!, len: open[1]!.length };
      block = line;
      continue;
    }
    block += line;
    const close = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?\n?$/.exec(line);
    if (close && close[1]![0] === fence.ch && close[1]!.length >= fence.len) {
      parts.push({ code: true, text: block });
      block = '';
      fence = null;
    }
  }
  if (fence) parts.push({ code: true, text: block });
  if (prose) parts.push({ code: false, text: prose });
  return parts;
}

/** `||text||` in prose (not in code, and not the empty cells of a table row). */
const MARKED = new RegExp(`${INLINE_CODE.source}|\\|\\|(?=\\S)([^|\\n]+?)(?<=\\S)\\|\\|`, 'g');
const markManual = (text: string, hit: Hit) =>
  text.replace(MARKED, (m, ticks: string | undefined, inner: string | undefined, offset: number, all: string) => {
    if (ticks || inner === undefined) return m;
    const line = all.slice(all.lastIndexOf('\n', offset) + 1);
    if (/^\s*\|/.test(line)) return m;
    hit('marked', inner);
    return M;
  });

/** Swap the placeholders for the visible mask: plain inside inline code, escaped elsewhere. */
const PROSE_MASKS = new RegExp(`${INLINE_CODE.source}|${M}`, 'g');
const finishProse = (text: string, proseMask: string, codeMask: string) =>
  text.replace(PROSE_MASKS, (m, ticks: string | undefined) => (ticks ? m.replaceAll(M, codeMask) : proseMask));

function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.kind}\u0001${f.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const clip = (s: string, max = 80) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

// ---------------------------------------------------------------------------------------------
// API

/**
 * The document as the public sees it, and what was hidden. `mask` replaces each hidden value in
 * prose (escaped by default so Markdown shows "***"); `codeMask` inside code.
 */
export function redactMarkdown(md: string, opts: { mask?: string; codeMask?: string } = {}): Redaction {
  const proseMask = opts.mask ?? PROSE_MASK;
  const codeMask = opts.codeMask ?? MASK;
  const findings: Finding[] = [];
  const hit: Hit = (kind, value) => findings.push({ kind, value: kind === 'hidden-block' ? value : clip(value) });

  const visible = md.replaceAll(M, '').replace(PRIVATE_BLOCK, (block) => {
    const inner = block.replace(/^<!--\s*private\s*-->|<!--\s*\/\s*private\s*-->$/gi, '');
    if (inner.trim()) hit('hidden-block', clip(inner));
    return '';
  });
  const text = splitCode(visible)
    .map(({ code, text }) => {
      const masked = runRules(text, hit);
      return code ? masked.replaceAll(M, codeMask) : finishProse(markManual(masked, hit), proseMask, codeMask);
    })
    .join('');
  return { text, findings: dedupe(findings) };
}

/** A short plain-text field (a title, a project name) as the public sees it. */
export function redactText(text: string): string {
  const masked = runRules(text.replaceAll(M, ''), () => undefined);
  return markManual(masked, () => undefined).replaceAll(M, MASK);
}

const cache = new Map<string, string>();

/** `redactMarkdown(content).text`, remembered for recently read documents (`key` changes when the content does). */
export function redactedContent(key: string, content: string): string {
  const hitValue = cache.get(key);
  if (hitValue !== undefined) {
    cache.delete(key);
    cache.set(key, hitValue);
    return hitValue;
  }
  const text = redactMarkdown(content).text;
  cache.set(key, text);
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return text;
}

const HOLE = '';

/**
 * What the blog shows and searches, stored with the document so searching never touches the
 * original text: the title, the summary and the topics, with sensitive parts hidden.
 */
export function publicFields(title: string, content: string) {
  const masked = redactMarkdown(content, { mask: HOLE, codeMask: HOLE }).text;
  const fill = (s: string) => s.replaceAll(HOLE, MASK);
  // A title taken from the document follows the visible document (its first heading may be in a private part).
  const publicTitle = title === deriveTitle(content) ? fill(deriveTitle(masked)) : redactText(title);
  return {
    publicTitle: publicTitle.slice(0, 300),
    publicExcerpt: fill(makeExcerpt(masked)).slice(0, 400),
    topics: topicsOf(masked).map(fill),
  };
}
