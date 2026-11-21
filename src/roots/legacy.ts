import { existsSync } from 'node:fs'

/**
 * Where a fallback chain resolves for reading: the first path that exists, or the first
 * candidate when none does, which is the write target. The tuple type keeps a caller from
 * passing an empty list.
 */
export function resolveExisting(paths: readonly [string, ...string[]]): string {
  return paths.find((path) => existsSync(path)) ?? paths[0]
}
