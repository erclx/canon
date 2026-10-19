import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LivenessProbes } from '@/sessions/live'
import {
  callerIdentity,
  type Located,
  type ResolvedSession,
  resolveSessions,
  selfOf,
} from '@/sessions/resolve'

let DIR: string

beforeEach(() => {
  DIR = mkdtempSync(join(tmpdir(), 'canon-resolve-'))
})

afterEach(() => {
  rmSync(DIR, { recursive: true, force: true })
})

function seed(pid: number, fields: Record<string, unknown> = {}): void {
  writeFileSync(
    join(DIR, `${pid}.json`),
    JSON.stringify({
      pid,
      sessionId: `id-${pid}`,
      cwd: `/repo/worktrees/w${pid}`,
      name: `canon-${pid}`,
      kind: 'interactive',
      status: 'idle',
      startedAt: pid,
      procStart: String(pid * 10),
      ...fields,
    }),
  )
}

/** Every seeded pid confirmed live, which is the ordinary machine. */
const ALIVE: LivenessProbes = {
  procStartOf: (pid) => String(pid * 10),
  responds: () => true,
}

/** No process filesystem, which is the platform the fallback exists for. */
const NO_PROC: LivenessProbes = {
  procStartOf: () => null,
  responds: () => true,
}

function locating(branch: string | null): (cwd: string) => Promise<Located> {
  return async (cwd) =>
    branch === null
      ? {
          repository: '/repo/.git',
          worktree: cwd,
          branch: null,
          unresolved: 'detached-head',
        }
      : { repository: '/repo/.git', worktree: cwd, branch, unresolved: null }
}

describe('resolveSessions', () => {
  it('should pass an absent registry through rather than reporting no sessions', async () => {
    const report = await resolveSessions({ dir: join(DIR, 'nowhere') })

    expect(report.kind).toBe('absent')
  })

  it('should name the branch each live session holds', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions[0]).toMatchObject({
      name: 'canon-100',
      branch: 'feat/parser',
      unresolved: null,
    })
  })

  it('should drop a record whose session has ended', async () => {
    seed(100)
    seed(200)

    const report = await resolveSessions({
      dir: DIR,
      probes: {
        procStartOf: (pid) => (pid === 100 ? '1000' : 'reused'),
        responds: () => true,
      },
      locate: locating('feat/parser'),
    })

    expect(
      report.kind === 'resolved' && report.sessions.map((s) => s.pid),
    ).toEqual([100])
  })

  it('should report confirmed confidence where start times were read', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.confidence).toBe('confirmed')
  })

  it('should report unverified confidence where the process read is unavailable', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: NO_PROC,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.confidence).toBe('unverified')
  })

  it('should keep a session whose branch cannot be read and say why', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating(null),
    })

    expect(report.kind === 'resolved' && report.sessions[0]).toMatchObject({
      branch: null,
      unresolved: 'detached-head',
    })
  })

  it('should carry the working directory each session reported', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions[0]?.cwd).toBe(
      '/repo/worktrees/w100',
    )
  })

  it('should carry the repository each session belongs to', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions[0]?.repository).toBe(
      '/repo/.git',
    )
  })

  it('should report an absent start time as absent rather than as 1970', async () => {
    seed(100, { startedAt: undefined })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(
      report.kind === 'resolved' && report.sessions[0]?.startedAt,
    ).toBeNull()
  })

  it('should report an absent session identifier as absent rather than as empty', async () => {
    seed(100, { sessionId: undefined })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(
      report.kind === 'resolved' && report.sessions[0]?.sessionId,
    ).toBeNull()
  })

  it('should report no live session on a registry holding only ended ones', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: { procStartOf: () => 'other', responds: () => false },
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toHaveLength(0)
  })

  it("should report the dwell elapsed since the record's own status stamp", async () => {
    seed(100, { statusUpdatedAt: 1_000 })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
      now: () => 61_000,
    })

    expect(report.kind === 'resolved' && report.sessions[0]).toMatchObject({
      statusUpdatedAt: new Date(1_000).toISOString(),
      statusDwellMs: 60_000,
    })
  })

  it('should report a dwell as absent when neither stamp is present', async () => {
    seed(100, { statusUpdatedAt: undefined, updatedAt: undefined })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions[0]).toMatchObject({
      statusUpdatedAt: null,
      statusDwellMs: null,
    })
  })

  it('should fall back to updatedAt for the dwell when statusUpdatedAt is absent', async () => {
    seed(100, { statusUpdatedAt: undefined, updatedAt: 1_000 })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
      now: () => 61_000,
    })

    expect(
      report.kind === 'resolved' && report.sessions[0]?.statusDwellMs,
    ).toBe(60_000)
  })

  it('should keep statusUpdatedAt null on a fallback dwell rather than borrowing updatedAt', async () => {
    seed(100, { statusUpdatedAt: undefined, updatedAt: 1_000 })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
      now: () => 61_000,
    })

    expect(
      report.kind === 'resolved' && report.sessions[0]?.statusUpdatedAt,
    ).toBeNull()
  })

  it('should clamp a stamp ahead of the clock to zero rather than a negative dwell', async () => {
    seed(100, { statusUpdatedAt: 120_000 })

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
      now: () => 60_000,
    })

    expect(
      report.kind === 'resolved' && report.sessions[0]?.statusDwellMs,
    ).toBe(0)
  })
})

/** A resolved row, which the self read matches against rather than a record. */
function row(pid: number, sessionId: string | null): ResolvedSession {
  return {
    name: `canon-${pid}`,
    pid,
    sessionId,
    cwd: `/repo/worktrees/w${pid}`,
    kind: 'interactive',
    status: 'idle',
    via: 'pid',
    startedAt: null,
    statusUpdatedAt: null,
    statusDwellMs: null,
    repository: '/repo/.git',
    worktree: `/repo/worktrees/w${pid}`,
    branch: 'feat/parser',
    unresolved: null,
  }
}

describe('resolveSessions from another pid namespace', () => {
  const FOREIGN = {
    pidDomain: 'linux:abc:pid:[4026532999]',
    messagingSocketPath: '/run/user/1000/cc-socks/100.sock',
  }

  function reader(socketExists: boolean): LivenessProbes {
    return {
      procStartOf: () => null,
      responds: () => false,
      ownDomain: () => 'pid:[4026532221]',
      socketExists: () => socketExists,
    }
  }

  it('should keep a foreign row whose socket exists and mark it as socket evidence', async () => {
    seed(100, FOREIGN)

    const report = await resolveSessions({
      dir: DIR,
      probes: reader(true),
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toMatchObject([
      { pid: 100, via: 'socket' },
    ])
    expect(report.kind === 'resolved' && report.confidence).toBe('unverified')
  })

  it('should count a foreign row whose socket is gone rather than listing it', async () => {
    seed(100, FOREIGN)

    const report = await resolveSessions({
      dir: DIR,
      probes: reader(false),
      locate: locating('feat/parser'),
    })

    expect(report).toMatchObject({
      kind: 'resolved',
      sessions: [],
      foreignDead: 1,
    })
  })

  it('should leave a same-namespace dead row out of the foreign count', async () => {
    seed(100, { ...FOREIGN, pidDomain: 'linux:abc:pid:[4026532221]' })

    const report = await resolveSessions({
      dir: DIR,
      probes: { ...reader(true), procStartOf: () => 'other' },
      locate: locating('feat/parser'),
    })

    expect(report).toMatchObject({
      kind: 'resolved',
      sessions: [],
      foreignDead: 0,
    })
  })

  it('should mark an ordinary row as decided by its pid', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: ALIVE,
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions[0]?.via).toBe('pid')
  })
})

describe('callerIdentity', () => {
  it('should take the session identifier the environment states outright', () => {
    const identity = callerIdentity({
      CLAUDE_CODE_SESSION_ID: 'id-100',
      CLAUDE_PID: '100',
    })

    expect(identity.sessionId).toBe('id-100')
  })

  it('should ignore the host session identifier, which spells another namespace', () => {
    const identity = callerIdentity({
      CLAUDE_CODE_HOST_SESSION_ID: 'local_e718444b-11a0-4301-a383-bfb3500bd33a',
    })

    expect(identity.sessionId).toBeNull()
  })

  it('should read the pid off the messaging socket where none is stated', () => {
    const identity = callerIdentity({
      CLAUDE_CODE_MESSAGING_SOCKET: '/run/user/1000/cc-socks/100.sock',
    })

    expect(identity.pid).toBe(100)
  })

  it('should prefer the stated pid over the one the socket path spells', () => {
    const identity = callerIdentity({
      CLAUDE_PID: '100',
      CLAUDE_CODE_MESSAGING_SOCKET: '/run/user/1000/cc-socks/200.sock',
    })

    expect(identity.pid).toBe(100)
  })

  it('should report a socket basename that is not a pid as no pid at all', () => {
    const identity = callerIdentity({
      CLAUDE_CODE_MESSAGING_SOCKET: '/run/user/1000/cc-socks/peer.sock',
    })

    expect(identity.pid).toBeNull()
  })

  it('should report an environment carrying nothing as carrying no identity', () => {
    expect(callerIdentity({})).toEqual({ sessionId: null, pid: null })
  })
})

describe('selfOf', () => {
  it('should name the row the session identifier matches', () => {
    const report = selfOf([row(100, 'id-100'), row(200, 'id-200')], {
      sessionId: 'id-200',
      pid: null,
    })

    expect(report.kind === 'self' && report.session.pid).toBe(200)
  })

  it('should name the row the pid matches where no identifier is carried', () => {
    const report = selfOf([row(100, 'id-100'), row(200, 'id-200')], {
      sessionId: null,
      pid: 100,
    })

    expect(report.kind === 'self' && report.session.pid).toBe(100)
  })

  it('should prefer the identifier match over a row carrying the same pid', () => {
    const report = selfOf([row(100, 'id-100'), row(200, 'id-200')], {
      sessionId: 'id-200',
      pid: 100,
    })

    expect(report.kind === 'self' && report.session.sessionId).toBe('id-200')
  })

  it('should refuse with a named reason where the environment carries no identity', () => {
    const report = selfOf([row(100, 'id-100')], { sessionId: null, pid: null })

    expect(report.kind === 'unresolved' && report.reason).toBe('no-identity')
  })

  it('should refuse with a named reason where no live row carries the caller', () => {
    const report = selfOf([row(100, 'id-100')], {
      sessionId: 'id-900',
      pid: 900,
    })

    expect(report.kind === 'unresolved' && report.reason).toBe('no-row')
  })
})

describe('resolveSessions with a listener probe', () => {
  const SOCKET = '/run/user/1000/cc-socks/100.sock'

  function reader(
    accepting: readonly string[],
    fields: Partial<LivenessProbes> = {},
  ): LivenessProbes {
    return {
      ...NO_PROC,
      listens: async (path) => accepting.includes(path),
      ...fields,
    }
  }

  it('should confirm an unverified row whose socket accepts and mark it as listener', async () => {
    seed(100, { messagingSocketPath: SOCKET })

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([SOCKET]),
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toMatchObject([
      { pid: 100, via: 'listener' },
    ])
    expect(report.kind === 'resolved' && report.confidence).toBe('confirmed')
  })

  it('should leave a row unverified when its socket refuses', async () => {
    seed(100, { messagingSocketPath: SOCKET })

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([]),
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toMatchObject([
      { via: 'pid' },
    ])
    expect(report.kind === 'resolved' && report.confidence).toBe('unverified')
  })

  it('should leave a row with no socket path exactly as it was', async () => {
    seed(100)

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([SOCKET]),
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toMatchObject([
      { via: 'pid' },
    ])
    expect(report.kind === 'resolved' && report.confidence).toBe('unverified')
  })

  it('should never probe a row the start time already confirmed', async () => {
    seed(100, { messagingSocketPath: SOCKET })
    const probed: string[] = []

    const report = await resolveSessions({
      dir: DIR,
      probes: {
        ...ALIVE,
        listens: async (path) => {
          probed.push(path)
          return true
        },
      },
      locate: locating('feat/parser'),
    })

    expect(probed).toEqual([])
    expect(report.kind === 'resolved' && report.sessions[0]?.via).toBe('pid')
  })

  it('should never probe or upgrade a dead pid', async () => {
    seed(100, { messagingSocketPath: SOCKET })

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([SOCKET], { responds: () => false }),
      locate: locating('feat/parser'),
    })

    expect(report).toMatchObject({ kind: 'resolved', sessions: [] })
  })

  it('should report unverified while any live row stays unconfirmed in a mixed roster', async () => {
    const other = '/run/user/1000/cc-socks/200.sock'
    seed(100, { messagingSocketPath: SOCKET })
    seed(200, { messagingSocketPath: other })

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([SOCKET]),
      locate: locating('feat/parser'),
    })

    expect(
      report.kind === 'resolved' &&
        Object.fromEntries(report.sessions.map((s) => [s.pid, s.via])),
    ).toEqual({ 100: 'listener', 200: 'pid' })
    expect(report.kind === 'resolved' && report.confidence).toBe('unverified')
  })

  it('should confirm a foreign row whose socket accepts and drop its socket mark', async () => {
    seed(100, {
      pidDomain: 'linux:abc:pid:[4026532999]',
      messagingSocketPath: SOCKET,
    })

    const report = await resolveSessions({
      dir: DIR,
      probes: reader([SOCKET], {
        ownDomain: () => 'pid:[4026532221]',
        socketExists: () => true,
      }),
      locate: locating('feat/parser'),
    })

    expect(report.kind === 'resolved' && report.sessions).toMatchObject([
      { via: 'listener' },
    ])
    expect(report.kind === 'resolved' && report.confidence).toBe('confirmed')
  })
})
