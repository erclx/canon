import { readFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { isBinary } from '@/sweep/binary'
import { listRepositoryFiles } from '@/git/files'
import { readBlobsAt, SYMLINK_MODE } from '@/git/revision'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'

export type CensusRefusal = 'no-git'

export interface ExtensionCount {
  readonly extension: string
  readonly files: number
  readonly lines: number
}

export interface FolderExtensionCount {
  readonly extension: string
  readonly files: number
}

/** One folder's own files, never its subtree's, broken down by extension. */
export interface FolderCount {
  readonly path: string
  readonly files: number
  readonly byExtension: readonly FolderExtensionCount[]
}

/** A folder holding this many files of its own is reported. */
export const FOLDER_FILE_CHECKPOINT = 10

export interface CensusResult {
  readonly kind: 'measured'
  readonly files: number
  /** Binary or unreadable, counted toward `files` and excluded from `lines`. */
  readonly skipped: number
  readonly lines: number
  readonly byExtension: readonly ExtensionCount[]
  /** Every folder at or past `FOLDER_FILE_CHECKPOINT`, empty when none is. */
  readonly folders: readonly FolderCount[]
}

export interface CensusFailure {
  readonly kind: 'refused'
  readonly reason: CensusRefusal
}

/**
 * Open descriptors allowed at once while reading the tree, matching
 * `src/comments/scan.ts`. A single `Promise.all` over every path opens one
 * descriptor per file, which exhausts a default 1024 limit on a large
 * repository and fails the whole census with EMFILE.
 */
const CONCURRENT_READS = 64

interface ReadOutcome {
  readonly path: string
  /** Absent when the read failed: a symlink leaving the tree, or a file git
   * listed and the working tree no longer holds. */
  readonly text?: string
}

async function readOne(root: string, path: string): Promise<ReadOutcome> {
  try {
    return { path, text: await readFile(join(root, path), 'utf8') }
  } catch {
    return { path }
  }
}

function extensionFor(path: string): string {
  const ext = extname(path)
  return ext === '' ? 'no-extension' : ext.slice(1).toLowerCase()
}

const FIXTURE_SEGMENTS: ReadonlySet<string> = new Set([
  'fixtures',
  '__fixtures__',
])

/** Only a directory segment counts, so a file named `fixtures.ts` does not. */
function underFixtures(folder: string): boolean {
  return folder.split('/').some((segment) => FIXTURE_SEGMENTS.has(segment))
}

/**
 * Counts each file toward its own folder alone, keeping the folders that reach
 * the checkpoint. Fixture folders are left out of this list only, since the
 * headline totals are the baseline's and must not move.
 */
function largeFolders(paths: readonly string[]): FolderCount[] {
  const byFolder = new Map<string, Map<string, number>>()

  for (const path of paths) {
    const folder = dirname(path)
    if (underFixtures(folder)) continue

    const extensions = byFolder.get(folder) ?? new Map<string, number>()
    const extension = extensionFor(path)
    extensions.set(extension, (extensions.get(extension) ?? 0) + 1)
    byFolder.set(folder, extensions)
  }

  return [...byFolder.entries()]
    .map(([path, extensions]) => ({
      path,
      files: [...extensions.values()].reduce((sum, n) => sum + n, 0),
      byExtension: [...extensions.entries()]
        .map(([extension, files]) => ({ extension, files }))
        .sort(
          (a, b) => b.files - a.files || a.extension.localeCompare(b.extension),
        ),
    }))
    .filter((folder) => folder.files >= FOLDER_FILE_CHECKPOINT)
    .sort((a, b) => b.files - a.files || a.path.localeCompare(b.path))
}

/**
 * A trailing newline is the file's terminator rather than an empty final line,
 * which is what keeps a file ending `a\nb\n` at two lines rather than three.
 */
function countLines(text: string): number {
  if (text === '') return 0
  const lines = text.split('\n')
  return text.endsWith('\n') ? lines.length - 1 : lines.length
}

/**
 * A text's line count under the census definition, or undefined when it reads
 * as binary, for a caller sizing single files rather than a whole tree.
 */
export function textLines(text: string): number | undefined {
  return isBinary(text) ? undefined : countLines(text)
}

/**
 * Counts what was read, the one definition both the working-tree census and
 * the past-revision census share, so the two cannot drift apart on what a
 * line or a skipped file is.
 */
function tally(outcomes: readonly ReadOutcome[]): CensusResult {
  const totals = new Map<string, { files: number; lines: number }>()
  let skipped = 0
  let lines = 0

  for (const outcome of outcomes) {
    const extension = extensionFor(outcome.path)
    const entry = totals.get(extension) ?? { files: 0, lines: 0 }
    entry.files += 1

    // A read that failed and a file that read as binary are counted the
    // same way: toward `files`, excluded from every line count.
    if (outcome.text === undefined || isBinary(outcome.text)) {
      skipped += 1
    } else {
      const counted = countLines(outcome.text)
      entry.lines += counted
      lines += counted
    }

    totals.set(extension, entry)
  }

  const byExtension = [...totals.entries()]
    .map(([extension, counts]) => ({ extension, ...counts }))
    .sort((a, b) => b.files - a.files || a.extension.localeCompare(b.extension))

  const paths = outcomes.map((outcome) => outcome.path)

  return {
    kind: 'measured',
    files: outcomes.length,
    skipped,
    lines,
    byExtension,
    folders: largeFolders(paths),
  }
}

/**
 * Censuses the tracked-plus-untracked tree under `root`: a file count, a
 * breakdown by extension, and a line total that skips whatever reads as
 * binary.
 *
 * Reads `listRepositoryFiles`, the same corpus the citation check, the
 * markdown corpus, and the secret scan already share, so this is not a
 * fourth definition of what counts.
 */
export async function census(
  root: string,
): Promise<CensusResult | CensusFailure> {
  const listed = await listRepositoryFiles(root)
  if (listed === undefined) return { kind: 'refused', reason: 'no-git' }

  const outcomes: ReadOutcome[] = []

  for (let start = 0; start < listed.length; start += CONCURRENT_READS) {
    const batch = listed.slice(start, start + CONCURRENT_READS)
    outcomes.push(
      ...(await Promise.all(batch.map((path) => readOne(root, path)))),
    )
  }

  return tally(outcomes)
}

/**
 * Censuses the tree `rev` committed under `root`, through the same count
 * `census` runs over the working tree.
 *
 * A symlink and a submodule count toward `files` and as skipped, never as the
 * link text's lines. `census` reads a symlink through to its target, so the two
 * agree on a clean tree only while every symlink points at a binary or
 * unreadable file, as canon's one symlink does.
 *
 * Refuses with `no-git` when git cannot resolve `rev` to a tree, since an
 * empty count would read as an empty repository.
 */
export async function censusAt(
  root: string,
  rev: string,
): Promise<CensusResult | CensusFailure> {
  const resolved =
    await $`git -C ${root} rev-parse --verify --quiet ${`${rev}^{tree}`}`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (resolved.exitCode !== 0) return { kind: 'refused', reason: 'no-git' }

  const entries = await readBlobsAt(root, rev, () => true)
  const outcomes = entries
    .map(({ path, mode, text }) => ({
      path,
      text: mode === SYMLINK_MODE ? undefined : text,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  return tally(outcomes)
}
