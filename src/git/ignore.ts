import { resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/**
 * Reports which of `candidates` git ignores under `root`.
 *
 * Batched through one `check-ignore --stdin` rather than a call per path,
 * since a whole-repo walk hands this thousands of candidates. Outside a git
 * repo nothing is ignored, so a caller's segment prune becomes the only filter
 * that applies.
 */
export async function listIgnored(
  root: string,
  candidates: string[],
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set()

  const isRepo = await $`git -C ${root} rev-parse --git-dir`
    .env(gitEnv())
    .quiet()
    .nothrow()
    .then((result) => result.exitCode === 0)

  if (!isRepo) return new Set()

  const stdin = Buffer.from(`${candidates.join('\n')}\n`)

  const result = await $`git -C ${root} check-ignore --stdin < ${stdin}`
    .env(gitEnv())
    .quiet()
    .nothrow()

  // Exit 1 means nothing matched, which is a clean result rather than a
  // failure. Anything above that is a real error and degrades to "ignores
  // nothing" so a broken git never silently shrinks the scanned set.
  if (result.exitCode > 1) return new Set()

  return new Set(
    result
      .text()
      .split('\n')
      .filter(Boolean)
      .map((path) => resolve(root, path)),
  )
}
