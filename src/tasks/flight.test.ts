import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksDir } from '@/tasks/archive'
import { type FlightReaders, readFlight, stageOfLift } from '@/tasks/flight'
import { orderingPath } from '@/tasks/validate'

let ROOT: string

const WORKER = '22222222-2222-4222-8222-222222222222'

interface TaskLines {
  readonly sessions?: string
  readonly pullRequest?: string
}

async function seedTask(stem: string, lines: TaskLines = {}): Promise<void> {
  const body = [
    `# ${stem}`,
    '',
    ...(lines.pullRequest ? [`Pull request: ${lines.pullRequest}`] : []),
    ...(lines.sessions ? [`Sessions: ${lines.sessions}`] : []),
    '',
    '## Outcomes',
    '',
    '- [ ] it ships',
    '',
  ]
  await writeFile(join(tasksDir(ROOT), `${stem}.md`), body.join('\n'))
}

async function seedBoard(...stems: readonly string[]): Promise<void> {
  await writeFile(
    orderingPath(ROOT),
    [
      '# Priority',
      '',
      '## In flight',
      '',
      '| Task | Touches | Session |',
      '| ---- | ------- | ------- |',
      ...stems.map((stem) => `| [${stem}](${stem}.md) |  | x |`),
      '',
    ].join('\n'),
  )
}

function readers(
  live: readonly string[] | undefined,
  pulls: Readonly<Record<number, string>> = {},
): FlightReaders {
  return {
    roster: async () => (live ? new Set(live) : undefined),
    pull: async (number) => {
      const reason = pulls[number]
      return reason === undefined ? undefined : { reason }
    },
  }
}

async function stageOf(reading: FlightReaders): Promise<string | undefined> {
  const outcome = await readFlight(ROOT, reading)
  return outcome.ok ? outcome.rows[0]?.stage : outcome.reason
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-flight-'))
  mkdirSync(tasksDir(ROOT), { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readFlight', () => {
  it('should read building for a live session with no pull request', async () => {
    await seedTask('v1.0-one', { sessions: `worker-one (${WORKER})` })
    await seedBoard('v1.0-one')

    expect(await readFlight(ROOT, readers([WORKER]))).toEqual({
      ok: true,
      rows: [
        {
          task: 'v1.0-one',
          session: { name: 'worker-one', sessionId: WORKER },
          live: true,
          pullRequest: null,
          stage: 'building',
          reason: null,
        },
      ],
    })
  })

  it('should read stopped for a recorded session the roster no longer lists', async () => {
    await seedTask('v1.0-one', { sessions: `worker-one (${WORKER})` })
    await seedBoard('v1.0-one')

    expect(await stageOf(readers([]))).toBe('stopped')
  })

  it('should read unrecorded for a task naming no session', async () => {
    await seedTask('v1.0-one')
    await seedBoard('v1.0-one')

    expect(await stageOf(readers([WORKER]))).toBe('unrecorded')
  })

  it('should read unread rather than stopped when the roster fails', async () => {
    await seedTask('v1.0-one', { sessions: `worker-one (${WORKER})` })
    await seedBoard('v1.0-one')

    expect(await stageOf(readers(undefined))).toBe('unread')
  })

  it('should read the stage off the last pull request the task records', async () => {
    await seedTask('v1.0-one', {
      sessions: `worker-one (${WORKER})`,
      pullRequest: '#12, #40',
    })
    await seedBoard('v1.0-one')

    const outcome = await readFlight(
      ROOT,
      readers([WORKER], { 12: 'pull-closed', 40: 'review-open' }),
    )

    expect(outcome.ok && outcome.rows[0]).toMatchObject({
      pullRequest: 40,
      stage: 'reviewing',
      reason: 'review-open',
    })
  })

  it('should read unread when the pull request check fails', async () => {
    await seedTask('v1.0-one', { pullRequest: '#40' })
    await seedBoard('v1.0-one')

    expect(await stageOf(readers([WORKER]))).toBe('unread')
  })

  it('should keep board order across rows', async () => {
    await seedTask('v1.0-one')
    await seedTask('v2.0-two')
    await seedBoard('v2.0-two', 'v1.0-one')

    const outcome = await readFlight(ROOT, readers([]))

    expect(outcome.ok && outcome.rows.map((row) => row.task)).toEqual([
      'v2.0-two',
      'v1.0-one',
    ])
  })

  it('should refuse a project with no ordering file', async () => {
    expect(await stageOf(readers([]))).toBe('no-ordering')
  })
})

describe('stageOfLift', () => {
  it.each([
    ['clear', 'mergeable'],
    ['already-ready', 'mergeable'],
    ['pull-closed', 'closed'],
    ['ui-undriven', 'reviewing'],
    ['evidence-owed', 'reviewing'],
    ['painted-uncaptured', 'reviewing'],
    ['ci-failing', 'checks'],
    ['standing-stale', 'rebase'],
    ['standing-unknown', 'unread'],
    ['gh-failed', 'unread'],
  ])('should read %s as %s', (reason, stage) => {
    expect(stageOfLift(reason)).toBe(stage)
  })
})
