import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { isBinary } from '@/sweep/binary'
import { listRepositoryFiles } from '@/git-files'

export type CensusRefusal = 'no-git'

export interface ExtensionCount {
  readonly extension: string
  readonly files: number
  readonly lines: number
}

export interface CensusResult {
  readonly kind: 'measured'
  readonly files: number
  /** Binary or unreadable, counted toward `files` and excluded from `lines`. */
  readonly skipped: number
  readonly lines: number
  readonly byExtension: readonly ExtensionCount[]
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

  const totals = new Map<string, { files: number; lines: number }>()
  let skipped = 0
  let lines = 0

  for (let start = 0; start < listed.length; start += CONCURRENT_READS) {
    const batch = listed.slice(start, start + CONCURRENT_READS)
    const outcomes = await Promise.all(batch.map((path) => readOne(root, path)))

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
  }

  const byExtension = [...totals.entries()]
    .map(([extension, counts]) => ({ extension, ...counts }))
    .sort((a, b) => b.files - a.files || a.extension.localeCompare(b.extension))

  return { kind: 'measured', files: listed.length, skipped, lines, byExtension }
}
