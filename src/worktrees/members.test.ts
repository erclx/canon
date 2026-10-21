import { execaSync } from 'execa'
import {
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import type { ResolvedSession, SessionReport } from '@/sessions/resolve'
import {
  type CommandResult,
  type MembersOptions,
  parseMembers,
  retireMembers,
} from '@/worktrees/members'

const NUMBER = 7

let SCRATCH: string
let ORIGIN: string
let ROOT: string

function gitAt(cwd: string, ...args: string[]): string {
  return execaSync('git', ['-C', cwd, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function git(...args: string[]): string {
  return gitAt(ROOT, ...args)
}

function commit(cwd: string, message: string): void {
  gitAt(cwd, 'commit', '--quiet', '--allow-empty', '-m', message)
}

beforeEach(() => {
  SCRATCH = realpathSync(mkdtempSync(join(tmpdir(), 'canon-members-')))
  ORIGIN = join(SCRATCH, 'origin.git')
  ROOT = join(SCRATCH, 'repo')
  execaSync(
    'git',
    ['init', '--quiet', '--bare', '--initial-branch=main', ORIGIN],
    {
      env: gitEnv(),
      extendEnv: false,
    },
  )
  execaSync('git', ['clone', '--quiet', ORIGIN, ROOT], {
    env: gitEnv(),
    extendEnv: false,
  })
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  commit(ROOT, 'init')
  git('push', '--quiet', 'origin', 'main')
})

afterEach(() => {
  rmSync(SCRATCH, { recursive: true, force: true })
})

/** A member branch with one commit of its own, pushed to origin. */
function member(branch: string): void {
  git('branch', branch, 'main')
  git('checkout', '--quiet', branch)
  commit(ROOT, `work on ${branch}`)
  git('push', '--quiet', 'origin', branch)
  git('checkout', '--quiet', 'main')
}

/**
 * The integrator merging every member, pushed both as its own branch and as
 * the pull request ref GitHub keeps. Returns the merged head.
 */
function integrate(...members: string[]): string {
  git('checkout', '--quiet', '-b', 'feat/integrator', 'main')
  for (const branch of members) {
    git('merge', '--quiet', '--no-ff', '--no-edit', branch)
  }
  git('push', '--quiet', 'origin', 'feat/integrator')
  git('push', '--quiet', 'origin', `HEAD:refs/pull/${NUMBER}/head`)
  const head = git('rev-parse', 'HEAD')
  git('checkout', '--quiet', 'main')
  return head
}

function worktree(branch: string): string {
  const path = join(SCRATCH, branch.replace('/', '-'))
  git('worktree', 'add', '--quiet', path, branch)
  return path
}

function onOrigin(branch: string): boolean {
  return git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`) !== ''
}

function local(branch: string): boolean {
  return (
    execaSync(
      'git',
      ['-C', ROOT, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
      {
        env: gitEnv(),
        extendEnv: false,
        reject: false,
      },
    ).exitCode === 0
  )
}

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
    kind: 'background',
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

interface View {
  state: string
  body: string
  headRefName: string
  headRefOid: string
  baseRefName: string
}

/** Answers `gh pr view` with the view and `gh pr list` with the open heads. */
function gh(
  view: View,
  open: readonly string[] = [],
): (cwd: string, args: readonly string[]) => Promise<CommandResult> {
  return async (_cwd, args) => {
    const stdout =
      args[1] === 'view'
        ? JSON.stringify(view)
        : JSON.stringify(
            open.map((headRefName, index) => ({
              headRefName,
              number: index + 1,
            })),
          )
    return { exitCode: 0, stdout, stderr: '' }
  }
}

function view(head: string, fields: Partial<View> = {}): View {
  return {
    state: 'MERGED',
    body: '## Summary\n\nFan-in members: `feat/a`, `feat/b`\n',
    headRefName: 'feat/integrator',
    headRefOid: head,
    baseRefName: 'main',
    ...fields,
  }
}

function options(fields: Partial<MembersOptions> = {}): MembersOptions {
  return {
    cwd: ROOT,
    root: ROOT,
    reclaim: {
      resolve: async () => roster(),
      claudeAgentIds: async () => new Map(),
    },
    ...fields,
  }
}

describe('parseMembers', () => {
  it('should read the backticked branches on the member line in the order named', () => {
    expect(parseMembers('Fan-in members: `feat/b`, `feat/a`')).toEqual([
      'feat/b',
      'feat/a',
    ])
  })

  it('should read nothing outside the member line', () => {
    const body =
      'Builds on `feat/c` from earlier.\n\nFan-in members: `feat/a`\n\nSee `feat/d`.'

    expect(parseMembers(body)).toEqual(['feat/a'])
  })

  it('should read a bare name on the line as nothing', () => {
    expect(parseMembers('Fan-in members: feat/a, `feat/b`')).toEqual(['feat/b'])
  })

  it('should name nobody when the body carries no member line', () => {
    expect(parseMembers('## Summary\n\nCloses the task.')).toEqual([])
  })
})

describe('retireMembers', () => {
  it('should delete each member origin branch, worktree, and local branch in the order named', async () => {
    member('feat/a')
    member('feat/b')
    const head = integrate('feat/a', 'feat/b')
    const path = worktree('feat/a')

    const report = await retireMembers(NUMBER, options({ gh: gh(view(head)) }))

    expect(report).toEqual({
      kind: 'read',
      members: [
        {
          branch: 'feat/a',
          origin: { state: 'deleted', reasons: [], detail: null },
          worktree: { state: 'deleted', reasons: [], detail: null, path },
          local: { state: 'deleted', reasons: [], detail: null },
        },
        {
          branch: 'feat/b',
          origin: { state: 'deleted', reasons: [], detail: null },
          worktree: null,
          local: { state: 'deleted', reasons: [], detail: null },
        },
      ],
    })
    expect(onOrigin('feat/a')).toBe(false)
    expect(onOrigin('feat/b')).toBe(false)
    expect(existsSync(path)).toBe(false)
    expect(local('feat/a')).toBe(false)
    expect(local('feat/b')).toBe(false)
  })

  it('should report every half it would delete and delete nothing on a dry run', async () => {
    member('feat/a')
    member('feat/b')
    const head = integrate('feat/a', 'feat/b')
    const path = worktree('feat/a')

    const report = await retireMembers(
      NUMBER,
      options({ gh: gh(view(head)), dryRun: true }),
    )

    expect(report.kind === 'read' && report.members[0]?.worktree?.state).toBe(
      'would-delete',
    )
    expect(onOrigin('feat/a')).toBe(true)
    expect(existsSync(path)).toBe(true)
    expect(local('feat/b')).toBe(true)
  })

  describe('refusing the whole run', () => {
    it('should delete nothing on a body with no member line', async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Merges `feat/a` in.' })) }),
      )

      expect(report.kind === 'refused' && report.reason).toBe('no-members')
      expect(onOrigin('feat/a')).toBe(true)
      expect(local('feat/a')).toBe(true)
    })

    it('should delete nothing for a pull request that has not merged', async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { state: 'OPEN' })) }),
      )

      expect(report.kind === 'refused' && report.reason).toBe('not-merged')
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete nothing when gh is not on the path', async () => {
      member('feat/a')

      const report = await retireMembers(NUMBER, options({ gh: null }))

      expect(report.kind === 'refused' && report.reason).toBe('gh-missing')
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete nothing when gh fails', async () => {
      member('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: async () => ({ exitCode: 1, stdout: '', stderr: 'HTTP 401' }),
        }),
      )

      expect(report).toMatchObject({
        kind: 'refused',
        reason: 'gh-failed',
        detail: 'HTTP 401',
      })
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete nothing when the session roster is unreadable', async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })),
          reclaim: {
            resolve: async () => ({ kind: 'absent', dir: '/registry' }),
          },
        }),
      )

      expect(report.kind === 'refused' && report.reason).toBe(
        'sessions-unreadable',
      )
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete nothing when session records went unchecked', async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })),
          reclaim: { resolve: async () => ({ ...roster(), foreignDead: 1 }) },
        }),
      )

      expect(report.kind === 'refused' && report.reason).toBe(
        'sessions-unchecked',
      )
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete nothing when the integrator head cannot be fetched', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      execaSync(
        'git',
        ['-C', ORIGIN, 'update-ref', '-d', `refs/pull/${NUMBER}/head`],
        {
          env: gitEnv(),
          extendEnv: false,
        },
      )

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })) }),
      )

      expect(report.kind === 'refused' && report.reason).toBe('head-unreadable')
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete none of the members when the line names the trunk', async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: gh(view(head, { body: 'Fan-in members: `feat/a`, `main`' })),
        }),
      )

      expect(report.kind === 'refused' && report.reason).toBe('trunk-named')
      expect(onOrigin('feat/a')).toBe(true)
      expect(onOrigin('main')).toBe(true)
    })

    it("should delete none of the members when the line names the integrator's own branch", async () => {
      member('feat/a')
      const head = integrate('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: gh(
            view(head, { body: 'Fan-in members: `feat/a`, `feat/integrator`' }),
          ),
        }),
      )

      expect(report.kind === 'refused' && report.reason).toBe('head-named')
      expect(onOrigin('feat/a')).toBe(true)
    })

    it('should delete none of the members when one has an open pull request of its own', async () => {
      member('feat/a')
      member('feat/b')
      const head = integrate('feat/a', 'feat/b')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head), ['feat/b']) }),
      )

      expect(report.kind === 'refused' && report.reason).toBe(
        'open-pull-request',
      )
      expect(onOrigin('feat/a')).toBe(true)
      expect(onOrigin('feat/b')).toBe(true)
    })
  })

  describe('keeping one member', () => {
    it('should keep the local branch and worktree holding an unpushed commit while origin goes', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      const path = worktree('feat/a')
      commit(path, 'after the merge')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })) }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        origin: { state: 'deleted' },
        worktree: { state: 'kept', reasons: ['not-in-merged-head'] },
        local: { state: 'kept', reasons: ['not-in-merged-head'] },
      })
      expect(onOrigin('feat/a')).toBe(false)
      expect(existsSync(path)).toBe(true)
      expect(local('feat/a')).toBe(true)
    })

    it('should keep the origin branch holding a commit pushed after the merge while local goes', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      git('checkout', '--quiet', 'feat/a')
      commit(ROOT, 'pushed after the merge')
      git('push', '--quiet', 'origin', 'feat/a')
      git('checkout', '--quiet', 'main')
      git('branch', '--quiet', '-f', 'feat/a', 'feat/a~1')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })) }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        origin: { state: 'kept', reasons: ['not-in-merged-head'] },
        local: { state: 'deleted' },
      })
      expect(onOrigin('feat/a')).toBe(true)
      expect(local('feat/a')).toBe(false)
    })

    it('should keep the worktree and local branch a live session holds', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      const path = worktree('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })),
          reclaim: {
            resolve: async () => roster([session({ worktree: path })]),
            claudeAgentIds: async () => new Map(),
          },
        }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        origin: { state: 'deleted' },
        worktree: { state: 'kept', reasons: ['held-by-session'] },
        local: { state: 'kept', reasons: ['worktree-kept'] },
      })
      expect(existsSync(path)).toBe(true)
      expect(local('feat/a')).toBe(true)
    })

    it('should keep a dirty worktree and its local branch', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      const path = worktree('feat/a')
      writeFileSync(join(path, 'notes.md'), 'unsaved\n')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })) }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        worktree: { state: 'kept', reasons: ['uncommitted-changes'] },
        local: { state: 'kept', reasons: ['worktree-kept'] },
      })
      expect(existsSync(join(path, 'notes.md'))).toBe(true)
    })

    it('should keep the worktree the run stands in and its local branch', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      const path = worktree('feat/a')

      const report = await retireMembers(
        NUMBER,
        options({
          cwd: path,
          gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })),
        }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        worktree: { state: 'kept', reasons: ['current-worktree'] },
        local: { state: 'kept', reasons: ['worktree-kept'] },
      })
      expect(existsSync(path)).toBe(true)
    })

    it('should keep a member checked out in the main worktree', async () => {
      member('feat/a')
      const head = integrate('feat/a')
      git('checkout', '--quiet', 'feat/a')

      const report = await retireMembers(
        NUMBER,
        options({ gh: gh(view(head, { body: 'Fan-in members: `feat/a`' })) }),
      )

      expect(report.kind === 'read' && report.members[0]).toMatchObject({
        worktree: {
          state: 'kept',
          reasons: expect.arrayContaining(['main-worktree']),
        },
        local: { state: 'kept', reasons: ['worktree-kept'] },
      })
      expect(local('feat/a')).toBe(true)
    })
  })
})
