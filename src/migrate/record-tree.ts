/**
 * The old-root citations left inside the record tree itself.
 *
 * `migrate records` sweeps a git listing, so it reaches every tracked file and
 * none of the records, which are gitignored by construction. What that leaves
 * behind is the tree's own citations: a pointer a session still follows, and a
 * far larger body of prose that has to keep saying what it says. This module
 * holds the scope that separates the two.
 *
 * Separate from `records.ts` because that module answers about a repository
 * listing and this one answers about a directory walk. Folding them would give
 * one file two enumeration models, and the predicates each needs are the
 * inverse of the other's.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type CitationLine,
  RECORD_ONLY_ROOTS,
  rewriteText,
  scanText,
} from '@/migrate/records'

/**
 * The folders inside the record root a session still follows a path into.
 *
 * Every one of them holds a live pointer: a task naming its plan, a review
 * naming the branch it graded, a memory entry naming the folder that owns it.
 * The corpora left out are closed trails and scratch, which are the same class
 * of document the exclusion set in `records.ts` already refuses to rewrite, so
 * this is that reasoning applied one level down rather than a new rule.
 *
 * `proposals` is listed though the tree does not carry it here. The scope is a
 * statement about which folders are live rather than about what one machine
 * holds, and a folder absent from disk costs a `readdir` that finds nothing.
 */
export const LIVE_FOLDERS: readonly string[] = [
  'diagrams',
  'memory',
  'plans',
  'proposals',
  'review',
  'tasks',
  'teach',
]

/**
 * The backup history, skipped by name rather than by content.
 *
 * It is a git object store, so a walk that does not know it by name reads
 * binary object files whole and discards them. `runRecords` already names that
 * cost for this tree at 9,744 files and 83M.
 */
export const OBJECT_STORE = '.records.git'

/**
 * Segments that end the walk wherever they appear inside a live folder.
 *
 * `archive` is the substantive one: an archived plan or a retired memory entry
 * describes work that closed, and a path inside that sentence is history rather
 * than a pointer. It is pruned at any depth because the archives do not all sit
 * at the same one, `memory/review/archive/` being two levels down.
 */
export const PRUNED_SEGMENTS: readonly string[] = [
  'archive',
  'node_modules',
  '.git',
]

/** A corpus the sweep passes over, with what it holds. */
export interface ExcludedCorpus {
  readonly path: string
  readonly files: number
}

/** What the walk found, before anything is read. */
export interface RecordTreeWalk {
  readonly files: readonly string[]
  readonly excluded: readonly ExcludedCorpus[]
  readonly skipped: readonly string[]
}

/** One file the walk reached, carried with its text. */
export interface RecordTreeSource {
  readonly path: string
  readonly text: string
}

/** One record file whose citations move. */
export interface RecordTreeEntry {
  readonly path: string
  readonly text: string
  readonly rewritten: number
  readonly kept: number
  readonly lines: readonly CitationLine[]
}

export interface RecordTreePlan {
  readonly entries: readonly RecordTreeEntry[]
  readonly excluded: readonly ExcludedCorpus[]
  readonly skipped: readonly string[]
  readonly rewritten: number
  readonly kept: number
}

/**
 * Where a path sits relative to the project root, always forward-slashed.
 *
 * `Bun.Glob` reports a platform separator on Windows and every path here is
 * compared against a literal `/` or printed for a reader, so the separator is
 * spelled rather than joined.
 */
function under(...segments: readonly string[]): string {
  return segments.join('/')
}

/** How many files sit under a directory, without reading any of them. */
async function countFiles(directory: string): Promise<number> {
  const glob = new Bun.Glob('**/*')
  let count = 0

  for await (const _path of glob.scan({
    cwd: directory,
    onlyFiles: true,
    dot: true,
  })) {
    count += 1
  }

  return count
}

/**
 * The files inside one live folder, with each pruned subtree counted rather
 * than swept.
 *
 * The prune is attributed to the shallowest pruned segment on the path, so an
 * archive reports as one corpus instead of one per folder inside it.
 */
async function scanLiveFolder(
  root: string,
  relative: string,
): Promise<{ files: string[]; excluded: Map<string, number> }> {
  const glob = new Bun.Glob('**/*')
  const files: string[] = []
  const excluded = new Map<string, number>()

  for await (const path of glob.scan({
    cwd: join(root, relative),
    onlyFiles: true,
    dot: true,
  })) {
    const segments = path.split(/[/\\]/)
    const cut = segments.findIndex((segment) =>
      PRUNED_SEGMENTS.includes(segment),
    )

    if (cut === -1) {
      files.push(under(relative, ...segments))
      continue
    }

    const corpus = under(relative, ...segments.slice(0, cut + 1))
    excluded.set(corpus, (excluded.get(corpus) ?? 0) + 1)
  }

  return { files, excluded }
}

/**
 * Every file in the live record surface, and a count for each corpus left out.
 *
 * The scope is root-directed rather than an inversion of `isRecordArtifact`.
 * That predicate is true for the new root whole and for each record entry under
 * the old one, since the sweep it serves skips both, so inverting it would
 * reach a project the move has not run in, where the old spelling is correct.
 */
export async function walkRecordTree(root: string): Promise<RecordTreeWalk> {
  const files: string[] = []
  const excluded: ExcludedCorpus[] = []
  const skipped: string[] = []

  for (const recordRoot of RECORD_ONLY_ROOTS) {
    const entries = await readdir(join(root, recordRoot), {
      withFileTypes: true,
    }).catch(() => undefined)
    if (entries === undefined) continue

    // Each top-level entry is a separate subtree, so the scans are independent
    // and run together. Nothing downstream depends on the order they settle in,
    // since both lists are sorted once the whole root has been read.
    const scans = entries.map(async (entry) => {
      const relative = under(recordRoot, entry.name)

      if (entry.name === OBJECT_STORE) {
        skipped.push(relative)
        return
      }

      if (!entry.isDirectory()) {
        excluded.push({ path: relative, files: 1 })
        return
      }

      if (!LIVE_FOLDERS.includes(entry.name)) {
        excluded.push({
          path: relative,
          files: await countFiles(join(root, relative)),
        })
        return
      }

      const folder = await scanLiveFolder(root, relative)
      files.push(...folder.files)
      for (const [path, count] of folder.excluded) {
        excluded.push({ path, files: count })
      }
    })

    await Promise.all(scans)
  }

  files.sort()
  excluded.sort((left, right) => left.path.localeCompare(right.path))
  skipped.sort()

  return { files, excluded, skipped }
}

/**
 * Reads what the walk found.
 *
 * A file whose bytes carry a NUL is skipped outright rather than carried as
 * empty text, which is what `readSources` does for the tracked sweep. There is
 * no path to move here, so a binary record has nothing left to contribute.
 */
export async function readRecordTree(
  root: string,
  paths: readonly string[],
): Promise<RecordTreeSource[]> {
  const sources: RecordTreeSource[] = []

  for (const path of paths) {
    const bytes = await readFile(join(root, path)).catch(() => undefined)
    if (bytes === undefined || bytes.includes(0)) continue

    sources.push({ path, text: bytes.toString('utf8') })
  }

  return sources
}

/**
 * Which lines the rewrite would change, read off the rewrite rather than off a
 * second expression.
 *
 * A marked line is unchanged by `rewriteText`, so it never lands here, which is
 * what keeps the report and the write agreeing about what is in scope. The
 * count of marked citations comes from `scanText` instead, since a protected
 * line is invisible in a diff and the reader needs to know the markers fired.
 */
function citationLines(before: string, after: string): CitationLine[] {
  const original = before.split('\n')
  const rewritten = after.split('\n')

  return original.flatMap((line, index) =>
    rewritten[index] === line ? [] : [{ line: index + 1, text: line.trim() }],
  )
}

/**
 * What the sweep would rewrite, without writing it.
 *
 * Pure over the sources it is handed, the way `planRecordsMove` is, so a caller
 * reports and applies from one value. A file whose text does not change is
 * dropped rather than carried as a no-op.
 */
export function planRecordTree(
  sources: readonly RecordTreeSource[],
  excluded: readonly ExcludedCorpus[],
  skipped: readonly string[],
): RecordTreePlan {
  const entries: RecordTreeEntry[] = []
  let kept = 0

  for (const source of sources) {
    const counts = scanText(source.text)
    kept += counts.kept
    if (counts.rewritten === 0) continue

    const text = rewriteText(source.text)
    entries.push({
      path: source.path,
      text,
      rewritten: counts.rewritten,
      kept: counts.kept,
      lines: citationLines(source.text, text),
    })
  }

  return {
    entries,
    excluded,
    skipped,
    rewritten: entries.reduce((sum, entry) => sum + entry.rewritten, 0),
    kept,
  }
}

export interface RecordTreeResult {
  readonly written: number
  readonly failed: readonly string[]
}

/**
 * Writes the plan.
 *
 * The write lives here rather than beside the two in `apply.ts` because this
 * verb has no folder half: the citations are the whole of it, and the module
 * that decided which files are in scope is the one that should be trusted to
 * name them again. A rejected write is recorded rather than thrown, since this
 * runs inside a commander action that would unwind past the report.
 */
export async function applyRecordTree(
  root: string,
  plan: RecordTreePlan,
): Promise<RecordTreeResult> {
  let written = 0
  const failed: string[] = []

  for (const entry of plan.entries) {
    const done = await writeFile(join(root, entry.path), entry.text)
      .then(() => true)
      .catch(() => false)

    if (done) written += 1
    else failed.push(entry.path)
  }

  return { written, failed }
}
