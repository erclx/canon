import { execaSync } from 'execa'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import {
  repositoryOf,
  type ResolvedSession,
  type SessionReport,
} from '@/sessions/resolve'
import {
  type MergedReport,
  type ReclaimReport,
  reclaimReport,
  type WorktreeVerdict,
} from '@/worktrees/reclaim'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-reclaim-'))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--quiet', '--allow-empty', '-m', 'init')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function roster(sessions: readonly ResolvedSession[] = []): SessionReport {
  return {
    kind: 'resolved',
    dir: '/registry',
    confidence: 'confirmed',
    sessions,
  }
}

function session(fields: Partial<ResolvedSession>): ResolvedSession {
  return {
    name: 'canon-1',
    pid: 1,
    sessionId: 'id-1',
    cwd: '/repo',
    kind: 'interactive',
    status: 'idle',
    startedAt: null,
    statusUpdatedAt: null,
    statusDwellMs: null,
    repository: null,
    worktree: null,
    branch: null,
    unresolved: null,
    ...fields,
  }
}

function merged(
  ...pairs: readonly (readonly [string, number])[]
): MergedReport {
  return {
    kind: 'read',
    merged: pairs.map(([branch, number]) => ({ branch, number })),
  }
}

function linked(name: string, branch: string): string {
  git('worktree', 'add', '--quiet', '-b', branch, name)
  return join(ROOT, name)
}

function verdictFor(report: ReclaimReport, path: string): WorktreeVerdict {
  if (report.kind !== 'read') throw new Error('expected a readable report')

  const found = report.worktrees.find((entry) => entry.path === path)
  if (!found) throw new Error(`no verdict for ${path}`)

  return found
}

describe('reclaimReport', () => {
  it('should report a clean worktree whose branch merged as reclaimable', async () => {
    const path = linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(true)
    expect(verdict.refusals).toEqual([])
    expect(verdict.pullRequest).toBe(673)
    expect(verdict.route).toBe('worktree')
  })

  // Ancestry is the reading anyone reaches for first, and this repository squash
  // merges, so a merged branch is never an ancestor of main. The pull request
  // state is the only surface that answers.
  it('should report a merged branch reclaimable even though it sits ahead of main', async () => {
    const path = linked('wt-parser', 'feat/parser')
    execaSync(
      'git',
      ['-C', path, 'commit', '--quiet', '--allow-empty', '-m', 'work'],
      { env: gitEnv(), extendEnv: false },
    )

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    expect(verdictFor(report, path).reclaimable).toBe(true)
  })

  it('should refuse a worktree whose branch has no merged pull request', async () => {
    const path = linked('wt-verdicts', 'docs/verdicts')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toContain('no-merged-pull-request')
    expect(verdict.pullRequest).toBeNull()
  })

  it('should refuse a worktree carrying uncommitted work', async () => {
    const path = linked('wt-parser', 'feat/parser')
    writeFileSync(join(path, 'draft.txt'), 'unsaved\n')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toContain('uncommitted-changes')
  })

  it('should refuse a worktree a live session holds and route removal through that session', async () => {
    const path = linked('wt-parser', 'feat/parser')
    const repository = await repositoryOf(ROOT)

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () =>
        roster([
          session({
            name: 'orchestrator-parser',
            worktree: path,
            branch: 'feat/parser',
            repository,
          }),
        ]),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toContain('held-by-session')
    expect(verdict.sessions).toEqual([
      { name: 'orchestrator-parser', kind: 'interactive', id: null },
    ])
    expect(verdict.route).toBe('session')
  })

  it('should resolve a background holder to the id claude agents --json carries beside it', async () => {
    const path = linked('wt-parser', 'feat/parser')
    const repository = await repositoryOf(ROOT)

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () =>
        roster([
          session({
            name: 'worker-parser',
            kind: 'bg',
            pid: 4242,
            worktree: path,
            branch: 'feat/parser',
            repository,
          }),
        ]),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
      claudeAgentIds: async () => new Map([[4242, 'abcd1234']]),
    })

    expect(verdictFor(report, path).sessions).toEqual([
      { name: 'worker-parser', kind: 'bg', id: 'abcd1234' },
    ])
  })

  it('should leave a background holder null when the lookup could not resolve it', async () => {
    const path = linked('wt-parser', 'feat/parser')
    const repository = await repositoryOf(ROOT)

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () =>
        roster([
          session({
            name: 'worker-parser',
            kind: 'bg',
            pid: 4242,
            worktree: path,
            branch: 'feat/parser',
            repository,
          }),
        ]),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
      claudeAgentIds: async () => new Map(),
    })

    expect(verdictFor(report, path).sessions).toEqual([
      { name: 'worker-parser', kind: 'bg', id: null },
    ])
  })

  it('should leave an interactive holder null even where a pid happens to collide', async () => {
    const path = linked('wt-parser', 'feat/parser')
    const repository = await repositoryOf(ROOT)

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () =>
        roster([
          session({
            name: 'orchestrator-parser',
            kind: 'interactive',
            pid: 4242,
            worktree: path,
            branch: 'feat/parser',
            repository,
          }),
        ]),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
      claudeAgentIds: async () => new Map([[4242, 'abcd1234']]),
    })

    expect(verdictFor(report, path).sessions).toEqual([
      { name: 'orchestrator-parser', kind: 'interactive', id: null },
    ])
  })

  it('should not count a session holding the same branch in another repository', async () => {
    const path = linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () =>
        roster([
          session({
            name: 'other-repo',
            branch: 'feat/parser',
            repository: '/other/.git',
          }),
        ]),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    expect(verdictFor(report, path).reclaimable).toBe(true)
  })

  it('should never report the main worktree reclaimable', async () => {
    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['main', 1]),
    })

    const verdict = verdictFor(report, ROOT)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toContain('main-worktree')
    // No removal shape reaches it, so a reader acting on the record is offered
    // neither rather than the one that would break the checkout.
    expect(verdict.route).toBeNull()
  })

  // Git removes the directory a caller is standing in without complaint, and
  // every later call scoped to that directory then fails, so the run would leave
  // the branches after it undeleted and blame the worktrees for it.
  it('should refuse the linked worktree the reading is being run from', async () => {
    const path = linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: path,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toEqual(['current-worktree'])
  })

  // The main worktree already refuses on its own, so a reading run from there
  // names one reason rather than stacking a second that says the same thing.
  it('should not stack the current-worktree refusal onto the main worktree', async () => {
    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['main', 1]),
    })

    expect(verdictFor(report, ROOT).refusals).toEqual(['main-worktree'])
  })

  it('should refuse a detached worktree that holds no branch to match', async () => {
    git('worktree', 'add', '--quiet', '--detach', 'wt-detached')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(),
    })

    const verdict = verdictFor(report, join(ROOT, 'wt-detached'))
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toEqual(['detached-head'])
  })

  it('should refuse a worktree whose status could not be read', async () => {
    const path = linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
      worktreeStatus: async () => ({
        readable: false,
        dirty: false,
        missing: false,
      }),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toContain('unreadable-worktree')
  })

  // A directory deleted by hand and a status read that failed both exit 128, and
  // folding them together is what reported eight reclaimable worktrees as
  // unreadable. The real status read runs here rather than an injected one,
  // since the separation is the thing under test.
  it('should reclaim a worktree whose directory was already deleted by hand', async () => {
    const path = linked('wt-parser', 'feat/parser')
    rmSync(path, { recursive: true, force: true })

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(true)
    expect(verdict.refusals).toEqual([])
    expect(verdict.missing).toBe(true)
  })

  // Reading a missing directory as clean must not clear anything else with it,
  // so the merged check still decides and names its own refusal.
  it('should still refuse a deleted directory whose branch never merged', async () => {
    const path = linked('wt-verdicts', 'docs/verdicts')
    rmSync(path, { recursive: true, force: true })

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(),
    })

    const verdict = verdictFor(report, path)
    expect(verdict.reclaimable).toBe(false)
    expect(verdict.refusals).toEqual(['no-merged-pull-request'])
    expect(verdict.missing).toBe(true)
  })

  it('should name every failing condition rather than only the first', async () => {
    const path = linked('wt-verdicts', 'docs/verdicts')
    writeFileSync(join(path, 'draft.txt'), 'unsaved\n')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(),
    })

    expect(verdictFor(report, path).refusals).toEqual([
      'no-merged-pull-request',
      'uncommitted-changes',
    ])
  })

  // An unreadable merge state and a branch with no merged pull request produce
  // the same empty answer, and reporting the second when it was the first is
  // the false clean this reading exists against.
  it('should refuse the whole reading when the pull request state is unreadable', async () => {
    linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => ({
        kind: 'unreadable' as const,
        reason: 'gh-missing' as const,
        detail: 'gh is not on the path.',
      }),
    })

    expect(report.kind).toBe('unreadable')
    if (report.kind !== 'unreadable') return
    expect(report.reason).toBe('gh-missing')
  })

  it('should refuse the whole reading when the session roster is unreadable', async () => {
    linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => ({ kind: 'absent' as const, dir: '/registry' }),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    expect(report.kind).toBe('unreadable')
    if (report.kind !== 'unreadable') return
    expect(report.reason).toBe('sessions-unreadable')
  })

  // One call for the whole repository rather than one per worktree, which is
  // nine network round trips at the board this was measured against.
  it('should read the pull request state once for every worktree', async () => {
    linked('wt-parser', 'feat/parser')
    linked('wt-verdicts', 'docs/verdicts')
    let calls = 0

    await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => {
        calls += 1
        return merged(['feat/parser', 673])
      },
    })

    expect(calls).toBe(1)
  })
})
