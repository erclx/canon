import { resolve } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/**
 * Reports which of `candidates` git ignores under `root`, batched through one
 * `check-ignore --stdin`. Outside a git repo nothing is ignored.
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

  // Exit 1 means nothing matched, and anything above degrades to ignoring nothing.
  if (result.exitCode > 1) return new Set()

  return new Set(
    result
      .text()
      .split('\n')
      .filter(Boolean)
      .map((path) => resolve(root, path)),
  )
}
