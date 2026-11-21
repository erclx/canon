import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The roots a tracked toolkit surface is read at, in precedence order, apart from
 * `RECORD_ROOTS`, since a record folder is gitignored and a surface is committed.
 * `canon` wins because `.claude/` in a moved tree is the copy the move left behind.
 */
export const SURFACE_ROOTS = ['canon', '.claude'] as const

export type SurfaceRoot = (typeof SURFACE_ROOTS)[number]

/**
 * The root a surface is created at when neither root carries it yet, which agrees with the head of
 * the read precedence. An unmoved project keeps resolving its own through the fallback.
 */
export const CREATION_ROOT: SurfaceRoot = 'canon'

/**
 * Every tracked surface this module resolves, at the name `.claude/` gives it.
 *
 * `canon` names the stamp folder rather than the CLI itself, which is the one
 * entry `spell` respells per root.
 */
export const SURFACE_ENTRIES: readonly string[] = [
  'ARCHITECTURE.md',
  'REQUIREMENTS.md',
  'DESIGN.md',
  'context',
  'wireframes',
  'canon',
]

/**
 * How a root spells an entry name. Only the stamp folder differs, since a
 * project under `canon/` reserves the bare name for the CLI's own install
 * rather than for its config.
 */
export function spell(root: SurfaceRoot, entry: string): string {
  return root === 'canon' && entry === 'canon' ? 'config' : entry
}

/**
 * The root a surface resolves at: the first that carries it, and `CREATION_ROOT` when neither does.
 * Every entry shares the one default, since the install stamp moved to `canon/config/`.
 */
function rootOf(root: string, entry: string): SurfaceRoot {
  return (
    SURFACE_ROOTS.find((candidate) =>
      existsSync(join(root, candidate, spell(candidate, entry))),
    ) ?? CREATION_ROOT
  )
}

/**
 * Where a tracked surface is read.
 *
 * `entry` is the surface itself and `rest` is whatever sits inside it, so a
 * caller spells no root and no per-root naming variant of its own.
 */
export function surfaceDir(
  root: string,
  entry: string,
  ...rest: string[]
): string {
  const at = rootOf(root, entry)
  return join(root, at, spell(at, entry), ...rest)
}

/**
 * Where a path authored at the `canon/` spelling lands under `root`. A target may still hold the
 * surface under `.claude/`, where a literal `canon/` copy would win read precedence and hide it,
 * so the entry resolves the way a read does.
 */
export function resolveSurfacePath(root: string, rel: string): string {
  const [head, entry, ...rest] = rel.split(/[\\/]/)

  if (head !== 'canon' || entry === undefined || entry === 'canon') {
    return join(root, rel)
  }
  if (!SURFACE_ENTRIES.includes(entry)) return join(root, rel)

  return surfaceDir(root, entry, ...rest)
}

/**
 * Every root a surface would be read at, in precedence order, whether or not it is on disk.
 * Containment tests take this rather than `surfaceDir`, since a path under a root the tree no
 * longer uses is still a path into that surface.
 */
export function surfaceDirs(
  root: string,
  entry: string,
  ...rest: string[]
): string[] {
  return SURFACE_ROOTS.map((candidate) =>
    join(root, candidate, spell(candidate, entry), ...rest),
  )
}
