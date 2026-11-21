import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { indexRuleSources } from '@/gov/install'

/** Old rule basename to the basename the same rule ships under now. */
export type Renames = ReadonlyMap<string, string>

function renamesPath(root: string): string {
  return join(root, 'governance', 'renames.toml')
}

/**
 * Reads the shipped rename ledger. A toolkit without one declares no renames,
 * which leaves every sourceless rule on the retire path it took before the
 * ledger existed.
 */
export function loadRenames(root: string): Renames {
  const path = renamesPath(root)
  if (!existsSync(path)) return new Map()

  const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as Record<
    string,
    unknown
  >
  const table = parsed.renamed
  if (typeof table !== 'object' || table === null) return new Map()

  return new Map(
    Object.entries(table).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

/**
 * Follows a declared rename to the name the toolkit ships the rule under now,
 * through every later rename, since the ledger is pruned only once a rule is
 * retired. Returns nothing on a chain ending in no source or a loop.
 */
export function resolveSuccessor(
  renames: Renames,
  index: ReadonlyMap<string, string>,
  name: string,
): string | undefined {
  const visited = new Set([name])
  let current = renames.get(name)

  while (current !== undefined) {
    if (visited.has(current)) return undefined
    visited.add(current)

    const next = renames.get(current)
    if (next === undefined) break
    current = next
  }

  if (current === undefined || !index.has(current)) return undefined
  return current
}

/**
 * Binds the ledger and the source tree at `root` once, for a caller asking
 * about many held names.
 */
export function successorResolver(
  root: string,
): (name: string) => string | undefined {
  const renames = loadRenames(root)
  if (renames.size === 0) return () => undefined

  const index = indexRuleSources(root)
  return (name) => resolveSuccessor(renames, index, name)
}
