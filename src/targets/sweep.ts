import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import {
  claudeCanonStampPath,
  isLegacyStamped,
  legacyStampPath,
  retiredNameStampPath,
  stampPath,
} from '@/sync/stamp'
import { isDirectory } from '@/targets/validate'

/**
 * Folders a walk never descends into.
 *
 * Most hold vendored trees or the repository's own object store, where a target
 * cannot live and walking costs the sweep most of its time. `.claude` is here
 * for a different reason: a stamped folder is found by testing the folder
 * itself rather than by walking into its `.claude`, so descending finds nothing
 * new, and `.claude/worktrees/` holds a full checkout per linked worktree that
 * carries a copy of its own target's stamp. One target on this machine had five
 * of them, each of which would have reported as a target of its own.
 */
const SKIP = new Set([
  'node_modules',
  '.git',
  '.claude',
  'dist',
  'build',
  'vendor',
  'target',
  '.next',
  '.venv',
])

/** How deep below a root the walk goes before it stops and says so. */
export const DEFAULT_DEPTH = 4

/**
 * One project, with every path on this machine that holds a stamp for it.
 *
 * The paths are plural because a project can be cloned more than once, and
 * counting only the clone a walk found misses a repair run in another.
 */
export interface SweptTarget {
  readonly paths: readonly string[]
  /** The origin every path agrees on, or null when git resolved none. */
  readonly origin: string | null
  /** The subset of `paths` still carrying their stamp at the retired location, in `paths` order. */
  readonly legacyPaths: readonly string[]
}

/**
 * What the answer is bounded by, reported alongside it.
 *
 * A sweep cannot see another machine, a clone under a path nobody named, or a
 * tree it lacked permission to read. Stating the bound is what makes an
 * incomplete answer legible as incomplete, which the two undercounts this
 * exists to replace were not.
 */
export interface SweepBound {
  readonly roots: readonly string[]
  readonly depth: number
  /** Folders the walk stopped at on reaching the depth cap, so a target below one is unseen. */
  readonly truncated: readonly string[]
  /** Roots that could not be listed at all, as opposed to holding nothing. */
  readonly unreadable: readonly string[]
  /**
   * Symlinks to directories, which the walk does not follow.
   *
   * `readdirSync` with `withFileTypes` answers `isDirectory()` false for one, so
   * without this field a target reached only through a symlink is dropped
   * before the walk and named nowhere, which is a third silent undercount
   * beside the two this module replaces.
   */
  readonly symlinks: readonly string[]
}

export interface SweepReport {
  readonly targets: readonly SweptTarget[]
  readonly bound: SweepBound
}

export interface SweepOptions {
  readonly depth?: number
  /** Resolves a checkout's origin. Injected so a test needs no remote. */
  readonly originOf?: (path: string) => Promise<string | null>
}

/**
 * Whether a folder carries an install stamp at the current path or any
 * retired one. `aitk@3.57.0` still writes the folder form,
 * `retiredNameStampPath`, as its current path, so a target a pre-rename
 * binary syncs after this check drops the folder form would otherwise vanish
 * from the walk with nothing saying so. `claudeCanonStampPath` is the spelling
 * every target carried before the stamp moved to `canon/config/`, which a
 * target this batch has not reached still writes to.
 */
function isStamped(path: string): boolean {
  return (
    Bun.file(stampPath(path)).size > 0 ||
    Bun.file(claudeCanonStampPath(path)).size > 0 ||
    Bun.file(retiredNameStampPath(path)).size > 0 ||
    Bun.file(legacyStampPath(path)).size > 0
  )
}

/**
 * Reads the origin a checkout pushes to, trimmed to a form two clones of one
 * project agree on.
 *
 * The scheme and the `.git` suffix are dropped, since one project is commonly
 * cloned over ssh and https. Userinfo goes too, since a token in the URL would
 * reach the key that `canon targets list --json` prints, and a user name would
 * keep a clone from grouping with the same project's ssh clone.
 */
export async function originOf(path: string): Promise<string | null> {
  const result = await $`git -C ${path} remote get-url origin`
    .env(gitEnv())
    .quiet()
    .nothrow()

  if (result.exitCode !== 0) return null

  const raw = result.stdout.toString().trim()
  if (raw.length === 0) return null

  return raw
    .replace(/^[a-z+]+:\/\//, '')
    .replace(/^[^/@]*@/, '')
    .replace(/:/, '/')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

/**
 * Walks the given roots for installed targets and reports what bounds the walk.
 *
 * A stamped folder is descended into like any other, because a stamp is written
 * by an install someone ran in that folder and a target can hold others. The
 * machine this was measured on has exactly that shape: one stamped repository
 * holds the eight the hand census walked, so stopping at the outer one would
 * have hidden every target the sweep exists to find.
 */
export async function sweepTargets(
  roots: readonly string[],
  opts: SweepOptions = {},
): Promise<SweepReport> {
  const depth = opts.depth ?? DEFAULT_DEPTH
  const resolveOrigin = opts.originOf ?? originOf

  const found: string[] = []
  const truncated: string[] = []
  const unreadable: string[] = []
  const symlinks: string[] = []
  const seen = new Set<string>()

  const walk = (dir: string, level: number): void => {
    if (seen.has(dir)) return
    seen.add(dir)

    if (isStamped(dir)) found.push(dir)

    if (level >= depth) {
      truncated.push(dir)
      return
    }

    let entries: string[]
    try {
      const listed = readdirSync(dir, { withFileTypes: true }).filter(
        (entry) => !SKIP.has(entry.name),
      )

      // A directory symlink is named rather than followed, so the walk states what it
      // did not reach. A link to a file or a broken link is excluded.
      for (const entry of listed) {
        if (!entry.isSymbolicLink()) continue
        const full = join(dir, entry.name)
        if (isDirectory(full)) symlinks.push(full)
      }

      entries = listed
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch {
      unreadable.push(dir)
      return
    }

    for (const name of entries) walk(join(dir, name), level + 1)
  }

  const resolved = roots.map((root) => resolve(root))

  for (const root of resolved) {
    if (!isDirectory(root)) {
      unreadable.push(root)
      continue
    }
    walk(root, 0)
  }

  return {
    targets: await group(found.sort(), resolveOrigin),
    bound: { roots: resolved, depth, truncated, unreadable, symlinks },
  }
}

/**
 * Collapses the paths sharing one origin into a single target.
 *
 * A path whose origin does not resolve stays on its own, since two checkouts
 * with no remote cannot be shown to be the same project and merging them on
 * that absence would undercount in the other direction.
 */
async function group(
  paths: readonly string[],
  resolveOrigin: (path: string) => Promise<string | null>,
): Promise<readonly SweptTarget[]> {
  const origins = await Promise.all(paths.map(resolveOrigin))
  const byOrigin = new Map<string, string[]>()
  const alone: SweptTarget[] = []

  paths.forEach((path, index) => {
    const origin = origins[index]

    if (origin === null || origin === undefined) {
      alone.push({
        paths: [path],
        origin: null,
        legacyPaths: isLegacyStamped(path) ? [path] : [],
      })
      return
    }

    const group = byOrigin.get(origin)
    if (group === undefined) byOrigin.set(origin, [path])
    else group.push(path)
  })

  const merged = [...byOrigin.entries()].map(([origin, group]) => ({
    paths: group,
    origin,
    legacyPaths: group.filter((path) => isLegacyStamped(path)),
  }))

  return [...merged, ...alone].sort((a, b) =>
    (a.paths[0] ?? '').localeCompare(b.paths[0] ?? ''),
  )
}
