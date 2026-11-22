import { $ } from 'bun'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
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

/** What a fast-forward of the main worktree did, with a stable code per outcome. */
export type MainPull =
  | {
      readonly outcome: 'pulled'
      readonly reason: 'fast-forwarded' | 'up-to-date'
    }
  | {
      readonly outcome: 'skipped'
      readonly reason: 'not-a-repo' | 'linked-worktree' | 'off-trunk'
    }
  | {
      readonly outcome: 'refused'
      readonly reason: 'dirty-tree' | 'diverged' | 'pull-failed'
    }

const PULL_TIMEOUT_MS = 120_000

async function gitRead(
  cwd: string,
  args: readonly string[],
): Promise<string | undefined> {
  const result = await $`git -C ${cwd} ${args}`.env(gitEnv()).quiet().nothrow()
  return result.exitCode === 0 ? result.stdout.toString().trim() : undefined
}

/**
 * Runs a git write with its output and any hook's on stderr, so a caller's
 * stdout stays a clean record.
 */
function gitWrite(cwd: string, args: readonly string[]): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn('git', ['-C', cwd, ...args], {
      env: gitEnv(),
      stdio: ['ignore', 2, 2],
      timeout: PULL_TIMEOUT_MS,
    })
    child.on('error', () => done(false))
    child.on('close', (code) => done(code === 0))
  })
}

/**
 * Fast-forwards the main worktree at `cwd` to its remote trunk, which fires the
 * `post-merge` hook as a hand pull does. It skips a linked worktree and a main
 * on another branch, and refuses a tree with tracked changes or a branch that
 * diverged, leaving the checkout where it was in every case but `pulled`.
 */
export async function fastForwardMain(cwd: string): Promise<MainPull> {
  const dirs = (
    await gitRead(cwd, [
      'rev-parse',
      '--path-format=absolute',
      '--git-dir',
      '--git-common-dir',
    ])
  )?.split('\n')
  const [gitDir, commonDir] = dirs ?? []
  if (gitDir === undefined || commonDir === undefined) {
    return { outcome: 'skipped', reason: 'not-a-repo' }
  }
  if (resolve(gitDir) !== resolve(commonDir)) {
    return { outcome: 'skipped', reason: 'linked-worktree' }
  }

  const remoteHead = await gitRead(cwd, [
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  const trunk = remoteHead?.replace(/^origin\//, '') || 'main'
  const branch = await gitRead(cwd, ['branch', '--show-current'])
  if (branch !== trunk) return { outcome: 'skipped', reason: 'off-trunk' }

  const status = await gitRead(cwd, [
    'status',
    '--porcelain',
    '--untracked-files=no',
  ])
  if (status === undefined) return { outcome: 'refused', reason: 'pull-failed' }
  if (status !== '') return { outcome: 'refused', reason: 'dirty-tree' }

  if (!(await gitWrite(cwd, ['fetch', '--quiet', 'origin', trunk]))) {
    return { outcome: 'refused', reason: 'pull-failed' }
  }
  const remote = `refs/remotes/origin/${trunk}`
  const [local, upstream] = await Promise.all([
    gitRead(cwd, ['rev-parse', 'HEAD']),
    gitRead(cwd, ['rev-parse', remote]),
  ])
  if (local === undefined || upstream === undefined) {
    return { outcome: 'refused', reason: 'pull-failed' }
  }
  if (local === upstream) return { outcome: 'pulled', reason: 'up-to-date' }

  const isBehind =
    await $`git -C ${cwd} merge-base --is-ancestor HEAD ${remote}`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (isBehind.exitCode !== 0) return { outcome: 'refused', reason: 'diverged' }

  return (await gitWrite(cwd, ['merge', '--ff-only', '--quiet', remote]))
    ? { outcome: 'pulled', reason: 'fast-forwarded' }
    : { outcome: 'refused', reason: 'pull-failed' }
}
