import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'
import { RECORD_ENTRIES, RECORD_ROOTS } from '@/roots/record'
import type { RecordRoot } from '@/roots/record'

/**
 * The two version namespaces `claude/skills/git-commit/references/versioning.md` keeps apart, and why a
 * pull request cannot be sorted between them by pattern alone.
 *
 * A phase label (`v68.5`) and a semver reference (`v3.44`) both match
 * `v<digits>(.<digits>){1,2}`, so a shape-only scan cannot tell them apart. The
 * first measurement of this defect tried exactly that and returned 28 of 60
 * correct. What separates the two is not the token but the pull request: a
 * release-please pull request legitimately carries version numbers in its
 * generated body, and every other pull request does not.
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
   * quotes, and a path under a record root.
   *
   * It sits beside the two namespaces rather than inside either, because a
   * record path is version-shaped in neither and a quoted token is one the
   * reading below has already declined to sort. Both are one defect at the
   * destination, which is a reader on a remote holding neither the task board
   * nor the gitignored folder a path names.
   */
  readonly boardReferences: readonly string[]
  /**
   * A link to one Claude Code session, which the harness appends to text it
   * tells a session to publish.
   *
   * It sits beside the board references rather than inside them because the
   * two are unresolvable for different reasons. A record path fails for a
   * reader holding no copy of this checkout, and a session link fails for
   * everyone outside the one account that holds the session, which no clone
   * and no checkout repairs. The report line for a board reference names a
   * record path and a quoted label, so a session link folded in would be
   * reported under a sentence that does not describe it.
   */
  readonly sessionLinks: readonly string[]
}

const VERSION_TOKEN = /\bv\d+(?:\.\d+){1,2}\b/g

/**
 * A code span holding a version token and nothing else.
 *
 * The closing delimiter refers back to the opening one, so a span opened on two
 * backticks closes on two, which is the rule `maskCodeSpans` reads a span by.
 * Content is the token alone, which is the whole of what separates a quoted
 * phase label from a version-shaped name quoted inside longer content.
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
 * relocated.
 *
 * The worktrees folder is ignored but stays out of `RECORD_ENTRIES` on
 * purpose, since the harness pins worktrees there and the migration must not
 * relocate it. It is also the entry a worker announcement names most often.
 */
const IGNORED_BEYOND_RECORDS: readonly string[] = ['worktrees']

/**
 * Which reading each record root takes: `whole` for a root one `.gitignore`
 * line covers entirely, `entries` for a root kept narrow by name.
 *
 * `.canon/` takes `whole`: the ignore file excludes the folder outright, and
 * git does not descend into an excluded directory, so no entry list is ever
 * wider than the root itself. `.claude/` takes `entries` because it is
 * tracked. A `Record` over `RecordRoot` rather than a filtered list of the
 * roots read one way, so a root added to `RECORD_ROOTS` fails to typecheck
 * here until this map says which reading it takes, rather than falling
 * through a filter into the entry-list branch unnoticed.
 */
const ROOT_READING: Record<RecordRoot, 'whole' | 'entries'> = {
  '.canon': 'whole',
  '.claude': 'entries',
}

/**
 * A path a reader on a remote cannot open.
 *
 * A `whole` root matches on the root alone, since one ignore line covers all
 * of it, and needs one tail character so a bare root names no path. An
 * `entries` root is tracked, so only the relocated entries match there, with a
 * lookahead inside that branch so `plans` skips a longer word. Roots and
 * entries come from `src/roots/record.ts`, so a folder added there matches
 * here with no edit. The tail runs to the first whitespace or closing
 * delimiter, so a report names the whole path an author has to remove.
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
 * A link to one Claude Code session, matched on the host and the path segment
 * rather than on the identifier alphabet.
 *
 * Reading the identifier's shape into the pattern would empty this check the
 * moment the harness changed it, while the host and segment must stay for the
 * link to resolve. A host change still gets past this. The scheme is optional,
 * and the tail runs to the first whitespace or closing delimiter, as a record
 * path is read.
 */
const SESSION_LINK =
  /(?<![\w./-])(?:https?:\/\/)?claude\.ai\/code\/session_[^\s`)\]]+/g

/**
 * The head branch release-please opens every release pull request under.
 *
 * `release-please-config.json` names the package `canon`, so the observed
 * branch is `release-please--branches--main--components--canon`. The prefix
 * stops short of the component segment, since that segment moves with the
 * package name and the branch segment does not.
 */
const RELEASE_HEAD_PREFIX = 'release-please--branches--main'

const RELEASE_TITLE_PREFIX = 'chore(main): release '

/**
 * Two fixed signals rather than one, because either alone is a string an
 * author's own pull request could reproduce. A title starting with the
 * release commit type is plain conventional-commit text, and a head branch is
 * exactly what a PR renamed for review would want to imitate to slip a real
 * phase label past this check. Together they name release-please's own act of
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
 * Drops a fenced block outright and blanks a code span inside what remains,
 * so a quoted token reads as shown rather than asserted, as `canon markdown
 * audit` reads the same text.
 *
 * A link destination stays unmasked, since a release body's real semver sits
 * inside the generated compare link and masking it would empty `semverTags`.
 * `keepVersionSpans` keeps a span holding only a version token for the board
 * reference pass, while longer content stays blanked, so a quoted fixture name
 * is never read as a leak. A token is a board reference by the span it came
 * from, which nothing downstream of the match can see, hence two passes.
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
 * namespace this pull request may carry.
 *
 * A release pull request's tokens are semver references, and every other pull
 * request's are leaked phase labels, the defect `versioning.md` names. A
 * release reports no board reference, since every commit in its generated
 * history already passed this check. A session link is reported on both
 * paths, so that coverage argument never has to hold for links.
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

  // Dropped where the same token is also written bare, since the phase-label
  // half already names it and reporting it twice asks for one removal twice.
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
