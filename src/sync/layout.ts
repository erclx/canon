import { existsSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { SUBDIRS } from '@/claude/seeds'
import { creationRel, isRecordEntry } from '@/roots/record'
import { SURFACE_ENTRIES, spell, surfaceDir } from '@/roots/surface'
import type { StampDomain } from '@/sync/stamp'

const CLAUDE_DIR = '.claude'

/**
 * Domains an older toolkit installed at the project root, each with the source folder naming what it
 * owns. Governance, standards, and snippets are absent, since none installs there now. It is empty
 * now, and a future root domain would be the next entry.
 */
const ROOT_LAYOUTS: readonly (readonly [
  StampDomain,
  string,
  (root: string) => string,
])[] = []

/**
 * A target file that a shipped seed folder replaced. Carries no source and
 * queues no change, because the file holds content the project wrote and only
 * the user can decide where it moves.
 */
export interface SupersededEntry {
  readonly rel: string
  readonly replacedBy: string
}

/**
 * A domain whose files sit at the root layout an older toolkit installed to,
 * with nothing at the path the current one reads. Distinct from a domain that
 * was never installed, which has neither.
 */
export interface UnmigratedDomain {
  readonly domain: StampDomain
  readonly rootPath: string
  readonly installPath: string
  /** Root files the toolkit ships under this domain, not every file present. */
  readonly files: number
}

/**
 * Pairs each seed subdirectory against an uppercase-stem sibling in the target, so a project holding
 * `.claude/TASKS.md` is reported against the `.canon/tasks/` folder that replaced it. Only an exact
 * stem matches, so `TASKS-ARCHIVE.md` is not reported.
 */
export function collectSuperseded(target: string): SupersededEntry[] {
  const entries: SupersededEntry[] = []

  for (const subdir of SUBDIRS) {
    const rel = join(CLAUDE_DIR, `${subdir.toUpperCase()}.md`)
    if (!isFile(join(target, rel))) continue

    // A record subdir resolves under the record root and a surface under the surface root.
    const replacedBy = isRecordEntry(subdir)
      ? creationRel(target, subdir)
      : SURFACE_ENTRIES.includes(subdir)
        ? relative(target, surfaceDir(target, subdir))
        : join(CLAUDE_DIR, subdir)

    entries.push({ rel, replacedBy })
  }

  return entries
}

/**
 * Domains the target holds at the root rather than under `.claude/`, reported apart from the
 * per-domain scan, which lists only installed domains. A root folder is claimed only when it holds
 * a file the toolkit ships, since a project's own `snippets/` would fail `--exit-code` with no remedy.
 */
export function detectUnmigrated(
  toolkitRoot: string,
  target: string,
): UnmigratedDomain[] {
  const found: UnmigratedDomain[] = []

  for (const [domain, rootPath, sourceDir] of ROOT_LAYOUTS) {
    const installPath = join(CLAUDE_DIR, rootPath)
    if (isDirectoryWithFiles(join(target, installPath))) continue

    const files = countToolkitOwned(
      join(target, rootPath),
      sourceDir(toolkitRoot),
    )
    if (files === 0) continue

    found.push({ domain, rootPath, installPath, files })
  }

  return found
}

/**
 * A tracked surface the target still reads at its `.claude/` spelling, with
 * nothing at the `canon/` one, and where `canon migrate surface-roots` moves it.
 */
export interface UnmovedSurface {
  readonly rel: string
  readonly movesTo: string
}

/**
 * Surfaces a target holds only at the root the surface move retired. Kept apart from
 * `detectUnmigrated`, since a surface carries no stamp domain, and a target here stops loading
 * the rules scoped to these files.
 */
export function detectUnmovedSurfaces(target: string): UnmovedSurface[] {
  return SURFACE_ENTRIES.filter(
    (entry) =>
      relative(target, surfaceDir(target, entry)) === join(CLAUDE_DIR, entry),
  ).map((entry) => ({
    rel: join(CLAUDE_DIR, entry),
    movesTo: join('canon', spell('canon', entry)),
  }))
}

/**
 * Root files whose basename matches something the toolkit ships for this domain. Basenames rather
 * than relative paths, since an older toolkit wrote a flat root layout and the source nests.
 */
function countToolkitOwned(dir: string, sourceDir: string): number {
  const owned = new Set(listMarkdown(sourceDir).map((rel) => basename(rel)))
  if (owned.size === 0) return 0

  return listMarkdown(dir).filter((rel) => owned.has(basename(rel))).length
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

function isDirectoryWithFiles(path: string): boolean {
  return listMarkdown(path).length > 0
}

function listMarkdown(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return []

  return [
    ...new Bun.Glob('**/*.md').scanSync({
      cwd: dir,
      onlyFiles: true,
      dot: true,
    }),
  ]
}
