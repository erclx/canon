import { execSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * Spawns this checkout's own `src/cli.ts` rather than whatever `canon`
 * resolves to on PATH, the shape `web:tokens` already takes in
 * `package.json`. `cwd: repoRoot()` alone does not close that gap: a
 * PATH-resolved `canon` can be a different install entirely, so a build in a
 * linked worktree would read the main checkout's catalogs while the rest of
 * the page renders from the branch.
 */
export function repoRoot(): string {
  return execSync('git rev-parse --show-toplevel', {
    encoding: 'utf8',
  }).trim()
}

/**
 * The CLI's stdout for `args`, refusing an empty read. A non-zero exit is not
 * itself the failure, since `canon gov counts` exits 2 on drift elsewhere in
 * the tree that this page neither causes nor gates.
 */
export function readCanonText(args: readonly string[]): string {
  const root = repoRoot()
  const result = spawnSync('bun', [join(root, 'src', 'cli.ts'), ...args], {
    encoding: 'utf8',
    cwd: root,
    // The standards catalog carries every standard's full body, which runs
    // past the default buffer and would otherwise truncate into a parse
    // error.
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' },
  })

  if (result.error || !result.stdout) {
    throw new Error(
      `canon ${args.join(' ')} produced no output. The page never ships a typed catalog, so the build cannot continue without it. Underlying error: ${result.error instanceof Error ? result.error.message : (result.stderr ?? 'none')}`,
    )
  }

  return result.stdout
}

export function readCanonJson<T>(args: readonly string[]): T {
  return JSON.parse(readCanonText([...args, '--json'])) as T
}
