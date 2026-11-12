import { mkdirSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordDir } from '@/roots/record'
import { tasksDir } from '@/tasks/archive'
import { type Finding, type FindingKind, validateBoard } from '@/tasks/validate'
import {
  boardBody,
  kinds,
  NO_PLAN,
  needsPlanBoard,
  needsPlanTable,
  parkedTable,
  readyTable,
  seedArchivedTask,
  seedBacklog,
  seedBoard,
  seedDeclinedTask,
  seedPlan,
  seedPlanLine,
  seedTask,
  SEVERAL_PLANS,
  trunkHolding,
  UNREACHABLE_TRUNK,
  ROOT,
  useRoot,
} from './fixture'

useRoot()

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

  it('should report a rowed task whose Sessions line carries a short id', async () => {
    await seedPlanLine(
      'v1.0-first',
      'Plan: [feature-v1.0-first](../plans/feature-v1.0-first.md)\nSessions: worker-canon-a (0b1c2d3e)',
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual([
      'sessions-misshapen',
    ])
  })

  it('should report a task file whose frontmatter will not parse', async () => {
    await seedTask('v1.0-first')
    await writeFile(
      join(tasksDir(ROOT), 'v1.0-first.md'),
      "---\ntitle: 'v1.0: Trim the Board's ad page'\ndescription: Demo\n---\n\n# v1.0: Trim\n\nPlan: [feature-v1.0-first](../plans/feature-v1.0-first.md)\n",
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual([
      'frontmatter-invalid',
    ])
  })

  it('should pass a task file whose title doubles its apostrophe', async () => {
    await seedTask('v1.0-first')
    await writeFile(
      join(tasksDir(ROOT), 'v1.0-first.md'),
      "---\ntitle: 'v1.0: Trim the Board''s ad page'\ndescription: Demo\n---\n\n# v1.0: Trim\n\nPlan: [feature-v1.0-first](../plans/feature-v1.0-first.md)\n",
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ ok: true, findings: [] })
  })

  it('should pass a rowed task whose Sessions line names full ids', async () => {
    await seedPlanLine(
      'v1.0-first',
      'Plan: [feature-v1.0-first](../plans/feature-v1.0-first.md)\nSessions: worker-canon-a (0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0), cloud-a (session_01AbC)',
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ ok: true, findings: [] })
  })

  it('should read a sliced run now row naming one of the links as agreeing', async () => {
    await seedPlanLine('v1.0-first', SEVERAL_PLANS('v1.0-first'))
    await seedPlan('v1.0-first')
    await seedPlan('other')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    expect(await validateBoard(ROOT)).toMatchObject({ ok: true, findings: [] })
  })

  it('should report a run now row naming none of the links', async () => {
    await seedPlanLine('v1.0-first', SEVERAL_PLANS('v1.0-first'))
    await seedPlan('v1.0-first')
    await seedPlan('other')
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', plan: '../plans/feature-third.md' }]),
      ]),
    )
    await seedPlan('third')

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-mismatched'])
    expect(outcome.ok && outcome.findings[0]).toMatchObject({
      message: expect.stringContaining('none of the links'),
    })
  })

  it('should report a run now line linking one plan twice', async () => {
    await seedPlanLine(
      'v1.0-first',
      'Plan: [a](../plans/feature-v1.0-first.md), [b](.canon/plans/feature-v1.0-first.md)',
    )
    await seedPlan('v1.0-first')
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-several'])
    expect(outcome.ok && outcome.findings[0]).toMatchObject({
      group: 'Run now',
      subject: 'v1.0-first',
      message: expect.stringContaining('the same plan twice'),
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

    it('should leave a sliced up next row with one live link unreported', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      expect(await validateBoard(ROOT)).toMatchObject({
        ok: true,
        findings: [],
      })
    })

    it('should leave a sliced up next row with an archived and a live link unreported', async () => {
      await seedPlanLine(
        'v3.0-third',
        'Plan: [old](../plans/archive/feature-old.md), [live](../plans/feature-v3.0-third.md)',
      )
      await seedArchivedPlan('old')
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      expect(await validateBoard(ROOT)).toMatchObject({
        ok: true,
        findings: [],
      })
    })

    it('should report a sliced up next row whose links are all absent', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedBoard(boardBody([parkedTable([upNextRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-absent',
      ])
    })

    it('should report a sliced needs a plan row when any link is live', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && claimKinds(outcome.findings)).toEqual([
        'plan-parked',
      ])
    })

    it('should leave a sliced needs a plan row with no live link unreported', async () => {
      await seedPlanLine('v3.0-third', SEVERAL_PLANS('v3.0-third'))
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      expect(await validateBoard(ROOT)).toMatchObject({
        ok: true,
        findings: [],
      })
    })

    it('should report a parked row whose line links one plan twice', async () => {
      await seedPlanLine(
        'v3.0-third',
        'Plan: [a](../plans/feature-v3.0-third.md), [b](.canon/plans/feature-v3.0-third.md)',
      )
      await seedPlan('v3.0-third')
      await seedBoard(boardBody([needsPlanTable([needsPlanRow])]))

      const outcome = await validateBoard(ROOT)

      expect(outcome.ok && kinds(outcome.findings)).toEqual(['plan-several'])
      expect(outcome.ok && outcome.findings[0]).toMatchObject({
        group: 'Needs a plan',
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

  it('should leave the findings empty for two run now rows sharing a file', async () => {
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

    expect(outcome.ok && outcome.findings).toEqual([])
  })

  it('should list a directory sharing a file inside it', async () => {
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

    expect(outcome.ok && outcome.shared).toMatchObject([
      { subject: 'v1.0-first and v2.0-second' },
    ])
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

    expect(outcome.ok && outcome.shared).toMatchObject([
      {
        message: 'both touch src/tasks, which v2.0-second claims as a folder.',
      },
    ])
  })

  it('should list two run now rows sharing a file as shared', async () => {
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

    expect(outcome.ok && outcome.shared).toEqual([
      {
        group: 'Run now',
        subject: 'v1.0-first and v2.0-second',
        message: 'both touch docs/commands.md.',
      },
    ])
  })

  it('should report an empty shared list on a board with no run now rows', async () => {
    await seedTask('v3.0-third')
    await seedBoard(needsPlanBoard('a plan'))

    const outcome = await validateBoard(ROOT)

    expect(outcome.ok && outcome.shared).toEqual([])
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
      'columns-mismatched',
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

  it('should read a cited task made only of operator checks as closed', async () => {
    await seedTask('v1.0-first', '- [ ] Operator check: run it on a Mac')
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

    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        subject: 'v2.0-second',
        message: expect.stringContaining('names no pull request'),
      },
    ])
  })

  it('should read a cited task holding only operator checks open as closed', async () => {
    await seedTask(
      'v1.0-first',
      '- [x] shipped\n- [ ] Operator check: run it on a Mac',
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

    expect(outcome.ok && outcome.untested).toMatchObject([
      {
        subject: 'v2.0-second',
        message: expect.stringContaining('names no pull request'),
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

  it('should leave a row untested when the cited task carries a pending branch', async () => {
    await seedTask('v1.0-first', '- [x] shipped\n\nPending branch: feat/a', 673)
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

    expect(outcome.ok && kinds(outcome.findings)).not.toContain(
      'blocker-settled',
    )
    expect(outcome.ok && outcome.untested).toMatchObject([
      { group: 'Up next', subject: 'v2.0-second' },
    ])
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
