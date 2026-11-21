/**
 * The old-root citations left inside the record tree itself, a pointer a session still
 * follows and prose that must keep its words. It stays apart from `records.ts`, which
 * answers about a repository listing rather than a walk.
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
 * The folders inside the record root a session still follows a path into, each holding
 * a live pointer. `proposals` is listed though this tree does not carry it.
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
 * The backup history, skipped by name rather than by content. It is a git object store,
 * so a walk that does not know it reads binary object files whole.
 */
export const OBJECT_STORE = '.records.git'

/**
 * Segments that end the walk wherever they appear inside a live folder. `archive` is
 * pruned at any depth, since archives do not all sit at the same one.
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
 * Where a path sits relative to the project root, always forward-slashed, since
 * `Bun.Glob` reports a platform separator on Windows.
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
 * The files inside one live folder, with each pruned subtree counted rather than swept.
 * The prune is attributed to the shallowest pruned segment on the path.
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
 * Every file in the live record surface, and a count for each corpus left out. The scope
 * is root-directed rather than an inversion of `isRecordArtifact`, which would reach a
 * project the move has not run in.
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

    // Each top-level entry is an independent subtree, so the scans run together and sort after.
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
 * Reads what the walk found. A file whose bytes carry a NUL is skipped outright, since
 * there is no path to move and a binary record has nothing to contribute.
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
 * Which lines the rewrite would change, read off the rewrite rather than a second
 * expression. A marked line never lands here, and `scanText` counts the markers.
 */
function citationLines(before: string, after: string): CitationLine[] {
  const original = before.split('\n')
  const rewritten = after.split('\n')

  return original.flatMap((line, index) =>
    rewritten[index] === line ? [] : [{ line: index + 1, text: line.trim() }],
  )
}

/**
 * What the sweep would rewrite, without writing it. Pure over the sources it is
 * handed, so a caller reports and applies from one value.
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
 * Writes the plan. The write lives here because this verb has no folder half, and a
 * rejected write is recorded rather than thrown, since a commander action would unwind.
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
