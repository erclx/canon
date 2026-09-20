import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tasksDir } from '@/tasks/archive'
import { type ListOutcome, listTasks } from '@/tasks/list'
import { backlogPath, orderingPath, validateBoard } from '@/tasks/validate'

let ROOT: string

function assertOk(
  outcome: ListOutcome,
): asserts outcome is Extract<ListOutcome, { ok: true }> {
  expect(outcome.ok).toBe(true)
}

function group(title: string, ...stems: string[]): string {
  const rows = stems.map((stem) => `| [${stem}](${stem}.md) | \`src/a.ts\` | |`)

  return [
    title,
    '',
    '| Task | Touches | Plan |',
    '| ---- | ------- | ---- |',
    ...rows,
    '',
  ].join('\n')
}

async function seed(
  board: string,
  backlog: readonly string[],
  ...stems: string[]
): Promise<void> {
  const dir = tasksDir(ROOT)
  mkdirSync(dir, { recursive: true })
  await writeFile(orderingPath(ROOT), board)
  await writeFile(
    backlogPath(ROOT),
    backlog.map((stem) => `- [${stem}](${stem}.md)`).join('\n'),
  )
  await Promise.all(
    stems.map((stem) => writeFile(join(dir, `${stem}.md`), '', 'utf8')),
  )
}

function readinessOf(outcome: ListOutcome, stem: string): string | undefined {
  assertOk(outcome)

  return outcome.tasks.find((task) => task.stem === stem)?.readiness
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-list-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('listTasks', () => {
  it('should refuse a board that does not exist', async () => {
    const outcome = await listTasks(ROOT)

    expect(outcome.ok === false && outcome.reason).toBe('no-board')
  })

  it('should read the group a board row sits under', async () => {
    const board = [
      group('## Run now', 'a'),
      group('## Up next', 'b'),
      group('## Needs a plan', 'c'),
    ].join('\n')
    await seed(board, [], 'a', 'b', 'c')

    const outcome = await listTasks(ROOT)

    expect(readinessOf(outcome, 'a')).toBe('Run now')
    expect(readinessOf(outcome, 'b')).toBe('Up next')
    expect(readinessOf(outcome, 'c')).toBe('Needs a plan')
  })

  it('should read a backlog line as backlog', async () => {
    await seed(group('## Run now', 'a'), ['p'], 'a', 'p')

    expect(readinessOf(await listTasks(ROOT), 'p')).toBe('backlog')
  })

  it('should read a file in neither surface as unplaced', async () => {
    await seed(group('## Run now', 'a'), [], 'a', 'lost')

    expect(readinessOf(await listTasks(ROOT), 'lost')).toBe('unplaced')
  })

  it('should read a file in both surfaces as both', async () => {
    await seed(group('## Run now', 'a'), ['a'], 'a')

    expect(readinessOf(await listTasks(ROOT), 'a')).toBe('both')
  })

  it('should skip a session map file', async () => {
    await seed(group('## Run now', 'a'), [], 'a', 'session-x')

    const outcome = await listTasks(ROOT)

    assertOk(outcome)
    expect(outcome.tasks.map((task) => task.stem)).toEqual(['a'])
  })

  it('should agree with validate on which files are unplaced', async () => {
    await seed(group('## Run now', 'a'), ['p'], 'a', 'p', 'lost')

    const outcome = await listTasks(ROOT)
    const report = await validateBoard(ROOT)

    assertOk(outcome)
    const unplaced = outcome.tasks
      .filter((task) => task.readiness === 'unplaced')
      .map((task) => task.stem)
    expect(report.ok && report.unplaced.map((entry) => entry.subject)).toEqual(
      unplaced,
    )
  })
})
