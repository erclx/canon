import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordDir } from '@/record-root'
import { archiveDir, declinedDir, tasksDir } from '@/tasks/archive'
import {
  backlogPath,
  type Finding,
  type FindingKind,
  orderingPath,
  readBacklog,
  readBoard,
  readPaths,
  validateBoard,
  type ValidateOptions,
} from '@/tasks/validate'

let ROOT: string

interface RowFixture {
  readonly stem: string
  readonly touches?: string
  readonly plan?: string
}

function readyTable(rows: readonly RowFixture[]): string {
  const body = rows.map(
    ({ stem, touches = '`src/a.ts`', plan = `../plans/feature-${stem}.md` }) =>
      `| [${stem}](${stem}.md) | ${touches} | [${stem}](${plan}) |`,
  )

  return [
    '## Run now',
    '',
    '| Task | Touches | Plan |',
    '| ---- | ------- | ---- |',
    ...body,
    '',
  ].join('\n')
}

function boardBody(sections: readonly string[]): string {
  return [
    '---',
    'title: Priority',
    'description: One line on what the board covers',
    '---',
    '',
    '# Priority',
    '',
    ...sections,
  ].join('\n')
}

async function seedBoard(text: string): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(orderingPath(ROOT), text)
}

/** Seeds a task carrying no `Plan:` line, which the agreement check reports. */
const NO_PLAN = ''

async function seedTask(
  stem: string,
  outcomes = '',
  pullRequest?: number | readonly number[],
  plan: string = `../plans/feature-${stem}.md`,
): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  const numbers = typeof pullRequest === 'number' ? [pullRequest] : pullRequest
  const origin = numbers
    ? `Pull request: ${numbers.map((number) => `#${number}`).join(', ')}\n\n`
    : ''
  const cites = plan ? `Plan: [feature-${stem}](${plan})\n\n` : ''
  await writeFile(
    join(tasksDir(ROOT), `${stem}.md`),
    `# ${stem}\n\n${cites}${origin}## Outcomes\n\n${outcomes}\n`,
  )
}

/** Answers the trunk from a fixture, so no test reaches for a git history. */
function trunkHolding(...landed: readonly number[]): ValidateOptions {
  return { trunk: async (number) => landed.includes(number) }
}

const UNREACHABLE_TRUNK: ValidateOptions = { trunk: async () => undefined }

async function seedArchivedTask(stem: string): Promise<void> {
  const archive = archiveDir(ROOT)
  mkdirSync(archive, { recursive: true })
  await writeFile(join(archive, `${stem}.md`), `# ${stem}\n`)
}

async function seedDeclinedTask(stem: string): Promise<void> {
  const declined = declinedDir(ROOT)
  mkdirSync(declined, { recursive: true })
  await writeFile(join(declined, `${stem}.md`), `# ${stem}\n`)
}

function needsPlanTable(rows: readonly string[]): string {
  return [
    '## Needs a plan',
    '',
    '| Task | Waiting on |',
    '| ---- | ---------- |',
    ...rows,
    '',
  ].join('\n')
}

/** A board holding one `## Needs a plan` row, for reading a single cell back. */
function needsPlanBoard(cell: string): string {
  return boardBody([
    needsPlanTable([`| [v3.0-third](v3.0-third.md) | ${cell} |`]),
  ])
}

function parkedTable(rows: readonly string[]): string {
  return [
    '## Up next',
    '',
    '| Task | Touches | Waiting on |',
    '| ---- | ------- | ---------- |',
    ...rows,
    '',
  ].join('\n')
}

async function seedBacklog(lines: readonly string[]): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(
    backlogPath(ROOT),
    [
      '---',
      'title: Backlog',
      'description: One line on what the backlog holds',
      '---',
      '',
      '# Backlog',
      '',
      'Unordered. Nothing here is queued.',
      '',
      ...lines,
      '',
    ].join('\n'),
  )
}

async function seedPlan(stem: string): Promise<void> {
  const plans = recordDir(ROOT, 'plans')
  mkdirSync(plans, { recursive: true })
  await writeFile(join(plans, `feature-${stem}.md`), `# ${stem}\n`)
}

/** A `Plan:` line linking the stem's own plan and a second one. */
const SEVERAL_PLANS = (stem: string): string =>
  `Plan: [feature-${stem}](../plans/feature-${stem}.md), [feature-other](../plans/feature-other.md)`

/** Writes a task whose `Plan:` line is given verbatim, for shapes `seedTask` cannot build. */
async function seedPlanLine(stem: string, line: string): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(
    join(tasksDir(ROOT), `${stem}.md`),
    `# ${stem}\n\n${line}\n\n## Outcomes\n\n`,
  )
}

function kinds(findings: readonly Finding[]): FindingKind[] {
  return findings.map((finding) => finding.kind)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-validate-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readPaths', () => {
  it('should read every backticked path out of a prose cell', () => {
    expect(
      readPaths('`src/a.ts` and its test, plus a `commands.md` row'),
    ).toEqual(['src/a.ts', 'commands.md'])
  })

  it('should drop a backticked span that names no file', () => {
    expect(readPaths('`memory-capture` and `docs-fold`')).toEqual([])
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

describe('validateBoard', () => {
  it('should refuse when the project carries no board', async () => {
    expect(await validateBoard(ROOT)).toMatchObject({
      ok: false,
      reason: 'no-board',
    })
  })

  it('should refuse when the board carries no ordering file', async () => {
    mkdirSync(tasksDir(ROOT), { recursive: true })

    expect(await validateBoard(ROOT)).toMatchObject({
      ok: false,
      reason: 'no-ordering',
    })
  })

  it('should refuse when no readiness group is recognized', async () => {
    await seedBoard(boardBody(['## Ready', '', 'nothing here', '']))

    expect(await validateBoard(ROOT)).toMatchObject({
      ok: false,
      reason: 'no-groups',
    })
  })

  it('should pass a board whose rows resolve and touch disjoint files', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`src/a.ts`' },
          { stem: 'v2.0-second', touches: '`src/b.ts`' },
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({
      ok: true,
      rows: 2,
      tasks: 2,
      findings: [],
    })
  })

  it('should report a run now row whose plan pointer resolves nowhere', async () => {
    await seedTask('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-unresolved'])
  })

  it('should report a run now row carrying prose in place of a plan link', async () => {
    await seedTask('v1.0-first')
    await seedBoard(
      boardBody([
        '## Run now',
        '',
        '| Task | Touches | Plan |',
        '| ---- | ------- | ---- |',
        '| [v1.0-first](v1.0-first.md) | `src/a.ts` | planned in session |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-unstated'])
  })

  it('should report a run now row whose task carries no plan line', async () => {
    await seedTask('v1.0-first', '', undefined, NO_PLAN)
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-uncited'])
  })

  it('should report a run now row whose task links several plans, the first matching the row', async () => {
    await seedTask('v1.0-first', '', undefined, NO_PLAN)
    await seedPlanLine('v1.0-first', SEVERAL_PLANS('v1.0-first'))
    await seedPlan('v1.0-first')
    await seedPlan('other')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-several'])
    expect(outcome.ok && outcome.findings[0]).toMatchObject({
      group: 'Run now',
      subject: 'v1.0-first',
      message: expect.stringContaining(
        '../plans/feature-v1.0-first.md, ../plans/feature-other.md',
      ),
    })
  })

  it('should report a row and a task naming two different plans', async () => {
    await seedTask('v1.0-first', '', undefined, '../plans/feature-other.md')
    await seedPlan('v1.0-first')
    await seedPlan('other')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-mismatched'])
  })

  it('should read two spellings of one plan as agreeing', async () => {
    await seedTask(
      'v1.0-first',
      '',
      undefined,
      '.canon/plans/feature-v1.0-first.md',
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ ok: true, findings: [] })
  })

  it('should report a row whose task file is gone', async () => {
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['task-unresolved'])
  })

  describe('group plan claims', () => {
    function claimKinds(findings: readonly Finding[]): FindingKind[] {
      return kinds(findings).filter(
        (kind) => kind === 'plan-parked' || kind === 'plan-absent',
      )
    }

    async function seedArchivedPlan(stem: string): Promise<void> {
      const archive = recordDir(ROOT, 'plans', 'archive')
      mkdirSync(archive, { recursive: true })
      await writeFile(join(archive, `feature-${stem}.md`), `# ${stem}\n`)
    }

    const needsPlanRow = '| [v3.0-third](v3.0-third.md) | ranked last |'
    const upNextRow = '| [v3.0-third](v3.0-third.md) | `src/c.ts` | nothing |'

    it('should report a needs a plan row whose task cites a live plan on disk', async () => {
      await seedTask('v3.0-third')
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-parked',
      ])
      expect(outcome.ok && outcome.findings[0]).toMatchObject({
        group: 'Needs a plan',
        subject: 'v3.0-third',
      })
    })

    it('should leave a needs a plan row whose task cites an archived plan unreported', async () => {
      await seedTask(
        'v3.0-third',
        '',
        undefined,
        '../plans/archive/feature-v3.0-third.md',
      )
      await seedArchivedPlan('v3.0-third')
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([])
    })

    it('should leave a needs a plan row whose task cites no plan unreported', async () => {
      await seedTask('v3.0-third', '', undefined, NO_PLAN)
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([])
    })

    it('should leave a needs a plan row whose cited plan is absent from disk unreported', async () => {
      await seedTask('v3.0-third')
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([])
    })

    it('should report an up next row whose task cites no plan', async () => {
      await seedTask('v3.0-third', '', undefined, NO_PLAN)
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-absent',
      ])
      expect(outcome.ok && outcome.findings[0]).toMatchObject({
        group: 'Up next',
        subject: 'v3.0-third',
      })
    })

    it('should report an up next row whose task links several plans', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-several'])
      expect(outcome.ok && outcome.findings[0]).toMatchObject({
        group: 'Up next',
        subject: 'v3.0-third',
      })
    })

    it('should report a needs a plan row whose task links several plans', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-several'])
      expect(outcome.ok && outcome.findings[0]).toMatchObject({
        group: 'Needs a plan',
        subject: 'v3.0-third',
      })
    })

    it('should report an up next row whose task cites an archived plan', async () => {
      await seedTask(
        'v3.0-third',
        '',
        undefined,
        '../plans/archive/feature-v3.0-third.md',
      )
      await seedArchivedPlan('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-absent',
      ])
    })

    it('should report an up next row whose cited plan is absent from disk', async () => {
      await seedTask('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-absent',
      ])
    })

    it('should leave an up next row whose task cites a live plan unreported', async () => {
      await seedTask('v3.0-third')
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([])
    })

    it('should leave a parked row whose task file is gone to the mapping check', async () => {
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && kinds(outcome.findings)).toEqual(['task-unresolved'])
    })

    it('should keep reporting a run now row whose task cites no plan', async () => {
      await seedTask('v1.0-first', '', undefined, NO_PLAN)
      await seedPlan('v1.0-first')
      await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-uncited'])
    })
  })

  it('should report a task file that neither surface names as unplaced rather than a finding', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-orphan')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.unplaced).toMatchObject([
      { subject: 'v9.0-orphan' },
    ])
  })

  it('should account for a task file the backlog names', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-parked')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))
    await seedBacklog(['- [v9.0 parked](v9.0-parked.md)'])

    expect(await validateBoard(ROOT)).toMatchObject({
      backlog: 1,
      tasks: 2,
      findings: [],
    })
  })

  it('should count the declined folder, mirroring backlog and tasks', async () => {
    await seedTask('v1.0-first')
    await seedDeclinedTask('v9.0-declined')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({
      declined: 1,
      findings: [],
    })
  })

  it('should tolerate an absent declined folder', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ declined: 0 })
  })

  it('should report a task sitting on the board and the backlog both', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))
    await seedBacklog(['- [v1.0 first](v1.0-first.md)'])

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      { kind: 'row-duplicated', subject: 'v1.0-first' },
    ])
  })

  it('should report a backlog line whose task file is gone', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))
    await seedBacklog(['- [v9.0 gone](v9.0-gone.md)'])

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      { kind: 'task-unresolved', subject: 'v9.0-gone' },
    ])
  })

  it('should skip the backlog sibling when counting task files', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))
    await seedBacklog([])

    expect(await validateBoard(ROOT)).toMatchObject({ tasks: 1, findings: [] })
  })

  it('should skip the generated, ordering, and session siblings', async () => {
    await seedTask('v1.0-first')
    await seedTask('index')
    await seedTask('session')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ tasks: 1, findings: [] })
  })

  it('should skip a session map named for the session that wrote it', async () => {
    await seedTask('v1.0-first')
    await seedTask('session-feature-work')
    await seedTask('session-main')
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ tasks: 1, findings: [] })
  })

  it('should report a task carrying a row in two groups', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first' }]),
        '## Up next',
        '',
        '| Task | Touches | Waiting on |',
        '| ---- | ------- | ---------- |',
        '| [v1.0-first](v1.0-first.md) | `src/a.ts` | nothing |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['row-duplicated'])
  })

  it('should report two run now rows touching the same file', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`src/a.ts`, `docs/commands.md`' },
          { stem: 'v2.0-second', touches: '`src/b.ts`, `docs/commands.md`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      { kind: 'touches-collided', message: 'both touch docs/commands.md.' },
    ])
  })

  it('should report a directory colliding with a file inside it', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`src/tasks/`' },
          { stem: 'v2.0-second', touches: '`src/tasks/archive.ts`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['touches-collided'])
  })

  it('should name the row that claimed the containing path', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`src/tasks/archive.ts`' },
          { stem: 'v2.0-second', touches: '`src/tasks/`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'touches-collided',
        message: 'both touch src/tasks, which v2.0-second claims as a folder.',
      },
    ])
  })

  it('should report a run now row claiming a bare folder', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`src/tasks/`' },
          { stem: 'v2.0-second', touches: '`docs/commands.md`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.claims).toMatchObject([
      {
        group: 'Run now',
        subject: 'v1.0-first',
        message:
          'claims the whole src/tasks folder, so it collides with every row written under it.',
      },
    ])
  })

  it('should leave a resolving file with no extension out of the claims', async () => {
    await mkdir(join(ROOT, '.husky'), { recursive: true })
    await writeFile(join(ROOT, '.husky', 'pre-push'), '#!/bin/sh\n')
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        readyTable([
          { stem: 'v1.0-first', touches: '`.husky/pre-push`' },
          { stem: 'v2.0-second', touches: '`docs/commands.md`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.claims).toEqual([])
  })

  it('should report a run now table declaring no touches column', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v1.0-first')
    await seedPlan('v2.0-second')
    await seedBoard(
      boardBody([
        '## Run now',
        '',
        '| Task | Plan |',
        '| ---- | ---- |',
        '| [v1.0-first](v1.0-first.md) | [p](../plans/feature-v1.0-first.md) |',
        '| [v2.0-second](v2.0-second.md) | [p](../plans/feature-v2.0-second.md) |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual([
      'touches-unstated',
      'touches-unstated',
    ])
  })

  it('should report a run now row whose touches column names no file', async () => {
    await seedTask('v1.0-first')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([readyTable([{ stem: 'v1.0-first', touches: 'the board' }])]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['touches-unstated'])
  })

  it('should leave an up next collision unreported', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | v1.0-first |',
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should report a parked row whose cited task is archived', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedArchivedTask('v3.0-gone')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v3.0-gone](v3.0-gone.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-settled',
        message: 'waits on v3.0-gone, which is archived.',
      },
    ])
  })

  it('should report a parked row whose cited task was declined', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedDeclinedTask('v3.0-declined')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v3.0-declined](v3.0-declined.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-declined',
        message: 'waits on v3.0-declined, which was declined.',
      },
    ])
  })

  it('should report a cited task that is neither on the board nor archived', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v9.0-typo](v9.0-typo.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-unresolved',
        message:
          'waits on v9.0-typo, which is neither on the board nor archived.',
      },
    ])
  })

  it('should report a parked row whose cited pull request reached the trunk', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-settled',
        message:
          'waits on v1.0-first, whose pull request #673 reached the trunk.',
      },
    ])
  })

  it('should settle a parked row on the last pull request its blocker lists', async () => {
    await seedTask('v1.0-first', '- [x] shipped', [12, 673])
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-settled',
        message:
          'waits on v1.0-first, whose pull request #673 reached the trunk.',
      },
    ])
  })

  it('should not settle a parked row on an earlier pull request its blocker lists', async () => {
    await seedTask('v1.0-first', '- [x] shipped', [12, 673])
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(12))

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toEqual([])
  })

  it('should leave a parked row whose cited pull request is not on the trunk unreported', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding())

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toEqual([])
  })

  it('should park a row whose cited task closed every outcome but names no pull request', async () => {
    await seedTask('v1.0-first', '- [x] shipped')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        subject: 'v2.0-second',
        message:
          'waits on v1.0-first, which closed every outcome but names no pull request, so nothing tests whether the work reached the trunk.',
      },
    ])
  })

  it('should park a row whose trunk could not be read', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        subject: 'v2.0-second',
        message:
          'waits on v1.0-first, whose pull request #673 could not be read against the trunk.',
      },
    ])
  })

  it('should leave a parked row whose cited task has an open outcome unreported', async () => {
    await seedTask('v1.0-first', '- [x] one\n- [ ] two')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should leave a parked row whose cited task carries no outcome box unreported', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should ignore a checkbox inside a fenced block on the cited task', async () => {
    await seedTask(
      'v1.0-first',
      '- [x] shipped\n\n```markdown\n- [ ] a sample the task displays\n```',
      673,
    )
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['blocker-settled'])
  })

  it('should read no task out of a blocker cell pointing at a plan', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [second](../plans/feature-v2.0-second.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      { group: 'Up next', subject: 'v2.0-second' },
    ])
  })

  it('should resolve the task cited after a record link in a blocker cell', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [a record](../review/branch/review-blocker.md) answered it, then waits on [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['blocker-settled'])
  })

  it('should read no task out of a blocker cell citing only a record', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [a record](../review/branch/review-blocker.md) answered it |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      { group: 'Up next', subject: 'v2.0-second' },
    ])
  })

  it('should keep resolving a blocker cell whose task link comes first, before a later record link', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [v1.0-first](v1.0-first.md), settled by [a record](../review/branch/review-blocker.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['blocker-settled'])
  })

  it('should not stop at an in-page anchor link, whose target is empty rather than slashed', async () => {
    await seedTask('v1.0-first', '- [x] shipped', 673)
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | [see](#note) waits on [v1.0-first](v1.0-first.md) |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, trunkHolding(673))

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['blocker-settled'])
  })

  it('should report a parked row whose cited file nothing under run now holds', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/z.ts` | `src/z.ts`, held by the task already running |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-settled',
        subject: 'v2.0-second',
        message: 'waits on src/z.ts, which nothing under Run now holds.',
      },
    ])
  })

  it('should leave a parked row whose cited file is still held unreported', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/a.ts` | `src/a.ts`, held by the task already running |',
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should call a row untested when it declares files but its blocker cites none', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | `src/z.ts` | a published upstream release, cleared when it ships |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      { group: 'Up next', subject: 'v2.0-second' },
    ])
  })

  it('should report a parked row citing no task and naming no file as untested', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedPlan('v2.0-second')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        parkedTable([
          '| [v2.0-second](v2.0-second.md) | none yet | an operator run from a shell |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        group: 'Up next',
        subject: 'v2.0-second',
        message:
          'cites no task and no file, so neither half of its blocker is mechanical.',
      },
    ])
  })

  it('should report a needs a plan sequence carrying a gap, a duplicate, and a start other than first', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-a')
    await seedTask('v9.1-b')
    await seedTask('v9.2-c')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first' }]),
        '## Needs a plan',
        '',
        '| Task | Waiting on |',
        '| ---- | ---------- |',
        '| [v9.0-a](v9.0-a.md) | nothing, behind the merge-gate port. Second here |',
        '| [v9.1-b](v9.1-b.md) | nothing, beside the compaction row. Second here |',
        '| [v9.2-c](v9.2-c.md) | nothing yet. Fourth here |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      { kind: 'row-misordered', subject: 'v9.0-a' },
      { kind: 'row-misordered', subject: 'v9.2-c' },
    ])
  })

  it('should pass a needs a plan sequence whose ordinals match their position', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-a')
    await seedTask('v9.1-b')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first' }]),
        '## Needs a plan',
        '',
        '| Task | Waiting on |',
        '| ---- | ---------- |',
        '| [v9.0-a](v9.0-a.md) | nothing, behind the merge-gate port. First here |',
        '| [v9.1-b](v9.1-b.md) | Untestable from here, re-confirmed 2026-08-30. Last |',
        '',
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should report one finding per needs a plan row whose cell ranks it against nothing', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-a')
    await seedTask('v9.1-b')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first' }]),
        needsPlanTable([
          '| [v9.0-a](v9.0-a.md) | a plan, and it closes a gap the reference gate leaves open |',
          '| [v9.1-b](v9.1-b.md) | a plan, because a leaked link reaches one pull request |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'row-unranked',
        group: 'Needs a plan',
        subject: 'v9.0-a',
        message:
          'names no row or class it is ranked against, so its position 1 of 2 in Needs a plan records only when it was filed.',
      },
      { kind: 'row-unranked', subject: 'v9.1-b' },
    ])
  })

  it('should leave a needs a plan row carrying an ordinal out of the unranked finding', async () => {
    await seedTask('v1.0-first')
    await seedTask('v9.0-a')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first' }]),
        needsPlanTable([
          '| [v9.0-a](v9.0-a.md) | a plan settling what the sweep covers. First here |',
        ]),
      ]),
    )

    expect(await validateBoard(ROOT)).toMatchObject({ findings: [] })
  })

  it('should report a needs a plan row stating no file set as untested', async () => {
    await seedTask('v1.0-first')
    await seedTask('v3.0-third')
    await seedPlan('v1.0-first')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '`src/a.ts`' }]),
        '## Needs a plan',
        '',
        '| Task | Waiting on |',
        '| ---- | ---------- |',
        '| [v3.0-third](v3.0-third.md) | a plan settling what the sweep covers, and it opens the group |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        group: 'Needs a plan',
        subject: 'v3.0-third',
        message:
          'cites no task and no file, so neither half of its blocker is mechanical.',
      },
    ])
  })
})
