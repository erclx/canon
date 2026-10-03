// Shared by the poll and the watch. Imports are `node:` builtins only, since
// the plugin ships `claude/` alone and a cached plugin root carries no
// `node_modules`.
import { spawnSync } from 'node:child_process'

export interface RunResult {
  isOk: boolean
  stdout: string
}

/** Runs a command to completion. A command that cannot start reads as failed. */
export const run = (command: string, args: string[]): RunResult => {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  return { isOk: result.status === 0, stdout: result.stdout ?? '' }
}

/**
 * The main worktree root rather than the current one, so a script started from
 * a linked worktree reads the same repository and state as one started from
 * main.
 */
export const mainRoot = (): null | string => {
  const listed = run('git', ['worktree', 'list', '--porcelain'])
  if (!listed.isOk) return null

  const first = listed.stdout
    .split('\n')
    .find((line) => line.startsWith('worktree '))

  return first === undefined ? null : first.slice('worktree '.length)
}

/** The repository `.git` path, which is the field a session roster row carries. */
export const gitPath = (root: string): string => `${root}/.git`

/**
 * The base ref is read rather than assumed, since this ships to projects that
 * do not all call it `main`. A wrong base is not a visible failure: merge-tree
 * reports every pull request as conflicted against a ref that does not resolve.
 */
export const baseRef = (): string => {
  const symbolic = run('git', [
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  const ref = symbolic.stdout.trim()
  if (symbolic.isOk && ref !== '') return ref

  const repo = run('gh', [
    'api',
    'repos/{owner}/{repo}',
    '--jq',
    '.default_branch',
  ])
  const name = repo.isOk ? repo.stdout.trim() : ''

  return `origin/${name === '' ? 'main' : name}`
}

export const baseBranch = (ref: string): string =>
  ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref
