import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { GitRunner, PullRequestOpener } from '@/sync/git'
import {
  collectChanges,
  runGitWorkflow,
  type WorkflowChoice,
  type WorkflowDeps,
} from '@/sync/workflow'

const NOW = new Date(2026, 6, 29, 12, 42, 0)

const dirs: string[] = []

interface FakeGit extends GitRunner {
  readonly calls: string[]
}

interface FakeOptions {
  readonly status?: Record<string, string>
  readonly branch?: string
  readonly localTaken?: boolean
  readonly remoteTaken?: boolean
}

function makeGit(options: FakeOptions = {}): FakeGit {
  const calls: string[] = []
  const status = options.status ?? {}

  return {
    calls,
    status: async (paths) => status[paths.join(',')] ?? '',
    currentBranch: async () => options.branch ?? 'main',
    branchExists: async () => options.localTaken ?? false,
    remoteBranchExists: async () => options.remoteTaken ?? false,
    createBranch: async (name) => {
      calls.push(`createBranch ${name}`)
    },
    stage: async (paths) => {
      calls.push(`stage ${paths.join(' ')}`)
    },
    commit: async (message) => {
      calls.push(`commit ${message}`)
    },
    push: async (branch) => {
      calls.push(`push ${branch}`)
    },
  }
}

function makeOpener(calls: string[]): PullRequestOpener {
  return {
    create: async (title) => {
      calls.push(`pr ${title}`)
      return 'https://example.test/pr/1'
    },
  }
}

async function makeRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'canon-sync-workflow-'))
  dirs.push(dir)
  await mkdir(join(dir, '.git'), { recursive: true })
  return dir
}

const DRIFTED_GOVERNANCE = {
  '.claude/rules/,.claude/GOV.md': ' M .claude/rules/core/testing.md\n',
}

const DRIFTED_TWO_DOMAINS = {
  '.claude/rules/,.claude/GOV.md':
    ' M .claude/rules/core/testing.md\n M .claude/rules/core/020-concurrency.md\n',
  '.gitignore': ' M .gitignore\n',
}

function choosing(choice: WorkflowChoice): WorkflowDeps['choose'] {
  return async () => choice
}

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  )
})

describe('collectChanges', () => {
  it('should report one entry per domain with pending changes', async () => {
    const git = makeGit({
      status: {
        '.claude/rules/,.claude/GOV.md': ' M .claude/rules/core/testing.md\n',
        '.gitignore': '?? .gitignore\n',
      },
    })

    const changes = await collectChanges(git)

    expect(changes).toEqual([
      {
        domain: 'governance',
        verb: 'Update',
        names: ['testing.md'],
        paths: ['.claude/rules/core/testing.md'],
      },
      {
        domain: 'claude',
        verb: 'Add',
        names: ['.gitignore'],
        paths: ['.gitignore'],
      },
    ])
  })

  it('should report nothing when no domain changed', async () => {
    expect(await collectChanges(makeGit())).toEqual([])
  })
})

describe('runGitWorkflow', () => {
  it('should do nothing when the target is not a git root', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canon-sync-workflow-'))
    dirs.push(dir)
    const git = makeGit({ status: DRIFTED_GOVERNANCE })

    const code = await runGitWorkflow(dir, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
  })

  it('should do nothing when the syncs changed no files', async () => {
    const target = await makeRepo()
    const git = makeGit()

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
  })

  it('should refuse to commit when the branch already exists locally', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, localTaken: true })

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
  })

  it('should refuse to commit when the branch already exists on the remote', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, remoteTaken: true })

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
  })

  it('should refuse the git workflow entirely for a headless caller', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE })
    const prCalls: string[] = []

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: makeOpener(prCalls),
      now: NOW,
      nonInteractive: true,
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
    expect(prCalls).toEqual([])
  })

  it('should not open a pull request headlessly even on a feature branch', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, branch: 'feat/x' })
    const prCalls: string[] = []

    await runGitWorkflow(target, {
      git,
      pullRequests: makeOpener(prCalls),
      now: NOW,
      nonInteractive: true,
    })

    expect(prCalls).toEqual([])
  })

  it('should make no git call when the operator cancels', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE })

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('cancel'),
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([])
  })
})

describe('runGitWorkflow staging', () => {
  it('should stage only the paths the syncs changed', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_TWO_DOMAINS })

    await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls).toContain(
      'stage .claude/rules/core/testing.md .claude/rules/core/020-concurrency.md .gitignore',
    )
  })

  it('should not stage the whole working tree', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE })

    await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls).toContain('stage .claude/rules/core/testing.md')
    expect(git.calls).not.toContain('stage -A')
  })

  it('should collapse a path two domains both report', async () => {
    const target = await makeRepo()
    const git = makeGit({
      status: {
        '.claude/rules/,.claude/GOV.md': ' D .claude/GOV.md\n',
        '.gitignore': ' M .gitignore\n',
      },
    })

    await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls).toContain('stage .claude/GOV.md .gitignore')
  })

  it('should branch before committing when on a protected branch', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, branch: 'main' })

    await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls).toEqual([
      'createBranch chore/canon-sync-20260729-1242',
      'stage .claude/rules/core/testing.md',
      'commit chore(sync): update governance from toolkit',
    ])
  })

  it('should commit onto the current branch without branching on a feature branch', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, branch: 'feat/x' })

    await runGitWorkflow(target, {
      git,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls).toEqual([
      'stage .claude/rules/core/testing.md',
      'commit chore(sync): update governance from toolkit',
    ])
  })

  it('should not push on the commit-only path', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE })
    const prCalls: string[] = []

    await runGitWorkflow(target, {
      git,
      pullRequests: makeOpener(prCalls),
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(git.calls.some((call) => call.startsWith('push'))).toBe(false)
    expect(prCalls).toEqual([])
  })

  it('should branch, stage, commit, push, then open the pull request', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE, branch: 'feat/x' })
    const prCalls: string[] = []

    const code = await runGitWorkflow(target, {
      git,
      pullRequests: makeOpener(prCalls),
      now: NOW,
      nonInteractive: false,
      choose: choosing('pr'),
    })

    expect(code).toBe(0)
    expect(git.calls).toEqual([
      'createBranch chore/canon-sync-20260729-1242',
      'stage .claude/rules/core/testing.md',
      'commit chore(sync): update governance from toolkit',
      'push chore/canon-sync-20260729-1242',
    ])
    expect(prCalls).toEqual(['pr chore(sync): update governance from toolkit'])
  })

  it('should report a failed git mutation rather than a completed sync', async () => {
    const target = await makeRepo()
    const git = makeGit({ status: DRIFTED_GOVERNANCE })
    const failing: GitRunner = {
      ...git,
      commit: async () => {
        throw new Error('git commit failed: nothing to commit')
      },
    }

    const code = await runGitWorkflow(target, {
      git: failing,
      pullRequests: undefined,
      now: NOW,
      nonInteractive: false,
      choose: choosing('commit'),
    })

    expect(code).toBe(1)
  })
})
