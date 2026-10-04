import { existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { listIgnored } from '@/git/ignore'

const INDEX_FILE = 'index.md'

const PRUNED_SEGMENTS = ['node_modules', '.git']

function isPruned(relativePath: string): boolean {
  return relativePath
    .split('/')
    .some((segment) => PRUNED_SEGMENTS.includes(segment))
}

/**
 * Lists every folder index under `root`.
 *
 * Vendored and git trees are pruned by path segment, since `Bun.Glob` has no
 * exclude. Everything else is dropped via `git check-ignore`, so a project's
 * own `.gitignore` governs what the walker sees. Outside a git repo the
 * segment prune is the only filter that applies.
 */
export async function listIndexes(root: string): Promise<string[]> {
  const glob = new Bun.Glob(`**/${INDEX_FILE}`)
  const candidates: string[] = []

  for await (const rel of glob.scan({
    cwd: root,
    onlyFiles: true,
    dot: true,
  })) {
    if (isPruned(rel)) continue
    candidates.push(resolve(root, rel))
  }
  candidates.sort()

  if (candidates.length === 0) return []

  const ignored = await listIgnored(root, candidates)
  if (ignored.size === 0) return candidates

  return candidates.filter((path) => !ignored.has(path))
}

/**
 * Reports whether git ignores `path`.
 *
 * Positional regen reaches an ignored folder, because `findIndexedAncestor`
 * walks the filesystem and never consults git. Staging what it writes there
 * always fails, so the caller checks this first and skips the attempt rather
 * than warning on a no-op.
 */
export async function isIgnored(root: string, path: string): Promise<boolean> {
  const ignored = await listIgnored(root, [resolve(path)])
  return ignored.has(resolve(path))
}

/**
 * Walks up from `path` to the nearest folder holding an index, stopping at
 * `root`. Returns undefined when the path escapes the boundary or nothing
 * indexed is found.
 */
export function findIndexedAncestor(
  path: string,
  root: string,
): string | undefined {
  if (!existsSync(path)) return undefined

  const rootAbs = resolve(root)
  let dir = statSync(path).isDirectory()
    ? resolve(path)
    : dirname(resolve(path))

  while (dir === rootAbs || dir.startsWith(`${rootAbs}/`)) {
    if (existsSync(`${dir}/${INDEX_FILE}`)) return dir
    if (dir === rootAbs) return undefined
    dir = dirname(dir)
  }

  return undefined
}

export { INDEX_FILE, PRUNED_SEGMENTS }
