import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type LabelOutcome, claimLabel, nextLabel } from '@/tasks/label'
import type {
  ForeignRecord,
  ResolvedSession,
  SessionReport,
} from '@/sessions/resolve'

const NOW = Date.parse('2026-11-22T10:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000

let ROOT: string

function assertOk(
  outcome: LabelOutcome,
): asserts outcome is Extract<LabelOutcome, { ok: true }> {
  expect(outcome.ok).toBe(true)
}

async function seed(dir: string, ...stems: string[]): Promise<void> {
  mkdirSync(dir, { recursive: true })
  await Promise.all(
    stems.map((stem) => writeFile(join(dir, `${stem}.md`), '', 'utf8')),
  )
}

function lockDir(label: string): string {
  return join(ROOT, '.canon', 'ordinal-locks', label)
}

function ownedLock(label: string, sessionId: string): void {
  mkdirSync(lockDir(label), { recursive: true })
  writeFileSync(
    join(lockDir(label), 'claim.json'),
    JSON.stringify({ sessionId, claimedAt: '2026-11-22T09:59:00.000Z' }),
  )
}

function ownerlessLock(label: string, ageMs: number): void {
  mkdirSync(lockDir(label), { recursive: true })
  const at = new Date(NOW - ageMs)
  utimesSync(lockDir(label), at, at)
}

function roster(
  liveIds: string[],
  foreign: Partial<ForeignRecord>[] = [],
): () => Promise<SessionReport> {
  return async () => ({
    kind: 'resolved',
    dir: '/sessions',
    confidence: 'confirmed',
    foreignDead: foreign.length,
    foreign: foreign.map((record) => ({
      sessionId: null,
      pid: 1,
      cwd: '/',
      path: '/sessions/1.json',
      startedAt: null,
      ...record,
    })),
    sessions: liveIds.map(
      (sessionId) => ({ sessionId }) as unknown as ResolvedSession,
    ),
  })
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-label-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('nextLabel', () => {
  it('should refuse a board that does not exist', async () => {
    const outcome = await nextLabel(ROOT)

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.reason).toBe('no-board')
  })

  it('should allocate v01.0 for a board holding no label yet', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'index', 'priority', 'backlog')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v01.0')
    expect(outcome.highest).toBeUndefined()
  })

  it('should increment the minor digit off the live board alone', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v03.2-something')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.highest).toBe('v03.2')
    expect(outcome.label).toBe('v03.3')
  })

  it('should read a label held only in the archive', async () => {
    await seed(join(ROOT, '.canon', 'tasks'))
    await seed(join(ROOT, '.canon', 'tasks', 'archive'), 'v12.4-archived-work')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v12.5')
  })

  it('should tolerate an absent archive folder', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v05.0-solo-target')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v05.1')
  })

  it('should take the true maximum across a gap a naive count would miss', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v02.0-first')
    await seed(
      join(ROOT, '.canon', 'tasks', 'archive'),
      'v02.1-second',
      'v07.3-far-ahead',
    )

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v07.4')
  })

  it('should roll a minor of 9 to the next major', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v04.9-last-of-its-major')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v05.0')
  })

  it('should tolerate a label already claimed by two different files', async () => {
    await seed(
      join(ROOT, '.canon', 'tasks'),
      'v06.0-first-claim',
      'v06.0-second-claim',
    )

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.highest).toBe('v06.0')
    expect(outcome.label).toBe('v06.1')
  })

  it('should skip the non-label siblings each folder carries', async () => {
    await seed(
      join(ROOT, '.canon', 'tasks'),
      'index',
      'priority',
      'backlog',
      'session-handoff',
      'v08.1-real-task',
    )
    await seed(join(ROOT, '.canon', 'tasks', 'archive'), 'TASK-ARCHIVE')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v08.2')
  })

  it('should read a label held only in the declined folder', async () => {
    await seed(join(ROOT, '.canon', 'tasks'))
    await seed(join(ROOT, '.canon', 'tasks', 'declined'), 'v09.3-declined-work')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v09.4')
  })

  it('should take the true maximum across the archive and declined folders both', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v02.0-first')
    await seed(join(ROOT, '.canon', 'tasks', 'archive'), 'v02.1-second')
    await seed(join(ROOT, '.canon', 'tasks', 'declined'), 'v07.3-far-ahead')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v07.4')
  })

  it('should report a reservation above the highest stem without claiming', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    mkdirSync(join(ROOT, '.canon', 'ordinal-locks', 'v01.4'), {
      recursive: true,
    })

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.reservations).toEqual([
      { label: 'v01.4', sessionId: null, claimedAt: null },
    ])
    expect(outcome.released).toEqual([])
  })

  it('should tolerate an absent declined folder', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v05.0-solo-target')

    const outcome = await nextLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v05.1')
  })
})

describe('claimLabel', () => {
  it('should return different labels for two claims taken back to back', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v03.2-something')

    const first = await claimLabel(ROOT)
    const second = await claimLabel(ROOT)

    assertOk(first)
    assertOk(second)
    expect(first.label).toBe('v03.3')
    expect(second.label).toBe('v03.4')
  })

  it('should return different labels for claims taken at once', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v03.2-something')

    const outcomes = await Promise.all([
      claimLabel(ROOT),
      claimLabel(ROOT),
      claimLabel(ROOT),
    ])

    const labels = outcomes.map((outcome) => outcome.ok && outcome.label)
    expect(new Set(labels).size).toBe(3)
  })

  it('should count a reservation with no file behind it toward the next scan', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    mkdirSync(join(ROOT, '.canon', 'ordinal-locks', 'v05.2'), {
      recursive: true,
    })

    const outcome = await claimLabel(ROOT)

    assertOk(outcome)
    expect(outcome.label).toBe('v05.3')
  })

  it('should report the claim in the record and leave a bare read unclaimed', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')

    const claimed = await claimLabel(ROOT)
    const peeked = await nextLabel(ROOT)

    assertOk(claimed)
    assertOk(peeked)
    expect(claimed.claimed).toBe(true)
    expect(peeked.claimed).toBe(false)
    expect(peeked.label).toBe('v01.1')
  })

  it('should stamp the claiming session and time into its lock', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')

    await claimLabel(ROOT, {
      sessionId: 'session-a',
      now: () => Date.parse('2026-11-22T10:00:00.000Z'),
    })

    const owner = JSON.parse(
      readFileSync(
        join(ROOT, '.canon', 'ordinal-locks', 'v01.1', 'claim.json'),
        'utf8',
      ),
    )
    expect(owner).toEqual({
      sessionId: 'session-a',
      claimedAt: '2026-11-22T10:00:00.000Z',
    })
  })

  it('should report each reservation above the highest stem with its owner', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    mkdirSync(join(ROOT, '.canon', 'ordinal-locks', 'v00.9'), {
      recursive: true,
    })

    const outcome = await claimLabel(ROOT, {
      sessionId: 'session-a',
      now: () => Date.parse('2026-11-22T10:00:00.000Z'),
    })

    assertOk(outcome)
    expect(outcome.reservations).toEqual([
      {
        label: 'v01.1',
        sessionId: 'session-a',
        claimedAt: '2026-11-22T10:00:00.000Z',
      },
    ])
  })

  it('should refuse a board that does not exist', async () => {
    const outcome = await claimLabel(ROOT)

    expect(outcome.ok === false && outcome.reason).toBe('no-board')
  })

  it('should refuse as contended once every attempt loses its reservation', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')

    const outcome = await claimLabel(ROOT, { reserve: async () => false })

    expect(outcome.ok === false && outcome.reason).toBe('label-contended')
  })
})

describe('claimLabel releasing dead claims', () => {
  it('should release a dead claim above the highest stem and reissue its label', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.1', 'gone-session')
    ownedLock('v01.2', 'gone-session')

    const outcome = await claimLabel(ROOT, {
      sessionId: 'session-a',
      now: () => NOW,
      sessions: roster(['session-a']),
    })

    assertOk(outcome)
    expect(outcome.label).toBe('v01.1')
    expect(outcome.released).toEqual(['v01.1', 'v01.2'])
    expect(existsSync(lockDir('v01.2'))).toBe(false)
  })

  it('should keep a claim whose session is live', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.1', 'planner-session')

    const outcome = await claimLabel(ROOT, {
      sessionId: 'session-a',
      now: () => NOW,
      sessions: roster(['planner-session']),
    })

    assertOk(outcome)
    expect(outcome.label).toBe('v01.2')
    expect(outcome.released).toEqual([])
  })

  it('should keep a dead claim whose label names a task file', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.0', 'gone-session')

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: roster([]),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual([])
    expect(existsSync(lockDir('v01.0'))).toBe(true)
  })

  it('should leave a dead claim below the highest stem', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v00.5', 'gone-session')

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: roster([]),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual([])
    expect(existsSync(lockDir('v00.5'))).toBe(true)
  })

  it('should release an ownerless lock past an hour', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownerlessLock('v01.1', HOUR_MS + 1)

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: roster([]),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual(['v01.1'])
    expect(outcome.label).toBe('v01.1')
  })

  it('should keep an ownerless lock inside an hour', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownerlessLock('v01.1', HOUR_MS - 60_000)

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: roster([]),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual([])
    expect(outcome.label).toBe('v01.2')
  })

  it('should keep an owned claim when the roster cannot be read', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.1', 'unknown-session')

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: async () => ({ kind: 'absent', dir: '/sessions' }),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual([])
  })

  it('should keep an owned claim the roster holds as an unchecked foreign record', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.1', 'foreign-session')

    const outcome = await claimLabel(ROOT, {
      now: () => NOW,
      sessions: roster([], [{ sessionId: 'foreign-session' }]),
    })

    assertOk(outcome)
    expect(outcome.released).toEqual([])
  })

  it('should never read or remove a numeric record lock', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownerlessLock('0042', HOUR_MS * 48)

    await claimLabel(ROOT, { now: () => NOW, sessions: roster([]) })

    expect(existsSync(lockDir('0042'))).toBe(true)
  })

  it('should hand a freed label to one of several racing claims', async () => {
    await seed(join(ROOT, '.canon', 'tasks'), 'v01.0-first')
    ownedLock('v01.1', 'gone-session')
    const options = {
      sessionId: 'racer',
      now: () => NOW,
      sessions: roster(['racer']),
    }

    const outcomes = await Promise.all([
      claimLabel(ROOT, options),
      claimLabel(ROOT, options),
      claimLabel(ROOT, options),
    ])

    const labels = outcomes.map((outcome) => outcome.ok && outcome.label)
    expect(new Set(labels).size).toBe(3)
    expect(labels).toContain('v01.1')
  })
})
