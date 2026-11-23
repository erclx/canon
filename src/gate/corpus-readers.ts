import { execaSync } from 'execa'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

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

const E2E_SUFFIX = '.e2e.test.ts'

const readTracked = (root: string, path: string): string | undefined => {
  try {
    return readFileSync(join(root, path), 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Every tracked test file under `root`, mapped to its source with any
 * `fixture*.ts` beside it appended. Production modules beside a test stay out,
 * since they name corpus folders as data and would select every test there.
 */
export function readTestSources(root: string): ReadonlyMap<string, string> {
  const listing = execaSync(
    'git',
    ['-C', root, 'ls-files', '-z', '--', '*.ts'],
    { env: gitEnv(), extendEnv: false },
  ).stdout
  const tests: string[] = []
  const helpers = new Map<string, string[]>()
  for (const path of listing.split('\0')) {
    if (path === '') continue
    if (path.endsWith('.test.ts')) {
      tests.push(path)
      continue
    }
    if (!basename(path).startsWith('fixture')) continue
    const folder = dirname(path)
    helpers.set(folder, [...(helpers.get(folder) ?? []), path])
  }
  const sources = new Map<string, string>()
  for (const path of tests) {
    const own = readTracked(root, path)
    if (own === undefined) continue
    const beside = (helpers.get(dirname(path)) ?? []).map(
      (helper) => readTracked(root, helper) ?? '',
    )
    sources.set(path, [own, ...beside].join('\n'))
  }
  return sources
}

/**
 * The tests that read `file` from disk, found by the folder its first two path
 * segments name. A reader that builds its path in a helper or glob is missed
 * here and caught by CI's full run.
 */
export function readersOf(
  file: string,
  sources: ReadonlyMap<string, string>,
): readonly string[] {
  return readersWhere(file, sources, (path) => !path.endsWith(E2E_SUFFIX))
}

/** The end-to-end suites `readersOf` leaves out, for the scope CI gives them. */
export function e2eReadersOf(
  file: string,
  sources: ReadonlyMap<string, string>,
): readonly string[] {
  return readersWhere(file, sources, (path) => path.endsWith(E2E_SUFFIX))
}

/**
 * The end-to-end suites that run the CLI entry as a child process, which reach
 * every command through no import, so a change under `src/` selects them.
 */
export function e2eCliSpawners(
  sources: ReadonlyMap<string, string>,
): readonly string[] {
  return [...sources]
    .filter(
      ([path, source]) =>
        path.endsWith(E2E_SUFFIX) && /cli\.ts['"]/.test(source),
    )
    .map(([path]) => path)
}

function readersWhere(
  file: string,
  sources: ReadonlyMap<string, string>,
  wanted: (path: string) => boolean,
): readonly string[] {
  const segments = file.split('/')
  const needles =
    segments.length === 1
      ? [file]
      : [`${segments[0]}/${segments[1]}`, `'${segments[0]}', '${segments[1]}'`]
  const readers: string[] = []
  for (const [path, source] of sources) {
    if (!wanted(path)) continue
    if (!ROOT_MARKERS.some((marker) => source.includes(marker))) continue
    if (needles.some((needle) => source.includes(needle))) readers.push(path)
  }
  return readers
}
