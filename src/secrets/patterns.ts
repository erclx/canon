/**
 * The rule set the secret scan keys on.
 *
 * Every pattern matches an issued value and none matches a word, so the
 * exclusion set starts empty, since a scan keyed on `password` or `token`
 * fires on the environment reads, workflow inputs, and prose naming them. The
 * cost is a credential with no recognizable issuer prefix. Each literal prefix
 * is followed by a character class, so none of these sources matches itself,
 * and `src/secrets/scan.test.ts` holds the check.
 */
export interface SecretPattern {
  readonly id: string
  readonly label: string
  /** Carries the global flag, since a line may hold more than one value. */
  readonly match: RegExp
  /**
   * Whether the matched text is the credential itself.
   *
   * A private key header names a block without carrying its bytes, so echoing
   * it whole tells the reader what was found. Every other pattern matches the
   * value, and reporting one in full would copy a live credential into a log.
   */
  readonly redact: boolean
}

export const PATTERNS: readonly SecretPattern[] = [
  {
    id: 'aws-access-key-id',
    label: 'AWS access key id',
    match: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    redact: true,
  },
  {
    id: 'github-token',
    label: 'GitHub token',
    // Spelled as alternation rather than a character class, so the source
    // carries the issued prefixes as themselves. A class reads as one
    // pronounceable token to a spell checker and puts a nonsense word in a
    // dictionary that is supposed to hold real terms.
    match: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    redact: true,
  },
  {
    id: 'github-fine-grained-token',
    label: 'GitHub fine-grained token',
    match: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g,
    redact: true,
  },
  {
    id: 'google-api-key',
    label: 'Google API key',
    match: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    redact: true,
  },
  {
    id: 'slack-token',
    label: 'Slack token',
    match: /\b(?:xoxa|xoxb|xoxp|xoxr|xoxs)-[0-9A-Za-z-]{12,}\b/g,
    redact: true,
  },
  {
    id: 'slack-webhook',
    label: 'Slack webhook',
    match: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Za-z_/-]{20,}/g,
    redact: true,
  },
  {
    id: 'stripe-secret-key',
    label: 'Stripe live key',
    match: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g,
    redact: true,
  },
  {
    id: 'anthropic-api-key',
    label: 'Anthropic API key',
    match: /\bsk-ant-[0-9A-Za-z_-]{24,}\b/g,
    redact: true,
  },
  {
    id: 'openai-api-key',
    label: 'OpenAI project key',
    match: /\bsk-proj-[0-9A-Za-z_-]{24,}\b/g,
    redact: true,
  },
  {
    id: 'npm-token',
    label: 'npm token',
    match: /\bnpm_[0-9A-Za-z]{36}\b/g,
    redact: true,
  },
  {
    id: 'private-key-block',
    label: 'Private key block',
    match: /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/g,
    redact: false,
  },
]

export interface PatternHit {
  readonly pattern: string
  readonly label: string
  /** One-based, so the report reads like every other file reference here. */
  readonly column: number
  /** What the report prints, redacted unless the pattern says otherwise. */
  readonly preview: string
}

/**
 * Shortens a matched value to its two ends.
 *
 * The ends are what a reader needs to find the credential in the file and to
 * tell one match from another, and the middle is the part no report should
 * carry. A value too short to have a middle is reported as its shape alone.
 */
function redact(value: string): string {
  if (value.length <= 8) return '…'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

/** Every value on one line, ordered by where each starts. */
export function matchLine(line: string): PatternHit[] {
  const hits: PatternHit[] = []

  for (const pattern of PATTERNS) {
    for (const found of line.matchAll(pattern.match)) {
      if (found.index === undefined) continue

      hits.push({
        pattern: pattern.id,
        label: pattern.label,
        column: found.index + 1,
        preview: pattern.redact ? redact(found[0]) : found[0],
      })
    }
  }

  return hits.sort((left, right) => left.column - right.column)
}
