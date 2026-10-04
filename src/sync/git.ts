import { basename } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import type { SyncDomain } from '@/sync/target'
import { pipeOutput } from '@/cli/ui'

const FILE_LIST_MAX = 3

export type DomainVerb = 'Add' | 'Remove' | 'Update'

export interface DomainChange {
  readonly domain: SyncDomain
  readonly verb: DomainVerb
  readonly names: readonly string[]
  readonly paths: readonly string[]
}

export class GitCommandError extends Error {}

/**
 * Pulls the path out of each porcelain line by taking the last whitespace
 * separated field, which is what the bash `awk '{print $NF}'` did. A rename
 * reports `old -> new` and so yields the destination, and a sync never
 * produces one because the workflow refuses a dirty tree before it starts.
 */
export function changedPaths(status: string): string[] {
  const paths: string[] = []

  for (const line of status.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const fields = trimmed.split(/\s+/)
    paths.push(fields[fields.length - 1])
  }

  return paths
}

export function changedNames(status: string): string[] {
  const names = changedPaths(status).map((path) => basename(path))
  return [...new Set(names)].sort()
}

/**
 * Classifies a domain's porcelain output as one verb for the pull request body.
 * Only an all-untracked change reads as `Add` and only an all-deleted one as
 * `Remove`, so any mix falls through to `Update`.
 */
export function classifyStatus(status: string): DomainVerb {
  let hasModify = false
  let hasNew = false
  let hasDelete = false

  for (const line of status.split('\n')) {
    if (line === '') continue
    const code = line.slice(0, 2)

    if (code === '??') hasNew = true
    else if (code === ' D' || code === 'D ' || code === 'DD') hasDelete = true
    else hasModify = true
  }

  if (!hasModify && !hasDelete && hasNew) return 'Add'
  if (!hasModify && !hasNew && hasDelete) return 'Remove'
  return 'Update'
}

export function formatFileList(files: readonly string[]): string {
  if (files.length === 0) return ''
  if (files.length <= FILE_LIST_MAX) return files.join(', ')

  const head = files.slice(0, FILE_LIST_MAX).join(', ')
  return `${head}, and ${files.length - FILE_LIST_MAX} more`
}

/**
 * Names the branch at minute resolution, so two syncs inside the same minute
 * collide by design and the collision check turns the second one away.
 */
export function syncBranchName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const minute = `${pad(now.getHours())}${pad(now.getMinutes())}`

  return `chore/canon-sync-${day}-${minute}`
}

export function commitMessage(domains: readonly SyncDomain[]): string {
  return `chore(sync): update ${domains.join(', ')} from toolkit`
}

export function pullRequestBody(changes: readonly DomainChange[]): string {
  const domains = changes.map((change) => change.domain).join(', ')
  const lines = [
    '## Summary',
    '',
    `Sync ${domains} from toolkit.`,
    '',
    '## Key Changes',
    '',
  ]

  for (const change of changes) {
    lines.push(
      `- ${change.verb} \`${change.domain}/\` ${formatFileList(change.names)}.`,
    )
  }

  return lines.join('\n')
}

/**
 * The seam every git mutation goes through, so the workflow can be driven by a
 * fake in tests without a repository behind it. Reads swallow failure the way
 * the bash `2>/dev/null || true` did. Mutations throw, because a failed commit
 * or push must not be reported as a completed sync.
 */
export interface GitRunner {
  status(paths: readonly string[]): Promise<string>
  currentBranch(): Promise<string>
  branchExists(name: string): Promise<boolean>
  remoteBranchExists(name: string): Promise<boolean>
  createBranch(name: string): Promise<void>
  stage(paths: readonly string[]): Promise<void>
  commit(message: string): Promise<void>
  push(branch: string): Promise<void>
}

export interface PullRequestOpener {
  create(title: string, body: string): Promise<string>
}

export function createGitRunner(target: string): GitRunner {
  return {
    status: (paths) => read(target, ['status', '--short', '--', ...paths]),
    currentBranch: () => read(target, ['symbolic-ref', '--short', 'HEAD']),
    branchExists: async (name) =>
      (await read(target, ['branch', '--list', name])) !== '',
    remoteBranchExists: async (name) =>
      (await read(target, ['ls-remote', '--heads', 'origin', name])) !== '',
    createBranch: async (name) => {
      await mutate(target, ['checkout', '-b', name])
    },
    stage: async (paths) => {
      await mutate(target, ['add', '--', ...paths])
    },
    commit: async (message) => {
      await mutate(target, ['commit', '-m', message])
    },
    push: async (branch) => {
      await mutate(target, ['push', '-u', 'origin', branch])
    },
  }
}

/**
 * Passes the body on stdin rather than through a temp file. The bash wrote one
 * with `mktemp` and removed it afterwards, which left the file behind whenever
 * `gh` failed.
 */
export function createPullRequestOpener(target: string): PullRequestOpener {
  return {
    create: async (title, body) => {
      const result = await execa(
        'gh',
        ['pr', 'create', '--title', title, '--body-file', '-'],
        {
          cwd: target,
          input: body,
          reject: false,
          env: gitEnv(),
          extendEnv: false,
        },
      )

      if (result.exitCode !== 0) {
        throw new GitCommandError(
          `gh pr create failed: ${result.stderr || result.stdout}`,
        )
      }

      return result.stdout.trim()
    },
  }
}

export async function hasGh(): Promise<boolean> {
  const result = await execa('command', ['-v', 'gh'], {
    reject: false,
    shell: true,
  })

  return result.exitCode === 0
}

/**
 * Both seams strip git's repository-resolution variables, since a hook exports
 * `GIT_DIR` into every process it runs and it beats `-C`. A sync driven from
 * inside one would otherwise read the hook's repository and, through `mutate`,
 * commit and push into it.
 */
async function read(target: string, args: readonly string[]): Promise<string> {
  const result = await execa('git', ['-C', target, ...args], {
    reject: false,
    env: gitEnv(),
    extendEnv: false,
  })
  return result.exitCode === 0 ? result.stdout : ''
}

async function mutate(target: string, args: readonly string[]): Promise<void> {
  const result = await execa('git', ['-C', target, ...args], {
    reject: false,
    env: gitEnv(),
    extendEnv: false,
  })

  if (result.exitCode !== 0) {
    throw new GitCommandError(
      `git ${args[0]} failed: ${result.stderr || result.stdout}`,
    )
  }

  if (result.stdout !== '') pipeOutput(result.stdout)
}
