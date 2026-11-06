import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import type { ResolvedSession } from '@/sessions/resolve'
import { locateTranscript, projectsDir } from '@/sessions/transcript'

export interface StopReading {
  /**
   * `usage-limit` means the last assistant entry is a limit stop. `unknown`
   * means the read failed or found a limit-worded entry of another shape, so
   * the row may be stopped and nothing here can say.
   */
  readonly stopped: 'usage-limit' | 'unknown' | null
  readonly stopResets: string | null
}

const NOT_STOPPED: StopReading = { stopped: null, stopResets: null }
const UNREADABLE: StopReading = { stopped: 'unknown', stopResets: null }

/**
 * The largest measured distance from a final stop to the end of its file is
 * under 4 KiB, while a live transcript reaches hundreds of megabytes, so the
 * read stays positional and never loads the file.
 */
const WINDOW_BYTES = 1024 * 1024

function readTail(path: string): {
  readonly text: string
  readonly cut: boolean
} {
  const fd = openSync(path, 'r')
  try {
    const { size } = fstatSync(fd)
    const length = Math.min(size, WINDOW_BYTES)
    const start = size - length
    const buffer = Buffer.alloc(length)
    let filled = 0
    while (filled < length) {
      const read = readSync(fd, buffer, filled, length - filled, start + filled)
      if (read === 0) break
      filled += read
    }
    return {
      text: buffer.subarray(0, filled).toString('utf8'),
      cut: start > 0,
    }
  } finally {
    closeSync(fd)
  }
}

function parseEntry(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function lastAssistantEntry(
  text: string,
  cut: boolean,
): Record<string, unknown> | null {
  const lines = text.split('\n')
  // The first line of a cut window usually starts mid-entry, and one that
  // happens to parse cannot be told apart from it.
  const first = cut ? 1 : 0

  for (let index = lines.length - 1; index >= first; index -= 1) {
    const entry = parseEntry(lines[index] ?? '')
    if (entry?.type === 'assistant' && entry.isSidechain !== true) return entry
  }

  return null
}

function entryText(message: Record<string, unknown>): string {
  if (!Array.isArray(message.content)) return ''
  return message.content
    .map((block: { text?: unknown } | null) =>
      typeof block?.text === 'string' ? block.text : '',
    )
    .join('\n')
}

/**
 * No published contract describes the stop entry, so the two branches below
 * rest on a measured shape: `error: "rate_limit"`, a `<synthetic>` model,
 * `isApiErrorMessage`, and text naming the limit and its reset. The second
 * branch exists for a release that renames the field, which still parses
 * cleanly and would otherwise read as a session that never stopped.
 */
function classify(entry: Record<string, unknown>): StopReading {
  const message =
    typeof entry.message === 'object' && entry.message !== null
      ? (entry.message as Record<string, unknown>)
      : {}
  const text = entryText(message)

  if (entry.error === 'rate_limit') {
    return {
      stopped: 'usage-limit',
      stopResets: /resets (.+)/.exec(text)?.[1]?.trim() ?? null,
    }
  }

  const generated =
    message.model === '<synthetic>' || entry.isApiErrorMessage === true
  return generated && /hit your .* limit/.test(text) ? UNREADABLE : NOT_STOPPED
}

/**
 * Reads whether a usage limit stopped one roster row, from the tail of its
 * transcript. A `busy` row reads nothing, since a turn is running and a resume
 * may be in flight.
 */
export function readStop(
  row: Pick<ResolvedSession, 'status' | 'sessionId'>,
  dir: string = projectsDir(),
): StopReading {
  if (row.status === 'busy') return NOT_STOPPED
  if (row.sessionId === null) return UNREADABLE

  const located = locateTranscript(row.sessionId, dir)
  if (located === null) return UNREADABLE

  let tail: ReturnType<typeof readTail>
  try {
    tail = readTail(located.transcript)
  } catch {
    return UNREADABLE
  }

  const entry = lastAssistantEntry(tail.text, tail.cut)
  if (entry === null) return tail.cut ? UNREADABLE : NOT_STOPPED

  return classify(entry)
}
