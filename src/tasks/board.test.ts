import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordDir } from '@/roots/record'
import { tasksDir } from '@/tasks/archive'
import {
  type Board,
  deriveCells,
  parseBoard,
  renderBoard,
  touchesCell,
} from '@/tasks/board'

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

  it('should drop the blocker of a row under Run now, which owns no such column', () => {
    const text = board(
      '## Run now',
      '',
      '| Task | Touches | Plan |',
      '| ---- | ------- | ---- |',
      '| [v1.0: One](v1.0-one.md) | `a.ts` | [one](../plans/feature-one.md) |',
    )

    expect(parsed(text).groups['Run now'][0]?.waiting).toBeUndefined()
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
    })
  })
})

describe('touchesCell', () => {
  it('should list three paths with no tail', () => {
    expect(touchesCell(['a.ts', 'b.ts', 'c.ts'], 1)).toBe(
      '`a.ts`, `b.ts`, `c.ts`',
    )
  })

  it('should count a fourth path the plan lists', () => {
    expect(touchesCell(['a.ts', 'b.ts', 'c.ts', 'd.ts'], 1)).toBe(
      '`a.ts`, `b.ts`, `c.ts`, and 1 more files the plan lists',
    )
  })

  it('should name the plans in the plural for a sliced task', () => {
    expect(touchesCell(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'], 2)).toBe(
      '`a.ts`, `b.ts`, `c.ts`, and 2 more files the plans list',
    )
  })

  it('should read empty for a plan declaring nothing', () => {
    expect(touchesCell([], 1)).toBe('')
  })
})

describe('deriveCells', () => {
  it('should take the title from the H1 and link each live plan by its slug', async () => {
    await seedPlan('one', ['src/a.ts'])
    await seedTask('v1.0-one', { title: 'v1.0: One thing', plans: ['one'] })

    expect(await deriveCells(ROOT, { stem: 'v1.0-one', label: 'old' })).toEqual(
      {
        task: '[v1.0: One thing](v1.0-one.md)',
        touches: '`src/a.ts`',
        plan: '[one](../plans/feature-one.md)',
      },
    )
  })

  it('should union a sliced task in line order once each', async () => {
    await seedPlan('first', ['a.ts', 'b.ts'])
    await seedPlan('second', ['b.ts', 'c.ts', 'd.ts'])
    await seedTask('v1.0-one', { plans: ['first', 'second'] })

    const cells = await deriveCells(ROOT, { stem: 'v1.0-one', label: '' })

    expect(cells.touches).toBe(
      '`a.ts`, `b.ts`, `c.ts`, and 1 more files the plans list',
    )
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
    })
  })

  it('should keep the row label when the task file is gone', async () => {
    expect(
      await deriveCells(ROOT, { stem: 'v1.0-gone', label: 'v1.0: Gone' }),
    ).toEqual({ task: '[v1.0: Gone](v1.0-gone.md)', touches: '', plan: '' })
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
        '## Run now',
        '',
        '| Task | Touches | Plan |',
        '| ---- | ------- | ---- |',
        '| [v1.0: One](v1.0-one.md) | `src/a.ts` | [one](../plans/feature-one.md) |',
        '',
        '## Up next',
        '',
        '| Task | Touches | Waiting on |',
        '| ---- | ------- | ---------- |',
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
