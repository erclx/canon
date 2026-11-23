import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordDir } from '@/roots/record'
import { orderingPath } from '@/tasks/validate'
import { planWaves, type WavesReport } from '@/tasks/waves'

let ROOT: string

interface Queued {
  readonly stem: string
  readonly paths?: readonly string[]
  readonly waiting?: string
}

async function writeTask(stem: string, plan: string | undefined) {
  const dir = recordDir(ROOT, 'tasks')
  mkdirSync(dir, { recursive: true })
  const link = plan ? `Plan: [${plan}](../plans/${plan})\n` : ''
  await writeFile(join(dir, `${stem}.md`), `# ${stem}\n\n${link}`, 'utf8')
}

async function writePlan(stem: string, paths: readonly string[]) {
  const dir = recordDir(ROOT, 'plans')
  mkdirSync(dir, { recursive: true })
  const lines = paths.map((path) => `- \`${path}\`: reason`)
  await writeFile(
    join(dir, `feature-${stem}.md`),
    `# Feature: ${stem}\n\n**Files to touch:**\n\n${lines.join('\n')}\n`,
    'utf8',
  )
}

async function board(
  queued: readonly Queued[],
  running: readonly Queued[] = [],
) {
  for (const row of [...queued, ...running]) {
    const planned = row.paths !== undefined
    if (planned) await writePlan(row.stem, row.paths ?? [])
    await writeTask(row.stem, planned ? `feature-${row.stem}.md` : undefined)
  }

  const cell = (row: Queued) => `[${row.stem}: A row](${row.stem}.md)`
  const text = [
    '# Priority',
    '',
    '## In flight',
    '',
    '| Task | Touches | Session |',
    '| ---- | ------- | ------- |',
    ...running.map((row) => `| ${cell(row)} | 1 file | worker |`),
    '',
    '## Up next',
    '',
    '| Task | Touches | Launch | Waiting on |',
    '| ---- | ------- | ------ | ---------- |',
    ...queued.map(
      (row) =>
        `| ${cell(row)} | 1 file | worker | ${row.waiting ?? 'Planned, not dispatched yet'} |`,
    ),
    '',
  ].join('\n')

  mkdirSync(recordDir(ROOT, 'tasks'), { recursive: true })
  await writeFile(orderingPath(ROOT), text, 'utf8')
}

async function read(): Promise<WavesReport> {
  const outcome = await planWaves(ROOT)
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome
}

const stems = (report: WavesReport) =>
  report.waves.map((wave) => wave.rows.map((row) => row.stem))

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'waves-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('planWaves', () => {
  it('puts rows declaring no common path in one wave', async () => {
    await board([
      { stem: 'a', paths: ['src/a.ts'] },
      { stem: 'b', paths: ['src/b.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['a', 'b']])
    expect(report.shared).toEqual([])
  })

  it('moves the later of two rows sharing a path to the next wave and names it', async () => {
    await board([
      { stem: 'a', paths: ['src/x.ts', 'src/a.ts'] },
      { stem: 'b', paths: ['src/x.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['a'], ['b']])
    expect(report.shared).toEqual([
      { path: 'src/x.ts', stems: ['a', 'b'], rebases: 'b' },
    ])
  })

  it('places a row after the task its Waiting on cell cites', async () => {
    await board([
      { stem: 'a', paths: ['src/a.ts'], waiting: '[a](b.md)' },
      { stem: 'b', paths: ['src/b.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['b'], ['a']])
    expect(report.waves[1].rows[0].after).toEqual(['b'])
  })

  it('places a row beside the task its Waiting on cell only ranks it against', async () => {
    await board([
      { stem: 'v1.2-second', paths: ['src/a.ts'], waiting: 'Follows v1.1' },
      { stem: 'v1.1-first', paths: ['src/b.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['v1.2-second', 'v1.1-first']])
    expect(report.waves[0].rows[0].after).toEqual([])
  })

  it('keeps a row waiting on a task its cell cites as a blocker', async () => {
    await board([
      { stem: 'v1.2-second', paths: ['src/a.ts'], waiting: 'Waits on v1.1' },
      { stem: 'v1.1-first', paths: ['src/b.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['v1.1-first'], ['v1.2-second']])
    expect(report.waves[1].rows[0].after).toEqual(['v1.1-first'])
  })

  it('waits on the blocker alone when a cell carries a ranking clause and a blocker', async () => {
    await board([
      {
        stem: 'v1.3-third',
        paths: ['src/a.ts'],
        waiting: 'Follows v1.1, waits on [v1.2](v1.2-second.md)',
      },
      { stem: 'v1.2-second', paths: ['src/b.ts'] },
      { stem: 'v1.1-first', paths: ['src/c.ts'] },
    ])

    const report = await read()
    const third = report.waves
      .flatMap((wave) => wave.rows)
      .find((row) => row.stem === 'v1.3-third')
    expect(third?.after).toEqual(['v1.2-second'])
  })

  it('reads a folder declaration as covering a file under it', async () => {
    await board([
      { stem: 'a', paths: ['src/tasks/'] },
      { stem: 'b', paths: ['src/tasks/waves.ts'] },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['a'], ['b']])
    expect(report.shared[0].path).toBe('src/tasks')
  })

  it('reports a row with no plan apart from the waves', async () => {
    await board([{ stem: 'a' }, { stem: 'b', paths: ['src/b.ts'] }])

    const report = await read()
    expect(report.unplanned).toEqual(['a'])
    expect(stems(report)).toEqual([['b']])
  })

  it('names an In flight holder in a shared entry without delaying the row', async () => {
    await board(
      [{ stem: 'a', paths: ['src/x.ts'] }],
      [{ stem: 'r', paths: ['src/x.ts'] }],
    )

    const report = await read()
    expect(stems(report)).toEqual([['a']])
    expect(report.shared).toEqual([
      { path: 'src/x.ts', stems: ['a', 'r'], rebases: 'a' },
    ])
  })

  it('keeps a row waiting on an In flight task in wave 1 and names the blocker', async () => {
    await board(
      [{ stem: 'a', paths: ['src/a.ts'], waiting: '[r](r.md)' }],
      [{ stem: 'r', paths: ['src/r.ts'] }],
    )

    const report = await read()
    expect(stems(report)).toEqual([['a']])
    expect(report.waves[0].rows[0].after).toEqual(['r'])
  })

  it('drops a blocker whose task is no longer live from after', async () => {
    await board([
      { stem: 'a', paths: ['src/a.ts'], waiting: '[gone](gone.md)' },
    ])

    const report = await read()
    expect(stems(report)).toEqual([['a']])
    expect(report.waves[0].rows[0].after).toEqual([])
  })

  it('reports two rows waiting on each other instead of looping', async () => {
    await board([
      { stem: 'a', paths: ['src/a.ts'], waiting: '[b](b.md)' },
      { stem: 'b', paths: ['src/b.ts'], waiting: '[a](a.md)' },
      { stem: 'c', paths: ['src/c.ts'] },
    ])

    const report = await read()
    expect(report.cyclic).toEqual(['a', 'b'])
    expect(stems(report)).toEqual([['c']])
    expect(report.cycles).toEqual([
      { stem: 'a', edges: [{ to: 'b', source: 'waiting' }] },
      { stem: 'b', edges: [{ to: 'a', source: 'waiting' }] },
    ])
  })

  it('places an earlier row waiting on a later row it shares a path with, rather than in a cycle', async () => {
    await board([
      { stem: 'a', paths: ['src/x.ts'], waiting: '[b](b.md)' },
      { stem: 'b', paths: ['src/x.ts'] },
    ])

    const report = await read()
    expect(report.cyclic).toEqual([])
    expect(stems(report)).toEqual([['b'], ['a']])
  })

  it('keeps a waiting edge to a later row sharing no path, and a shared edge named for its path', async () => {
    await board([
      { stem: 'a', paths: ['src/x.ts'], waiting: '[c](c.md)' },
      { stem: 'b', paths: ['src/x.ts'], waiting: '[a](a.md)' },
      { stem: 'c', paths: ['src/c.ts'], waiting: '[b](b.md)' },
    ])

    const report = await read()
    expect(report.cycles.find((cycle) => cycle.stem === 'b')?.edges).toEqual([
      { to: 'a', source: 'waiting' },
      { to: 'a', source: 'shared', path: 'src/x.ts' },
    ])
  })

  it('reports an empty Up next as ok with no waves', async () => {
    await board([])

    const report = await read()
    expect(report.waves).toEqual([])
  })

  it('refuses when no board is on disk', async () => {
    const outcome = await planWaves(ROOT)
    expect(outcome).toMatchObject({ ok: false, reason: 'no-board' })
  })
})
