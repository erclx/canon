import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TOOLING = 'tooling'
const SURFACE_ROOTS = ['.claude', 'canon']

/**
 * Every `tooling/<stack>/seeds` holding a `.claude/` or a `canon/`, sorted and
 * relative to the root.
 *
 * Both seed stages discover through this rather than naming a stack, so a stack
 * seeding either root later reaches both and the two cannot disagree about which
 * roots exist. A stack seeding only tracked surfaces carries `canon/` alone,
 * which a `.claude/` test would drop from both stages. An absent `tooling/` is
 * an empty answer, and each caller decides what an empty answer means.
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
