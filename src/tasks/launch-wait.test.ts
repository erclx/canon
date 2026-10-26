import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type LaunchClock,
  readLaunchable,
  waitForLaunchable,
} from '@/tasks/launch-wait'

let ROOT: string

const OPEN_CALL = 'needs your call, the two shapes cost the same.'

function planBody(answer: string): string {
  return [
    '# Feature: A plan under test',
    '',
    '## Summary',
    '',
    '- It ships something.',
    '',
    '**Files to touch:**',
    '',
    '- `src/a.ts`: the thing.',
    '',
    '**Questions:**',
    '',
    '1. Which shape?',
    `   - Suggested: ${OPEN_CALL}`,
    `   - Answer:${answer ? ` ${answer}` : ''}`,
    '',
  ].join('\n')
}

async function writePlan(slug: string, answer = 'Take the second.') {
  await writeFile(
    join(ROOT, '.canon', 'plans', `feature-${slug}.md`),
    planBody(answer),
    'utf8',
  )
}

async function writeTask(stem: string, planLine?: string) {
  const lines = ['# A task under test', '']
  if (planLine !== undefined) lines.push(planLine, '')
  lines.push('## Outcomes', '', '- [ ] It ships.', '')

  await writeFile(
    join(ROOT, '.canon', 'tasks', `${stem}.md`),
    lines.join('\n'),
    'utf8',
  )
}

/**
 * A clock that advances only when the wait sleeps, running `onSleep` at each
 * sleep so a test can change the board between two readings.
 */
function fakeClock(onSleep: (count: number) => Promise<void> = async () => {}) {
  let now = 0
  let count = 0
  const clock: LaunchClock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms
      count += 1
      await onSleep(count)
    },
  }

  return { clock, sleeps: () => count }
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'launch-wait-'))
  mkdirSync(join(ROOT, '.canon', 'plans', 'archive'), { recursive: true })
  mkdirSync(join(ROOT, '.canon', 'tasks'), { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readLaunchable', () => {
  it('should report a task with no Plan: line as unlinked rather than refuse it', async () => {
    await writeTask('v1.1-row')

    const outcome = await readLaunchable(ROOT, 'v1.1-row')

    expect(outcome).toEqual({
      ok: true,
      task: 'v1.1-row',
      reason: 'unlinked',
      launchable: false,
      open: [],
    })
  })

  it('should hold a linked plan that still waits on the operator', async () => {
    await writePlan('row', '')
    await writeTask('v1.1-row', 'Plan: [feature-row](../plans/feature-row.md)')

    const outcome = await readLaunchable(ROOT, 'v1.1-row')

    expect(outcome).toMatchObject({
      ok: true,
      plan: '.canon/plans/feature-row.md',
      reason: 'open',
      launchable: false,
      open: [{ label: '1. Which shape?' }],
    })
  })

  it('should report a linked plan with every call answered as launchable', async () => {
    await writePlan('row')
    await writeTask('v1.1-row', 'Plan: [feature-row](../plans/feature-row.md)')

    const outcome = await readLaunchable(ROOT, 'v1.1-row')

    expect(outcome).toEqual({
      ok: true,
      task: 'v1.1-row',
      plan: '.canon/plans/feature-row.md',
      reason: 'launchable',
      launchable: true,
      open: [],
    })
  })

  it('should refuse a task whose plan sits in the archive', async () => {
    await writeFile(
      join(ROOT, '.canon', 'plans', 'archive', 'feature-row.md'),
      planBody('Done.'),
      'utf8',
    )
    await writeTask(
      'v1.1-row',
      'Plan: [feature-row](../plans/archive/feature-row.md)',
    )

    const outcome = await readLaunchable(ROOT, 'v1.1-row')

    expect(outcome).toMatchObject({ ok: false, reason: 'archived' })
  })

  it('should refuse a task linking several plans, since no one plan dispatches', async () => {
    await writePlan('a')
    await writePlan('b')
    await writeTask(
      'v1.1-row',
      'Plan: [feature-a](../plans/feature-a.md), [feature-b](../plans/feature-b.md)',
    )

    const outcome = await readLaunchable(ROOT, 'v1.1-row')

    expect(outcome).toMatchObject({ ok: false, reason: 'several-plans' })
  })

  it('should refuse a name that only prefixes a task', async () => {
    await writeTask('v1.1-row')

    const outcome = await readLaunchable(ROOT, 'v1.1')

    expect(outcome).toMatchObject({
      ok: false,
      reason: 'no-match',
      detail: ['v1.1-row'],
    })
  })
})

describe('waitForLaunchable', () => {
  it('should wake once a planner links a plan that clears every call', async () => {
    await writeTask('v1.1-row')
    const { clock, sleeps } = fakeClock(async (count) => {
      if (count !== 2) return
      await writePlan('row')
      await writeTask(
        'v1.1-row',
        'Plan: [feature-row](../plans/feature-row.md)',
      )
    })

    const outcome = await waitForLaunchable(ROOT, 'v1.1-row', {
      waitSeconds: 1800,
      clock,
      pollMs: 30_000,
    })

    expect(outcome).toMatchObject({
      ok: true,
      reason: 'launchable',
      plan: '.canon/plans/feature-row.md',
      waitedSeconds: 60,
    })
    expect(sleeps()).toBe(2)
  })

  it('should keep waiting while the linked plan still holds an operator call', async () => {
    await writePlan('row', '')
    await writeTask('v1.1-row', 'Plan: [feature-row](../plans/feature-row.md)')
    const { clock } = fakeClock(async (count) => {
      if (count === 3) await writePlan('row', 'Take the first.')
    })

    const outcome = await waitForLaunchable(ROOT, 'v1.1-row', {
      waitSeconds: 1800,
      clock,
      pollMs: 30_000,
    })

    expect(outcome).toMatchObject({
      ok: true,
      reason: 'launchable',
      waitedSeconds: 90,
    })
  })

  it('should end on timeout carrying the last reading at the deadline', async () => {
    await writePlan('row', '')
    await writeTask('v1.1-row', 'Plan: [feature-row](../plans/feature-row.md)')
    const { clock } = fakeClock()

    const outcome = await waitForLaunchable(ROOT, 'v1.1-row', {
      waitSeconds: 100,
      clock,
      pollMs: 30_000,
    })

    expect(outcome).toMatchObject({
      ok: true,
      reason: 'timeout',
      plan: '.canon/plans/feature-row.md',
      launchable: false,
      open: [{ label: '1. Which shape?' }],
      waitedSeconds: 90,
    })
  })

  it('should stop on a refusal rather than wait it out', async () => {
    await writeTask('v1.1-row', 'Plan: [feature-row](../plans/feature-row.md)')
    const { clock, sleeps } = fakeClock()

    const outcome = await waitForLaunchable(ROOT, 'v1.1-row', {
      waitSeconds: 1800,
      clock,
      pollMs: 30_000,
    })

    expect(outcome).toMatchObject({
      ok: false,
      reason: 'no-plan',
      waitedSeconds: 0,
    })
    expect(sleeps()).toBe(0)
  })
})
