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
 * Folders a walk never descends into. Most hold vendored trees or the object store, and `.claude` is here
 * because a stamped folder is tested directly and `.claude/worktrees/` holds a copy of each target's stamp.
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
 * What the answer is bounded by, reported alongside it. A sweep cannot see another machine, an unnamed
 * clone path, or an unreadable tree, and stating the bound makes an incomplete answer legible.
 */
export interface SweepBound {
  readonly roots: readonly string[]
  readonly depth: number
  /** Folders the walk stopped at on reaching the depth cap, so a target below one is unseen. */
  readonly truncated: readonly string[]
  /** Roots that could not be listed at all, as opposed to holding nothing. */
  readonly unreadable: readonly string[]
  /**
   * Symlinks to directories, which the walk does not follow. `readdirSync` with `withFileTypes` answers
   * `isDirectory()` false for one, so without this field a target behind a symlink is named nowhere.
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
 * Whether a folder carries an install stamp at the current path or any retired one. A pre-rename binary
 * still writes the folder form and `claudeCanonStampPath` is the spelling before the move to `canon/config/`.
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
 * Reads the origin a checkout pushes to, trimmed to a form two clones of one project agree on. The scheme,
 * the `.git` suffix, and userinfo are dropped, since a token would reach the key `canon targets list --json` prints.
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
 * Walks the given roots for installed targets and reports what bounds the walk. A stamped folder is
 * descended into like any other, since a target can hold others and stopping would hide them.
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

      // A directory symlink is named rather than followed, and a link to a file or a broken link is excluded.
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
 * Collapses the paths sharing one origin into a single target. A path whose origin does not resolve stays
 * on its own, since merging checkouts with no remote would undercount.
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
