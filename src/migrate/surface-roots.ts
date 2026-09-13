/**
 * The move of the tracked toolkit surfaces from `.claude/` to `canon/`.
 *
 * Unlike the records move, every entry here is tracked, so a folder relocating
 * is itself a citation-shaped event: the file's own path is a string every
 * other file may quote. One planner therefore judges both halves per source
 * file rather than moving folders and rewriting citations as two passes, so a
 * file that both moves and cites another moved entry is decided once.
 */

import { join } from 'node:path'
import { SURFACE_ENTRIES, spell, type SurfaceRoot } from '@/surface-root'

/** The root the entries below leave. */
export const FROM_ROOT: SurfaceRoot = '.claude'

/** The root they arrive at. */
const TO_ROOT: SurfaceRoot = 'canon'

/**
 * Every entry this move relocates, at the name `.claude/` gives it.
 *
 * Read from `SURFACE_ENTRIES` rather than restated. `canon` names the install
 * stamp folder and is the one entry whose name differs by root, which
 * `sourcePrefix` and `destinationPrefix` already resolve through `spell`
 * rather than restating the variant here.
 */
export const MOVED_ENTRIES: readonly string[] = SURFACE_ENTRIES

function sourcePrefix(entry: string): string {
  return join(FROM_ROOT, spell(FROM_ROOT, entry))
}

function destinationPrefix(entry: string): string {
  return join(TO_ROOT, spell(TO_ROOT, entry))
}

/**
 * Where a moved entry's own path lands, or `undefined` when `path` sits
 * outside every moved entry.
 *
 * Tested against the file's own path rather than its content, so a context
 * entry moves regardless of what it cites.
 */
export function movedPath(path: string): string | undefined {
  for (const entry of MOVED_ENTRIES) {
    const prefix = sourcePrefix(entry)
    if (path === prefix) return destinationPrefix(entry)
    if (path.startsWith(`${prefix}/`)) {
      return destinationPrefix(entry) + path.slice(prefix.length)
    }
  }

  return undefined
}

/**
 * A citation into a moved entry.
 *
 * The tail rejects a following name character rather than asking for a word
 * boundary, which is what keeps `.claude/context` bare and `.claude/context/`
 * both matching while `.claude/contexts/` does not. The alternation is ordered
 * longest first so `ARCHITECTURE.md` is decided before any shorter entry could
 * claim its prefix, and each entry is escaped because two of them carry a dot.
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
 * The changelog is release history, and an eval result is a transcript of
 * paths a session actually opened; rewriting either makes it testify to
 * something that never happened. `src/surface-root.ts` and
 * `src/record-root.ts` are the two sources that spell the old root as data on
 * purpose, so sweeping either would turn the very literals this verb reads
 * into their own replacement. A hook is the third such source, guarding on a
 * `case` carrying an arm per root, so `.claude/hooks/` and the seed's copy of
 * it are excluded for the same reason `records.ts` excludes them.
 *
 * No suffix-wide test exclusion. Most of the `src/` test files naming these
 * paths use them as fixture data proving the fallback still resolves, not to
 * pin one particular assertion, so a wholesale ban would leave the majority
 * silently unswept. The two files that do pin a fallback carry `KEEP_MARKER`
 * on the line that needs it instead.
 */
const EXCLUDED_PREFIXES: readonly string[] = [
  'src/migrate/',
  'scripts/eval/result-',
  '.claude/hooks/',
  'tooling/claude/seeds/.claude/hooks/',
]

const EXCLUDED_PATHS: readonly string[] = [
  'CHANGELOG.md',
  'src/surface-root.ts',
  'src/record-root.ts',
]

export function isExcludedPath(path: string): boolean {
  if (EXCLUDED_PATHS.includes(path)) return true
  return EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * Whether `text` names an `EXCLUDED_PREFIXES` or `EXCLUDED_PATHS` entry as
 * literal substring text, which is how a rewritten file can couple to one
 * this module leaves alone.
 */
export function referencesExcluded(text: string): boolean {
  return (
    EXCLUDED_PATHS.some((path) => text.includes(path)) ||
    EXCLUDED_PREFIXES.some((prefix) => text.includes(prefix))
  )
}

/**
 * Marks a line naming the old root on purpose.
 *
 * The marker sits on the line itself or on the nearest non-blank line above
 * it, walking past a run of blank markdown lines to reach a marker written on
 * its own line above the paragraph it protects.
 */
const KEEP_MARKER = 'canon-keep-surface-root'

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
 * or an indented `- 'glob'` list item under it.
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
 * repository's own name: it carries a dot or it is itself preceded by a
 * further `/`.
 */
const CROSS_REPO_PREFIX = /(?:[\w.-]+\.[\w.-]+|[\w.-]+\/[\w.-]+)\/$/

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
 * `.claude/ARCHITECTURE.md` is itself a moved entry and carries dozens of
 * `Measured at <sha> on <date>` paragraphs naming the old root as what was
 * true that day. Those stay as written rather than being rewritten into a
 * root that did not exist yet on the date being recorded.
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
            destinationPrefix(entry),
          )
        : line,
    )
    .join('\n')
}

/**
 * How many citations `rewriteText` would rewrite, how many marked lines it
 * left alone, how many sat inside a frontmatter `paths:` glob, how many sat
 * behind a cross-repository-shaped prefix, and how many sat inside a dated
 * paragraph.
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

/** One tracked file, as the planner reads it. */
export interface SurfaceRootsSource {
  readonly path: string
  readonly text: string
}

/** One file the sweep touches, whether by moving, rewriting, or both. */
export interface SurfaceRootsEntry {
  readonly path: string
  readonly movesTo?: string
  readonly text?: string
  readonly rewritten: number
  readonly kept: number
}

export interface FrontmatterGlobEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

export interface CrossRepoCitationEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

export interface DatedCitationEntry {
  readonly path: string
  readonly lines: readonly CitationLine[]
}

export interface SurfaceRootsPlan {
  readonly entries: readonly SurfaceRootsEntry[]
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
  readonly moves: number
}

/**
 * What the move would do, without doing it.
 *
 * A file is judged once for both halves: whether its own path sits under a
 * moved entry, and whether its content cites one. Either alone is enough to
 * produce an entry, and a file excluded from the citation rewrite still moves
 * when its path itself is inside a moved entry, since the two entries excluded
 * today, `src/surface-root.ts` and `src/record-root.ts`, both sit outside
 * every moved entry and never take that branch in practice.
 */
export function planSurfaceRootsMove(
  sources: readonly SurfaceRootsSource[],
): SurfaceRootsPlan {
  const entries: SurfaceRootsEntry[] = []
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
    const movesTo = movedPath(source.path)

    if (isExcludedPath(source.path)) {
      if (scanText(source.text).rewritten > 0) excluded.push(source.path)
      if (movesTo !== undefined) {
        entries.push({ path: source.path, movesTo, rewritten: 0, kept: 0 })
      }
      continue
    }

    const counts = scanText(source.text)
    kept += counts.kept
    globs += counts.globs
    crossRepo += counts.crossRepo
    dated += counts.dated

    const held = frontmatterGlobLines(source.text)
    if (held.length > 0)
      frontmatterGlobs.push({ path: source.path, lines: held })

    const foreign = crossRepoLines(source.text)
    if (foreign.length > 0)
      crossRepoCitations.push({ path: source.path, lines: foreign })

    const dates = datedLines(source.text)
    if (dates.length > 0)
      datedCitations.push({ path: source.path, lines: dates })

    const changed = counts.rewritten > 0
    if (!changed && movesTo === undefined) continue

    if (changed && referencesExcluded(source.text)) coupled.push(source.path)

    entries.push({
      path: source.path,
      ...(movesTo !== undefined ? { movesTo } : {}),
      ...(changed ? { text: rewriteText(source.text) } : {}),
      rewritten: counts.rewritten,
      kept: counts.kept,
    })
  }

  return {
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
    moves: entries.filter((entry) => entry.movesTo !== undefined).length,
  }
}
