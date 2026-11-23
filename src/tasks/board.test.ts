import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordDir } from '@/roots/record'
import { tasksDir } from '@/tasks/archive'
import {
  type Board,
  blockTask,
  deriveCells,
  moveTask,
  parseBoard,
  placeTask,
  promoteTask,
  renderBoard,
  touchesCell,
} from '@/tasks/board'
import { backlogPath, orderingPath } from '@/tasks/validate'

let ROOT: string

const FRONTMATTER = [
  '---',
  'title: Priority',
  'description: Execution order by readiness',
  '---',
  '',
  '# Priority',
]

function board(...sections: readonly string[]): string {
  return [...FRONTMATTER, '', ...sections].join('\n')
}

interface TaskFixture {
  readonly title?: string
  readonly plans?: readonly string[]
}

async function seedTask(
  stem: string,
  fixture: TaskFixture = {},
): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  const { title = `${stem}: A task`, plans = [] } = fixture
  const cites =
    plans.length > 0
      ? `Plan: ${plans.map((plan) => `[feature-${plan}](../plans/feature-${plan}.md)`).join(', ')}\n\n`
      : ''
  await writeFile(
    join(tasksDir(ROOT), `${stem}.md`),
    `---\ntitle: '${title}'\n---\n\n# ${title}\n\n${cites}## Outcomes\n\n- [ ] it ships\n`,
  )
}

async function seedPlan(slug: string, files: readonly string[]): Promise<void> {
  const dir = recordDir(ROOT, 'plans')
  mkdirSync(dir, { recursive: true })
  const listed = files.map((file) => `- \`${file}\`: why`).join('\n')
  await writeFile(
    join(dir, `feature-${slug}.md`),
    `# Feature: ${slug}\n\n**Files to touch:**\n\n${listed}\n\n**Verification:**\n\n- it works\n`,
  )
}

function parsed(text: string): Board {
  const outcome = parseBoard(text)
  if (!outcome.ok) throw new Error(`unparsed: ${outcome.line}`)
  return outcome.board
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-board-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('parseBoard', () => {
  it('should keep a row stranded after a closed table in its group', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Touches | Waiting on |',
      '| ---- | ------- | ---------- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | the gate |',
      '',
      '| [v1.1: Two](v1.1-two.md) | `b.ts` | v1.0 merging |',
    )

    expect(parsed(text).groups['Up next']).toEqual([
      { stem: 'v1.0-one', label: 'v1.0: One', waiting: 'the gate' },
      { stem: 'v1.1-two', label: 'v1.1: Two', waiting: 'v1.0 merging' },
    ])
  })

  it('should read the blocker under a header short a column', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v1.0: One](v1.0-one.md) | the gate |',
    )

    expect(parsed(text).groups['Up next'][0]?.waiting).toBe('the gate')
  })

  it('should read a board still headed Run now as In flight', () => {
    const text = board(
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | [one](../plans/feature-one.md) |',
    )

    expect(parsed(text).groups['In flight']).toEqual([
      { stem: 'v1.0-one', label: 'v1.0: One', waiting: undefined },
    ])
  })

  it('should refuse a board opening In flight beside Run now', () => {
    const text = board(
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | [one](../plans/feature-one.md) |',
      '',
      '## In flight',
      '',
      '| Task | Touches | Session |',
      '| ---- | ------- | ------- |',
      '| [v1.1: Two](v1.1-two.md) | `b.ts` | worker-two |',
    )

    expect(parseBoard(text)).toEqual({
      ok: false,
      line: '## In flight',
      kind: 'doubled',
    })
  })

  it('should read the Launch cell of an Up next row', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Touches | Launch | Waiting on |',
      '| ---- | ------- | ------ | ---------- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | worker, opus, high, hand (operator) | the gate |',
    )

    expect(parsed(text).groups['Up next'][0]?.launch).toEqual({
      role: 'worker',
      model: 'opus',
      effort: 'high',
      route: 'hand',
      override: true,
    })
  })

  it('should refuse a Launch cell it cannot read rather than drop it', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Touches | Launch | Waiting on |',
      '| ---- | ------- | ------ | ---------- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | opus please | the gate |',
    )

    expect(parseBoard(text)).toMatchObject({ ok: false, kind: 'row' })
  })

  it('should keep the model and effort an In flight Session cell carries', () => {
    const text = board(
      '## In flight',
      '',
      '| Task | Touches | Session |',
      '| ---- | ------- | ------- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | worker-one (sonnet, medium) |',
    )

    expect(parsed(text).groups['In flight'][0]?.pick).toEqual({
      model: 'sonnet',
      effort: 'medium',
    })
  })

  it('should refuse a pipe line that names no task', () => {
    const text = board(
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| a loose note | nothing |',
    )

    expect(parseBoard(text)).toEqual({
      ok: false,
      line: '| a loose note | nothing |',
      kind: 'row',
    })
  })

  it('should read the last cell of a row one short of a header ending in Waiting on', () => {
    const text = board(...UP_NEXT, '| [v1.0: One](v1.0-one.md) | the gate |')

    expect(parsed(text).groups['Up next'][0]?.waiting).toBe('the gate')
  })

  it('should refuse a row whose header carries no Waiting on rather than read a plan link as its blocker', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | [one](../plans/feature-one.md) |',
    )

    expect(parseBoard(text)).toMatchObject({ ok: false })
  })

  it('should refuse a row two cells short rather than read a path as its blocker', () => {
    const text = board(
      '## Up next',
      '',
      '| Task | Touches | Plan | Waiting on |',
      '| ---- | ------- | ---- | ---------- |',
      '| [v1.0: One](v1.0-one.md) | `z.ts` |',
    )

    expect(parseBoard(text)).toMatchObject({ ok: false })
  })

  it('should refuse a Needs a plan row carrying only its Task cell rather than read the link as its blocker', () => {
    const text = board(...NEEDS_A_PLAN, '| [v1.0: One](v1.0-one.md) |')

    expect(parseBoard(text)).toMatchObject({ ok: false })
  })

  it('should keep an escaped pipe inside a blocker cell', () => {
    const text = board(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | Waits on `a \\| b` merging |',
    )

    expect(parsed(text).groups['Needs a plan'][0]?.waiting).toBe(
      'Waits on `a \\| b` merging',
    )
  })
})

describe('touchesCell', () => {
  it('should count one file under its folder', () => {
    expect(touchesCell(['src/tasks/board.ts'])).toBe(
      '1 file under `src/tasks/`',
    )
  })

  it('should name one folder for paths sharing it, two segments deep', () => {
    expect(
      touchesCell([
        'claude/skills/task-board/SKILL.md',
        'claude/skills/task-board/references/board.md',
      ]),
    ).toBe('2 files under `claude/skills/`')
  })

  it('should name the two fullest folders and count the rest', () => {
    expect(
      touchesCell([
        'docs/a.md',
        'src/tasks/a.ts',
        'src/tasks/b.ts',
        'src/hooks/c.ts',
        'claude/skills/x/SKILL.md',
      ]),
    ).toBe('5 files under `src/tasks/`, `docs/`, and 2 more')
  })

  it('should name no folder for root files alone', () => {
    expect(touchesCell(['package.json', 'tsconfig.json'])).toBe('2 files')
  })

  it('should read empty for a plan declaring nothing', () => {
    expect(touchesCell([])).toBe('')
  })
})

describe('deriveCells', () => {
  it('should take the title from the H1 and link each live plan by its slug', async () => {
    await seedPlan('one', ['src/a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One thing', plans: ['one'] })

    expect(await deriveCells(ROOT, { stem: 'v1.0-one', label: 'old' })).toEqual(
      {
        task: '[v1.0: One thing](v1.0-one.md)',
        touches: '1 file under `src/`',
        plan: '[one](../plans/feature-one.md)',
        paths: ['src/a.ts'],
      },
    )
  })

  it('should count the union of a sliced task in line order once each', async () => {
    await seedPlan('first', ['src/a.ts', 'src/b.ts'])
    await seedPlan('second', ['src/b.ts', 'docs/c.md', 'src/d.ts'])
    await seedTask('v1.0-one', { plans: ['first', 'second'] })

    const cells = await deriveCells(ROOT, { stem: 'v1.0-one', label: '' })

    expect(cells.touches).toBe('4 files under `src/`, `docs/`')
    expect(cells.paths).toEqual([
      'src/a.ts',
      'src/b.ts',
      'docs/c.md',
      'src/d.ts',
    ])
    expect(cells.plan).toBe(
      '[first](../plans/feature-first.md), [second](../plans/feature-second.md)',
    )
  })

  it('should derive no plan and no files from an archived plan', async () => {
    const archive = recordDir(ROOT, 'plans', 'archive')
    mkdirSync(archive, { recursive: true })
    await writeFile(join(archive, 'feature-one.md'), '# Feature: one\n')
    mkdirSync(tasksDir(ROOT), { recursive: true })
    await writeFile(
      join(tasksDir(ROOT), 'v1.0-one.md'),
      '# v1.0: One\n\nPlan: [feature-one](../plans/archive/feature-one.md)\n',
    )

    const cells = await deriveCells(ROOT, { stem: 'v1.0-one', label: '' })

    expect(cells).toEqual({
      task: '[v1.0: One](v1.0-one.md)',
      touches: '',
      plan: '',
      paths: [],
    })
  })

  it('should keep the row label when the task file is gone', async () => {
    expect(
      await deriveCells(ROOT, { stem: 'v1.0-gone', label: 'v1.0: Gone' }),
    ).toEqual({
      task: '[v1.0: Gone](v1.0-gone.md)',
      touches: '',
      plan: '',
      paths: [],
    })
  })
})

describe('renderBoard', () => {
  it('should render one clean table per group from a broken board', async () => {
    await seedPlan('one', ['src/a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One', plans: ['one'] })
    await seedTask('v1.1-two', { title: 'v1.1: Two' })
    const text = board(
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0: One](v1.0-one.md) | `stale.ts` | [one](../plans/feature-one.md) |',
      '',
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '',
      '| [v1.1: Two](v1.1-two.md) | Not planned yet |',
    )

    expect(await renderBoard(ROOT, parsed(text))).toBe(
      [
        ...FRONTMATTER,
        '',
        '## In flight',
        '',
        '| Task | Touches | Session |',
        '| ---- | ------- | ------- |',
        '| [v1.0: One](v1.0-one.md) | 1 file under `src/` | no session recorded |',
        '',
        '## Up next',
        '',
        '| Task | Touches | Launch | Waiting on |',
        '| ---- | ------- | ------ | ---------- |',
        '',
        '## Needs a plan',
        '',
        '| Task | Waiting on |',
        '| ---- | ---------- |',
        '| [v1.1: Two](v1.1-two.md) | Not planned yet |',
        '',
      ].join('\n'),
    )
  })

  it('should keep a section that is not a group after the tables', async () => {
    const text = board('## Notes', '', 'Kept as written.', '')

    const rendered = await renderBoard(ROOT, parsed(text))

    expect(rendered.endsWith('## Notes\n\nKept as written.\n')).toBe(true)
  })

  it('should round trip a board it rendered', async () => {
    await seedTask('v1.1-two', { title: 'v1.1: Two' })
    const text = board(
      '## Needs a plan',
      '',
      '| Task | Waiting on |',
      '| ---- | ---------- |',
      '| [v1.1: Two](v1.1-two.md) | Not planned yet |',
    )
    const once = await renderBoard(ROOT, parsed(text))

    expect(await renderBoard(ROOT, parsed(once))).toBe(once)
  })
})

async function seedBoard(...sections: readonly string[]): Promise<void> {
  mkdirSync(tasksDir(ROOT), { recursive: true })
  await writeFile(orderingPath(ROOT), board(...sections))
}

type GroupName = 'In flight' | 'Up next' | 'Needs a plan'

async function stemsUnder(group: GroupName): Promise<string[]> {
  const outcome = parseBoard(await readFile(orderingPath(ROOT), 'utf8'))
  return outcome.ok ? outcome.board.groups[group].map((row) => row.stem) : []
}

const NEEDS_A_PLAN = [
  '## Needs a plan',
  '',
  '| Task | Waiting on |',
  '| ---- | ---------- |',
]

const UP_NEXT = [
  '## Up next',
  '',
  '| Task | Touches | Waiting on |',
  '| ---- | ------- | ---------- |',
]

const RUN_NOW_ONE = [
  '## Run now',
  '',
  '| Task | Touches | Plan |',
  '| ---- | ------- | ---- |',
  '| [v1.0: One](v1.0-one.md) | 1 file | [one](../plans/feature-one.md) |',
]

const IN_FLIGHT = [
  '## In flight',
  '',
  '| Task | Touches | Session |',
  '| ---- | ------- | ------- |',
]

describe('placeTask', () => {
  it('should place a backlog task and remove its backlog line in the same call', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN)
    await writeFile(
      backlogPath(ROOT),
      '# Backlog\n\n- [v1.0: One](v1.0-one.md)\n',
    )

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      waiting: 'Not planned yet',
    })

    expect(outcome).toMatchObject({ ok: true, from: 'backlog', backlog: true })
    expect(await readFile(backlogPath(ROOT), 'utf8')).toBe('# Backlog\n\n')
    expect(await stemsUnder('Needs a plan')).toEqual(['v1.0-one'])
  })

  it('should place a row before a named sibling', async () => {
    await seedTask('v1.0-one')
    await seedTask('v1.1-two')
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.1: Two](v1.1-two.md) | Not planned yet |',
    )

    await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      waiting: 'Not planned yet',
      position: { before: 'v1.1-two' },
    })

    expect(await stemsUnder('Needs a plan')).toEqual(['v1.0-one', 'v1.1-two'])
  })

  it('should keep a row at its position when a same-group edit names none', async () => {
    await seedTask('v1.0-one')
    await seedTask('v1.1-two')
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | old blocker |',
      '| [v1.1: Two](v1.1-two.md) | other |',
    )

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      waiting: 'new blocker',
    })

    expect(outcome).toMatchObject({ ok: true, position: 1, kept: true })
    expect(await stemsUnder('Needs a plan')).toEqual(['v1.0-one', 'v1.1-two'])
    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain('new blocker')
  })

  it('should still move a same-group row when a position is named', async () => {
    await seedTask('v1.0-one')
    await seedTask('v1.1-two')
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | old blocker |',
      '| [v1.1: Two](v1.1-two.md) | other |',
    )

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      position: { at: 'bottom' },
    })

    expect(outcome).toMatchObject({ ok: true, position: 2 })
    expect(outcome.ok && outcome.kept).toBeUndefined()
    expect(await stemsUnder('Needs a plan')).toEqual(['v1.1-two', 'v1.0-one'])
  })

  it('should give a row leaving In flight its Launch cell from its pick and a worker session', async () => {
    await seedPlan('one', ['a.ts'])
    mkdirSync(tasksDir(ROOT), { recursive: true })
    await writeFile(
      join(tasksDir(ROOT), 'v1.0-one.md'),
      [
        '# v1.0: One',
        '',
        'Plan: [feature-one](../plans/feature-one.md)',
        'Sessions: worker-one (22222222-2222-4222-8222-222222222222)',
        '',
        '## Outcomes',
        '',
        '- [ ] it ships',
        '',
      ].join('\n'),
    )
    await seedBoard(
      ...IN_FLIGHT,
      '| [v1.0: One](v1.0-one.md) | 1 file | worker-one (sonnet, medium) |',
    )

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Up next', {
      waiting: 'Planned, not dispatched yet',
    })

    expect(outcome).toMatchObject({ ok: true, launch: 'derived' })
    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain(
      'worker, sonnet, medium, background',
    )
  })

  it('should build no Launch cell for a row with no pick and report none', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One', plans: ['one'] })
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | Not planned yet |',
    )

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Up next', {
      waiting: 'Planned, not dispatched yet',
    })

    expect(outcome).toMatchObject({ ok: true, launch: 'none' })
    expect(await readFile(orderingPath(ROOT), 'utf8')).not.toContain(
      'background',
    )
  })

  it('should ask for a blocker when the group carries one and the row has none', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN)

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan')

    expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('should refuse a sibling the group does not hold', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN)

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      waiting: 'Not planned yet',
      position: { after: 'v9.9-nobody' },
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'bad-input' })
  })

  it('should refuse a task with no file', async () => {
    await seedBoard(...NEEDS_A_PLAN)

    const outcome = await placeTask(ROOT, 'v1.0-gone', 'Needs a plan', {
      waiting: 'Not planned yet',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should refuse a board holding a row it cannot read and leave it unwritten', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN, '| a loose note | nothing |')
    const before = await readFile(orderingPath(ROOT), 'utf8')

    const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
      waiting: 'Not planned yet',
    })

    expect(outcome).toMatchObject({ ok: false, reason: 'unreadable-row' })
    expect(await readFile(orderingPath(ROOT), 'utf8')).toBe(before)
  })

  it('should lose no row when two calls write the board at once', async () => {
    await seedTask('v1.0-one')
    await seedTask('v1.1-two')
    await seedBoard(...NEEDS_A_PLAN)

    const outcomes = await Promise.all([
      placeTask(ROOT, 'v1.0-one', 'Needs a plan', { waiting: 'first' }),
      placeTask(ROOT, 'v1.1-two', 'Needs a plan', { waiting: 'second' }),
    ])
    const landed = await stemsUnder('Needs a plan')

    expect(
      outcomes.map((outcome) =>
        outcome.ok ? landed.includes(outcome.stem) : outcome.reason,
      ),
    ).not.toContain(false)
  })

  describe('refuses', () => {
    it('an In flight row whose task cites no plan, on plan-unstated', async () => {
      await seedTask('v1.0-one')
      await seedBoard(...NEEDS_A_PLAN)

      const outcome = await placeTask(ROOT, 'v1.0-one', 'In flight')

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'group-rule',
        detail: expect.arrayContaining(['plan-unstated']),
      })
    })

    it('an In flight row whose plan lists no file, on touches-unstated', async () => {
      await seedPlan('one', [])
      await seedTask('v1.0-one', { plans: ['one'] })
      await seedBoard(...NEEDS_A_PLAN)

      const outcome = await placeTask(ROOT, 'v1.0-one', 'In flight')

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'group-rule',
        detail: ['touches-unstated'],
      })
    })

    it('an Up next row whose plan is archived, on plan-absent', async () => {
      const archive = recordDir(ROOT, 'plans', 'archive')
      mkdirSync(archive, { recursive: true })
      await writeFile(join(archive, 'feature-one.md'), '# Feature: one\n')
      mkdirSync(tasksDir(ROOT), { recursive: true })
      await writeFile(
        join(tasksDir(ROOT), 'v1.0-one.md'),
        '# v1.0: One\n\nPlan: [feature-one](../plans/archive/feature-one.md)\n',
      )
      await seedBoard(...UP_NEXT)

      const outcome = await placeTask(ROOT, 'v1.0-one', 'Up next', {
        waiting: 'Planned',
      })

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'group-rule',
        detail: ['plan-absent'],
      })
    })

    it('a Needs a plan row whose plan is live, on plan-parked', async () => {
      await seedPlan('one', ['a.ts'])
      await seedTask('v1.0-one', { plans: ['one'] })
      await seedBoard(...NEEDS_A_PLAN)

      const outcome = await placeTask(ROOT, 'v1.0-one', 'Needs a plan', {
        waiting: 'Not planned yet',
      })

      expect(outcome).toMatchObject({
        ok: false,
        reason: 'group-rule',
        detail: ['plan-parked'],
        message: expect.stringContaining('canon tasks block'),
      })
    })
  })
})

describe('promoteTask', () => {
  it('should move an Up next row to the bottom of In flight and drop its blocker', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One', plans: ['one'] })
    await seedBoard(
      ...UP_NEXT,
      '| [v1.0: One](v1.0-one.md) | `a.ts` | Planned, not dispatched yet |',
    )

    const outcome = await promoteTask(ROOT, 'v1.0-one')

    expect(outcome).toMatchObject({
      ok: true,
      group: 'In flight',
      from: 'Up next',
      position: 1,
    })
    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain(
      '| [v1.0: One](v1.0-one.md) | 1 file | no session recorded |',
    )
  })

  it('should carry the Launch pick into the Session cell and leave the Launch cell behind', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One', plans: ['one'] })
    await seedBoard(
      ...IN_FLIGHT,
      '',
      '## Up next',
      '',
      '| Task | Touches | Launch | Waiting on |',
      '| ---- | ------- | ------ | ---------- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | worker, sonnet, medium, background | Planned, not dispatched yet |',
    )

    await promoteTask(ROOT, 'v1.0-one')

    const text = await readFile(orderingPath(ROOT), 'utf8')
    expect(text).toContain(
      '| [v1.0: One](v1.0-one.md) | 1 file | no session recorded (sonnet, medium) |',
    )
    expect(text).not.toContain('worker, sonnet')
  })

  it('should name the last session the task records in the Session cell', async () => {
    await seedPlan('one', ['a.ts'])
    mkdirSync(tasksDir(ROOT), { recursive: true })
    await writeFile(
      join(tasksDir(ROOT), 'v1.0-one.md'),
      [
        '# v1.0: One',
        '',
        'Plan: [feature-one](../plans/feature-one.md)',
        'Sessions: planner-one (11111111-1111-4111-8111-111111111111), worker-one (22222222-2222-4222-8222-222222222222)',
        '',
        '## Outcomes',
        '',
        '- [ ] it ships',
        '',
      ].join('\n'),
    )
    await seedBoard(
      ...UP_NEXT,
      '| [v1.0: One](v1.0-one.md) | `a.ts` | Planned, not dispatched yet |',
    )

    await promoteTask(ROOT, 'v1.0-one')

    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain(
      '| [v1.0: One](v1.0-one.md) | 1 file | worker-one |',
    )
  })

  it('should carry a Needs a plan row into Up next as planned', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One', plans: ['one'] })
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | Not planned yet |',
    )

    await promoteTask(ROOT, 'v1.0-one')

    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain(
      '| [v1.0: One](v1.0-one.md) | 1 file |  | Planned, not dispatched yet |',
    )
  })

  it('should refuse a row already under In flight', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { plans: ['one'] })
    await seedBoard(...RUN_NOW_ONE)

    expect(await promoteTask(ROOT, 'v1.0-one')).toMatchObject({
      ok: false,
      reason: 'top-group',
    })
  })

  it('should refuse a task with no row', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN)

    expect(await promoteTask(ROOT, 'v1.0-one')).toMatchObject({
      ok: false,
      reason: 'no-row',
    })
  })
})

describe('moveTask', () => {
  it('should reposition a row after a sibling in its group', async () => {
    await seedTask('v1.0-one')
    await seedTask('v1.1-two')
    await seedBoard(
      ...NEEDS_A_PLAN,
      '| [v1.0: One](v1.0-one.md) | first |',
      '| [v1.1: Two](v1.1-two.md) | second |',
    )

    const outcome = await moveTask(ROOT, 'v1.0-one', { after: 'v1.1-two' })

    expect(outcome).toMatchObject({ ok: true, position: 2 })
    expect(await stemsUnder('Needs a plan')).toEqual(['v1.1-two', 'v1.0-one'])
  })

  it('should refuse a row named as its own sibling', async () => {
    expect(
      await moveTask(ROOT, 'v1.0-one', { before: 'v1.0-one' }),
    ).toMatchObject({ ok: false, reason: 'bad-input' })
  })
})

describe('blockTask', () => {
  it('should rewrite the blocker in place', async () => {
    await seedTask('v1.0-one', { title: 'v1.0: One' })
    await seedBoard(...NEEDS_A_PLAN, '| [v1.0: One](v1.0-one.md) | old |')

    await blockTask(ROOT, 'v1.0-one', 'the gate merging')

    expect(await readFile(orderingPath(ROOT), 'utf8')).toContain(
      '| [v1.0: One](v1.0-one.md) | the gate merging |',
    )
  })

  it('should accept 120 rendered characters whose raw cell runs past it', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN, '| [v1.0: One](v1.0-one.md) | old |')
    const cell = `[v1.1](v1.1-a-long-sibling-task-name.md) ${'x'.repeat(115)}`

    expect(await blockTask(ROOT, 'v1.0-one', cell)).toMatchObject({ ok: true })
  })

  it('should refuse 121 rendered characters', async () => {
    await seedTask('v1.0-one')
    await seedBoard(...NEEDS_A_PLAN, '| [v1.0: One](v1.0-one.md) | old |')

    expect(await blockTask(ROOT, 'v1.0-one', 'x'.repeat(121))).toMatchObject({
      ok: false,
      reason: 'cell-long',
    })
  })

  it('should refuse a row under Run now, which carries no blocker', async () => {
    await seedPlan('one', ['a.ts'])
    await seedTask('v1.0-one', { plans: ['one'] })
    await seedBoard(...RUN_NOW_ONE)

    expect(await blockTask(ROOT, 'v1.0-one', 'anything')).toMatchObject({
      ok: false,
      reason: 'no-column',
    })
  })
})
