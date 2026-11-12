import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordDir } from '@/roots/record'
import {
  type Finding,
  validateBoard,
  type ValidateOptions,
} from '@/tasks/validate'
import {
  kinds,
  NO_PLAN,
  needsPlanBoard,
  needsPlanTable,
  parkedTable,
  readyTable,
  seedArchivedTask,
  seedBoard,
  seedDeclinedTask,
  seedTask,
  boardBody,
  UNREACHABLE_TRUNK,
  ROOT,
  useRoot,
} from './fixture'

useRoot()

describe('validateBoard verb-written shape', () => {
  async function seedDeclaringPlan(
    stem: string,
    files: readonly string[],
  ): Promise<void> {
    const plans = recordDir(ROOT, 'plans')
    mkdirSync(plans, { recursive: true })
    await writeFile(
      join(plans, `feature-${stem}.md`),
      `# ${stem}\n\n**Files to touch:**\n\n${files.map((file) => `- \`${file}\`: why`).join('\n')}\n`,
    )
  }

  it('should report a header that is not the set its group owns', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedBoard(
      boardBody([
        '## Needs a plan',
        '',
        '| Task | Touches | Waiting on |',
        '| ---- | ------- | ---------- |',
        '| [v9.0-a](v9.0-a.md) | `a.ts` | nothing yet, first here |',
        '',
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && kinds(outcome.findings)).toEqual([
      'columns-mismatched',
    ])
  })

  it('should report a Waiting on cell rendering past 120 characters', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedBoard(
      boardBody([
        needsPlanTable([
          `| [v9.0-a](v9.0-a.md) | ${'x'.repeat(110)}. First here |`,
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && kinds(outcome.findings)).toEqual(['cell-long'])
  })

  it('should pass a cell of 120 rendered characters whose link target runs it past', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedBoard(
      boardBody([
        needsPlanTable([
          `| [v9.0-a](v9.0-a.md) | [x](v8.0-a-very-long-target.md) ${'x'.repeat(118)} |`,
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && kinds(outcome.findings)).not.toContain('cell-long')
  })

  it('should report a Touches cell that differs from what the plan derives', async () => {
    await seedTask('v1.0-first')
    await seedDeclaringPlan('v1.0-first', ['src/b.ts'])
    await seedBoard(boardBody([readyTable([{ stem: 'v1.0-first' }])]))

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.findings).toMatchObject([
      { kind: 'touches-stale', subject: 'v1.0-first' },
    ])
  })

  it('should pass a Touches cell that matches the derivation', async () => {
    await seedTask('v1.0-first')
    await seedDeclaringPlan('v1.0-first', ['src/a.ts'])
    await seedBoard(
      boardBody([
        readyTable([{ stem: 'v1.0-first', touches: '1 file under `src/`' }]),
      ]),
    )

    expect(await validateBoard(ROOT, UNREACHABLE_TRUNK)).toMatchObject({
      findings: [],
    })
  })

  it('should list a path two plans declare under cells naming only folders', async () => {
    await seedTask('v1.0-first')
    await seedTask('v2.0-second')
    await seedDeclaringPlan('v1.0-first', ['src/a.ts', 'docs/commands.md'])
    await seedDeclaringPlan('v2.0-second', ['src/b.ts', 'docs/commands.md'])
    await seedBoard(
      boardBody([
        readyTable([
          {
            stem: 'v1.0-first',
            touches: '2 files under `src/`, `docs/`',
          },
          {
            stem: 'v2.0-second',
            touches: '2 files under `src/`, `docs/`',
          },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.findings).toEqual([])
    expect(outcome.ok && outcome.shared).toEqual([
      {
        group: 'Run now',
        subject: 'v1.0-first and v2.0-second',
        message: 'both touch docs/commands.md.',
      },
    ])
    expect(outcome.ok && outcome.claims).toEqual([])
  })

  it('should read the written cell of a row whose task is gone', async () => {
    await seedTask('v1.0-first')
    await seedDeclaringPlan('v1.0-first', ['docs/commands.md'])
    await seedBoard(
      boardBody([
        readyTable([
          {
            stem: 'v1.0-first',
            touches: '1 file under `docs/`',
          },
          { stem: 'v2.0-gone', touches: '`docs/commands.md`' },
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.shared).toMatchObject([
      {
        subject: 'v1.0-first and v2.0-gone',
        message: 'both touch docs/commands.md.',
      },
    ])
  })

  it('should settle a row waiting on a bare label whose task is archived', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedArchivedTask('v8.0-done')
    await seedBoard(
      boardBody([
        needsPlanTable(['| [v9.0-a](v9.0-a.md) | v8.0 merging. First here |']),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.findings).toMatchObject([
      {
        kind: 'blocker-settled',
        subject: 'v9.0-a',
        message: 'waits on v8.0-done, which is archived.',
      },
    ])
  })

  it('should read a bare label through the live task over a declined one', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedTask('v8.0-live', '- [ ] open', undefined, NO_PLAN)
    await seedDeclinedTask('v8.0-dropped')
    await seedBoard(
      boardBody([
        needsPlanTable(['| [v9.0-a](v9.0-a.md) | v8.0 merging. First here |']),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && kinds(outcome.findings)).not.toContain(
      'blocker-declined',
    )
    expect(outcome.ok && outcome.untested).toEqual([])
  })

  it('should not settle a row whose cell names archived history before its live blocker', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedArchivedTask('v7.0-history')
    await seedTask('v8.0-live', '- [ ] open', undefined, NO_PLAN)
    await seedBoard(
      boardBody([
        needsPlanTable([
          '| [v9.0-a](v9.0-a.md) | Reworked after v7.0, now waits on v8.0 merging. First here |',
        ]),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && kinds(outcome.findings)).toEqual([])
  })

  it('should leave a row untested when a bare label matches two live tasks', async () => {
    await seedTask('v9.0-a', '', undefined, NO_PLAN)
    await seedTask('v8.0-one', '', undefined, NO_PLAN)
    await seedTask('v8.0-two', '', undefined, NO_PLAN)
    await seedBoard(
      boardBody([
        needsPlanTable(['| [v9.0-a](v9.0-a.md) | v8.0 merging. First here |']),
      ]),
    )

    const outcome = await validateBoard(ROOT, UNREACHABLE_TRUNK)

    expect(outcome.ok && outcome.untested).toMatchObject([
      { subject: 'v9.0-a', message: expect.stringContaining('v8.0') },
    ])
  })
})

describe('validateBoard held rows', () => {
  const STEM = 'v3.0-third'
  const BRANCH = `feat/${STEM}`

  function readers(
    sessions: ReadonlyMap<string, string> | undefined,
    pulls: ReadonlyMap<string, string> | undefined,
    merged: boolean | 'unreadable' = false,
  ): ValidateOptions {
    return {
      live: {
        sessions: async () => sessions,
        pulls: async () => pulls,
        merged: async () => (merged === 'unreadable' ? undefined : merged),
      },
    }
  }

  const NOBODY = new Map<string, string>()
  const OPEN_PULL = new Map([[BRANCH, 'pull request #12']])
  const LIVE_SESSION = new Map([[BRANCH, 'session worker-a']])

  async function seedPlan(): Promise<void> {
    const plans = recordDir(ROOT, 'plans')
    mkdirSync(plans, { recursive: true })
    await writeFile(join(plans, `feature-${STEM}.md`), `# ${STEM}\n`)
  }

  async function seedUpNext(): Promise<void> {
    await seedPlan()
    await seedTask(STEM)
    await seedBoard(
      boardBody([
        parkedTable([`| [${STEM}](${STEM}.md) | \`src/a.ts\` | x |`]),
      ]),
    )
  }

  async function heldFindings(options: ValidateOptions): Promise<Finding[]> {
    const outcome = await validateBoard(ROOT, options)
    if (!outcome.ok) throw new Error(outcome.message)
    return outcome.findings.filter((finding) => finding.kind === 'row-held')
  }

  it('should report an Up next row an open pull request holds', async () => {
    await seedUpNext()

    const held = await heldFindings(readers(NOBODY, OPEN_PULL))

    expect(held).toMatchObject([{ group: 'Up next', subject: STEM }])
    expect(held[0]?.message).toContain('pull request #12')
  })

  it('should report an Up next row a live session holds', async () => {
    await seedUpNext()

    const held = await heldFindings(readers(LIVE_SESSION, NOBODY))

    expect(held).toMatchObject([{ group: 'Up next', subject: STEM }])
  })

  it('should not report a session still on a merged branch', async () => {
    await seedUpNext()

    expect(await heldFindings(readers(LIVE_SESSION, NOBODY, true))).toEqual([])
  })

  it('should keep a session hold when the merged read fails', async () => {
    await seedUpNext()

    const held = await heldFindings(readers(LIVE_SESSION, NOBODY, 'unreadable'))

    expect(held).toMatchObject([{ subject: STEM }])
  })

  it('should read pulls as unread when only the merged read fails', async () => {
    await seedUpNext()

    const outcome = await validateBoard(
      ROOT,
      readers(LIVE_SESSION, NOBODY, 'unreadable'),
    )

    expect(outcome).toMatchObject({
      ok: true,
      live: { sessions: 'read', pulls: 'unread' },
    })
  })

  it('should keep pulls as read when the merged read answers', async () => {
    await seedUpNext()

    const outcome = await validateBoard(
      ROOT,
      readers(LIVE_SESSION, NOBODY, true),
    )

    expect(outcome).toMatchObject({
      ok: true,
      live: { sessions: 'read', pulls: 'read' },
    })
  })

  it('should report a Needs a plan row a holder reaches', async () => {
    await seedPlan()
    await seedTask(STEM)
    await seedBoard(needsPlanBoard('nothing. First here'))

    const held = await heldFindings(readers(NOBODY, OPEN_PULL))

    expect(held).toMatchObject([{ group: 'Needs a plan', subject: STEM }])
  })

  it('should not report a held row under Run now', async () => {
    await seedPlan()
    await seedTask(STEM)
    await seedBoard(boardBody([readyTable([{ stem: STEM }])]))

    expect(await heldFindings(readers(LIVE_SESSION, OPEN_PULL))).toEqual([])
  })

  it('should not report a row nothing holds', async () => {
    await seedUpNext()

    const other = new Map([['main', 'session orchestrator']])

    expect(await heldFindings(readers(other, NOBODY))).toEqual([])
  })

  it('should not tie a row to the branch of an archived plan', async () => {
    await seedTask(STEM, '', undefined, `../plans/archive/feature-${STEM}.md`)
    await seedBoard(needsPlanBoard('nothing. First here'))

    expect(await heldFindings(readers(LIVE_SESSION, OPEN_PULL))).toEqual([])
  })

  it('should read an unreachable gh as unread, not clean', async () => {
    await seedUpNext()

    const outcome = await validateBoard(ROOT, readers(NOBODY, undefined))

    expect(outcome).toMatchObject({
      ok: true,
      live: { sessions: 'read', pulls: 'unread' },
    })
  })

  it('should still report from the source that read when the other failed', async () => {
    await seedUpNext()

    const held = await heldFindings(readers(LIVE_SESSION, undefined))

    expect(held).toMatchObject([{ subject: STEM }])
  })

  it('should read neither source when the run did not ask', async () => {
    await seedUpNext()

    const outcome = await validateBoard(ROOT)

    expect(outcome).toMatchObject({
      ok: true,
      live: { sessions: 'not-asked', pulls: 'not-asked' },
    })
  })
})
