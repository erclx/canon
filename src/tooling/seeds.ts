import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TOOLING = 'tooling'
const SURFACE_ROOTS = ['.claude', 'canon']

/**
 * Every `tooling/<stack>/seeds` holding a `.claude/` or a `canon/`, sorted and relative to the root. Both seed
 * stages discover through this, so the two cannot disagree about which roots exist, and an absent `tooling/` is empty.
 */
export function seedRoots(root: string): string[] {
  const tooling = join(root, TOOLING)
  if (!existsSync(tooling)) return []

  return readdirSync(tooling)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => `${TOOLING}/${name}/seeds`)
    .filter((seeds) => isDirectory(join(root, seeds)))
    .filter((seeds) =>
      SURFACE_ROOTS.some((surface) => isDirectory(join(root, seeds, surface))),
    )
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
