import { createHash } from 'node:crypto'
import { findBacktickSpans } from '@/markdown/backticks'
import { KEY_CHANGES, LINE_SUFFIX, readSection } from '@/pr/paths'

/** A Key changes link whose anchor hashes a path other than its label's. */
export interface Mislinked {
  readonly path: string
  readonly anchor: string
}

/**
 * The fragment GitHub gives a file's diff in a pull request's Files tab, being
 * `diff-` and the SHA-256 of the raw path. Read off a merged pull request's
 * rendered page, so a path holding a space or a bracket hashes as written.
 */
export function diffAnchor(path: string): string {
  return `diff-${createHash('sha256').update(path).digest('hex')}`
}

/** The section's text and where it starts, in the body with line endings normalized. */
function locateSection(
  body: string,
  title: string,
): { text: string; start: number; whole: string } | undefined {
  const whole = body.replace(/\r\n/g, '\n')
  const text = readSection(whole, title)
  if (text === undefined) return undefined
  return { text, start: whole.indexOf(text), whole }
}

/**
 * Writes each code span in `## Key changes` that names a changed file as a link
 * to that file's diff, keeping the span as the label.
 *
 * Only an exact changed path is linked. A partial spelling or a folder names no
 * single row in the Files tab, and a link to a guessed row is worse than none.
 * A span already inside a link is left alone, so the rewrite is idempotent.
 *
 * `filesUrl` is the pull request's `/files` address, absolute because the body
 * becomes the squash commit message, where a relative link resolves nowhere.
 */
export function linkKeyChanges(
  body: string,
  changed: readonly string[],
  filesUrl: string,
): string {
  const located = locateSection(body, KEY_CHANGES)
  if (located === undefined) return body

  const known = new Set(changed)
  let out = ''
  let cursor = 0
  for (const span of findBacktickSpans(located.text)) {
    const path = span.content.replace(LINE_SUFFIX, '')
    if (!known.has(path)) continue
    const linked =
      located.text[span.start - 1] === '[' &&
      located.text.startsWith('](', span.end)
    if (linked) continue
    out += located.text.slice(cursor, span.start)
    out += `[${located.text.slice(span.start, span.end)}](${filesUrl}#${diffAnchor(path)})`
    cursor = span.end
  }
  out += located.text.slice(cursor)

  return (
    located.whole.slice(0, located.start) +
    out +
    located.whole.slice(located.start + located.text.length)
  )
}

const DIFF_LINK = /\[(`+)([^`]+)\1\]\([^)\s]*#(diff-[0-9a-f]{64})\)/g

/** Every Key changes link whose anchor does not hash the path its label names. */
export function findMislinked(body: string): Mislinked[] {
  const located = locateSection(body, KEY_CHANGES)
  if (located === undefined) return []

  const out: Mislinked[] = []
  for (const match of located.text.matchAll(DIFF_LINK)) {
    const path = (match[2] ?? '').trim().replace(LINE_SUFFIX, '')
    const anchor = match[3] ?? ''
    if (diffAnchor(path) !== anchor) out.push({ path, anchor })
  }
  return out
}
