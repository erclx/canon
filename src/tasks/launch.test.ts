import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksDir } from '@/tasks/archive'
import type { LaunchPick } from '@/tasks/board'
import { belowEffortFloor, writeLaunch } from '@/tasks/launch'
import { orderingPath } from '@/tasks/validate'

let ROOT: string

const PICK: LaunchPick = {
  role: 'worker',
  model: 'opus',
  effort: 'high',
  route: 'background',
  override: false,
}

async function seed(...sections: readonly string[]): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(
    join(tasksDir(ROOT), 'v1.0-one.md'),
    '# v1.0: One\n\n## Outcomes\n\n- [ ] it ships\n',
  )
  await writeFile(
    orderingPath(ROOT),
    ['# Priority', '', ...sections].join('\n'),
  )
}

function upNext(launch: string): string[] {
  return [
    '## Up next',
    '',
    '| Task | Touches | Launch | Waiting on |',
    '| ---- | ------- | ------ | ---------- |',
    `| [v1.0: One](v1.0-one.md) |  | ${launch} | the gate |`,
    '',
  ]
}

function board(): Promise<string> {
  return readFile(orderingPath(ROOT), 'utf8')
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-launch-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('writeLaunch', () => {
  it('should write the pick into an empty Launch cell', async () => {
    await seed(...upNext(''))

    const outcome = await writeLaunch(ROOT, 'v1.0-one', PICK)

    expect(outcome).toMatchObject({ ok: true, group: 'Up next' })
    expect(await board()).toContain(
      '| [v1.0: One](v1.0-one.md) |  | worker, opus, high, background | the gate |',
    )
  })

  it('should replace a pick with the operator override and mark it', async () => {
    await seed(...upNext('worker, opus, high, background'))

    await writeLaunch(ROOT, 'v1.0-one', {
      ...PICK,
      model: 'sonnet',
      effort: 'medium',
      route: 'hand',
      override: true,
    })

    expect(await board()).toContain(
      '| [v1.0: One](v1.0-one.md) |  | worker, sonnet, medium, hand (operator) | the gate |',
    )
  })

  it('should clear the cell and keep the blocker', async () => {
    await seed(...upNext('worker, opus, high, background'))

    await writeLaunch(ROOT, 'v1.0-one', undefined)

    expect(await board()).toContain(
      '| [v1.0: One](v1.0-one.md) |  |  | the gate |',
    )
  })

  it('should add the Launch column to a board written before it', async () => {
    await seed(
      '## Up next',
      '',
      '| Task | Touches | Waiting on |',
      '| ---- | ------- | ---------- |',
      '| [v1.0: One](v1.0-one.md) |  | the gate |',
      '',
    )

    await writeLaunch(ROOT, 'v1.0-one', PICK)

    expect(await board()).toContain('| Task | Touches | Launch | Waiting on |')
  })

  it('should refuse a row outside Up next', async () => {
    await seed(
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v1.0: One](v1.0-one.md) | Not planned yet |',
      '',
    )

    expect(await writeLaunch(ROOT, 'v1.0-one', PICK)).toMatchObject({
      ok: false,
      reason: 'no-column',
    })
  })

  it('should refuse a task with no row', async () => {
    await seed(...upNext(''))
    await writeFile(join(tasksDir(ROOT), 'v2.0-two.md'), '# v2.0: Two\n')

    expect(await writeLaunch(ROOT, 'v2.0-two', PICK)).toMatchObject({
      ok: false,
      reason: 'no-row',
    })
  })
})

describe('belowEffortFloor', () => {
  it.each(['opus', 'sonnet'] as const)(
    'should hold low below the floor on %s',
    (model) => {
      expect(belowEffortFloor({ model, effort: 'low', override: false })).toBe(
        true,
      )
    },
  )

  it.each(['opus', 'sonnet'] as const)(
    'should pass low on %s with the operator override',
    (model) => {
      expect(belowEffortFloor({ model, effort: 'low', override: true })).toBe(
        false,
      )
    },
  )

  it('should pass low on fable with no override', () => {
    expect(
      belowEffortFloor({ model: 'fable', effort: 'low', override: false }),
    ).toBe(false)
  })

  it.each(['medium', 'high', 'xhigh', 'max'] as const)(
    'should pass %s on opus with no override',
    (effort) => {
      expect(belowEffortFloor({ model: 'opus', effort, override: false })).toBe(
        false,
      )
    },
  )
})
