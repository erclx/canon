import { describe, expect, it } from 'vitest'
import type { ResolvedSession, SessionReport } from '@/sessions/resolve'
import { pullHolders, sessionHolders } from '@/tasks/holders'

const REPOSITORY = '/work/canon/.git'

function session(overrides: Partial<ResolvedSession>): ResolvedSession {
  return {
    name: 'worker-a',
    pid: 1,
    sessionId: 'id',
    cwd: '/work/canon',
    kind: 'bg',
    status: 'busy',
    via: 'pid',
    confidence: 'confirmed',
    startedAt: null,
    statusUpdatedAt: null,
    statusDwellMs: null,
    repository: REPOSITORY,
    worktree: '/work/canon',
    branch: 'feat/a',
    unresolved: null,
    ...overrides,
  }
}

function roster(
  sessions: readonly ResolvedSession[],
  foreignDead = 0,
): SessionReport {
  return {
    kind: 'resolved',
    dir: '/sessions',
    confidence: 'confirmed',
    foreignDead,
    sessions,
  }
}

function readSessions(
  report: SessionReport,
  repository: string | null = REPOSITORY,
) {
  return sessionHolders('/work/canon', {
    resolve: async () => report,
    repository: async () => repository,
  })()
}

describe('sessionHolders', () => {
  it('should name the session holding a branch in this repository', async () => {
    const held = await readSessions(roster([session({})]))

    expect(held?.get('feat/a')).toBe('session worker-a')
  })

  it('should ignore a session on the same branch in another repository', async () => {
    const held = await readSessions(
      roster([session({ repository: '/work/other/.git' })]),
    )

    expect(held?.size).toBe(0)
  })

  it('should skip a session with no branch', async () => {
    const held = await readSessions(
      roster([session({ branch: null, unresolved: 'detached-head' })]),
    )

    expect(held?.size).toBe(0)
  })

  it('should read as unread when the registry is absent', async () => {
    const held = await readSessions({ kind: 'absent', dir: '/sessions' })

    expect(held).toBeUndefined()
  })

  it('should read as unread when a foreign record could not be checked', async () => {
    const held = await readSessions(roster([session({})], 1))

    expect(held).toBeUndefined()
  })

  it('should read as unread when a row rests on a leftover socket', async () => {
    const held = await readSessions(
      roster([session({ via: 'socket', confidence: 'unverified' })]),
    )

    expect(held).toBeUndefined()
  })

  it('should take a row a listener confirmed as a hold', async () => {
    const held = await readSessions(roster([session({ via: 'listener' })]))

    expect(held?.get('feat/a')).toBe('session worker-a')
  })

  it('should read as unread when the root is no repository', async () => {
    const held = await readSessions(roster([session({})]), null)

    expect(held).toBeUndefined()
  })

  it('should read as unread when the roster read throws', async () => {
    const held = await sessionHolders('/work/canon', {
      resolve: async () => {
        throw new Error('EACCES')
      },
      repository: async () => REPOSITORY,
    })()

    expect(held).toBeUndefined()
  })
})

function pull(number: number, headRefName: string, fork = false) {
  return { number, headRefName, isCrossRepository: fork }
}

describe('pullHolders', () => {
  it('should name the open pull request holding a branch', async () => {
    const held = await pullHolders('/work/canon', async () =>
      JSON.stringify([pull(12, 'feat/a')]),
    )()

    expect(held?.get('feat/a')).toBe('pull request #12')
  })

  it('should read an empty list as read and holding nothing', async () => {
    const held = await pullHolders('/work/canon', async () => '[]')()

    expect(held?.size).toBe(0)
  })

  it('should ignore a fork head spelled like a branch here', async () => {
    const held = await pullHolders('/work/canon', async () =>
      JSON.stringify([pull(12, 'feat/a', true)]),
    )()

    expect(held?.size).toBe(0)
  })

  it('should read as unread when gh cannot answer', async () => {
    const held = await pullHolders('/work/canon', async () => undefined)()

    expect(held).toBeUndefined()
  })

  it.each(['not json', '{}', '[{"number":12}]'])(
    'should read %s as unread',
    async (stdout) => {
      const held = await pullHolders('/work/canon', async () => stdout)()

      expect(held).toBeUndefined()
    },
  )

  it('should read a list reaching the limit as unread', async () => {
    const full = Array.from({ length: 1_000 }, (_, index) =>
      pull(index, `feat/${index}`),
    )

    const held = await pullHolders('/work/canon', async () =>
      JSON.stringify(full),
    )()

    expect(held).toBeUndefined()
  })
})
