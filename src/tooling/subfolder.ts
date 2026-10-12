import { realpathSync } from 'node:fs'
import { relative } from 'node:path'
import { gitEnv } from '@/git/env'

const WITHHELD_PREFIX = '.github/'

/**
 * Whether the target sits below the root of the git repository holding it. A
 * target outside any repository, or one git cannot read, counts as a root, so
 * a scratch folder with no repository keeps the behavior a root sync has.
 *
 * Synchronous because `scan` and `buildToolingReport` are, which is why this
 * does not reuse the async worktree reader.
 */
export function isSubfolderTarget(target: string): boolean {
  return subfolderPath(target) !== undefined
}

/**
 * The target's path relative to its git toplevel, which is what a root CI
 * job names as its `working-directory`. Undefined wherever
 * `isSubfolderTarget` reads a root.
 */
export function subfolderPath(target: string): string | undefined {
  const result = Bun.spawnSync(
    ['git', '-C', target, 'rev-parse', '--show-toplevel'],
    { env: gitEnv(), stdout: 'pipe', stderr: 'ignore' },
  )
  if (result.exitCode !== 0) return undefined

  const toplevel = result.stdout.toString().trim()
  if (toplevel === '') return undefined

  try {
    const path = relative(realpathSync(toplevel), realpathSync(target))
    return path === '' ? undefined : path
  } catch {
    return undefined
  }
}

/**
 * GitHub reads workflows only at the repository root, so a `.github/` copied
 * into a subfolder is a file nothing runs. `scan`, `injectConfigs`, and
 * `injectSeeds` all read this, so the set the diff withholds and the set the
 * sync skips cannot disagree, whether the path ships as a config or a seed.
 */
export function isWithheldInSubfolder(rel: string): boolean {
  return rel.startsWith(WITHHELD_PREFIX)
}
