import { createHash } from 'node:crypto'
import { findBacktickSpans } from '@/markdown/backticks'
import { KEY_CHANGES, LINE_SUFFIX, readSectionAt } from '@/pr/paths'

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

interface Located {
  readonly text: string
  readonly offset: number
  readonly whole: string
}

/** The section's text and where it starts, in the body with line endings normalized. */
function locateSection(body: string, title: string): Located | undefined {
  const whole = body.replace(/\r\n/g, '\n')
  const found = readSectionAt(whole, title)
  return found === undefined ? undefined : { ...found, whole }
}

/** Blanks every code span, keeping offsets, so a bracket inside a path never reads as link syntax. */
function maskSpans(text: string): string {
  let out = text
  for (const span of findBacktickSpans(text)) {
    out =
      out.slice(0, span.start) +
      ' '.repeat(span.end - span.start) +
      out.slice(span.end)
  }
  return out
}

const LINK = /\[[^\]]*\]\(([^)\s]*)\)/g
const DIFF_DESTINATION = /#diff-[0-9a-f]{64}$/

interface Edit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/**
 * Writes each code span in `## Key changes` that names a changed file as a link
 * to that file's diff, keeping the span as the label.
 *
 * Only an exact changed path is linked. A partial spelling or a folder names no
 * single row in the Files tab, and a link to a guessed row is worse than none.
 *
 * A span that is the whole label of an existing diff link has its destination
 * rewritten, which is how a wrong anchor clears. A span anywhere else inside a
 * link's brackets is left alone, since a link nested in a link breaks the
 * bullet, and the rewrite stays idempotent.
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

  const { text } = located
  const known = new Set(changed)
  const links = [...maskSpans(text).matchAll(LINK)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    destination: match[1] ?? '',
  }))

  const edits: Edit[] = []
  for (const span of findBacktickSpans(text)) {
    const path = span.content.replace(LINE_SUFFIX, '')
    if (!known.has(path)) continue
    const target = `${filesUrl}#${diffAnchor(path)}`

    const link = links.find((l) => l.start < span.start && span.end <= l.end)
    if (link === undefined) {
      edits.push({
        start: span.start,
        end: span.end,
        text: `[${text.slice(span.start, span.end)}](${target})`,
      })
      continue
    }

    const wholeLabel =
      span.start === link.start + 1 && text.startsWith('](', span.end)
    if (!wholeLabel || !DIFF_DESTINATION.test(link.destination)) continue
    const from = link.end - 1 - link.destination.length
    edits.push({ start: from, end: link.end - 1, text: target })
  }

  let out = ''
  let cursor = 0
  for (const edit of edits) {
    out += text.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  out += text.slice(cursor)

  return (
    located.whole.slice(0, located.offset) +
    out +
    located.whole.slice(located.offset + text.length)
  )
}

const DIFF_LINK = /\[(`+)([^`]+)\1\]\([^)\s]*#(diff-[0-9a-f]{64})\)/g

/**
 * Every Key changes link whose label is a changed path and whose anchor hashes
 * another path.
 *
 * A label that is no changed path, such as a bare file name or a function, is
 * left unjudged: it can open the right file under a spelling this cannot map
 * back to a row, and an accusation needs the row.
 */
export function findMislinked(
  body: string,
  changed: readonly string[],
): Mislinked[] {
  const located = locateSection(body, KEY_CHANGES)
  if (located === undefined) return []

  const known = new Set(changed)
  const out: Mislinked[] = []
  for (const match of located.text.matchAll(DIFF_LINK)) {
    const path = (match[2] ?? '').trim().replace(LINE_SUFFIX, '')
    const anchor = match[3] ?? ''
    if (known.has(path) && diffAnchor(path) !== anchor) {
      out.push({ path, anchor })
    }
  }
  return out
}
