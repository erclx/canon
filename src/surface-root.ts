import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The roots a tracked toolkit surface is read at, in precedence order.
 *
 * These are not `RECORD_ROOTS`, and the difference is what each root is for
 * rather than an oversight. A record folder moves into `.canon/` because it is
 * gitignored, so nothing tracked ever lands there. A surface here is committed,
 * so a single shared list would put a record folder under a root a tracked
 * file also resolves against, which is a collision this list never has to
 * consider on its own.
 *
 * `canon` wins because a tree that carries it has moved, and reading `.claude/`
 * there would answer from the copy the move left behind. Read precedence
 * agreeing with the eventual creation default means the flip a later batch
 * takes changes one line rather than two.
 */
export const SURFACE_ROOTS = ['canon', '.claude'] as const

export type SurfaceRoot = (typeof SURFACE_ROOTS)[number]

/**
 * The root a surface is created at when neither root carries it yet.
 *
 * It agrees with the head of the read precedence. While the two disagreed,
 * creation stayed at `.claude/` so nothing wrote a fresh tracked file under a
 * root a target's installed binary could not resolve. A release carries the
 * read side now, so a fresh project scaffolds one root and an unmoved one keeps
 * resolving its own surfaces through the fallback above.
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
 * The creation default for one entry.
 *
 * The stamp folder keeps creating under `.claude/` until its own move lands,
 * since the install stamp and the audits baseline still write there by a
 * fixed path. A read resolving to `canon/config/` in a fresh project would
 * answer from a folder nothing writes.
 */
function creationRootFor(entry: string): SurfaceRoot {
  return entry === 'canon' ? '.claude' : CREATION_ROOT
}

/**
 * The root a surface resolves at: the first that carries it, and the creation
 * default when neither does.
 */
function rootOf(root: string, entry: string): SurfaceRoot {
  return (
    SURFACE_ROOTS.find((candidate) =>
      existsSync(join(root, candidate, spell(candidate, entry))),
    ) ?? creationRootFor(entry)
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
 * Where a path authored at the `canon/` spelling lands under `root`.
 *
 * A seed tree authors every surface once, at the new root, while a target may
 * still hold that surface under `.claude/`. Writing the literal path there
 * would open a `canon/` copy that wins read precedence and hides every entry
 * the target already wrote, so the entry resolves the way a read does. A path
 * naming no surface entry is joined as written.
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
 * Every root a surface would be read at, in precedence order, whether or not
 * it is on disk.
 *
 * Containment tests take this rather than `surfaceDir`, since a path written
 * against the root a tree no longer uses is still a path into that surface,
 * and reading it as outside would report a live reference as stale.
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
