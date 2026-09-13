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
 * Folders a target receives from the toolkit and does not author.
 *
 * The rename may rewrite these in a consuming project, because their content
 * came from here and a stale spelling in them is the toolkit's own defect.
 * Everything else in a target is prose that project wrote, where a citation is
 * reported for a person to decide rather than rewritten underneath them.
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
 * What the sweep would do to a set of files.
 *
 * Pure, so the decision and the write are separable and the same plan can be
 * reported or applied. A file whose content and path both stay put is dropped
 * rather than carried as a no-op entry, which keeps the reported count equal
 * to the number of files the sweep actually changes.
 *
 * The rules arrive as an argument rather than being read from a module, since
 * this planner serves every rename the engine compiles and the four calls
 * below have no other way to say which one they mean.
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
