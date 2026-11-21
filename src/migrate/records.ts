/**
 * The move of the gitignored session records from `.claude/` to `.canon/`. Two halves share
 * one list: the untracked folders move on disk, and every tracked citation of their paths
 * is rewritten, so one verb performs both.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  type RecordRoot,
  RECORD_ENTRIES,
  RECORD_ROOTS,
  spell,
} from '@/roots/record'

/** The root the entries below leave, exported so the writer can prune it. */
export const FROM_ROOT: RecordRoot = '.claude'

/** The root they arrive at. */
const TO_ROOT: RecordRoot = '.canon'

/**
 * Every entry the move relocates, at the name `.claude/` gave it. The list is
 * `RECORD_ENTRIES`, which `roots/record.ts` owns, so the sweep and the resolver agree.
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
 * A citation into a moved entry. The tail rejects a following name character rather than
 * a word boundary, which protects the retired flat archives with no exception list.
 * The alternation runs longest first, and each entry is escaped, since two carry a dot.
 */
const ENTRY_ALTERNATION = [...MOVED_ENTRIES]
  .sort((left, right) => right.length - left.length)
  .map(escape)
  .join('|')

const CITATION = new RegExp(
  `${escape(FROM_ROOT)}/(${ENTRY_ALTERNATION})(?![A-Za-z0-9._-])`,
  'g',
)

/** A gitignore line that is wholly an entry for one moved folder or file. */
const IGNORE_ENTRY = new RegExp(
  `^/?${escape(FROM_ROOT)}/(?:${ENTRY_ALTERNATION})/?$`,
)

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Files whose content is left alone entirely, because each states the old root on purpose
 * or records what happened under it. A file outside the list that quotes an excluded
 * path is reported by `referencesExcluded` rather than guessed at.
 */
const EXCLUDED_PREFIXES: readonly string[] = [
  'src/migrate/',
  'scripts/eval/result-',
  '.claude/hooks/',
  'tooling/claude/seeds/.claude/hooks/',
  'sandbox/fixtures/replay/',
]

const EXCLUDED_PATHS: readonly string[] = [
  'CHANGELOG.md',
  'src/roots/record.ts',
  'src/roots/surface.ts',
]

const EXCLUDED_SUFFIXES: readonly string[] = ['.test.ts']

export function isExcludedPath(path: string): boolean {
  if (EXCLUDED_PATHS.includes(path)) return true
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  return EXCLUDED_SUFFIXES.some((suffix) => path.endsWith(suffix))
}

/**
 * Whether `text` names an `EXCLUDED_PREFIXES` or `EXCLUDED_PATHS` entry as literal text,
 * which is how a rewritten file couples to one this module leaves alone.
 */
export function referencesExcluded(text: string): boolean {
  return (
    EXCLUDED_PATHS.some((path) => text.includes(path)) ||
    EXCLUDED_PREFIXES.some((prefix) => text.includes(prefix))
  )
}

/**
 * The roots holding nothing but records, so a path under one is a record whatever it is
 * named. The old root is mixed and derived by exclusion. Exported because `record-tree.ts`
 * sweeps inside these roots.
 */
export const RECORD_ONLY_ROOTS: readonly RecordRoot[] = RECORD_ROOTS.filter(
  (root) => root !== FROM_ROOT,
)

/**
 * Every prefix under which a path is a record rather than a file to sweep. The old root is
 * entry-scoped, since a bare `.claude/` prefix would strand installed rules. Joined with
 * a literal `/`, since `git ls-files` returns forward slashes.
 */
const RECORD_PREFIXES: readonly string[] = [
  ...RECORD_ONLY_ROOTS,
  ...RECORD_ENTRIES.map((entry) => `${FROM_ROOT}/${spell(FROM_ROOT, entry)}`),
]

/**
 * Whether a path is a record artifact, which the sweep passes over silently. Kept apart
 * from `isExcludedPath`, which reports what it skips, since a record tree would bury
 * those few. The retired flat archives stay outside it, as `CITATION` leaves them.
 */
export function isRecordArtifact(path: string): boolean {
  return RECORD_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

/**
 * Marks a line naming the old root on purpose, on the line itself or the nearest non-blank line above, walking past blank markdown lines to reach a marker written on its own line above the
 * paragraph it protects. `canon-keep-retired` and `canon-allow-superseded`
 * mark code instead, so neither needs the walk.
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
 * Marks a line inside a rule's frontmatter `paths:` key, found structurally by walking up
 * to the nearest line at column 0. Independent of `KEEP_MARKER`, since a rewritten glob
 * stops matching silently.
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
 * A path segment immediately before a citation match, shaped like another repository's own
 * name: it carries a dot, or it is preceded by a further `/`. Bounded by `[\w.-]`, which
 * keeps a shell-glob `*` prefix and a `$project` prefix out.
 */
const CROSS_REPO_PREFIX = /(?:[\w.-]+\.[\w.-]+|[\w.-]+\/[\w.-]+)\/$/

/**
 * Whether the line's citation sits right after a prefix `CROSS_REPO_PREFIX` reads as
 * another repository's path. Per-line, so a line with several citations is judged by the first.
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
 * Whether the line's citation sits inside a blank-line-delimited paragraph that also
 * carries an ISO date, read as dated prose rather than a live path. Walks both directions,
 * since the date can close a paragraph the citation opens.
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
 * How many citations `rewriteText` would rewrite, and how many marked lines, frontmatter
 * globs, cross-repository prefixes, and dated paragraphs it left alone. A diff cannot show
 * those, since a protected line does not appear in one.
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

/**
 * Deletes each live line that is wholly an entry for a moved folder, counting them. Only a
 * root `.gitignore` that already ignores `.canon/` may be handed here, since the dropped
 * line is redundant only then.
 */
export function dropCoveredIgnoreLines(text: string): {
  readonly text: string
  readonly dropped: number
} {
  const lines = text.split('\n')
  const frontmatterEndIndex = frontmatterEnd(lines)
  const kept = lines.filter(
    (line, index) =>
      !(
        IGNORE_ENTRY.test(line.trim()) &&
        classifyLine(lines, index, frontmatterEndIndex) === 'live'
      ),
  )

  return { text: kept.join('\n'), dropped: lines.length - kept.length }
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
 * Every line in `text` whose citation `classifyLine` reads as `crossRepo`. Reads through
 * `classifyLine`, so a line a glob or keep marker claims is not reported twice.
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
 * The entries actually on disk under the old root, with where each lands. A collision is
 * reported by the caller, since merging two record folders is a judgment no verb takes.
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
 * Whether a project's ignore rules already cover the new root. Landing the entries under
 * a root the project does not ignore would publish the memory pen into the next commit.
 * Reads the file rather than asking git, so it works with no commits yet.
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
  readonly dropped: number
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
  readonly dropped: number
  readonly kept: number
  readonly globs: number
  readonly crossRepo: number
  readonly dated: number
}

/**
 * What the move would do, without doing it. The folder half reads disk and the citation
 * half is pure, so a caller reports and applies from one value. A file whose text does
 * not change is dropped.
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
    // Ahead of the exclusion test, so a direct call stays correct without the command boundary.
    if (isRecordArtifact(source.path)) continue

    if (isExcludedPath(source.path)) {
      // Only an excluded file carrying a citation is reported, since the predicate covers every test file.
      if (scanText(source.text).rewritten > 0) excluded.push(source.path)
      continue
    }

    const swept =
      source.path === '.gitignore' && ignoresDestination(source.text)
        ? dropCoveredIgnoreLines(source.text)
        : { text: source.text, dropped: 0 }
    const counts = scanText(swept.text)
    kept += counts.kept
    globs += counts.globs
    crossRepo += counts.crossRepo
    dated += counts.dated

    // Ahead of the `rewritten === 0` continue below, since a glob-only file is still reported.
    const held = frontmatterGlobLines(source.text)
    if (held.length > 0)
      frontmatterGlobs.push({ path: source.path, lines: held })

    const foreign = crossRepoLines(source.text)
    if (foreign.length > 0)
      crossRepoCitations.push({ path: source.path, lines: foreign })

    const dates = datedLines(source.text)
    if (dates.length > 0)
      datedCitations.push({ path: source.path, lines: dates })

    if (counts.rewritten === 0 && swept.dropped === 0) continue

    if (referencesExcluded(source.text)) coupled.push(source.path)

    entries.push({
      path: source.path,
      text: rewriteText(swept.text),
      rewritten: counts.rewritten,
      kept: counts.kept,
      dropped: swept.dropped,
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
    dropped: entries.reduce((sum, entry) => sum + entry.dropped, 0),
    kept,
    globs,
    crossRepo,
    dated,
  }
}
