import { describe, expect, it } from 'vitest'
import {
  readBacklog,
  readBoard,
  readPaths,
  validateBoard,
} from '@/tasks/validate'
import {
  boardBody,
  needsPlanBoard,
  readyTable,
  seedBoard,
  seedPlan,
  seedTask,
  ROOT,
  useRoot,
} from './fixture'

useRoot()

describe('readPaths', () => {
  it('should read every backticked path out of a prose cell', () => {
    expect(
      readPaths('`src/a.ts` and its test, plus a `commands.md` row'),
    ).toEqual(['src/a.ts', 'commands.md'])
  })

  it('should drop a backticked span that names no file', () => {
    expect(readPaths('`git-ship` and `context-fold`')).toEqual([])
  })

  it('should strip a leading dot slash and a trailing slash', () => {
    expect(readPaths('`./src/tasks/` holds it')).toEqual(['src/tasks'])
  })

  it('should collapse a path named twice in one cell', () => {
    expect(readPaths('`src/a.ts`, then `src/a.ts` again')).toEqual(['src/a.ts'])
  })

  it('should drop a task version whose trailing digits look like an extension', () => {
    expect(readPaths('waits on `v40.2` and `v41.7`')).toEqual([])
  })

  it('should read no path out of a derived count, whose folders summarize', () => {
    expect(readPaths('12 files under `src/tasks/`, `claude/skills/`')).toEqual(
      [],
    )
    expect(readPaths('1 file under `docs/`, and 2 more')).toEqual([])
  })
})

describe('readBoard', () => {
  it('should key each row to the readiness group above it', () => {
    const text = boardBody([
      readyTable([{ stem: 'v1.0-first' }]),
      '## Up next',
      '',
      '| Task | Touches | Waiting on |',
      '| ---- | ------- | ---------- |',
      '| [v2.0-second](v2.0-second.md) | `src/b.ts` | v1.0 |',
      '',
    ])

    const { rows, groups, findings } = readBoard(text)

    expect(groups).toEqual(['Run now', 'Up next'])
    expect(rows.map((row) => [row.group, row.stem])).toEqual([
      ['Run now', 'v1.0-first'],
      ['Up next', 'v2.0-second'],
    ])
    expect(findings).toEqual([])
  })

  it('should leave touches absent when the group fixes no such column', () => {
    const text = boardBody([
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v3.0-third](v3.0-third.md) | nothing |',
      '',
    ])

    expect(readBoard(text).rows[0]?.touches).toBeUndefined()
  })

  it('should report no group when the headings are named differently', () => {
    const text = boardBody([
      '## Ready',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0-first](v1.0-first.md) | `src/a.ts` | [p](../plans/p.md) |',
      '',
    ])

    expect(readBoard(text)).toEqual({ rows: [], groups: [], findings: [] })
  })

  it('should read a column by its header rather than by its position', () => {
    const text = boardBody([
      '## Run now',
      '',
      '| Task | Plan | Touches |',
      '| ---- | ---- | ------- |',
      '| [v1.0-first](v1.0-first.md) | [p](../plans/p.md) | `src/a.ts` |',
      '',
    ])

    expect(readBoard(text).rows[0]).toMatchObject({
      plan: '../plans/p.md',
      touches: ['src/a.ts'],
    })
  })

  it('should report a row whose cell count disagrees with its header', () => {
    const text = boardBody([
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0-first](v1.0-first.md) `src/a.ts` | [p](../plans/p.md) |',
      '',
    ])

    const { rows, findings } = readBoard(text)

    expect(rows).toEqual([])
    expect(findings).toMatchObject([
      { kind: 'row-misshapen', group: 'Run now' },
    ])
  })

  it('should report a row landing after the blank line that closed its table', () => {
    const text = boardBody([
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0-first](v1.0-first.md) | `src/a.ts` | [p](../plans/p.md) |',
      '',
      '| [v2.0-second](v2.0-second.md) | `src/b.ts` | [p](../plans/p.md) |',
      '',
    ])

    const { rows, findings } = readBoard(text)

    expect(rows.map((row) => row.stem)).toEqual(['v1.0-first'])
    expect(findings).toMatchObject([{ kind: 'row-untabled', group: 'Run now' }])
  })

  it('should read the ordinal phrase from the end of the cell rather than only its start', () => {
    const text = boardBody([
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v3.0-third](v3.0-third.md) | nothing, cleared 2026-08-31 when it merged. Third here |',
      '',
    ])

    expect(readBoard(text).rows[0]?.ordinal).toBe('third')
  })

  it('should not read an ordinal out of a cell whose only "here" follows a non-ordinal word', () => {
    const text = boardBody([
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v3.0-third](v3.0-third.md) | Untestable from here, re-confirmed 2026-08-30 |',
      '',
    ])

    expect(readBoard(text).rows[0]?.ordinal).toBeUndefined()
  })

  it('should not read an ordinal out of a cell carrying the word "last" with no ordinal beside it', () => {
    const text = boardBody([
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v3.0-third](v3.0-third.md) | the last of the two instruments this rename needs, and nothing else |',
      '',
    ])

    expect(readBoard(text).rows[0]?.ordinal).toBeUndefined()
  })

  it('should read a cell naming the sibling row it is ranked against as ranked', () => {
    const text = needsPlanBoard(
      'a plan, and it trails `v75.9` because a dead link degrades a page where a wrong default breaks a command',
    )

    expect(readBoard(text).rows[0]?.ranked).toBe(true)
  })

  it('should read a cell naming the class of rows it opens or closes as ranked', () => {
    const text = needsPlanBoard(
      'a plan, and it closes the capability group because the escape hatch serves one deck author',
    )

    expect(readBoard(text).rows[0]?.ranked).toBe(true)
  })

  it('should not read a cell stating only why the task matters as ranked', () => {
    const text = needsPlanBoard(
      'a plan, and it closes a gap the reference gate leaves open',
    )

    expect(readBoard(text).rows[0]?.ranked).toBe(false)
  })

  it('should not pair a position verb in one clause with an object in another', () => {
    const text = needsPlanBoard(
      'a plan, and it closes a long-standing gap, because the row above ships a wrong instruction',
    )

    expect(readBoard(text).rows[0]?.ranked).toBe(false)
  })

  it('should keep a phase label whole rather than splitting it at its own period', () => {
    const text = needsPlanBoard('a plan, and it sits under `v80.4`')

    expect(readBoard(text).rows[0]?.ranked).toBe(true)
  })

  it('should leave ranked false where the group fixes no waiting on column', () => {
    const text = boardBody([
      readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
    ])

    expect(readBoard(text).rows[0]?.ranked).toBe(false)
  })
})

describe('readBacklog', () => {
  it('should read one row per bullet carrying a task link', () => {
    expect(
      readBacklog(
        [
          '- [v9.0 first](v9.0-first.md)',
          '- [v9.1 second](v9.1-second.md)',
        ].join('\n'),
      ),
    ).toEqual([
      { label: 'v9.0 first', stem: 'v9.0-first' },
      { label: 'v9.1 second', stem: 'v9.1-second' },
    ])
  })

  it('should skip a bullet carrying prose instead of a pointer', () => {
    expect(readBacklog('- nothing here is queued')).toEqual([])
  })

  it('should skip a pointer carrying a directory', () => {
    expect(readBacklog('- [the plan](../plans/feature-x.md)')).toEqual([])
  })

  it('should skip a pointer naming a reserved sibling', () => {
    expect(readBacklog('- [priority](priority.md)')).toEqual([])
  })
})

describe('checkWideTokens', () => {
  const wideSpan = `\`${'a'.repeat(74)}.md\``
  const fitSpan = `\`${'a'.repeat(50)}.md\``

  function groupTable(group: string, cell: string): string {
    return [
      `## ${group}`,
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      `| [v1.0-first](v1.0-first.md) | ${cell} | [v1.0-first](../plans/feature-v1.0-first.md) |`,
      '',
    ].join('\n')
  }

  async function wideFor(group: string, cell: string) {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([groupTable(group, cell)]))

    const outcome = await validateBoard(ROOT)

    return outcome.ok ? outcome.wide : undefined
  }

  it('should flag a 77-character span and name the row and the token', async () => {
    const wide = await wideFor('Run now', wideSpan)

    expect(wide).toMatchObject([{ group: 'Run now', subject: 'v1.0-first' }])
    expect(wide?.[0]?.message).toContain('a'.repeat(74))
  })

  it('should not flag a 53-character span', async () => {
    expect(await wideFor('Run now', fitSpan)).toEqual([])
  })

  it('should not flag a long link target', async () => {
    const cell = `[label](../${'a'.repeat(90)}.md) \`src/a.ts\``

    expect(await wideFor('Run now', cell)).toEqual([])
  })

  it('should measure the longest run between spaces rather than the span', async () => {
    const cell = `\`${`${'a'.repeat(40)} `.repeat(3)}\``

    expect(await wideFor('Run now', cell)).toEqual([])
  })

  it('should flag a brace-glob however short', async () => {
    const wide = await wideFor('Run now', '`src/{a,b}.ts`')

    expect(wide).toHaveLength(1)
    expect(wide?.[0]?.message).toContain('brace')
  })

  it.each(['Run now', 'Up next', 'Needs a plan'])(
    'should flag a wide span under %s',
    async (group) => {
      expect(await wideFor(group, wideSpan)).toMatchObject([{ group }])
    },
  )
})
