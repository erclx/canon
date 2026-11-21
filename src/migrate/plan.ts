import {
  isExcludedPath,
  renamePath,
  type RenameRules,
  renameText,
  scanText,
} from '@/migrate/rename'

/** One tracked file, as the planner reads it. */
export interface RenameSource {
  readonly path: string
  readonly text: string
}

/**
 * One file the sweep touches. `text` is absent when only the path moves, so a
 * caller writing the plan can tell a content rewrite from a pure move and
 * leave a binary file's bytes alone.
 */
export interface RenameEntry {
  readonly path: string
  readonly movesTo?: string
  readonly text?: string
  readonly renamed: number
  readonly protectedCount: number
}

export interface RenamePlan {
  readonly entries: readonly RenameEntry[]
  readonly excluded: readonly string[]
  readonly renamed: number
  readonly protectedCount: number
  readonly moves: number
}

/**
 * Folders a target receives from the toolkit and does not author, which the rename may
 * rewrite. Everything else is prose a project wrote, reported rather than rewritten.
 */
const TOOLKIT_OWNED: readonly string[] = [
  '.claude/aitk/',
  '.claude/canon/',
  'canon/config/',
  '.claude/hooks/',
  '.claude/rules/',
  '.claude/tooling/',
]

export function isToolkitOwned(path: string): boolean {
  return TOOLKIT_OWNED.some((owned) => path.startsWith(owned))
}

/**
 * What the sweep would do to a set of files. Pure, so the same plan can be reported
 * or applied, and a file whose content and path stay put is dropped. The rules
 * arrive as an argument, since this planner serves every rename the engine compiles.
 */
export function planRename(
  sources: readonly RenameSource[],
  rules: RenameRules,
): RenamePlan {
  const entries: RenameEntry[] = []
  const excluded: string[] = []

  for (const source of sources) {
    if (isExcludedPath(source.path, rules)) {
      excluded.push(source.path)
      continue
    }

    const movesTo = renamePath(source.path, rules)
    const rewritten = renameText(source.text, rules)
    const counts = scanText(source.text, rules)
    const moved = movesTo !== source.path
    const changed = rewritten !== source.text

    if (!moved && !changed) continue

    entries.push({
      path: source.path,
      ...(moved ? { movesTo } : {}),
      ...(changed ? { text: rewritten } : {}),
      renamed: counts.renamed,
      protectedCount: counts.protectedCount,
    })
  }

  return {
    entries,
    excluded,
    renamed: total(entries, (entry) => entry.renamed),
    protectedCount: total(entries, (entry) => entry.protectedCount),
    moves: entries.filter((entry) => entry.movesTo !== undefined).length,
  }
}

function total(
  entries: readonly RenameEntry[],
  read: (entry: RenameEntry) => number,
): number {
  return entries.reduce((sum, entry) => sum + read(entry), 0)
}
