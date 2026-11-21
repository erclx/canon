import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'
import { RECORD_ENTRIES, RECORD_ROOTS } from '@/roots/record'
import type { RecordRoot } from '@/roots/record'

/**
 * The two version namespaces `claude/skills/git-commit/references/versioning.md`
 * keeps apart, which a pull request cannot be sorted between by pattern alone.
 * A release-please pull request legitimately carries versions and no other does.
 */
export interface PhaseScanInput {
  readonly title: string
  readonly body: string
  readonly headRefName: string
}

export interface PhaseScanResult {
  /** Whether this pull request is release-please's own, per its fixed shape. */
  readonly cutsRelease: boolean
  readonly phaseLabels: readonly string[]
  readonly semverTags: readonly string[]
  /**
   * Text naming the board rather than the change: a version token a code span
   * quotes, and a path under a record root. Both leave a remote reader holding
   * neither the task board nor the gitignored folder a path names.
   */
  readonly boardReferences: readonly string[]
  /**
   * A link to one Claude Code session, which the harness appends to published
   * text. It sits beside the board references, since no clone repairs a session
   * link and the board report line would not describe it.
   */
  readonly sessionLinks: readonly string[]
}

const VERSION_TOKEN = /\bv\d+(?:\.\d+){1,2}\b/g

/**
 * A code span holding a version token and nothing else. The closing delimiter
 * refers back to the opening one, as `maskCodeSpans` reads a span, and the token
 * alone separates a quoted label from a version-shaped name in longer content.
 */
const VERSION_SPAN = /(`+)(v\d+(?:\.\d+){1,2})\1/g

/** Sentence punctuation a path picks up at the end of a clause. */
const TRAILING_PUNCTUATION = /[.,;]+$/

/** Escapes a literal so it can sit inside a constructed pattern. */
function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * What is ignored under the tracked root beyond the entries the record move
 * relocated. The worktrees folder stays out of `RECORD_ENTRIES`, since the
 * harness pins worktrees there and the migration must not relocate it.
 */
const IGNORED_BEYOND_RECORDS: readonly string[] = ['worktrees']

/**
 * Which reading each record root takes: `whole` for a root one `.gitignore`
 * line covers, `entries` for a root kept narrow by name. A `Record` over
 * `RecordRoot` fails to typecheck when a root is added without a reading.
 */
const ROOT_READING: Record<RecordRoot, 'whole' | 'entries'> = {
  '.canon': 'whole',
  '.claude': 'entries',
}

/**
 * A path a reader on a remote cannot open. A `whole` root matches on the root
 * alone, and a tracked `entries` root matches only the relocated entries, with
 * a lookahead so `plans` skips a longer word. Roots come from `src/roots/record.ts`.
 */
const RECORD_PATH = new RegExp(
  `(?<![\\w./-])(?:${RECORD_ROOTS.map((root) =>
    ROOT_READING[root] === 'whole'
      ? `${escapeLiteral(root)}/(?=[^\\s\`)\\]])`
      : `${escapeLiteral(root)}/(?:${[
          ...RECORD_ENTRIES,
          ...IGNORED_BEYOND_RECORDS,
        ]
          .map((entry) => escapeLiteral(entry))
          .join('|')})(?![\\w-])`,
  ).join('|')})[^\\s\`)\\]]*`,
  'g',
)

/**
 * A link to one Claude Code session, matched on the host and path segment rather
 * than the identifier alphabet, which would empty this check if the harness
 * changed it. The scheme is optional, and the tail runs to the first whitespace.
 */
const SESSION_LINK =
  /(?<![\w./-])(?:https?:\/\/)?claude\.ai\/code\/session_[^\s`)\]]+/g

/**
 * The head branch release-please opens every release pull request under. The
 * prefix stops short of the component segment, since that moves with the
 * package name and the branch segment does not.
 */
const RELEASE_HEAD_PREFIX = 'release-please--branches--main'

const RELEASE_TITLE_PREFIX = 'chore(main): release '

/**
 * Two fixed signals rather than one, since either alone is text an author's own
 * pull request could reproduce. Together they name release-please's own act of
 * opening the pull request, which nothing else on the remote can perform.
 */
export function isReleasePullRequest(input: PhaseScanInput): boolean {
  return (
    input.headRefName.startsWith(RELEASE_HEAD_PREFIX) &&
    input.title.startsWith(RELEASE_TITLE_PREFIX)
  )
}

/** Replaces a version span's delimiters with spaces, holding the line's width. */
function unquoteVersionSpans(line: string): string {
  return line.replace(
    VERSION_SPAN,
    (_span, ticks: string, token: string) =>
      `${' '.repeat(ticks.length)}${token}${' '.repeat(ticks.length)}`,
  )
}

/**
 * Drops a fenced block outright and blanks a code span inside what remains, so a
 * quoted token reads as shown. A link destination stays unmasked, since a release
 * body's semver sits in its compare link, and `keepVersionSpans` serves the second pass.
 */
function readable(text: string, keepVersionSpans = false): string {
  return linesOutsideFences(text)
    .map((line) =>
      maskCodeSpans(keepVersionSpans ? unquoteVersionSpans(line) : line),
    )
    .join('\n')
}

function versionTokens(text: string): string[] {
  return [...new Set(text.match(VERSION_TOKEN) ?? [])]
}

function recordPaths(text: string): string[] {
  return [
    ...new Set(
      (text.match(RECORD_PATH) ?? []).map((path) =>
        path.replace(TRAILING_PUNCTUATION, ''),
      ),
    ),
  ]
}

function sessionLinks(text: string): string[] {
  return [
    ...new Set(
      (text.match(SESSION_LINK) ?? []).map((link) =>
        link.replace(TRAILING_PUNCTUATION, ''),
      ),
    ),
  ]
}

/**
 * Reads a title and a body for version-shaped tokens and sorts each into the
 * namespace this pull request may carry. A release reports no board reference,
 * since its generated history already passed, and a session link reports on both paths.
 */
export function scanPhaseLabels(input: PhaseScanInput): PhaseScanResult {
  const source = `${input.title}\n${input.body}`
  const outsideFences = linesOutsideFences(source).join('\n')
  const tokens = versionTokens(readable(source))
  const cutsRelease = isReleasePullRequest(input)
  const links = sessionLinks(outsideFences)

  if (cutsRelease) {
    return {
      cutsRelease,
      phaseLabels: [],
      semverTags: tokens,
      boardReferences: [],
      sessionLinks: links,
    }
  }

  // Dropped where the same token is also written bare, since reporting it twice asks for one removal twice.
  const quoted = versionTokens(readable(source, true)).filter(
    (token) => !tokens.includes(token),
  )

  return {
    cutsRelease,
    phaseLabels: tokens,
    semverTags: [],
    boardReferences: [...quoted, ...recordPaths(outsideFences)],
    sessionLinks: links,
  }
}
