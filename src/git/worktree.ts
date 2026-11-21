import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/**
 * Resolves the root of the checkout the caller is standing in, the linked
 * worktree when a session is inside one. The directory is an argument so an
 * injected root asks about that one.
 */
export async function currentWorktreeRoot(
  cwd: string = process.cwd(),
): Promise<string> {
  const result = await $`git -C ${cwd} rev-parse --show-toplevel`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return cwd

  return result.stdout.toString().trim() || cwd
}

/**
 * Resolves the root every shared-scratch folder lives under, the first entry of
 * `git worktree list`. The file-editing tools refuse a main-root path from a
 * linked worktree, so a verb resolves it in-process.
 */
export async function mainWorktreeRoot(): Promise<string> {
  const result = await $`git worktree list --porcelain`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return process.cwd()

  const line = result.stdout
    .toString()
    .split('\n')
    .find((entry) => entry.startsWith('worktree '))

  return line ? line.slice('worktree '.length).trim() : process.cwd()
}

export interface WorktreeEntry {
  readonly path: string
  readonly branch: string | null
}

export interface RefReport {
  /** False when the ref read itself failed, so an empty `refs` says nothing about whether the branch exists. */
  readonly readable: boolean
  readonly refs: readonly string[]
}

/**
 * Reports which of the local head and the `origin` remote-tracking ref already
 * name a branch, separating an absent branch from a failed read. A ref path is a
 * pattern, so the over-match names a blocking branch.
 */
export async function branchRefs(
  branch: string,
  cwd: string = process.cwd(),
): Promise<RefReport> {
  // Every argument is interpolated, since Bun's shell parses the parentheses in `%(refname)`.
  const args = [
    '--format=%(refname)',
    `refs/heads/${branch}`,
    `refs/remotes/origin/${branch}`,
  ]

  const result = await $`git -C ${cwd} for-each-ref ${args}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return { readable: false, refs: [] }

  return {
    readable: true,
    refs: result.stdout
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  }
}

/**
 * Parses `git worktree list --porcelain`, which emits one block per worktree
 * separated by a blank line. A detached worktree carries no `branch` line,
 * reported here as `null` rather than a guessed name.
 */
export async function listWorktrees(
  cwd: string = process.cwd(),
): Promise<readonly WorktreeEntry[]> {
  const result = await $`git -C ${cwd} worktree list --porcelain`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return []

  const entries: WorktreeEntry[] = []
  let path: string | undefined
  let branch: string | null = null

  for (const line of result.stdout.toString().split('\n')) {
    if (line.startsWith('worktree ')) {
      if (path !== undefined) entries.push({ path, branch })
      path = line.slice('worktree '.length).trim()
      branch = null
      continue
    }

    if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length).trim()
      branch = ref.startsWith('refs/heads/')
        ? ref.slice('refs/heads/'.length)
        : ref
    }
  }

  if (path !== undefined) entries.push({ path, branch })

  return entries
}
