import { execaSync } from 'execa'
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import {
  repositoryOf,
  type ResolvedSession,
  resolveSessions,
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
  ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'canon-reclaim-')))
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
    foreignDead: 0,
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
    via: 'pid',
    confidence: 'confirmed',
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

  // This repository squash merges, so only the pull request state answers for a merged branch.
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
    // No removal shape reaches it, so a reader is offered neither.
    expect(verdict.route).toBeNull()
  })

  // Git removes the caller's own directory without complaint, failing every later scoped call.
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

  // The main worktree already refuses on its own, so a reading from there names one reason.
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

  // A hand-deleted directory and a failed status read both exit 128, so the real read runs here.
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

  // Reading a missing directory as clean must not clear anything else, so the merged check decides.
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

  // An unreadable merge state and a branch with no merged pull request look alike, a false clean.
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

  it('should refuse the whole reading when foreign records have no answering socket', async () => {
    linked('wt-parser', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => ({ ...roster(), foreignDead: 2 }),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    expect(report.kind).toBe('unreadable')
    if (report.kind !== 'unreadable') return
    expect(report.reason).toBe('sessions-unchecked')
  })

  describe('when foreign records are listed', () => {
    function stranded(
      cwd: string,
    ): Extract<SessionReport, { kind: 'resolved' }> {
      return {
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
        foreignDead: 1,
        foreign: [
          {
            sessionId: 'id-9',
            pid: 9,
            cwd,
            path: '/registry/9.json',
            startedAt: null,
          },
        ],
      }
    }

    it('should read the worktrees when every foreign record sits outside the repository', async () => {
      const path = linked('wt-parser', 'feat/parser')
      const elsewhere = realpathSync(
        mkdtempSync(join(tmpdir(), 'canon-elsewhere-')),
      )

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(elsewhere),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })
      rmSync(elsewhere, { recursive: true, force: true })

      expect(verdictFor(report, path).reclaimable).toBe(true)
    })

    it('should read the worktrees when a foreign record sits at an ancestor of the repository', async () => {
      const path = linked('wt-parser', 'feat/parser')

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(tmpdir()),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })

      expect(verdictFor(report, path).reclaimable).toBe(true)
    })

    it('should refuse when a foreign record sits inside the main worktree', async () => {
      linked('wt-parser', 'feat/parser')

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(join(ROOT, 'src')),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })

      expect(report).toMatchObject({
        kind: 'unreadable',
        reason: 'sessions-unchecked',
      })
    })

    it('should refuse when a foreign record sits inside a worktree outside the main root', async () => {
      const outside = realpathSync(
        mkdtempSync(join(tmpdir(), 'canon-outside-')),
      )
      const path = join(outside, 'wt-parser')
      git('worktree', 'add', '--quiet', '-b', 'feat/parser', path)

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(path),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })
      git('worktree', 'remove', '--force', path)
      rmSync(outside, { recursive: true, force: true })

      expect(report).toMatchObject({
        kind: 'unreadable',
        reason: 'sessions-unchecked',
      })
    })

    it('should refuse when a foreign record reaches a worktree through a symlink', async () => {
      const path = linked('wt-parser', 'feat/parser')
      const elsewhere = realpathSync(
        mkdtempSync(join(tmpdir(), 'canon-symlink-')),
      )
      const alias = join(elsewhere, 'alias')
      symlinkSync(path, alias)

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(alias),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })
      rmSync(elsewhere, { recursive: true, force: true })

      expect(report).toMatchObject({
        kind: 'unreadable',
        reason: 'sessions-unchecked',
      })
    })

    it('should refuse on every foreign record when the worktree listing is empty', async () => {
      const elsewhere = realpathSync(
        mkdtempSync(join(tmpdir(), 'canon-elsewhere-')),
      )

      const report = await reclaimReport({
        cwd: ROOT,
        listWorktrees: async () => [],
        resolve: async () => stranded(elsewhere),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })
      rmSync(elsewhere, { recursive: true, force: true })

      expect(report).toMatchObject({
        kind: 'unreadable',
        reason: 'sessions-unchecked',
      })
    })

    it('should name each blocking record and its file in the refusal', async () => {
      linked('wt-parser', 'feat/parser')

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(join(ROOT, 'wt-parser')),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })

      expect(report.kind === 'unreadable' && report.detail).toContain(
        '/registry/9.json',
      )
      expect(report.kind === 'unreadable' && report.detail).toContain(
        join(ROOT, 'wt-parser'),
      )
    })

    it('should count the merged worktrees held back and leave out one it would refuse anyway', async () => {
      linked('wt-parser', 'feat/parser')
      linked('wt-verdicts', 'docs/verdicts')
      linked('wt-open', 'feat/open')
      writeFileSync(join(linked('wt-dirty', 'feat/dirty'), 'work.txt'), 'work')

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(ROOT),
        mergedPullRequests: async () =>
          merged(['feat/parser', 1], ['docs/verdicts', 2], ['feat/dirty', 3]),
      })

      expect(report.kind === 'unreadable' && report.detail).toContain(
        '2 merged worktrees are held back',
      )
    })

    it('should word a single merged worktree held back as one', async () => {
      linked('wt-parser', 'feat/parser')

      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => stranded(ROOT),
        mergedPullRequests: async () => merged(['feat/parser', 1]),
      })

      expect(report.kind === 'unreadable' && report.detail).toContain(
        '1 merged worktree is held back',
      )
    })

    it('should state no held count when the worktree listing is empty', async () => {
      const report = await reclaimReport({
        cwd: ROOT,
        listWorktrees: async () => [],
        resolve: async () => stranded(ROOT),
        mergedPullRequests: async () => merged(['feat/parser', 1]),
      })

      expect(report.kind === 'unreadable' && report.detail).not.toContain(
        'held back',
      )
    })

    it('should say how many records from before the boot were set aside', async () => {
      const report = await reclaimReport({
        cwd: ROOT,
        resolve: async () => ({
          ...stranded(ROOT),
          foreignPreBoot: stranded(ROOT).foreign,
        }),
        mergedPullRequests: async () => merged(),
      })

      expect(report.kind === 'unreadable' && report.detail).toContain(
        '1 further record was set aside',
      )
    })
  })

  describe('when a foreign record sits inside a worktree', () => {
    const BOOT = 1_795_410_604_000

    async function reading(startedAt: number): Promise<ReclaimReport> {
      const path = linked('wt-parser', 'feat/parser')
      const dir = join(ROOT, 'registry')
      mkdirSync(dir)
      writeFileSync(
        join(dir, '9.json'),
        JSON.stringify({
          pid: 9,
          cwd: path,
          name: 'canon-9',
          startedAt,
          pidDomain: 'linux:abc:pid:[4026532999]',
        }),
      )

      return reclaimReport({
        cwd: ROOT,
        resolve: () =>
          resolveSessions({
            dir,
            probes: {
              procStartOf: () => null,
              responds: () => false,
              ownDomain: () => 'pid:[4026532221]',
            },
            bootTime: () => BOOT,
            machineId: () => 'abc',
          }),
        mergedPullRequests: async () => merged(['feat/parser', 673]),
      })
    }

    it('should refuse on a record started one second after boot', async () => {
      const report = await reading(BOOT + 1_000)

      expect(report).toMatchObject({
        kind: 'unreadable',
        reason: 'sessions-unchecked',
      })
    })

    it('should reclaim past a record started before boot', async () => {
      const report = await reading(BOOT - 1_000)

      expect(verdictFor(report, join(ROOT, 'wt-parser')).reclaimable).toBe(true)
    })
  })

  // One call for the whole repository rather than one per worktree, nine round trips measured.
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

describe('reclaimReport branches', () => {
  it('should report a merged branch no worktree holds', async () => {
    git('branch', 'feat/parser')
    const tip = git('rev-parse', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => ({
        kind: 'read',
        merged: [{ branch: 'feat/parser', number: 673, headOid: tip }],
      }),
    })

    if (report.kind !== 'read' || report.branches.kind !== 'read') {
      throw new Error('expected a readable branch report')
    }
    expect(report.branches.branches).toEqual([
      {
        branch: 'feat/parser',
        tip,
        reclaimable: true,
        refusals: [],
        pullRequest: 673,
      },
    ])
  })

  it('should never list a branch a worktree holds as a branch candidate', async () => {
    const path = linked('wt-parser', 'feat/parser')
    const tip = git('rev-parse', 'feat/parser')

    const report = await reclaimReport({
      cwd: ROOT,
      resolve: async () => roster(),
      mergedPullRequests: async () => ({
        kind: 'read',
        merged: [{ branch: 'feat/parser', number: 673, headOid: tip }],
      }),
    })

    if (report.kind !== 'read') throw new Error('expected a readable report')
    expect(report.branches).toEqual({ kind: 'read', branches: [] })
    expect(verdictFor(report, path).reclaimable).toBe(true)
  })

  it('should refuse the branch reading alone when the worktree listing reads empty', async () => {
    const report = await reclaimReport({
      cwd: ROOT,
      listWorktrees: async () => [],
      resolve: async () => roster(),
      mergedPullRequests: async () => merged(['feat/parser', 673]),
    })

    if (report.kind !== 'read') throw new Error('expected a readable report')
    expect(report.branches.kind).toBe('unreadable')
  })
})
