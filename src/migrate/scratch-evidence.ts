/**
 * The promotion of nine cited measurement folders out of `.canon/tmp/` into
 * `.canon/evidence/<nn>-<folder>/`, which `canon records push` already backs.
 *
 * The scratch root is the one record root a disk loss takes with it, and a
 * durable record naming a folder under it as its evidence is a citation into
 * something the backup never covers. The nine promoted here are every folder
 * under scratch that a live or archived record cites and no source file under
 * `claude/`, `scripts/`, `src/`, `governance/`, or `standards/` names by path,
 * which is what separates them from a folder a script still writes into on its
 * own schedule.
 *
 * Distinct from `record-tree.ts`, which repoints a citation of the `.claude/`
 * to `.canon/` root move and prunes every `archive` segment on the way in,
 * since an archived record describes work that already closed. This move
 * reaches into an archive on purpose: `tasks/archive/`, `plans/archive/`, and
 * `groundwork/` are where most of the citations broken here already sit, and
 * a folder promoted out from under them stays gone whether the citing record
 * is open or closed.
 *
 * Honors the same `canon-keep-record-root` marker `records.ts` reads, since a
 * sentence describing what no target holds is not a live pointer this checkout
 * has to keep resolving.
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  byFirstAppearance,
  folderNames,
  nextOrdinal,
  numberedName,
  slugOf,
} from '@/migrate/evidence-ordinal'
import { presentFolders } from '@/records/backup'
import { recordDir, SCRATCH } from '@/record-root'

/**
 * Every folder this promotion moves, at the name it carries under scratch.
 *
 * Derived by the two-clause test `canon migrate scratch-evidence` exists to
 * apply mechanically: a durable record under a `BACKED_FOLDERS` entry, live
 * or archived, names the folder as its evidence, and no file under `claude/`,
 * `scripts/`, `src/`, `governance/`, or `standards/` names that path. Measured
 * 2026-09-06 against nine folders holding thirteen files.
 *
 * `verify-astro` and `verify-vite-react` pass the same test and are excluded
 * by name: both are scaffolds a command generates rather than records a
 * session wrote, and each is 100+ MB, which the review remote is not sized
 * for. `ablation`, `eval-runs`, `sandbox-runs`, `memory-archive`,
 * `groundwork-fixtures`, `precompact-handoff`, `pr-poll`, `pr`,
 * `address-review`, and `memory-routing` fail the second clause: a script or
 * a skill body names each of those paths, so moving one needs a code change
 * first rather than a promotion.
 */
export const PROMOTED_FOLDERS: readonly string[] = [
  'hero-probe',
  'markdown-corpus-sweep',
  'orchestrator-output',
  'orchestrator-watch',
  'review-calibration',
  'sandbox-drift',
  'skill-requirement-pass',
  'system-map',
  'target-survey',
]

/** Where a promoted folder sits before the move. */
export function sourcePath(root: string, folder: string): string {
  return recordDir(root, SCRATCH, folder)
}

/** The folder a promoted one lands inside, under whichever root carries it. */
function evidenceDir(root: string): string {
  return recordDir(root, 'evidence')
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The prefixes a citation of a promoted folder is spelled with, absolute at
 * either record root and relative from one directory below it. A tail
 * rejecting a following name character is what keeps `target-survey` from
 * swallowing a sibling folder whose name extends it.
 */
const OLD_PREFIXES = [
  '.claude/.tmp/',
  '.canon/tmp/',
  '../.tmp/',
  '../tmp/',
  '../../.tmp/',
  '../../tmp/',
] as const

function citationPattern(folder: string): RegExp {
  const alternation = OLD_PREFIXES.map(escape).join('|')
  return new RegExp(
    `(?:${alternation})${escape(folder)}(?![A-Za-z0-9._-])`,
    'g',
  )
}

interface Rewrite {
  readonly pattern: RegExp
  readonly name: string
}

/** One rewrite per folder, from its scratch name to its numbered one. */
function buildRewrites(names: ReadonlyMap<string, string>): readonly Rewrite[] {
  return [...names].map(([folder, name]) => ({
    pattern: citationPattern(folder),
    name,
  }))
}

/**
 * Marks a line naming a promoted folder's old path on purpose, the same
 * marker `records.ts` reads: on the line itself or on the nearest non-blank
 * line above it. A sentence describing what no target holds, rather than
 * pointing a reader at this checkout's own evidence, needs the old spelling
 * kept, and a mechanical rewrite cannot tell that apart from a live citation.
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
    (current, { pattern, name }) =>
      current.replace(pattern, `.canon/evidence/${name}`),
    line,
  )
}

interface RewriteOutcome {
  readonly text: string
  readonly count: number
}

/**
 * Rewrites every unmarked citation of a folder `rewrites` covers into its
 * destination under `.canon/evidence/`, absolute regardless of how the
 * source citation was spelled, counting each as it goes. A file naming no
 * such folder returns byte-identical with a count of zero, and a marked line
 * is returned unchanged and uncounted.
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
export async function walkScratchEvidenceCorpus(
  root: string,
): Promise<string[]> {
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

export interface ScratchEvidenceSource {
  readonly path: string
  readonly text: string
}

/** Reads every file the walk found, skipping one that carries a NUL byte. */
export async function readScratchEvidenceCorpus(
  paths: readonly string[],
): Promise<ScratchEvidenceSource[]> {
  const sources: ScratchEvidenceSource[] = []

  for (const path of paths) {
    const bytes = await readFile(path).catch(() => undefined)
    if (bytes === undefined || bytes.includes(0)) continue

    sources.push({ path, text: bytes.toString('utf8') })
  }

  return sources
}

export interface FolderMove {
  readonly folder: string
  readonly from: string
  readonly to: string
}

export interface CitationEntry {
  readonly path: string
  readonly text: string
  readonly rewritten: number
}

export interface ScratchEvidencePlan {
  readonly moves: readonly FolderMove[]
  readonly collisions: readonly string[]
  readonly entries: readonly CitationEntry[]
  readonly rewritten: number
}

/**
 * Every promoted folder found on disk, with its numbered destination, and the
 * name each promoted folder's citations rewrite to.
 *
 * Folders on disk take ordinals in order of first appearance, continuing past
 * the highest ordinal `evidence/` already holds. One whose slug `evidence/`
 * already carries refuses rather than taking a second number, and its
 * citations stay as they are. One already moved is not on disk under scratch,
 * so its citations rewrite to the numbered name it landed at.
 */
export function planFolderMoves(root: string): {
  moves: FolderMove[]
  collisions: string[]
  names: Map<string, string>
} {
  const dir = evidenceDir(root)
  const existing = folderNames(dir)
  const moves: FolderMove[] = []
  const collisions: string[] = []
  const names = new Map<string, string>()
  let next = nextOrdinal(existing)

  const present = byFirstAppearance(
    PROMOTED_FOLDERS.map((folder) => ({
      name: folder,
      dir: sourcePath(root, folder),
    })).filter((folder) => existsSync(folder.dir)),
  )

  for (const { name: folder, dir: from } of present) {
    const landed = existing.find((entry) => slugOf(entry) === folder)
    if (landed !== undefined) {
      collisions.push(join(dir, landed))
      continue
    }

    const name = numberedName(next, folder)
    next += 1
    names.set(folder, name)
    moves.push({ folder, from, to: join(dir, name) })
  }

  for (const folder of PROMOTED_FOLDERS) {
    if (existsSync(sourcePath(root, folder))) continue

    const landed = existing.find((entry) => slugOf(entry) === folder)
    if (landed !== undefined) names.set(folder, landed)
  }

  return { moves, collisions, names }
}

/**
 * What the promotion would do, without doing it. Pure over the sources it is
 * handed, the way `planRecordTree` is, so a caller reports and applies from
 * the same value. A file whose text does not change is dropped.
 */
export function planScratchEvidence(
  root: string,
  sources: readonly ScratchEvidenceSource[],
): ScratchEvidencePlan {
  const { moves, collisions, names } = planFolderMoves(root)
  const rewrites = buildRewrites(names)
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
  }
}

export interface ScratchEvidenceResult {
  readonly moved: number
  readonly written: number
  readonly failed: readonly string[]
}

/** Writes the plan: every folder move, then every citation rewrite. */
export async function applyScratchEvidence(
  plan: ScratchEvidencePlan,
): Promise<ScratchEvidenceResult> {
  let moved = 0
  let written = 0
  const failed: string[] = []

  for (const move of plan.moves) {
    await mkdir(dirname(move.to), { recursive: true })
    const done = await rename(move.from, move.to)
      .then(() => true)
      .catch(() => false)

    if (done) moved += 1
    else failed.push(move.from)
  }

  for (const entry of plan.entries) {
    const done = await writeFile(entry.path, entry.text)
      .then(() => true)
      .catch(() => false)

    if (done) written += 1
    else failed.push(entry.path)
  }

  return { moved, written, failed }
}
