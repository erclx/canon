/**
 * The local Ollama backend: a reachability probe and one chat call per item.
 *
 * One chunk or section per call, never batched. The groundwork spike measured
 * batching 16 hunks into a single call returning KEEP for every one, so a
 * caller here (`run.ts`) invokes `chat` once per item rather than folding a
 * set into one prompt.
 */

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

/**
 * Nothing in the groundwork pins a request timeout: the spike scripts used a
 * 600s ceiling meant for a batch research run, not a per-call budget for an
 * interactive verb. 30s is chosen here as a deviation, wide enough that a
 * shared GPU under another local session's load (measured coexisting at 12GB)
 * still has room, while short enough that a `docs-fold` run does not hang
 * indefinitely on a backend that stopped responding mid-call.
 */
export const OLLAMA_TIMEOUT_MS = 30_000

/** Parsed straight off the model's own JSON, upper-cased for a loose model. */
export interface ParsedVerdict {
  readonly verdict: string
  readonly quote: string
  readonly reason: string
}

export type ChatOutcome =
  | {
      readonly kind: 'ok'
      readonly parsed: ParsedVerdict
      readonly raw: string
    }
  | { readonly kind: 'unparsed'; readonly raw: string }
  | { readonly kind: 'unreachable'; readonly message: string }
  | { readonly kind: 'timeout' }

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

/**
 * Reads the model's reply out of its own JSON body.
 *
 * Ported from `classify.py`'s `_parse`: find the first `{` and the last `}`,
 * so a model that wraps its JSON in a sentence or a fence still parses. Diff
 * mode returns a single `quote` string and sweep mode returns a `quotes`
 * array, and both are read here since the caller decides which mode it asked
 * for by which prompt it sent, not by which shape came back.
 */
export function parseVerdictText(text: string): ParsedVerdict | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return undefined

  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }

  if (typeof data !== 'object' || data === null) return undefined
  const record = data as Record<string, unknown>

  const verdict = record.verdict
  if (typeof verdict !== 'string' || verdict === '') return undefined

  const quote =
    typeof record.quote === 'string'
      ? record.quote
      : Array.isArray(record.quotes)
        ? record.quotes.map((entry) => String(entry)).join(' | ')
        : ''

  const reason = typeof record.reason === 'string' ? record.reason : ''

  return { verdict: verdict.toUpperCase(), quote, reason }
}

/**
 * Whether the backend answers at all, checked before the real call so a
 * per-item timeout is never the thing that discovers an unreachable Ollama.
 */
export async function probeOllama(
  baseUrl: string,
  timeoutMs = OLLAMA_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * One chat call: JSON output format, temperature 0, thinking off.
 *
 * Thinking is always off. The groundwork spike measured it never catching a
 * flag thinking-off missed, at roughly five times the latency, and in sweep
 * mode it lost three real flags by reasoning itself past them. There is no
 * option to turn it on here, matching the groundwork decision to defer that
 * rather than build an unused knob.
 */
export async function chat(opts: {
  readonly baseUrl: string
  readonly model: string
  readonly system: string
  readonly user: string
  readonly timeoutMs?: number
}): Promise<ChatOutcome> {
  const timeoutMs = opts.timeoutMs ?? OLLAMA_TIMEOUT_MS

  let response: Response
  try {
    response = await fetch(`${opts.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        stream: false,
        think: false,
        format: 'json',
        options: { temperature: 0, num_ctx: 16384 },
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (isTimeout(error)) return { kind: 'timeout' }
    return { kind: 'unreachable', message: describeError(error) }
  }

  if (!response.ok) {
    return {
      kind: 'unreachable',
      message: `ollama returned ${response.status}`,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    return { kind: 'unparsed', raw: describeError(error) }
  }

  const content =
    typeof body === 'object' && body !== null
      ? (body as { message?: { content?: unknown } }).message?.content
      : undefined

  if (typeof content !== 'string') {
    return { kind: 'unparsed', raw: JSON.stringify(body) }
  }

  const parsed = parseVerdictText(content)
  return parsed === undefined
    ? { kind: 'unparsed', raw: content }
    : { kind: 'ok', parsed, raw: content }
}
