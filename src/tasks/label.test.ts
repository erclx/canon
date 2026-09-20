import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type LabelOutcome, claimLabel, nextLabel } from '@/tasks/label'

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
