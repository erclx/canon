import { $ } from 'bun'
import { gitEnv } from '@/git/env'

/**
 * Resolves the root of the checkout the caller is standing in, which is the
 * linked worktree rather than the main one when a session is inside one.
 *
 * A tracked tree differs per worktree, so a verb answers about the session's
 * edits only from this root, and the working directory is no substitute from a
 * subdirectory. The directory is an argument so a verb driven by an injected
 * root asks about that one rather than wherever the process stands.
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
 * Resolves the root every shared-scratch folder lives under. `git worktree
 * list` puts the main worktree first, and trusting the working directory
 * instead would write a second board nothing else reads, or validate a linked
 * worktree's empty folder and report it clean.
 *
 * A caller reaching this from a linked worktree is the case it exists for: the
 * file-editing tools refuse a main-root path there, so a verb resolving the
 * root in-process is the route a skill body has.
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
 * name a branch, separating an absent branch from a read that failed.
 *
 * `git show-ref --verify` exits 128 both for a missing ref and for no
 * repository, while `for-each-ref` exits zero with empty output for absent. A
 * ref path is a pattern here, so `refs/heads/x` also matches `refs/heads/x/y`,
 * which git forbids beside it, so the over-match names the blocking branch.
 * The remote-tracking ref is read as the last fetch left it, so a branch pushed
 * elsewhere since is invisible, and `git ls-remote` costs a network read.
 */
export async function branchRefs(
  branch: string,
  cwd: string = process.cwd(),
): Promise<RefReport> {
  // Every argument is interpolated rather than written inline, since Bun's
  // shell parses the bare parentheses in `%(refname)` as syntax of its own.
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
