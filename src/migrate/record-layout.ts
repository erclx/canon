/**
 * The record folder layout, moved one intake batch at a time.
 *
 * Batch 2 folded the memory pen's review receipts and retired entries under
 * the pen itself. Batch 3 leaves `.canon/review/` holding only reviews: toolkit
 * feedback moves to `.canon/feedback/`, option captures to `.canon/picks/`,
 * claim-backing folders to a numbered `.canon/evidence/`, renders rebuilt from
 * committed sources to `.canon/tmp/render/`, a branch report flattens to
 * `review/branch-<slug>.md`, and a flat checklist joins the `tmp/ui-checklist/`
 * handoff folder. `canon records push` carries every top-level `.canon/`
 * entry except `EXCLUDED_ENTRIES`, so the new root folders are backed with no
 * list edit, and `tmp/render/` is deliberately not.
 *
 * The move and the citation repoint follow `scratch-evidence.ts`'s shape: a
 * dry run by default, `--write` to apply, a collision refusal, the
 * `canon-keep-record-root` marker honored, and archives swept on purpose,
 * since an archived receipt still cites the row it retired.
 *
 * `RECORD_LAYOUT_MOVES` is a data table rather than one function per pair, so
 * a later batch appends a row instead of restructuring the module. A row that
 * cannot name its destination ahead of time, being the pick-or-evidence split,
 * names the rule that derives it from what is on disk, never a list of slugs,
 * since every target holds folders of its own.
 */

import { existsSync, readdirSync } from 'node:fs'
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rmdir,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  byFirstAppearance,
  nextOrdinal,
  numberedName,
  slugOf,
} from '@/migrate/evidence-ordinal'
import { presentFolders } from '@/records/backup'
import { recordDir, SCRATCH, spell, type RecordRoot } from '@/record-root'

const CANON: RecordRoot = '.canon'
const CLAUDE: RecordRoot = '.claude'

/** A whole folder moving to a fixed destination. */
export interface FolderLayoutMove {
  readonly kind: 'folder'
  readonly from: readonly string[]
  readonly to: readonly string[]
}

/**
 * Every file directly inside `from` whose name starts with `prefix`, each
 * landing in `to` with that prefix swapped for `renamed`. `prune` removes
 * `from` once the moves leave it empty.
 */
export interface FilesLayoutMove {
  readonly kind: 'files'
  readonly from: readonly string[]
  readonly prefix: string
  readonly to: readonly string[]
  readonly renamed: string
  readonly prune: boolean
}

/**
 * Every folder directly inside `from`, sent to `picks` when it holds what a
 * pick writes and to `evidence` under the next ordinal otherwise.
 */
export interface SplitLayoutMove {
  readonly kind: 'split'
  readonly from: readonly string[]
  readonly picks: readonly string[]
  readonly evidence: readonly string[]
}

export type RecordLayoutMove =
  | FolderLayoutMove
  | FilesLayoutMove
  | SplitLayoutMove

const RENDER = [SCRATCH, 'render'] as const

/**
 * Every move this migration makes, as record-relative paths.
 *
 * The first two rows are batch 2's. The rest are batch 3's, in the order the
 * intake's review-folder pass listed them. A later batch appends here rather
 * than adding a second table.
 */
export const RECORD_LAYOUT_MOVES: readonly RecordLayoutMove[] = [
  { kind: 'folder', from: ['review', 'memory'], to: ['memory', 'review'] },
  {
    kind: 'folder',
    from: [SCRATCH, 'memory-archive'],
    to: ['memory', 'archive'],
  },
  { kind: 'folder', from: ['review', 'feedback'], to: ['feedback'] },
  { kind: 'folder', from: ['review', 'design'], to: [...RENDER, 'design'] },
  { kind: 'folder', from: ['review', 'board'], to: [...RENDER, 'board'] },
  { kind: 'folder', from: ['review', 'slides'], to: [...RENDER, 'slides'] },
  { kind: 'folder', from: ['review', 'diagrams'], to: [...RENDER, 'diagrams'] },
  {
    kind: 'folder',
    from: ['review', 'references'],
    to: ['picks', 'references'],
  },
  {
    kind: 'files',
    from: ['review', 'branch'],
    prefix: 'review-',
    to: ['review'],
    renamed: 'branch-',
    prune: true,
  },
  {
    kind: 'files',
    from: ['review'],
    prefix: 'ui-checklist-',
    to: [SCRATCH, 'ui-checklist'],
    renamed: '',
    prune: false,
  },
  {
    kind: 'split',
    from: ['review', 'evidence'],
    picks: ['picks'],
    evidence: ['evidence'],
  },
]

function resolveRecord(root: string, segments: readonly string[]): string {
  const [folder, ...rest] = segments
  return recordDir(root, folder, ...rest)
}

/** Where a move's source sits today. */
export function sourcePath(root: string, move: RecordLayoutMove): string {
  return resolveRecord(root, move.from)
}

/** Where a folder row lands, under whichever root its head folder resolves at. */
export function destinationPath(root: string, move: FolderLayoutMove): string {
  return resolveRecord(root, move.to)
}

/** A record-relative path as a citation spells it at `.canon/`, no trailing slash. */
function canonCitation(segments: readonly string[]): string {
  const [head, ...rest] = segments
  return ['.canon', spell(CANON, head), ...rest].join('/')
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The prefixes a citation of a source is spelled with, each ending in a
 * slash: absolute at either record root, spelled the way each root spells the
 * leading segment, and relative one and two directories up, in both
 * spellings, since a relative citation carries no root of its own to read the
 * spelling from.
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

/** Matches a citation of `from` followed by `tail`, a pattern source. */
function citationPattern(from: readonly string[], tail: string): RegExp {
  const alternation = oldPrefixes(from).map(escape).join('|')
  return new RegExp(`(?:${alternation})${tail}`, 'g')
}

/** Rejects a following name character, so one slug never swallows a sibling. */
const NAME_BOUNDARY = '(?![A-Za-z0-9._-])'

interface Rewrite {
  readonly pattern: RegExp
  readonly destination: string
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

export type Classification = 'pick' | 'evidence'

export interface PathMove {
  readonly move: RecordLayoutMove
  readonly from: string
  readonly to: string
  readonly classified?: Classification
}

export interface CitationEntry {
  readonly path: string
  readonly text: string
  readonly rewritten: number
}

export interface RecordLayoutPlan {
  readonly moves: readonly PathMove[]
  readonly collisions: readonly string[]
  readonly entries: readonly CitationEntry[]
  readonly rewritten: number
  readonly strays: readonly string[]
  readonly prune: readonly string[]
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

function entriesOf(dir: string, isDirectory: boolean): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() === isDirectory)
    .map((entry) => entry.name)
    .sort()
}

/**
 * What `draft-and-pick` Step 6 and `sketch-design` write into the folder they
 * archive a choice to: a capture per arm, named `arm-<id>`, and a design
 * handoff. A folder carrying neither is evidence.
 */
const PICK_FILE = /^(?:arm-[^.]+\..+|design-handoff\.md)$/

function classify(dir: string): Classification {
  return entriesOf(dir, false).some((name) => PICK_FILE.test(name))
    ? 'pick'
    : 'evidence'
}

interface RowPlan {
  readonly moves: PathMove[]
  readonly collisions: string[]
  readonly rewrites: Rewrite[]
  readonly prune: string[]
}

function planFolderRow(
  root: string,
  move: FolderLayoutMove,
  claimed: Set<string>,
): RowPlan {
  const from = sourcePath(root, move)
  const to = destinationPath(root, move)

  if (existsSync(from) && (existsSync(to) || claimed.has(to))) {
    return { moves: [], collisions: [to], rewrites: [], prune: [] }
  }

  const rewrites = [
    {
      pattern: citationPattern(move.from, ''),
      destination: `${canonCitation(move.to)}/`,
    },
  ]
  if (!existsSync(from))
    return { moves: [], collisions: [], rewrites, prune: [] }

  claimed.add(to)
  return { moves: [{ move, from, to }], collisions: [], rewrites, prune: [] }
}

/**
 * A files row moves whole or not at all: one occupied destination refuses
 * every file in the row, since the citation rewrite matches the shared prefix
 * rather than each name.
 */
function planFilesRow(
  root: string,
  move: FilesLayoutMove,
  claimed: Set<string>,
): RowPlan {
  const from = sourcePath(root, move)
  const toDir = resolveRecord(root, move.to)
  const names = entriesOf(from, false).filter((name) =>
    name.startsWith(move.prefix),
  )

  const moves = names.map((name) => ({
    move,
    from: join(from, name),
    to: join(toDir, `${move.renamed}${name.slice(move.prefix.length)}`),
  }))
  const collisions = moves
    .map((candidate) => candidate.to)
    .filter((to) => existsSync(to) || claimed.has(to))

  if (collisions.length > 0) {
    return { moves: [], collisions, rewrites: [], prune: [] }
  }

  for (const candidate of moves) claimed.add(candidate.to)

  return {
    moves,
    collisions: [],
    rewrites: [
      {
        pattern: citationPattern(move.from, escape(move.prefix)),
        destination: `${canonCitation(move.to)}/${move.renamed}`,
      },
    ],
    prune: move.prune && moves.length > 0 ? [from] : [],
  }
}

/**
 * Sends each folder to its derived destination. Picks keep their slug.
 * Evidence folders take ordinals in order of first appearance, continuing past
 * the highest ordinal `evidence/` already holds, and a slug already numbered
 * there refuses rather than taking a second number.
 */
function planSplitRow(
  root: string,
  move: SplitLayoutMove,
  claimed: Set<string>,
): RowPlan {
  const from = sourcePath(root, move)
  const evidenceDir = resolveRecord(root, move.evidence)
  const existing = entriesOf(evidenceDir, true)
  let next = nextOrdinal(existing)

  const folders = entriesOf(from, true).map((name) => ({
    name,
    dir: join(from, name),
  }))
  const picks = folders.filter(({ dir }) => classify(dir) === 'pick')
  const evidence = byFirstAppearance(
    folders.filter(({ dir }) => classify(dir) === 'evidence'),
  )

  const plan: RowPlan = { moves: [], collisions: [], rewrites: [], prune: [] }

  const accept = (
    name: string,
    dir: string,
    segments: readonly string[],
    classified: Classification,
  ): void => {
    const to = resolveRecord(root, segments)
    claimed.add(to)
    plan.moves.push({ move, from: dir, to, classified })
    plan.rewrites.push({
      pattern: citationPattern(move.from, `${escape(name)}${NAME_BOUNDARY}`),
      destination: canonCitation(segments),
    })
  }

  for (const { name, dir } of picks) {
    const segments = [...move.picks, name]
    const to = resolveRecord(root, segments)
    if (existsSync(to) || claimed.has(to)) plan.collisions.push(to)
    else accept(name, dir, segments, 'pick')
  }

  for (const { name, dir } of evidence) {
    const numbered = existing.find((entry) => slugOf(entry) === name)
    if (numbered !== undefined) {
      plan.collisions.push(join(evidenceDir, numbered))
      continue
    }

    accept(name, dir, [...move.evidence, numberedName(next, name)], 'evidence')
    next += 1
  }

  return plan
}

function planRow(
  root: string,
  move: RecordLayoutMove,
  claimed: Set<string>,
): RowPlan {
  switch (move.kind) {
    case 'folder':
      return planFolderRow(root, move, claimed)
    case 'files':
      return planFilesRow(root, move, claimed)
    case 'split':
      return planSplitRow(root, move, claimed)
  }
}

/**
 * What the migration would do, without doing it. Pure over the sources it is
 * handed apart from reading the tree it plans against, so a caller reports
 * and applies from the same value. A file whose text does not change is
 * dropped.
 */
export function planRecordLayout(
  root: string,
  sources: readonly RecordLayoutSource[],
): RecordLayoutPlan {
  const claimed = new Set<string>()
  const rows = RECORD_LAYOUT_MOVES.map((move) => planRow(root, move, claimed))
  const rewrites = rows.flatMap((row) => row.rewrites)
  const entries: CitationEntry[] = []

  for (const source of sources) {
    const { text, count } = applyRewrites(source.text, rewrites)
    if (count === 0) continue

    entries.push({ path: source.path, text, rewritten: count })
  }

  return {
    moves: rows.flatMap((row) => row.moves),
    collisions: rows.flatMap((row) => row.collisions),
    entries,
    rewritten: entries.reduce((sum, entry) => sum + entry.rewritten, 0),
    strays: strayReceipts(root),
    prune: rows.flatMap((row) => row.prune),
  }
}

export interface RecordLayoutResult {
  readonly moved: number
  readonly written: number
  readonly failed: readonly string[]
}

async function removeIfEmpty(dir: string): Promise<void> {
  const left = await readdir(dir).catch(() => undefined)
  if (left === undefined || left.length > 0) return

  await rmdir(dir).catch(() => undefined)
}

/**
 * Writes the plan: every citation rewrite first, then every move, then the
 * folders a files row emptied.
 *
 * A citation can sit inside a file the plan is about to move, since the walk
 * carries archives on purpose and a receipt can cite the row it retired.
 * Rewriting first is what keeps that write landing on a path that still
 * exists: moving first would send `writeFile` at the pre-move path into a
 * directory `rename` already cleared.
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

  for (const dir of plan.prune) await removeIfEmpty(dir)

  return { moved, written, failed }
}
