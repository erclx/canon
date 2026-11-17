import { execaSync } from 'execa'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { gitEnv } from '@/git/env'

/**
 * Spellings a test uses to reach a file from the repository root rather than
 * through an import. A test naming none of them cannot be reading a corpus
 * file by path, so a folder name in its source is a string under test.
 */
const ROOT_MARKERS = [
  'import.meta.dirname',
  'PROJECT_ROOT',
  'REPO_ROOT',
  'process.cwd()',
]

/**
 * Every tracked test file under `root`, mapped to its source. A file
 * the index lists and the working tree has deleted is left out rather than
 * read.
 */
export function readTestSources(root: string): ReadonlyMap<string, string> {
  const listing = execaSync(
    'git',
    ['-C', root, 'ls-files', '-z', '--', '*.test.ts'],
    { env: gitEnv(), extendEnv: false },
  ).stdout
  const sources = new Map<string, string>()
  for (const path of listing.split('\0')) {
    if (path === '') continue
    try {
      sources.set(path, readFileSync(join(root, path), 'utf8'))
    } catch {
      continue
    }
  }
  return sources
}

/**
 * The tests that read `file` from disk, found by the folder its first two path
 * segments name, as `a/b` or as `'a', 'b'`. A root-level file is its own
 * needle. A reader that builds its path in a helper or a glob is missed here
 * and caught by CI's full run.
 */
export function readersOf(
  file: string,
  sources: ReadonlyMap<string, string>,
): readonly string[] {
  const segments = file.split('/')
  const needles =
    segments.length === 1
      ? [file]
      : [`${segments[0]}/${segments[1]}`, `'${segments[0]}', '${segments[1]}'`]
  const readers: string[] = []
  for (const [path, source] of sources) {
    if (path.endsWith('.e2e.test.ts')) continue
    if (!ROOT_MARKERS.some((marker) => source.includes(marker))) continue
    if (needles.some((needle) => source.includes(needle))) readers.push(path)
  }
  return readers
}
