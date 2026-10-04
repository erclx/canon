import { execaSync } from 'execa'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { checkClaim } from '@/sessions/claim'
import { repositoryOf, type ResolvedSession } from '@/sessions/resolve'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-claim-'))
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('commit', '--quiet', '--allow-empty', '-m', 'init')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function session(fields: Partial<ResolvedSession>): ResolvedSession {
  return {
    name: 'canon-1',
    pid: 1,
    sessionId: 'id-1',
    cwd: '/repo/worktrees/w1',
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

describe('checkClaim', () => {
  it('should report an unclaimed branch when neither surface holds it', async () => {
    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
    })

    expect(report).toEqual({
      claimed: false,
      worktree: null,
      sessions: [],
      refs: [],
      sessionsReadable: true,
      refsReadable: true,
    })
  })

  // The branch behind a merged pull request has no worktree and no session, and
  // read across those two alone it answered clear. Dispatching onto it opens a
  // second pull request against a head GitHub already shows merged.
  it('should report a branch claimed by a local ref that no worktree or session holds', async () => {
    git('branch', 'feat/parser')

    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
    })

    expect(report.claimed).toBe(true)
    expect(report.refs).toEqual(['refs/heads/feat/parser'])
    expect(report.worktree).toBeNull()
    expect(report.sessions).toHaveLength(0)
  })

  // A sibling dispatcher that pushed seconds earlier leaves the remote-tracking
  // ref behind and nothing else this machine can see.
  it('should report a branch claimed by an origin remote-tracking ref alone', async () => {
    git('update-ref', 'refs/remotes/origin/feat/parser', 'HEAD')

    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
    })

    expect(report.claimed).toBe(true)
    expect(report.refs).toEqual(['refs/remotes/origin/feat/parser'])
  })

  it('should report the ref read as unreadable rather than reporting a clean unclaimed', async () => {
    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
      branchRefs: async () => ({ readable: false, refs: [] }),
    })

    expect(report.refsReadable).toBe(false)
    expect(report.sessionsReadable).toBe(true)
    expect(report.refs).toEqual([])
  })

  it('should report a branch claimed by an existing worktree', async () => {
    git('worktree', 'add', '--quiet', '-b', 'feat/parser', 'wt-linked')

    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [],
      }),
    })

    expect(report.claimed).toBe(true)
    expect(report.worktree).toBe(join(ROOT, 'wt-linked'))
  })

  it('should report a branch claimed by a live session with no worktree', async () => {
    const repository = await repositoryOf(ROOT)

    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [session({ branch: 'feat/parser', repository })],
      }),
    })

    expect(report.claimed).toBe(true)
    expect(report.worktree).toBeNull()
    expect(report.sessions).toHaveLength(1)
  })

  it('should not count a session holding the same branch in another repository', async () => {
    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({
        kind: 'resolved',
        dir: '/registry',
        confidence: 'confirmed',
        sessions: [
          session({ branch: 'feat/parser', repository: '/other/.git' }),
        ],
      }),
    })

    expect(report.claimed).toBe(false)
    expect(report.sessions).toHaveLength(0)
  })

  // The roster is machine-wide and the filter is what scopes it, so pointing
  // the read at another project is how a dispatcher in one repository learns a
  // branch is already held in another. Reading that as unclaimed is what sent
  // two sessions onto branches live sessions were holding.
  it('should answer for another repository when handed its path', async () => {
    const other = mkdtempSync(join(tmpdir(), 'canon-claim-target-'))
    execaSync(
      'git',
      ['-C', other, 'init', '--quiet', '--initial-branch=main'],
      {
        env: gitEnv(),
        extendEnv: false,
      },
    )

    try {
      const target = await repositoryOf(other)

      const report = await checkClaim('chore/toolkit-sync', {
        cwd: other,
        resolve: async () => ({
          kind: 'resolved',
          dir: '/registry',
          confidence: 'confirmed',
          sessions: [
            session({ branch: 'chore/toolkit-sync', repository: target }),
          ],
        }),
      })

      expect(report.claimed).toBe(true)
      expect(report.sessions).toHaveLength(1)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })

  // The same roster read from the caller's own repository has to keep answering
  // the way it did, or widening the reach would change every existing dispatch.
  it('should leave the default answer unchanged for a session in another repository', async () => {
    const other = mkdtempSync(join(tmpdir(), 'canon-claim-target-'))
    execaSync(
      'git',
      ['-C', other, 'init', '--quiet', '--initial-branch=main'],
      {
        env: gitEnv(),
        extendEnv: false,
      },
    )

    try {
      const target = await repositoryOf(other)

      const report = await checkClaim('chore/toolkit-sync', {
        cwd: ROOT,
        resolve: async () => ({
          kind: 'resolved',
          dir: '/registry',
          confidence: 'confirmed',
          sessions: [
            session({ branch: 'chore/toolkit-sync', repository: target }),
          ],
        }),
      })

      expect(report.claimed).toBe(false)
      expect(report.sessions).toHaveLength(0)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })

  it('should report the session roster as unreadable when the registry is absent', async () => {
    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({ kind: 'absent', dir: '/registry' }),
    })

    expect(report).toEqual({
      claimed: false,
      worktree: null,
      sessions: [],
      refs: [],
      sessionsReadable: false,
      refsReadable: true,
    })
  })

  it('should still report a worktree claim when the session roster is unreadable', async () => {
    git('worktree', 'add', '--quiet', '-b', 'feat/parser', 'wt-linked')

    const report = await checkClaim('feat/parser', {
      cwd: ROOT,
      resolve: async () => ({ kind: 'absent', dir: '/registry' }),
    })

    expect(report.claimed).toBe(true)
    expect(report.sessionsReadable).toBe(false)
  })

  // A git hook exports GIT_DIR into every process it runs, and it takes
  // precedence over `-C`, so a claim read from inside one answered about the
  // hook's own repository rather than the directory it was handed.
  it('should read the directory it was given when the environment names another repository', async () => {
    const other = mkdtempSync(join(tmpdir(), 'canon-claim-other-'))
    execaSync(
      'git',
      ['-C', other, 'init', '--quiet', '--initial-branch=main'],
      {
        env: gitEnv(),
        extendEnv: false,
      },
    )
    git('worktree', 'add', '--quiet', '-b', 'feat/parser', 'wt-linked')

    process.env.GIT_DIR = join(other, '.git')
    try {
      const report = await checkClaim('feat/parser', {
        cwd: ROOT,
        resolve: async () => ({ kind: 'absent', dir: '/registry' }),
      })

      expect(report.claimed).toBe(true)
    } finally {
      delete process.env.GIT_DIR
      rmSync(other, { recursive: true, force: true })
    }
  })
})
