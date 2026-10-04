import { existsSync } from 'node:fs'

/**
 * Where a fallback chain resolves for reading: the first path that exists,
 * current first, or the first candidate when none exists yet, which is
 * always the write target.
 *
 * `src/audits/baseline.ts`, `src/labels/map.ts`, and `src/sync/stamp.ts` each
 * trail a file that moved, and each used to reason about its own chain
 * separately. The tuple type keeps a caller from passing an empty list, since
 * every chain here has a write target to fall back to.
 */
export function resolveExisting(paths: readonly [string, ...string[]]): string {
  return paths.find((path) => existsSync(path)) ?? paths[0]
}
