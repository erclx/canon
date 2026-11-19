import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type ClientIds,
  clientEffects,
  executeReap,
  parseClientIds,
  planFinishedReap,
  planTaskReap,
  readTaskSessions,
  type ReapEffects,
  type RosterRow,
  type TaskSessions,
} from '@/sessions/reap'

const REPOSITORY = '/work/canon/.git'
const WORKER = '11111111-1111-4111-8111-111111111111'
const REVIEWER = '22222222-2222-4222-8222-222222222222'
const CALLER = '33333333-3333-4333-8333-333333333333'
const PLANNER = '44444444-4444-4444-8444-444444444444'
const HOUR = 60 * 60 * 1000

function row(overrides: Partial<RosterRow>): RosterRow {
  return {
    name: 'worker-canon-parser',
    pid: 1,
    sessionId: WORKER,
    cwd: '/work/canon',
    kind: 'bg',
    status: 'idle',
    via: 'pid',
    confidence: 'confirmed',
    startedAt: null,
    statusUpdatedAt: null,
    statusDwellMs: 2 * HOUR,
    repository: REPOSITORY,
    worktree: '/work/canon',
    branch: 'feat/parser',
    unresolved: null,
    stopped: null,
    ...overrides,
  }
}

function task(
  stem: string,
  state: TaskSessions['state'],
  ids: readonly string[],
): TaskSessions {
  return {
    stem,
    state,
    entries: ids.map((sessionId) => ({ name: `name-${sessionId}`, sessionId })),
  }
}

const GUARDS = { self: CALLER, keep: [] }

describe('planTaskReap', () => {
  it('should target an idle background session the task records', () => {
    const merged = task('v1.0-parser', 'archived', [WORKER])

    const plan = planTaskReap(merged, [row({})], [merged], GUARDS)

    expect(plan.targets).toEqual([
      { sessionId: WORKER, name: 'worker-canon-parser' },
    ])
    expect(plan.settled).toEqual([])
  })

  it('should read a recorded id the roster no longer holds as gone', () => {
    const merged = task('v1.0-parser', 'archived', [WORKER])

    const plan = planTaskReap(merged, [], [merged], GUARDS)

    expect(plan.settled).toEqual([
      {
        sessionId: WORKER,
        name: `name-${WORKER}`,
        outcome: 'gone',
        reason: null,
        detail: null,
      },
    ])
  })

  it.each([
    ['caller', row({ sessionId: CALLER }), CALLER, null],
    ['interactive', row({ kind: 'interactive' }), WORKER, 'interactive'],
    ['busy', row({ status: 'busy' }), WORKER, 'busy'],
    ['talk', row({ name: 'worker-canon-parser-talk' }), WORKER, null],
    [
      'controller',
      row({ name: 'orchestrator-canon' }),
      WORKER,
      'orchestrator-canon',
    ],
    ['usage-limit', row({ stopped: 'usage-limit' }), WORKER, null],
  ])(
    'should skip a %s session with its reason',
    (reason, session, id, detail) => {
      const merged = task('v1.0-parser', 'archived', [id])

      const plan = planTaskReap(merged, [session], [merged], GUARDS)

      expect(plan.targets).toEqual([])
      expect(plan.settled[0]).toMatchObject({
        outcome: 'skipped',
        reason,
        detail,
      })
    },
  )

  it('should target a recorded session holding a background shell', () => {
    const merged = task('v1.0-parser', 'archived', [WORKER])

    const plan = planTaskReap(
      merged,
      [row({ status: 'shell' })],
      [merged],
      GUARDS,
    )

    expect(plan.targets).toHaveLength(1)
  })

  it('should skip a session the caller keeps', () => {
    const merged = task('v1.0-parser', 'archived', [WORKER])

    const plan = planTaskReap(merged, [row({})], [merged], {
      self: CALLER,
      keep: [WORKER],
    })

    expect(plan.settled[0]).toMatchObject({ reason: 'kept' })
  })

  it('should skip a session an open task also records, naming that task', () => {
    const merged = task('v1.0-parser', 'archived', [WORKER])
    const open = task('v1.1-lexer', 'live', [WORKER])

    const plan = planTaskReap(merged, [row({})], [merged, open], GUARDS)

    expect(plan.settled[0]).toMatchObject({
      reason: 'open-task',
      detail: 'v1.1-lexer',
    })
  })

  it('should target the planner a live task records once its plan landed', () => {
    const landed = task('v1.2-plan', 'live', [PLANNER])

    const plan = planTaskReap(
      landed,
      [row({ sessionId: PLANNER, name: 'planner-canon-plan' })],
      [landed],
      GUARDS,
    )

    expect(plan.targets).toEqual([
      { sessionId: PLANNER, name: 'planner-canon-plan' },
    ])
  })

  it('should skip a session holding a background shell on a live task', () => {
    const open = task('v1.2-plan', 'live', [WORKER])

    const plan = planTaskReap(open, [row({ status: 'shell' })], [open], GUARDS)

    expect(plan.targets).toEqual([])
    expect(plan.settled[0]).toMatchObject({ reason: 'busy', detail: 'shell' })
  })

  it('should skip a reused planner another live task records', () => {
    const landed = task('v1.2-plan', 'live', [PLANNER])
    const next = task('v1.3-next', 'live', [PLANNER])

    const plan = planTaskReap(
      landed,
      [row({ sessionId: PLANNER, name: 'planner-canon-plan' })],
      [landed, next],
      GUARDS,
    )

    expect(plan.settled[0]).toMatchObject({
      reason: 'open-task',
      detail: 'v1.3-next',
    })
  })

  it('should never match a roster row by name alone', () => {
    const merged: TaskSessions = {
      stem: 'v1.0-parser',
      state: 'archived',
      entries: [{ name: 'worker-canon-parser', sessionId: REVIEWER }],
    }

    const plan = planTaskReap(merged, [row({})], [merged], GUARDS)

    expect(plan.targets).toEqual([])
    expect(plan.settled[0]).toMatchObject({ outcome: 'gone' })
  })
})

describe('planFinishedReap', () => {
  it('should target a session recorded only on settled tasks', () => {
    const tasks = [task('v1.0-parser', 'archived', [WORKER])]

    const plan = planFinishedReap(
      [row({ statusDwellMs: 0 })],
      tasks,
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan.targets).toEqual([
      { sessionId: WORKER, name: 'worker-canon-parser' },
    ])
  })

  it('should target an untasked session idle past the threshold', () => {
    const plan = planFinishedReap([row({})], [], GUARDS, REPOSITORY, HOUR)

    expect(plan.targets).toHaveLength(1)
  })

  it('should skip an untasked session holding a background shell', () => {
    const plan = planFinishedReap(
      [row({ status: 'shell' })],
      [],
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan.settled[0]).toMatchObject({ reason: 'busy', detail: 'shell' })
  })

  it('should skip an untasked session idle under the threshold', () => {
    const plan = planFinishedReap(
      [row({ statusDwellMs: 10 * 60 * 1000 })],
      [],
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan.settled[0]).toMatchObject({ reason: 'recent', detail: '10m' })
  })

  it('should skip an untasked session with no measured dwell', () => {
    const plan = planFinishedReap(
      [row({ statusDwellMs: null })],
      [],
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan.settled[0]).toMatchObject({
      reason: 'recent',
      detail: 'unmeasured',
    })
  })

  it('should leave a session stopped at a usage limit alone', () => {
    const plan = planFinishedReap(
      [row({ stopped: 'usage-limit' })],
      [],
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan.settled[0]).toMatchObject({ reason: 'usage-limit' })
  })

  it('should not list a session in another repository or an interactive one', () => {
    const plan = planFinishedReap(
      [
        row({ repository: '/work/other/.git' }),
        row({ sessionId: REVIEWER, kind: 'interactive' }),
      ],
      [],
      GUARDS,
      REPOSITORY,
      HOUR,
    )

    expect(plan).toEqual({ settled: [], targets: [] })
  })
})

/** The short id the client lists a session under, its first eight characters. */
function short(sessionId: string): string {
  return sessionId.slice(0, 8)
}

function effects(
  live: string[],
  vanish: boolean,
  listed: ClientIds = new Map(live.map((id) => [id, short(id)])),
): ReapEffects & { calls: string[] } {
  const calls: string[] = []
  const held = new Set(live)
  const byShort = new Map(
    [...(listed ?? new Map<string, string>())].map(([full, id]) => [id, full]),
  )
  return {
    clientIds: async () => listed,
    calls,
    run: async (verb, id) => {
      calls.push(`${verb} ${id}`)
      const full = byShort.get(id)
      if (vanish && full !== undefined) held.delete(full)
      return { exitCode: vanish ? 0 : 1, output: 'No session matching\n' }
    },
    live: async () => held,
    pause: async () => {},
  }
}

describe('executeReap', () => {
  const target = { sessionId: WORKER, name: 'worker-canon-parser' }

  it('should stop a target and read it stopped once the roster drops it', async () => {
    const fake = effects([WORKER], true)

    const rows = await executeReap([target], false, false, fake)

    expect(fake.calls).toEqual(['stop 11111111'])
    expect(rows[0]).toMatchObject({ outcome: 'stopped', clientId: '11111111' })
  })

  it('should run the client remove in place of its stop under remove', async () => {
    const fake = effects([WORKER], true)

    const rows = await executeReap([target], true, false, fake)

    expect(fake.calls).toEqual(['rm 11111111'])
    expect(rows[0]).toMatchObject({ outcome: 'removed' })
  })

  it('should run no client command on a dry run and report the id it would pass', async () => {
    const fake = effects([WORKER], true)

    const rows = await executeReap([target], true, true, fake)

    expect(fake.calls).toEqual([])
    expect(rows[0]).toMatchObject({
      outcome: 'would-remove',
      clientId: '11111111',
    })
  })

  it('should read a live session the client does not list as failed, running nothing', async () => {
    const fake = effects([WORKER], true, new Map())

    const rows = await executeReap([target], false, false, fake)

    expect(fake.calls).toEqual([])
    expect(rows[0]).toMatchObject({
      outcome: 'failed',
      clientId: null,
      detail: expect.stringContaining('lists no session'),
    })
  })

  it('should read an unlisted session the roster also dropped as gone', async () => {
    const fake = effects([], true, new Map())

    const rows = await executeReap([target], false, false, fake)

    expect(fake.calls).toEqual([])
    expect(rows[0]).toMatchObject({ outcome: 'gone', clientId: null })
  })

  it('should read a failed client listing as failed, running nothing', async () => {
    const fake = {
      ...effects([WORKER], true),
      clientIds: async () => undefined,
    }

    const rows = await executeReap([target], false, true, fake)

    expect(fake.calls).toEqual([])
    expect(rows[0]).toMatchObject({
      outcome: 'failed',
      detail: expect.stringContaining('could not be read'),
    })
  })

  it('should read a session still on the roster as failed with the output', async () => {
    const fake = effects([WORKER], false)

    const rows = await executeReap([target], false, false, fake)

    expect(rows[0]).toMatchObject({
      outcome: 'failed',
      detail: 'No session matching',
    })
  })
})

describe('parseClientIds', () => {
  it('should map each listed sessionId to the short id the client lists', () => {
    const ids = parseClientIds(
      JSON.stringify([
        { id: '11111111', sessionId: WORKER, kind: 'background' },
        { pid: 9, sessionId: REVIEWER, kind: 'interactive' },
      ]),
    )

    expect(ids).toEqual(new Map([[WORKER, '11111111']]))
  })

  it('should read output that is not a JSON array as unreadable', () => {
    expect(parseClientIds('{"error":"no daemon"}')).toBeUndefined()
  })

  it('should read text that is not JSON as unreadable', () => {
    expect(parseClientIds('daemon not running')).toBeUndefined()
  })
})

describe('clientEffects', () => {
  const standIn = join(import.meta.dirname, 'fixtures', 'claude-stand-in.sh')

  it('should stop a session through a client that matches the short id alone', async () => {
    const client = clientEffects(standIn)
    const held = new Set([WORKER])
    const fake: ReapEffects = {
      ...client,
      run: async (verb, id) => {
        const result = await client.run(verb, id)
        if (result.exitCode === 0) held.delete(WORKER)
        return result
      },
      live: async () => held,
      pause: async () => {},
    }

    const rows = await executeReap(
      [{ sessionId: WORKER, name: 'worker-canon-parser' }],
      false,
      false,
      fake,
    )

    expect(rows[0]).toMatchObject({ outcome: 'stopped', clientId: '11111111' })
  })

  it('should be refused by that client when handed the full sessionId', async () => {
    const result = await clientEffects(standIn).run('stop', WORKER)

    expect(result.exitCode).toBe(1)
  })

  it('should read a client binary that cannot run as an unreadable listing', async () => {
    const ids = await clientEffects(
      join(tmpdir(), 'no-such-claude'),
    ).clientIds()

    expect(ids).toBeUndefined()
  })
})

describe('readTaskSessions', () => {
  let root = ''

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('should read the Sessions line from live and archived tasks alike', async () => {
    root = mkdtempSync(join(tmpdir(), 'reap-'))
    const tasks = join(root, '.canon', 'tasks')
    mkdirSync(join(tasks, 'archive'), { recursive: true })
    writeFileSync(
      join(tasks, 'v1.1-lexer.md'),
      `# Lexer\n\nSessions: worker-a (${WORKER})\n`,
    )
    writeFileSync(
      join(tasks, 'archive', 'v1.0-parser.md'),
      `# Parser\n\nSessions: reviewer-b (${REVIEWER})\n`,
    )

    const read = await readTaskSessions(root)

    expect(read).toEqual([
      {
        stem: 'v1.1-lexer',
        state: 'live',
        entries: [{ name: 'worker-a', sessionId: WORKER }],
      },
      {
        stem: 'v1.0-parser',
        state: 'archived',
        entries: [{ name: 'reviewer-b', sessionId: REVIEWER }],
      },
    ])
  })
})
