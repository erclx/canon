/**
 * The move of the gitignored session records from `.claude/` to `.canon/`.
 *
 * Two halves that share one list. The folders themselves are untracked, so
 * relocating them is a filesystem act no commit records, while every tracked
 * file naming one of their paths is a citation that goes stale the moment they
 * land. Running one half without the other leaves a tree whose records are at a
 * root nothing points at, which is why the same verb performs both.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  type RecordRoot,
  RECORD_ENTRIES,
  RECORD_ROOTS,
  spell,
} from '@/record-root'

/** The root the entries below leave, exported so the writer can prune it. */
export const FROM_ROOT: RecordRoot = '.claude'

/** The root they arrive at. */
const TO_ROOT: RecordRoot = '.canon'

/**
 * Every entry the move relocates, at the name `.claude/` gave it.
 *
 * The list is `RECORD_ENTRIES`, which `record-root.ts` owns because a seed
 * destination and a superseded-layout report ask the same question. Restating
 * it here would let the sweep and the resolver disagree about what moved.
 */
export const MOVED_ENTRIES = RECORD_ENTRIES

/** Where an entry sits before the move, relative to the project root. */
export function sourcePath(entry: string): string {
  return join(FROM_ROOT, entry)
}

/** Where it sits after, which is the only place the scratch folder is renamed. */
export function destinationPath(entry: string): string {
  return join(TO_ROOT, spell(TO_ROOT, entry))
}

/**
 * A citation into a moved entry.
 *
 * The tail rejects a following name character rather than asking for a word
 * boundary, and that is what protects the three retired flat archives without
 * an exception list: `.claude/plans-archive` continues into a `-` and never
 * matches, where `.claude/plans/` and a bare `.claude/plans` both do. A
 * boundary would treat the hyphen as a break and rewrite the archive to a root
 * it never sat under.
 *
 * The alternation is ordered longest first so `README.md` is decided before any
 * shorter entry can claim its prefix, and each entry is escaped because two of
 * them carry a dot.
 */
const CITATION = new RegExp(
  `${escape(FROM_ROOT)}/(${[...MOVED_ENTRIES]
    .sort((left, right) => right.length - left.length)
    .map(escape)
    .join('|')})(?![A-Za-z0-9._-])`,
  'g',
)

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Files whose content is left alone entirely.
 *
 * The changelog is release history, whose entries record what shipped while the
 * records were still under the old root. An eval result is a transcript of the
 * paths a session actually opened. Rewriting either makes it testify to
 * something that never happened.
 *
 * This module and `src/record-root.ts` are two of the sources that state the old
 * root on purpose. Sweeping them turns every citation this expression is built
 * from into its own replacement, leaving a rewriter that maps `.canon/` to
 * `.canon/` and matches nothing. `src/surface-root.ts` joins the list a release
 * early, for the same reason: it spells `.claude` as data the moment it
 * exists, and excluding it later would leave one release where a records
 * migration in a target could rewrite the resolver that migration itself
 * depends on.
 *
 * A test file is excluded because the fixtures that prove the old root still
 * resolves have to keep building it. Rewriting one is worse than a failing
 * test: the old-root case collapses into a copy of the new-root case beside it
 * and keeps passing, reporting coverage for a fallback nothing exercises.
 *
 * A hook is the third source that states both roots on purpose. Each one guards
 * on a `case` carrying an arm per root, so rewriting the old arm collapses the
 * pair into two copies of the new one and shellcheck reports a pattern that can
 * never match. The guard then stops firing in a project the move has not
 * reached, which is silent: the index goes stale while every save succeeds.
 *
 * A file outside this list can still couple to one inside it, naming an
 * excluded path as plain text while it also carries a live citation of its
 * own, which `referencesExcluded` reports separately below. Widening this list
 * or `EXCLUDED_SUFFIXES` to catch that case would mean guessing at a naming
 * convention no project here declares, where the coupling check instead reads
 * what the file's own text already says.
 */
const EXCLUDED_PREFIXES: readonly string[] = [
  'src/migrate/',
  'scripts/eval/result-',
  '.claude/hooks/',
  'tooling/claude/seeds/.claude/hooks/',
]

const EXCLUDED_PATHS: readonly string[] = [
  'CHANGELOG.md',
  'src/record-root.ts',
  'src/surface-root.ts',
]

const EXCLUDED_SUFFIXES: readonly string[] = ['.test.ts']

export function isExcludedPath(path: string): boolean {
  if (EXCLUDED_PATHS.includes(path)) return true
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  return EXCLUDED_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

/**
 * Whether `text` names an `EXCLUDED_PREFIXES` or `EXCLUDED_PATHS` entry as
 * literal substring text, which is how a rewritten file can couple to one this
 * module leaves alone: a citation gets rewritten clean while a line a few away
 * still spells the excluded path it was testing against.
 *
 * `EXCLUDED_SUFFIXES` plays no part here, since a suffix names a file's own
 * shape rather than text its content could quote. The one gap this cannot
 * close is a file that names the excluded surface by description rather than
 * by path, such as "the exemption hook" rather than `.claude/hooks/`, which is
 * the same limit `isExcludedPath` already carries for content it cannot parse.
 */
export function referencesExcluded(text: string): boolean {
  return (
    EXCLUDED_PATHS.some((path) => text.includes(path)) ||
    EXCLUDED_PREFIXES.some((prefix) => text.includes(prefix))
  )
}

/**
 * The roots holding nothing but records, so a path under one is a record
 * whatever it is named.
 *
 * `.canon/` qualifies by construction. `.claude/ARCHITECTURE.md` fixes the rule
 * that every gitignored session record moves there and nothing tracked ever
 * lands there, which covers a record folder `RECORD_ENTRIES` has yet to learn
 * about. The old root is the one that cannot take a whole-root reading, and it
 * is derived by exclusion rather than named, so a third root added later reads
 * as records-only unless someone says otherwise.
 *
 * Exported because `record-tree.ts` sweeps inside these roots and has to name
 * them rather than invert `isRecordArtifact`. That predicate is true for the old
 * root's record entries as well, so an inversion would sweep a project the move
 * has not run in, where the old spelling is the correct one.
 */
export const RECORD_ONLY_ROOTS: readonly RecordRoot[] = RECORD_ROOTS.filter(
  (root) => root !== FROM_ROOT,
)

/**
 * Every prefix under which a path is a record rather than a file to sweep.
 *
 * The asymmetry is the point. A whole-root prefix is correct for the new root
 * and wrong for the old one, which is mixed: this repository tracks 163 files
 * under `.claude/`, and a target's installed `.claude/rules/canon/core/035-tasks.md`
 * is the file the sweep exists to repoint, so a bare `.claude/` prefix strands
 * it silently. The old root is therefore entry-scoped, through `spell` so the
 * one naming variant stays decided in `record-root.ts`.
 *
 * Joined with a literal separator rather than through `join`, the way
 * `EXCLUDED_PREFIXES` already is. These are matched against what `git ls-files`
 * returns, which is forward-slashed on every platform, where `join` would spell
 * a backslash on Windows and match nothing.
 */
const RECORD_PREFIXES: readonly string[] = [
  ...RECORD_ONLY_ROOTS,
  ...RECORD_ENTRIES.map((entry) => `${FROM_ROOT}/${spell(FROM_ROOT, entry)}`),
]

/**
 * Whether a path is a record artifact, which the sweep passes over entirely.
 *
 * Separate from `isExcludedPath`, which reports what it skips because a reader
 * has to check those by hand. A record artifact is never something to check,
 * and a target's record tree is large enough that reporting each one would bury
 * the handful of exclusions that matter.
 *
 * A record folder becomes visible to the sweep at the moment `canon tooling
 * sync claude` prunes the twelve old ignore entries down to one `.canon/` line,
 * which is the step the documented first-run order puts immediately before this
 * verb. Without this predicate the run that follows reads the memory pen and
 * the groundwork trails as source and rewrites them.
 *
 * The three retired flat archives stay outside this, the way `CITATION` already
 * leaves them alone: `.claude/plans-archive/x.md` does not start with
 * `.claude/plans/`, and widening the entry list to catch it would change what
 * `MOVED_ENTRIES` means for the folder half of the verb.
 */
export function isRecordArtifact(path: string): boolean {
  return RECORD_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

/**
 * Marks a line naming the old root on purpose.
 *
 * Prose that dates a decision, records where a defect landed, or names the
 * fallback a target still resolves through all have to keep saying `.claude/`,
 * and a sweep cannot tell those from a live path. The marker sits on the line
 * itself or on the nearest non-blank line above it, walking past a run of
 * blank markdown lines to reach a marker written on its own line above the
 * paragraph it protects. `canon-keep-retired` and `canon-allow-superseded`
 * mark code instead, where no blank line ever falls between the marker and
 * the line it protects, so neither needs the walk.
 */
const KEEP_MARKER = 'canon-keep-record-root'

function isKept(lines: readonly string[], index: number): boolean {
  if (lines[index]?.includes(KEEP_MARKER)) return true

  let above = index - 1
  while (above >= 0 && lines[above]?.trim() === '') above -= 1

  return above >= 0 && (lines[above]?.includes(KEEP_MARKER) ?? false)
}

/**
 * The line index where a leading YAML frontmatter block closes, or
 * `undefined` when the file does not open with a bare `---` on line one.
 */
function frontmatterEnd(lines: readonly string[]): number | undefined {
  if (lines[0] !== '---') return undefined
  const end = lines.indexOf('---', 1)
  return end === -1 ? undefined : end
}

/**
 * Marks a line inside a rule's frontmatter `paths:` key: the key line itself,
 * or an indented `- 'glob'` list item under it. Structural rather than
 * marker-based, found by walking up to the nearest line starting at column 0
 * and testing whether that line is the bare `paths:` key.
 *
 * Independent of `KEEP_MARKER`. A rewritten glob stops matching silently,
 * where a rewritten sentence is at least visible to a reader, so this line is
 * held whether or not anyone remembered the marker.
 */
function isFrontmatterPathsLine(
  lines: readonly string[],
  index: number,
  frontmatterEndIndex: number | undefined,
): boolean {
  if (frontmatterEndIndex === undefined) return false
  if (index <= 0 || index >= frontmatterEndIndex) return false

  let top = index
  while (top > 0 && /^\s/.test(lines[top] ?? '')) top -= 1

  return lines[top]?.trim().startsWith('paths:') ?? false
}

/**
 * A path segment immediately before a citation match, shaped like another
 * repository's own name: it carries a dot (a domain-shaped token, matching
 * the measured `erclx.dev`) or it is itself preceded by a further `/` (two
 * path segments deep, also matching the measured `public/erclx.dev/...`).
 *
 * Bounded by `[\w.-]`, which is what keeps a shell-glob prefix such as
 * `*` before the slash and a variable-substitution prefix such as
 * `$project` out: neither `*` nor `$` is in the class, so a segment built
 * from either never reaches the dot or the second slash this looks for.
 */
const CROSS_REPO_PREFIX = /(?:[\w.-]+\.[\w.-]+|[\w.-]+\/[\w.-]+)\/$/

/**
 * Whether the line's citation sits right after a prefix `CROSS_REPO_PREFIX`
 * reads as another repository's own path. Per-line rather than per-match,
 * matching `isKept`'s and `isFrontmatterPathsLine`'s granularity: a line
 * carrying more than one citation is judged by the first.
 */
function isCrossRepoPrefix(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? ''
  const match = [...line.matchAll(CITATION)][0]
  if (match === undefined) return false

  return CROSS_REPO_PREFIX.test(line.slice(0, match.index ?? 0))
}

/** An ISO date, marking a paragraph as recording what was true on that day. */
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/

/**
 * Whether the line's citation sits inside a blank-line-delimited paragraph
 * that also carries an ISO date, read as dated prose rather than a live path.
 *
 * Walks both directions from `index` to the paragraph's edges, unlike
 * `isKept`'s upward-only walk to a marker: the date can close a paragraph the
 * citation opens, as `.claude/ARCHITECTURE.md`'s own `Measured at ... on
 * <date>` sentences do.
 */
function isDatedParagraph(lines: readonly string[], index: number): boolean {
  let start = index
  while (start > 0 && lines[start - 1]?.trim() !== '') start -= 1

  let end = index
  while (end < lines.length - 1 && lines[end + 1]?.trim() !== '') end += 1

  for (let cursor = start; cursor <= end; cursor += 1) {
    if (ISO_DATE.test(lines[cursor] ?? '')) return true
  }

  return false
}

type LineClass = 'live' | 'kept' | 'glob' | 'crossRepo' | 'dated'

function classifyLine(
  lines: readonly string[],
  index: number,
  frontmatterEndIndex: number | undefined,
): LineClass {
  if (isFrontmatterPathsLine(lines, index, frontmatterEndIndex)) return 'glob'
  if (isKept(lines, index)) return 'kept'
  if (isCrossRepoPrefix(lines, index)) return 'crossRepo'
  if (isDatedParagraph(lines, index)) return 'dated'
  return 'live'
}

/** Rewrites every unmarked, non-glob citation into a moved entry. */
export function rewriteText(text: string): string {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)

  return lines
    .map((line, index) =>
      classifyLine(lines, index, frontmatterEndIndex) === 'live'
        ? line.replace(CITATION, (_match, entry: string) =>
            destinationPath(entry),
          )
        : line,
    )
    .join('\n')
}

/**
 * How many citations `rewriteText` would rewrite, how many marked lines it
 * left alone, how many sat inside a frontmatter `paths:` glob, how many sat
 * behind a cross-repository-shaped prefix, and how many sat inside a dated
 * paragraph. Every number past the first is what says its boundary fired at
 * all, which a diff cannot show because a protected line does not appear in
 * one.
 */
export function scanText(text: string): {
  readonly rewritten: number
  readonly kept: number
  readonly globs: number
  readonly crossRepo: number
  readonly dated: number
} {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)
  let rewritten = 0
  let kept = 0
  let globs = 0
  let crossRepo = 0
  let dated = 0

  for (const [index, line] of lines.entries()) {
    const matches = [...line.matchAll(CITATION)].length
    if (matches === 0) continue

    const kind = classifyLine(lines, index, frontmatterEndIndex)
    if (kind === 'glob') globs += matches
    else if (kind === 'kept') kept += matches
    else if (kind === 'crossRepo') crossRepo += matches
    else if (kind === 'dated') dated += matches
    else rewritten += matches
  }

  return { rewritten, kept, globs, crossRepo, dated }
}

/** Where a citation sits, so a reader can judge it before `--write` runs. */
export interface CitationLine {
  readonly line: number
  readonly text: string
}

/** Every frontmatter `paths:` line in `text` carrying a citation. */
function frontmatterGlobLines(text: string): CitationLine[] {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)
  const held: CitationLine[] = []

  for (const [index, line] of lines.entries()) {
    if (!isFrontmatterPathsLine(lines, index, frontmatterEndIndex)) continue
    if ([...line.matchAll(CITATION)].length === 0) continue

    held.push({ line: index + 1, text: line.trim() })
  }

  return held
}

/**
 * Every line in `text` whose citation `classifyLine` reads as `crossRepo`.
 *
 * Reads through `classifyLine` rather than `isCrossRepoPrefix` alone, so a
 * line a glob or a keep marker already claims is not reported twice under a
 * second boundary.
 */
function crossRepoLines(text: string): CitationLine[] {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)
  const held: CitationLine[] = []

  for (const [index, line] of lines.entries()) {
    if ([...line.matchAll(CITATION)].length === 0) continue
    if (classifyLine(lines, index, frontmatterEndIndex) !== 'crossRepo')
      continue

    held.push({ line: index + 1, text: line.trim() })
  }

  return held
}

/** Every line in `text` whose citation `classifyLine` reads as `dated`. */
function datedLines(text: string): CitationLine[] {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)
  const held: CitationLine[] = []

  for (const [index, line] of lines.entries()) {
    if ([...line.matchAll(CITATION)].length === 0) continue
    if (classifyLine(lines, index, frontmatterEndIndex) !== 'dated') continue

    held.push({ line: index + 1, text: line.trim() })
  }

  return held
}

export interface FolderMove {
  readonly from: string
  readonly to: string
}

/**
 * The entries actually on disk under the old root, with where each lands.
 *
 * An entry already present at the destination is reported as a collision by the
 * caller rather than filtered out here, since merging two record folders is a
 * judgment no verb should take on a memory pen.
 */
export function planFolderMoves(root: string): FolderMove[] {
  return MOVED_ENTRIES.filter((entry) =>
    existsSync(join(root, sourcePath(entry))),
  ).map((entry) => ({ from: sourcePath(entry), to: destinationPath(entry) }))
}

/** Moves whose destination is already taken, which the verb refuses on. */
export function collisions(
  root: string,
  moves: readonly FolderMove[],
): string[] {
  return moves
    .filter((move) => existsSync(join(root, move.to)))
    .map((move) => move.to)
}

/**
 * Whether a project's ignore rules already cover the new root.
 *
 * The gate exists because every entry being moved is ignored where it stands.
 * Landing them under a root the project does not ignore publishes the memory
 * pen and the groundwork trails into the next commit, which is the same harm
 * the records remote gate refuses for the same payload. Reading the file rather
 * than asking git keeps the answer available in a project with no commits yet.
 */
export function ignoresDestination(gitignore: string): boolean {
  return gitignore
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line === TO_ROOT || line === `${TO_ROOT}/`)
}

/** One tracked file, as the planner reads it. */
export interface RecordsSource {
  readonly path: string
  readonly text: string
}

/** One file whose citations move, carried with the text to write back. */
export interface CitationEntry {
  readonly path: string
  readonly text: string
  readonly rewritten: number
  readonly kept: number
}

/** One file whose frontmatter `paths:` glob names a moved root, held rather than rewritten. */
export interface FrontmatterGlobEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

/** One file whose citation resolves outside this project, held rather than rewritten. */
export interface CrossRepoCitationEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

/** One file whose citation sits inside a dated paragraph, held rather than rewritten. */
export interface DatedCitationEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

export interface RecordsPlan {
  readonly moves: readonly FolderMove[]
  readonly collisions: readonly string[]
  readonly entries: readonly CitationEntry[]
  readonly excluded: readonly string[]
  readonly coupled: readonly string[]
  readonly frontmatterGlobs: readonly FrontmatterGlobEntry[]
  readonly crossRepoCitations: readonly CrossRepoCitationEntry[]
  readonly datedCitations: readonly DatedCitationEntry[]
  readonly rewritten: number
  readonly kept: number
  readonly globs: number
  readonly crossRepo: number
  readonly dated: number
}

/**
 * What the move would do, without doing it.
 *
 * The folder half reads disk and the citation half is pure over the sources it
 * is handed, so a caller can report the whole plan and apply it from the same
 * value. A file whose text does not change is dropped rather than carried as a
 * no-op, which keeps the reported file count equal to what the sweep writes.
 */
export function planRecordsMove(
  root: string,
  sources: readonly RecordsSource[],
): RecordsPlan {
  const moves = planFolderMoves(root)
  const entries: CitationEntry[] = []
  const excluded: string[] = []
  const coupled: string[] = []
  const frontmatterGlobs: FrontmatterGlobEntry[] = []
  const crossRepoCitations: CrossRepoCitationEntry[] = []
  const datedCitations: DatedCitationEntry[] = []
  let kept = 0
  let globs = 0
  let crossRepo = 0
  let dated = 0

  for (const source of sources) {
    // Silently, and ahead of the exclusion test. The command boundary filters
    // these out before it reads them, so this is what keeps the pure function
    // correct under a direct call rather than what the verb relies on.
    if (isRecordArtifact(source.path)) continue

    if (isExcludedPath(source.path)) {
      // Only an excluded file that actually carries a citation is reported. The
      // predicate covers every test file in the tree, so counting them all would
      // report hundreds of exclusions the sweep was never going to touch and
      // bury the handful a reader has to go and check by hand.
      if (scanText(source.text).rewritten > 0) excluded.push(source.path)
      continue
    }

    const counts = scanText(source.text)
    kept += counts.kept
    globs += counts.globs
    crossRepo += counts.crossRepo
    dated += counts.dated

    // Ahead of the rewritten === 0 continue below: a file whose only citation
    // sits in its paths: glob, a cross-repo prefix, or a dated paragraph still
    // needs to be reported.
    const held = frontmatterGlobLines(source.text)
    if (held.length > 0)
      frontmatterGlobs.push({ path: source.path, lines: held })

    const foreign = crossRepoLines(source.text)
    if (foreign.length > 0)
      crossRepoCitations.push({ path: source.path, lines: foreign })

    const dates = datedLines(source.text)
    if (dates.length > 0)
      datedCitations.push({ path: source.path, lines: dates })

    if (counts.rewritten === 0) continue

    if (referencesExcluded(source.text)) coupled.push(source.path)

    entries.push({
      path: source.path,
      text: rewriteText(source.text),
      rewritten: counts.rewritten,
      kept: counts.kept,
    })
  }

  return {
    moves,
    collisions: collisions(root, moves),
    entries,
    excluded,
    coupled,
    frontmatterGlobs,
    crossRepoCitations,
    datedCitations,
    rewritten: entries.reduce((sum, entry) => sum + entry.rewritten, 0),
    kept,
    globs,
    crossRepo,
    dated,
  }
}
