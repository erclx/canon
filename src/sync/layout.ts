import { existsSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { SUBDIRS } from '@/claude/seeds'
import { creationRel, isRecordEntry } from '@/record-root'
import { SURFACE_ENTRIES, surfaceDir } from '@/surface-root'
import type { StampDomain } from '@/sync/stamp'

const CLAUDE_DIR = '.claude'

/**
 * Domains an older toolkit installed at the project root, each with the source
 * folder naming what it owns. Governance is absent because its move stayed
 * inside `.claude/rules/`, from a flat `<subdir>/` layout to a `canon/`-wrapped
 * one, and this shape represents a domain stranded at the project root rather
 * than one stranded a folder short of where it belongs. `canon migrate
 * rule-layout` is the separate command that move needed instead. Standards and
 * snippets are absent because no copy installs into a target at all now, so a
 * root `standards/` or `snippets/` folder there is the project's own authoring
 * surface and reporting it as unmigrated would propose moving files nothing
 * installed.
 *
 * A tuple array rather than a partial record, so the domain key stays typed
 * without asserting an `Object.entries` result back into the union. Empty
 * now that both former entries retired their install channels. A future
 * domain installing at a target's root, the way an older toolkit installed
 * standards and snippets there, would be the next entry to add.
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
 * Pairs each seed subdirectory against an uppercase-stem sibling in the target,
 * so a project still holding `.claude/TASKS.md` is reported against the
 * `.canon/tasks/` folder that replaced it.
 *
 * Deriving from the seed tree rather than from a fixed list means a folder
 * added later is covered without editing this file. The cost is that only an
 * exact stem matches, so a suffixed variant such as `TASKS-ARCHIVE.md` is not
 * reported.
 */
export function collectSuperseded(target: string): SupersededEntry[] {
  const entries: SupersededEntry[] = []

  for (const subdir of SUBDIRS) {
    const rel = join(CLAUDE_DIR, `${subdir.toUpperCase()}.md`)
    if (!isFile(join(target, rel))) continue

    // A record subdir lives under the record root and a tracked surface under
    // the surface root, so the replacement this names is resolved against the
    // target rather than fixed at `.claude/`. Naming a folder the target does
    // not have sends a person to migrate their legacy file into a path nothing
    // reads.
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
 * Domains the target holds at the root rather than under `.claude/`. Reported
 * separately from the per-domain scan because that scan lists only domains it
 * finds installed, so an unmigrated project would otherwise read as one that
 * never installed the domain at all.
 *
 * A root folder is claimed only when it holds a file the toolkit ships under
 * that domain. Presence of the folder alone is not evidence: a project can
 * carry its own `snippets/` of prompts it wrote and never have installed the
 * domain, and calling that unmigrated would fail `--exit-code` with no action
 * that clears it.
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
 * Root files whose basename matches something the toolkit ships for this domain.
 * Basenames rather than relative paths, because the root layout an older toolkit
 * wrote is flat while the source nests by category, and the question here is only
 * whether any file is toolkit-owned rather than which source each one came from.
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
