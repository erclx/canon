import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'
import { RECORD_ENTRIES, RECORD_ROOTS } from '@/roots/record'
import type { RecordRoot } from '@/roots/record'

/**
 * The two version namespaces `standards/versioning.md` keeps apart, and why a
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
 * Content is the token alone rather than a token found inside longer content,
 * which is the whole of what separates a quoted phase label from `#1208`.
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
 * `RECORD_ENTRIES` answers which folders that move carried across, and this
 * check asks which paths a reader on a remote cannot open under `.claude/`,
 * the one root still read by entry name below. The two questions differ by
 * exactly one entry: the worktrees folder is ignored and stays out of
 * `RECORD_ENTRIES` deliberately, since the harness creates a worktree there
 * and requires its target to sit there, so adding it upstream would tell the
 * migration to relocate a folder the harness pins.
 *
 * It is also the entry a worker announcement names most often, which is what
 * makes the gap a live class rather than a theoretical one.
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
 * The two roots differ by why they are unreadable rather than by which one
 * they are. A root reading `whole` matches on the root alone, since one
 * ignore line covers everything beneath it and no entry list can ever be
 * narrower than that. A root reading `entries` keeps the entry-list reading:
 * `.claude/` is tracked and holds `rules`, `skills`, `hooks`, and `context`,
 * so a rule path resolves in any clone and is not a board reference, and only
 * the entries the record move relocated are unreadable there. Reading the
 * roots and the relocated entries from `src/record-root.ts` is what makes a
 * folder added there matched here without an edit, and the list above is what
 * covers the one thing that module deliberately does not carry.
 *
 * The root-alone branch requires at least one tail character ahead of the
 * shared tail capture, so a root written bare, such as the ignore line naming
 * it as a concept, reports nothing: there is no path there for an author to
 * remove. The entry-list branch instead bounds the entry name on the right
 * with a lookahead, so `plans` does not also match the prefix of a longer
 * word; that lookahead has to sit inside the entry branch rather than after
 * the whole alternation; the character right after a bare root is an ordinary
 * word character, and the same lookahead there would reject every root-alone
 * match.
 *
 * The tail runs to the first whitespace or closing delimiter, so a report
 * names the whole path an author has to remove rather than the prefix that
 * matched.
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
 * The two instances on the trunk carry a 24-character identifier after
 * `session_`, and reading that shape into the pattern would empty this check
 * the moment the harness changed it, with nothing left to report and no
 * failure to notice. The host and the path segment are what the harness has to
 * keep for the link to resolve at all. A host change still gets past this and
 * nothing detects that.
 *
 * The scheme is optional because it is incidental to the two parts being
 * matched, so a link written without it is the same unresolvable reference.
 * The tail runs to the first whitespace or closing delimiter, which is how a
 * record path is read, so a report names the whole link rather than the prefix
 * that matched.
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
function isReleasePullRequest(input: PhaseScanInput): boolean {
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
 * so a token quoted rather than written is read the way a reader reads it:
 * shown, not asserted.
 *
 * `canon markdown audit` excludes a fenced block and a code span from its own
 * ban scan over the same kind of text, and this reuses that reading rather
 * than inventing a second one. `#1208` is the corpus case that forced it: a
 * backticked span quoting a test fixture's own version-shaped name, which the
 * shape-only scan below cannot tell from a leak on its own.
 *
 * A link destination stays unmasked, unlike the ban scan's own reading. A
 * release-please body's real semver reference sits inside the generated
 * compare link's URL, and masking it would empty `semverTags` on the one
 * pull request this check exists to pass, trading the corpus's one code-span
 * leak for a hole in every release.
 *
 * `keepVersionSpans` widens that reading for the board-reference pass alone. A
 * span whose whole content is a version token survives it, which is the shape
 * the leak reached the remote through, and longer content stays blanked, which
 * is what holds `#1208` closed. Two passes over one source rather than one pass
 * sorting its own output, because a token is a board reference by virtue of the
 * span it came out of and nothing downstream of the match can see that.
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
 * Reads a title and a body for version-shaped tokens and sorts every one
 * found into the namespace this pull request is allowed to carry.
 *
 * The split runs on the pull request rather than on each token. A release
 * pull request's tokens are read as the semver references its generated body
 * legitimately carries, and every other pull request's tokens are read as
 * leaked phase labels, which is what `standards/versioning.md` names the
 * defect this exists to catch.
 *
 * A release pull request reports no board reference either, and the ground is
 * coverage rather than exemption. Release-please generates that body from
 * merged history, and every commit in that history came through a pull request
 * this same check already scanned, so a board reference cannot reach a release
 * body without passing the gate on its own. That its author has nothing to
 * rewrite is true as well and is the weaker half, since it would leave the
 * reference standing and unresolvable.
 *
 * A session link is reported on both paths, the release one included. Nothing
 * appends one to a release body, which release-please generates with no
 * session in the loop, so populating the field there costs nothing on every
 * run this repository has seen. What it buys is that the coverage argument
 * above never has to hold for this category: that argument reasons from every
 * commit in the generated history having passed this gate, and a link the gate
 * did not yet scan for would reach a release body under it. Reading the whole
 * body on both paths leaves no hole if the premise ever slips.
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
