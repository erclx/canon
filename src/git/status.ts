import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { $ } from 'bun'
import { gitEnv } from '@/git/env'

export interface StatusEntry {
  readonly path: string
  readonly status: string
  /** The content digest, or null where no regular file stands at the path. */
  readonly digest: string | null
}

function digestOf(path: string): string | null {
  try {
    if (!statSync(path).isFile()) return null
    return createHash('sha1').update(readFileSync(path)).digest('hex')
  } catch {
    return null
  }
}

/**
 * Every entry `git status` reports, untracked files listed one by one so a
 * file a drive adds inside a tracked folder names itself, each with a content
 * digest so a file already dirty at the baseline still reads as changed when
 * a drive writes it again. Undefined when git cannot read the tree.
 */
export async function readWorktreeStatus(
  worktree: string,
): Promise<readonly StatusEntry[] | undefined> {
  const result =
    await $`git -C ${worktree} status --porcelain=v1 -z --untracked-files=all`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) return undefined

  const tokens = result.stdout.toString().split('\0')
  const entries: StatusEntry[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? ''
    if (token.length < 4) continue
    const status = token.slice(0, 2)
    const path = token.slice(3)
    // A rename or copy carries its source as the next token.
    if (status.includes('R') || status.includes('C')) index++
    entries.push({ path, status, digest: digestOf(join(worktree, path)) })
  }
  return entries
}

/**
 * The paths whose status or content differs from the baseline, in the order
 * git reports them. An entry gone since the baseline is not reported, since a
 * worker committing its own edit mid-pass clears it the same way.
 */
export function changedSince(
  baseline: readonly StatusEntry[],
  current: readonly StatusEntry[],
): readonly string[] {
  const before = new Map(baseline.map((entry) => [entry.path, entry]))
  return current
    .filter((entry) => {
      const prior = before.get(entry.path)
      return (
        prior === undefined ||
        prior.status !== entry.status ||
        prior.digest !== entry.digest
      )
    })
    .map((entry) => entry.path)
}
