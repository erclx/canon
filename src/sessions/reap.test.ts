import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  executeReap,
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
    ['busy', row({ status: 'shell' }), WORKER, 'shell'],
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

  it('should target the planner of a live task whose plan landed', () => {
    const landed = task('v1.2-plan', 'live', [WORKER])

    const plan = planTaskReap(landed, [row({})], [landed], GUARDS)

    expect(plan.targets).toHaveLength(1)
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

function effects(
  live: string[],
  vanish: boolean,
): ReapEffects & { calls: string[] } {
  const calls: string[] = []
  const held = new Set(live)
  return {
    calls,
    run: async (verb, id) => {
      calls.push(`${verb} ${id}`)
      if (vanish) held.delete(id)
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

    expect(fake.calls).toEqual([`stop ${WORKER}`])
    expect(rows[0]).toMatchObject({ outcome: 'stopped' })
  })

  it('should run the client remove in place of its stop under remove', async () => {
    const fake = effects([WORKER], true)

    const rows = await executeReap([target], true, false, fake)

    expect(fake.calls).toEqual([`rm ${WORKER}`])
    expect(rows[0]).toMatchObject({ outcome: 'removed' })
  })

  it('should run no client command on a dry run', async () => {
    const fake = effects([WORKER], true)

    const rows = await executeReap([target], true, true, fake)

    expect(fake.calls).toEqual([])
    expect(rows[0]).toMatchObject({ outcome: 'would-remove' })
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
