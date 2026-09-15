/**
 * The memory pen's review receipts and retired entries, folded under the pen
 * itself rather than sitting in three separate record folders.
 *
 * `.canon/review/memory/` and `.canon/tmp/memory-archive/` move to
 * `.canon/memory/review/` and `.canon/memory/archive/`, the second one backed
 * for the first time: `canon records push` carries every top-level `.canon/`
 * entry except `EXCLUDED_ENTRIES`, and `tmp/` is one of the three names that
 * set excludes. `canon/ARCHITECTURE.md`'s "A durable record is named for what
 * it is, not for how long it lives" already names the cost this closes: two
 * surfaces both named for memory archived to two different places.
 *
 * The move and the citation repoint follow `scratch-evidence.ts`'s shape: a
 * dry run by default, `--write` to apply, a collision refusal, the
 * `canon-keep-record-root` marker honored, and archives swept on purpose,
 * since an archived receipt still cites the row it retired.
 *
 * `moves` is a data table rather than one function per pair, so a later
 * intake batch in the same folder-layout group appends an entry instead of
 * restructuring the module.
 */

import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { presentFolders } from '@/records/backup'
import { recordDir, SCRATCH, spell, type RecordRoot } from '@/record-root'

const CANON: RecordRoot = '.canon'
const CLAUDE: RecordRoot = '.claude'

export interface RecordLayoutMove {
  readonly from: readonly string[]
  readonly to: readonly string[]
}

/**
 * Every folder this migration moves, as a record-relative path on each side.
 *
 * Derived from the plan's own mapping: the review folder's memory receipts
 * fold into the pen at `memory/review/`, and the scratch archive folds in at
 * `memory/archive/`. A later batch in the same intake group appends here
 * rather than adding a second table.
 */
export const RECORD_LAYOUT_MOVES: readonly RecordLayoutMove[] = [
  { from: ['review', 'memory'], to: ['memory', 'review'] },
  { from: [SCRATCH, 'memory-archive'], to: ['memory', 'archive'] },
]

/** Where a move's source sits today. */
export function sourcePath(root: string, move: RecordLayoutMove): string {
  const [folder, ...rest] = move.from
  return recordDir(root, folder, ...rest)
}

/** Where it lands after, always under whichever root `memory/` resolves at. */
export function destinationPath(root: string, move: RecordLayoutMove): string {
  const [folder, ...rest] = move.to
  return recordDir(root, folder, ...rest)
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The prefixes a citation of a move's source is spelled with: absolute at
 * either record root, spelled the way each root spells the leading segment,
 * and relative one and two directories up, in both spellings, since a
 * relative citation carries no root of its own to read the spelling from.
 */
function oldPrefixes(from: readonly string[]): readonly string[] {
  const [head, ...rest] = from
  const canonSuffix = [spell(CANON, head), ...rest].join('/')
  const claudeSuffix = [spell(CLAUDE, head), ...rest].join('/')

  const prefixes = new Set<string>([
    `.canon/${canonSuffix}/`,
    `.claude/${claudeSuffix}/`,
  ])
  for (const suffix of [canonSuffix, claudeSuffix]) {
    prefixes.add(`../${suffix}/`)
    prefixes.add(`../../${suffix}/`)
  }

  return [...prefixes]
}

function citationPattern(move: RecordLayoutMove): RegExp {
  const alternation = oldPrefixes(move.from).map(escape).join('|')
  return new RegExp(`(?:${alternation})`, 'g')
}

interface Rewrite {
  readonly pattern: RegExp
  readonly destination: string
}

/** One rewrite per move, paired with its citation pattern. */
function buildRewrites(moves: readonly RecordLayoutMove[]): readonly Rewrite[] {
  return moves.map((move) => ({
    pattern: citationPattern(move),
    destination: `.canon/${move.to.join('/')}/`,
  }))
}

/**
 * Marks a line naming a moved path on purpose, the same marker
 * `scratch-evidence.ts` and `records.ts` read: on the line itself or on the
 * nearest non-blank line above it.
 */
const KEEP_MARKER = 'canon-keep-record-root'

function isKept(lines: readonly string[], index: number): boolean {
  if (lines[index]?.includes(KEEP_MARKER)) return true

  let above = index - 1
  while (above >= 0 && lines[above]?.trim() === '') above -= 1

  return above >= 0 && (lines[above]?.includes(KEEP_MARKER) ?? false)
}

function rewriteLine(line: string, rewrites: readonly Rewrite[]): string {
  return rewrites.reduce(
    (current, { pattern, destination }) =>
      current.replace(pattern, destination),
    line,
  )
}

interface RewriteOutcome {
  readonly text: string
  readonly count: number
}

/**
 * Rewrites every unmarked citation a move covers into its destination,
 * counting each as it goes. A file naming no such path returns
 * byte-identical with a count of zero, and a marked line is returned
 * unchanged and uncounted.
 */
function applyRewrites(
  text: string,
  rewrites: readonly Rewrite[],
): RewriteOutcome {
  const lines = text.split('\n')
  let count = 0

  const rewritten = lines.map((line, index) => {
    if (isKept(lines, index)) return line

    for (const { pattern } of rewrites) {
      count += [...line.matchAll(pattern)].length
    }
    return rewriteLine(line, rewrites)
  })

  return { text: rewritten.join('\n'), count }
}

/** The files under every present backed folder at `root`, archives included. */
export async function walkRecordLayoutCorpus(root: string): Promise<string[]> {
  const files: string[] = []

  for (const folder of presentFolders(root)) {
    const dir = recordDir(root, folder)
    if (!existsSync(dir)) continue

    const glob = new Bun.Glob('**/*')
    for await (const path of glob.scan({
      cwd: dir,
      onlyFiles: true,
      dot: true,
    })) {
      files.push(join(dir, path))
    }
  }

  return files.sort()
}

export interface RecordLayoutSource {
  readonly path: string
  readonly text: string
}

/** Reads every file the walk found, skipping one that carries a NUL byte. */
export async function readRecordLayoutCorpus(
  paths: readonly string[],
): Promise<RecordLayoutSource[]> {
  const sources: RecordLayoutSource[] = []

  for (const path of paths) {
    const bytes = await readFile(path).catch(() => undefined)
    if (bytes === undefined || bytes.includes(0)) continue

    sources.push({ path, text: bytes.toString('utf8') })
  }

  return sources
}

export interface FolderMove {
  readonly move: RecordLayoutMove
  readonly from: string
  readonly to: string
}

export interface CitationEntry {
  readonly path: string
  readonly text: string
  readonly rewritten: number
}

export interface RecordLayoutPlan {
  readonly moves: readonly FolderMove[]
  readonly collisions: readonly string[]
  readonly entries: readonly CitationEntry[]
  readonly rewritten: number
  readonly strays: readonly string[]
}

const STRAY_RECEIPT_PATTERN = /^memory-review-.*\.md$/

/**
 * A receipt sitting at the flat `review/` root, the shape `memory-review`
 * wrote before `.canon/review/memory/` existed. Neither mapped move covers
 * it, since it sits one level above the folder either move reads, so it is
 * reported rather than moved: widening the table for one stray file trades a
 * data-shaped mapping for a special case.
 */
export function strayReceipts(root: string): string[] {
  const dir = recordDir(root, 'review')
  const entries = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
    : []

  return entries
    .filter((entry) => entry.isFile() && STRAY_RECEIPT_PATTERN.test(entry.name))
    .map((entry) => join(dir, entry.name))
    .sort()
}

/**
 * Every mapped move found on disk, with its destination, refusing a move
 * whose destination is already occupied rather than merging into it.
 */
export function planFolderMoves(root: string): {
  moves: FolderMove[]
  collisions: string[]
} {
  const moves: FolderMove[] = []
  const collisions: string[] = []

  for (const move of RECORD_LAYOUT_MOVES) {
    const from = sourcePath(root, move)
    if (!existsSync(from)) continue

    const to = destinationPath(root, move)
    if (existsSync(to)) {
      collisions.push(to)
      continue
    }

    moves.push({ move, from, to })
  }

  return { moves, collisions }
}

/**
 * What the migration would do, without doing it. Pure over the sources it is
 * handed, so a caller reports and applies from the same value. A file whose
 * text does not change is dropped.
 */
export function planRecordLayout(
  root: string,
  sources: readonly RecordLayoutSource[],
): RecordLayoutPlan {
  const { moves, collisions } = planFolderMoves(root)
  const collidedDestinations = new Set(collisions)
  const covered = RECORD_LAYOUT_MOVES.filter(
    (move) => !collidedDestinations.has(destinationPath(root, move)),
  )
  const rewrites = buildRewrites(covered)
  const entries: CitationEntry[] = []

  for (const source of sources) {
    const { text, count } = applyRewrites(source.text, rewrites)
    if (count === 0) continue

    entries.push({ path: source.path, text, rewritten: count })
  }

  return {
    moves,
    collisions,
    entries,
    rewritten: entries.reduce((sum, entry) => sum + entry.rewritten, 0),
    strays: strayReceipts(root),
  }
}

export interface RecordLayoutResult {
  readonly moved: number
  readonly written: number
  readonly failed: readonly string[]
}

/**
 * Writes the plan: every citation rewrite first, then every folder move.
 *
 * A citation can sit inside a file the plan is about to move, since the walk
 * carries archives on purpose and a receipt can cite the row it retired.
 * Rewriting first is what keeps that write landing on a path that still
 * exists: renaming the folder first would send `writeFile` at the pre-move
 * path into a directory `rename` already cleared.
 */
export async function applyRecordLayout(
  plan: RecordLayoutPlan,
): Promise<RecordLayoutResult> {
  let moved = 0
  let written = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    const done = await writeFile(entry.path, entry.text)
      .then(() => true)
      .catch(() => false)

    if (done) written += 1
    else failed.push(entry.path)
  }

  for (const move of plan.moves) {
    await mkdir(dirname(move.to), { recursive: true })
    const done = await rename(move.from, move.to)
      .then(() => true)
      .catch(() => false)

    if (done) moved += 1
    else failed.push(move.from)
  }

  return { moved, written, failed }
}
