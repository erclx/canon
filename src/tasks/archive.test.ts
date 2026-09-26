import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  archiveDir,
  archiveTask,
  declinedDir,
  declineLine,
  declineTask,
  describeUnmatchedStem,
  planCitations,
  readOutcomes,
  readPlanTarget,
  readPlanTargets,
  readPullRequest,
  rebaseRelativeLinks,
  removeBacklogRow,
  removePriorityRow,
  retargetPlanLine,
  tasksDir,
} from '@/tasks/archive'

let ROOT: string

const INDEX_SEED = `---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label
`

interface TaskFixture {
  readonly stem?: string
  readonly pullRequest?: number | readonly number[]
  readonly plan?: string
  readonly planLine?: string
  readonly ready?: string
  readonly outcomes?: string
  readonly pending?: readonly string[]
}

function taskBody({
  pullRequest,
  plan,
  planLine,
  ready,
  outcomes = '- [x] Outcome: it shipped',
  pending,
}: TaskFixture): string {
  const lines = [
    '---',
    "title: 'v28.1: A task'",
    'description: One line on what this task achieves',
    '---',
    '',
    '# v28.1: A task',
    '',
  ]

  if (plan) lines.push(`Plan: [${plan}](${plan})`)
  if (planLine) lines.push(planLine)
  if (ready) lines.push(`Ready: [${ready}](../ready/${ready}/)`)
  if (pullRequest) {
    const numbers =
      typeof pullRequest === 'number' ? [pullRequest] : pullRequest
    lines.push(
      `Pull request: ${numbers.map((number) => `#${number}`).join(', ')}`,
    )
  }
  if (pending) lines.push(`Pending branch: ${pending.join(', ')}`)

  lines.push(
    '',
    '## Outcomes',
    '',
    outcomes,
    '',
    '## Findings',
    '',
    '- A note.',
  )

  return `${lines.join('\n')}\n`
}

async function seedPlan(name = 'feature-trigger.md'): Promise<string> {
  const dir = join(ROOT, '.canon', 'plans')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  await writeFile(path, '# Feature: the plan a task cites\n')
  return path
}

function archivedPlan(name = 'feature-trigger.md'): string {
  return join(ROOT, '.canon', 'plans', 'archive', name)
}

async function seedTask(fixture: TaskFixture = {}): Promise<string> {
  const stem = fixture.stem ?? 'v28.1-trigger-escalation'
  const dir = tasksDir(ROOT)
  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, 'index.md'), INDEX_SEED)
  await writeFile(join(dir, `${stem}.md`), taskBody(fixture))
  return stem
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-archive-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('tasksDir', () => {
  it('should resolve the board at the new record root when it carries one', () => {
    mkdirSync(join(ROOT, '.canon', 'tasks'), { recursive: true })

    expect(tasksDir(ROOT)).toBe(join(ROOT, '.canon', 'tasks'))
    expect(archiveDir(ROOT)).toBe(join(ROOT, '.canon', 'tasks', 'archive'))
  })

  it('should resolve the board at the old root when the new one is absent', () => {
    mkdirSync(join(ROOT, '.claude', 'tasks'), { recursive: true })

    expect(tasksDir(ROOT)).toBe(join(ROOT, '.claude', 'tasks'))
    expect(archiveDir(ROOT)).toBe(join(ROOT, '.claude', 'tasks', 'archive'))
  })

  it('should create the board at the new root now the move has landed', () => {
    expect(tasksDir(ROOT)).toBe(join(ROOT, '.canon', 'tasks'))
  })
})

describe('readOutcomes', () => {
  it('should split outcomes by checkbox state', () => {
    const text = '- [x] Outcome: shipped\n- [ ] Outcome: pending\n'

    expect(readOutcomes(text)).toEqual({
      open: ['Outcome: pending'],
      closed: ['Outcome: shipped'],
      cut: [],
    })
  })

  it('should ignore bullets that carry no checkbox', () => {
    expect(readOutcomes('- A finding, not an outcome\n')).toEqual({
      open: [],
      closed: [],
      cut: [],
    })
  })

  it('should treat an uppercase mark as closed', () => {
    expect(readOutcomes('- [X] Outcome: shipped\n').closed).toEqual([
      'Outcome: shipped',
    ])
  })

  it('should ignore a checkbox inside a fenced block', () => {
    const text =
      '```markdown\n- [ ] Outcome: a sample\n```\n- [x] Outcome: real\n'

    expect(readOutcomes(text)).toEqual({
      open: [],
      closed: ['Outcome: real'],
      cut: [],
    })
  })

  it('should read a struck outcome with no checkbox as cut', () => {
    expect(readOutcomes('- ~~Outcome: dropped~~ Cut 2026-09-02\n')).toEqual({
      open: [],
      closed: [],
      cut: ['~~Outcome: dropped~~ Cut 2026-09-02'],
    })
  })

  it('should read a struck outcome as cut with its checkbox open', () => {
    expect(readOutcomes('- [ ] ~~Outcome: dropped~~\n').open).toEqual([])
    expect(readOutcomes('- [ ] ~~Outcome: dropped~~\n').cut).toEqual([
      '~~Outcome: dropped~~',
    ])
  })

  it('should read a struck outcome as cut with its checkbox closed', () => {
    const text = '- [x] ~~Outcome: dropped~~ Cut 2026-09-02\n'

    expect(readOutcomes(text).closed).toEqual([])
    expect(readOutcomes(text).cut).toEqual([
      '~~Outcome: dropped~~ Cut 2026-09-02',
    ])
  })
})

describe('readPullRequest', () => {
  it('should read the number from the pull request line', () => {
    expect(readPullRequest('Pull request: #673\n')).toEqual([673])
  })

  it('should read every number on a list line, oldest first', () => {
    expect(readPullRequest('Pull request: #12, #673, #700\n')).toEqual([
      12, 673, 700,
    ])
  })

  it('should return no number when the line carries anything besides the list', () => {
    expect(readPullRequest('Pull request: #12, #673 (closed)\n')).toEqual([])
  })

  it('should return no number when the line is absent', () => {
    expect(readPullRequest('Issue: #12\n')).toEqual([])
  })

  it('should not read a number out of prose naming a pull request', () => {
    expect(readPullRequest('Split from #646, which shipped.\n')).toEqual([])
  })
})

describe('readPlanTarget', () => {
  it('should read the target out of a markdown link', () => {
    expect(readPlanTarget('Plan: [feature-x](../plans/feature-x.md)\n')).toBe(
      '../plans/feature-x.md',
    )
  })

  it('should read the older bare path form', () => {
    expect(readPlanTarget('Plan: ../plans/feature-x.md\n')).toBe(
      '../plans/feature-x.md',
    )
  })

  it('should return undefined when there is no plan line', () => {
    expect(readPlanTarget('Issue: #12\n')).toBeUndefined()
  })

  it('should return undefined when the line links several plans', () => {
    expect(
      readPlanTarget('Plan: [a](../plans/a.md), [b](../plans/b.md)\n'),
    ).toBeUndefined()
  })

  it('should skip a plan line inside a fenced sample above the real one', () => {
    const text = [
      '```markdown',
      'Plan: [sample](../plans/sample.md)',
      '```',
      '',
      'Plan: [real](../plans/real.md)',
      '',
    ].join('\n')

    expect(readPlanTarget(text)).toBe('../plans/real.md')
  })
})

describe('readPlanTargets', () => {
  it('should read the one target out of a single link', () => {
    expect(
      readPlanTargets('Plan: [feature-x](../plans/feature-x.md)\n'),
    ).toEqual(['../plans/feature-x.md'])
  })

  it('should read every target out of comma-separated links', () => {
    expect(
      readPlanTargets(
        'Plan: [feature-x](../plans/feature-x.md), [feature-y](../plans/feature-y.md)\n',
      ),
    ).toEqual(['../plans/feature-x.md', '../plans/feature-y.md'])
  })

  it('should read every target out of space-separated links', () => {
    expect(
      readPlanTargets(
        'Plan: [feature-x](../plans/feature-x.md) [feature-y](../plans/feature-y.md)\n',
      ),
    ).toEqual(['../plans/feature-x.md', '../plans/feature-y.md'])
  })

  it('should read one target out of a link followed by prose', () => {
    expect(
      readPlanTargets(
        'Plan: [feature-x](../plans/feature-x.md) (superseded)\n',
      ),
    ).toEqual(['../plans/feature-x.md'])
  })

  it('should read the older bare path form', () => {
    expect(readPlanTargets('Plan: ../plans/feature-x.md\n')).toEqual([
      '../plans/feature-x.md',
    ])
  })

  it('should read every path out of a bare line listing several', () => {
    expect(
      readPlanTargets('Plan: ../plans/feature-x.md ../plans/feature-y.md\n'),
    ).toEqual(['../plans/feature-x.md', '../plans/feature-y.md'])
  })

  it('should read every path out of a comma-separated bare line', () => {
    expect(readPlanTargets('Plan: feature-x.md, feature-y.md\n')).toEqual([
      'feature-x.md',
      'feature-y.md',
    ])
  })

  it('should not read trailing prose on a bare line as further plans', () => {
    expect(
      readPlanTargets('Plan: ../plans/feature-x.md see the notes\n'),
    ).toEqual(['../plans/feature-x.md'])
  })

  it('should not read a path inside trailing prose on a bare line as a plan', () => {
    expect(
      readPlanTargets('Plan: ../plans/feature-x.md (see ../notes/y.md)\n'),
    ).toEqual(['../plans/feature-x.md'])
  })

  it('should fall back to the first token when no bare token reads as a path', () => {
    expect(readPlanTargets('Plan: pending review\n')).toEqual(['pending'])
  })

  it('should read the real line below a fenced sample', () => {
    const text = [
      '```markdown',
      'Plan: [a](../plans/a.md), [b](../plans/b.md)',
      '```',
      '',
      'Plan: [c](../plans/c.md)',
      '',
    ].join('\n')

    expect(readPlanTargets(text)).toEqual(['../plans/c.md'])
  })

  it('should return no targets when there is no plan line', () => {
    expect(readPlanTargets('Issue: #12\n')).toEqual([])
  })

  it('should skip a plan line displayed inside a fenced sample', () => {
    const text = [
      '```markdown',
      'Plan: [a](../plans/a.md), [b](../plans/b.md)',
      '```',
      '',
    ].join('\n')

    expect(readPlanTargets(text)).toEqual([])
  })
})

describe('retargetPlanLine', () => {
  function moving(from: string, to: string): ReadonlyMap<string, string> {
    return new Map([[from, to]])
  }

  it('should rewrite the link text and the target together', () => {
    const text = 'Plan: [feature-x](../plans/feature-x.md)\n'

    expect(
      retargetPlanLine(
        text,
        moving('../plans/feature-x.md', '../../plans/archive/feature-x.md'),
      ),
    ).toBe('Plan: [feature-x](../../plans/archive/feature-x.md)\n')
  })

  it('should rewrite the older bare path form as a link', () => {
    const text = 'Plan: ../plans/feature-x.md\n'

    expect(
      retargetPlanLine(
        text,
        moving('../plans/feature-x.md', '../../plans/archive/feature-x.md'),
      ),
    ).toBe('Plan: [feature-x](../../plans/archive/feature-x.md)\n')
  })

  it('should write a target carrying a substitution sequence literally', () => {
    const text = 'Plan: [feature-x](../plans/feature-x.md)\n'

    expect(
      retargetPlanLine(
        text,
        moving('../plans/feature-x.md', "../../plans/archive/f$&$'-x.md"),
      ),
    ).toContain("(../../plans/archive/f$&$'-x.md)")
  })

  it('should leave text carrying no plan line untouched', () => {
    expect(
      retargetPlanLine('Issue: #12\n', moving('../plans/x.md', '../y.md')),
    ).toBe('Issue: #12\n')
  })

  it('should rewrite only the mapped link on a line linking two plans', () => {
    const text = 'Plan: [a](../plans/a.md), [b](../plans/b.md)\n'

    expect(
      retargetPlanLine(text, moving('../plans/b.md', '../plans/archive/b.md')),
    ).toBe('Plan: [a](../plans/a.md), [b](../plans/archive/b.md)\n')
  })

  it('should write a substitution sequence literally on a line linking two plans', () => {
    const text = 'Plan: [a](../plans/a.md), [b](../plans/b.md)\n'

    expect(
      retargetPlanLine(
        text,
        moving('../plans/b.md', '../plans/archive/b$&$1.md'),
      ),
    ).toBe('Plan: [a](../plans/a.md), [b$&$1](../plans/archive/b$&$1.md)\n')
  })

  it('should rewrite the mapped paths on a bare line listing two plans', () => {
    const text = 'Plan: ../plans/a.md ../plans/b.md\n'

    expect(
      retargetPlanLine(text, moving('../plans/a.md', '../plans/archive/a.md')),
    ).toBe('Plan: [a](../plans/archive/a.md) ../plans/b.md\n')
  })

  it('should leave a plan line inside a fenced sample alone', () => {
    const text = [
      '```markdown',
      'Plan: [x](../plans/x.md)',
      '```',
      '',
      'Plan: [x](../plans/x.md)',
      '',
    ].join('\n')

    expect(
      retargetPlanLine(text, moving('../plans/x.md', '../plans/archive/x.md')),
    ).toBe(
      [
        '```markdown',
        'Plan: [x](../plans/x.md)',
        '```',
        '',
        'Plan: [x](../plans/archive/x.md)',
        '',
      ].join('\n'),
    )
  })
})

describe('rebaseRelativeLinks', () => {
  const FROM = '/repo/.canon/tasks'
  const TO = '/repo/.canon/tasks/archive'

  it('should re-resolve a plan link whose target stayed put', () => {
    const text = 'Plan: [feature-x](../plans/feature-x.md)\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(
      'Plan: [feature-x](../../plans/feature-x.md)\n',
    )
  })

  it('should re-resolve untouched Groundwork and Intake links', () => {
    const text =
      'Groundwork: [g](../groundwork/01-g/)\nIntake: [i](../intake/02-i/item.md)\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(
      'Groundwork: [g](../../groundwork/01-g/)\nIntake: [i](../../intake/02-i/item.md)\n',
    )
  })

  it('should re-resolve a bare-path origin line and keep its trailing slash', () => {
    const text = 'Plan: ../plans/feature-x.md\nReady: ../ready/01-x/\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(
      'Plan: ../../plans/feature-x.md\nReady: ../../ready/01-x/\n',
    )
  })

  it('should leave a bare origin value that is not a path alone', () => {
    const text = 'Plan: none\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(text)
  })

  it('should re-resolve a link in the body and keep its fragment', () => {
    const text = 'See [the finding](./other.md#why) for detail.\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(
      'See [the finding](../other.md#why) for detail.\n',
    )
  })

  it('should leave a link inside a fenced block alone', () => {
    const text = '```md\n[x](../plans/feature-x.md)\n```\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(text)
  })

  it('should leave a link inside an inline code span alone', () => {
    const text = 'Write `[x](../a.md)` as shown, then see [y](../b.md).\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(
      'Write `[x](../a.md)` as shown, then see [y](../../b.md).\n',
    )
  })

  it('should leave absolute urls, anchors, and rooted paths alone', () => {
    const text =
      '[a](https://example.com/x) [b](#section) [c](/abs/path.md) [d](mailto:a@b.c)\n'

    expect(rebaseRelativeLinks(text, FROM, TO)).toBe(text)
  })
})

describe('removePriorityRow', () => {
  it('should drop the row linking to the archived task', () => {
    const text = [
      '| Task | Touches |',
      '| ---- | ------- |',
      '| [v28.1 escalation](v28.1-trigger-escalation.md) | `src/tasks/` |',
      '| [v32.1 globs](v32.1-sync-glob-narrowing.md) | `scripts/` |',
    ].join('\n')

    const result = removePriorityRow(text, 'v28.1-trigger-escalation')

    expect(result.removed).toBe(true)
    expect(result.text).not.toContain('v28.1-trigger-escalation.md')
    expect(result.text).toContain('v32.1-sync-glob-narrowing.md')
  })

  it('should leave prose naming the task untouched', () => {
    const text = 'The v28.1-trigger-escalation.md track runs first.'

    expect(removePriorityRow(text, 'v28.1-trigger-escalation')).toEqual({
      text,
      removed: false,
    })
  })

  it('should report nothing removed when no row matches', () => {
    const text = '| [v32.1 globs](v32.1-sync-glob-narrowing.md) | `scripts/` |'

    expect(removePriorityRow(text, 'v28.1-trigger-escalation').removed).toBe(
      false,
    )
  })

  it('should keep a row that only names the task as a blocker', () => {
    const text = [
      '| [v28.1 escalation](v28.1-trigger-escalation.md) | `src/tasks/` |',
      '| [v17.4 roadmap](v17.4-roadmap-lifecycle-gate.md) | waits on [v28.1](v28.1-trigger-escalation.md) |',
    ].join('\n')

    const result = removePriorityRow(text, 'v28.1-trigger-escalation')

    expect(result.text).toContain('v17.4-roadmap-lifecycle-gate.md')
    expect(result.text).not.toContain('| [v28.1 escalation]')
  })
})

describe('archiveTask', () => {
  it('should rebase links whose targets stayed put', async () => {
    const stem = await seedTask()
    const path = join(tasksDir(ROOT), `${stem}.md`)
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      text.replace(
        '# v28.1: A task\n',
        '# v28.1: A task\n\nGroundwork: [g](../groundwork/01-g/)\n',
      ),
    )

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain('Groundwork: [g](../../groundwork/01-g/)')
  })

  it('should keep a moved plan on its retargeted line after rebasing', async () => {
    await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain('(../../plans/archive/feature-trigger.md)')
  })

  it('should move a closed task into the archive', async () => {
    const stem = await seedTask()

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result.ok).toBe(true)
    expect(existsSync(join(tasksDir(ROOT), `${stem}.md`))).toBe(false)
    expect(existsSync(join(archiveDir(ROOT), `${stem}.md`))).toBe(true)
  })

  it('should refuse a task carrying an open outcome', async () => {
    const stem = await seedTask({
      outcomes: '- [x] Outcome: shipped\n- [ ] Outcome: pending',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: false,
      reason: 'open-outcomes',
      detail: ['Outcome: pending'],
    })
    expect(existsSync(join(tasksDir(ROOT), `${stem}.md`))).toBe(true)
  })

  it('should refuse a task carrying no outcomes at all', async () => {
    const stem = await seedTask({ outcomes: '- A note, not an outcome' })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: false,
      reason: 'no-outcomes',
    })
  })

  it('should archive a task whose outcomes are entirely cut', async () => {
    const stem = await seedTask({
      outcomes: '- ~~Outcome: dropped~~ Cut 2026-09-02',
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      closed: 0,
      cut: 1,
    })
  })

  it('should report both counts on a task mixing closed and cut outcomes', async () => {
    const stem = await seedTask({
      outcomes:
        '- [x] Outcome: shipped\n- [x] ~~Outcome: dropped~~ Cut 2026-09-02',
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      closed: 1,
      cut: 1,
    })
  })

  it('should refuse a stem that is not on the board', async () => {
    await seedTask()

    expect(
      await archiveTask(ROOT, { kind: 'stem', stem: 'v99.9-absent' }),
    ).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should name the one task a prefix resolves to, distinct from absence', async () => {
    const stem = await seedTask()

    expect(await archiveTask(ROOT, { kind: 'stem', stem: 'v28.1' })).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'no-match',
        message: `v28.1 does not name a task by itself. One task starts with it: ${stem}. Pass the full name instead.`,
        detail: [stem],
      }),
    )
  })

  it('should name the count when a prefix resolves to several tasks', async () => {
    const first = await seedTask({ stem: 'v28.1-alpha' })
    const second = await seedTask({ stem: 'v28.1-beta' })

    expect(await archiveTask(ROOT, { kind: 'stem', stem: 'v28.1' })).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'ambiguous',
        message:
          'v28.1 does not name a task by itself. 2 tasks start with it. Pass the full name instead.',
        detail: [first, second],
      }),
    )
  })

  it('should refuse when the board does not exist', async () => {
    expect(
      await archiveTask(ROOT, { kind: 'stem', stem: 'v28.1-anything' }),
    ).toMatchObject({ ok: false, reason: 'no-board' })
  })

  it('should carry the live plan of the last task citing it', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      plans: [{ from: plan, to: archivedPlan() }],
    })
    expect(existsSync(plan)).toBe(false)
    expect(existsSync(archivedPlan())).toBe(true)
  })

  it('should point the archived task at the archived plan', async () => {
    await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md)\n\n## Outcomes',
    )
  })

  it('should leave a live plan another task still cites', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '../plans/feature-trigger.md',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.plans).toEqual([])
    expect(existsSync(plan)).toBe(true)
  })

  it('should count two spellings of one live plan as a single citation', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '.claude/plans/feature-trigger.md',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true })
    expect(existsSync(plan)).toBe(true)
  })

  it('should carry the plan once the last sibling sharing it has archived', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '../plans/feature-other.md',
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      plans: [{ from: plan, to: archivedPlan() }],
    })
  })

  it('should archive a task whose plan target names no file', async () => {
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.plans).toEqual([])
    expect(existsSync(archivedPlan())).toBe(false)
  })

  it('should accept a task pointing at an archived plan', async () => {
    const stem = await seedTask({
      plan: '../plans/archive/feature-trigger.md',
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
    })
  })

  it('should not read a sibling of the plans folder as a live plan', async () => {
    const stem = await seedTask({ plan: '../plans-legacy/feature-trigger.md' })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
    })
  })

  it('should leave a plan a multi-link sibling still cites', async () => {
    const plan = await seedPlan()
    await seedPlan('feature-other.md')
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      planLine:
        'Plan: [feature-other](../plans/feature-other.md), [feature-trigger](../plans/feature-trigger.md)',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result.ok && result.plans).toEqual([])
    expect(existsSync(plan)).toBe(true)
    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [../plans/feature-trigger.md](../../plans/feature-trigger.md)',
    )
  })

  it('should carry every uncited plan a multi-link task names', async () => {
    const trigger = await seedPlan()
    const other = await seedPlan('feature-other.md')
    const stem = await seedTask({
      planLine:
        'Plan: [feature-trigger](../plans/feature-trigger.md), [feature-other](../plans/feature-other.md)',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: true,
      plans: [
        { from: trigger, to: archivedPlan() },
        { from: other, to: archivedPlan('feature-other.md') },
      ],
    })
    expect(existsSync(trigger)).toBe(false)
    expect(existsSync(other)).toBe(false)
    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md), [feature-other](../../plans/archive/feature-other.md)\n',
    )
  })

  it('should carry only the unshared plan of a multi-link task', async () => {
    const trigger = await seedPlan()
    const other = await seedPlan('feature-other.md')
    const stem = await seedTask({
      planLine:
        'Plan: [feature-trigger](../plans/feature-trigger.md), [feature-other](../plans/feature-other.md)',
    })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '../plans/feature-other.md',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: true,
      plans: [{ from: trigger, to: archivedPlan() }],
    })
    expect(existsSync(other)).toBe(true)
    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md), [feature-other](../../plans/feature-other.md)\n',
    )
  })

  it('should carry a live plan written from the project root', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '.canon/plans/feature-trigger.md' })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      plans: [{ from: plan, to: archivedPlan() }],
    })
    expect(existsSync(plan)).toBe(false)
  })

  it('should resolve a task by the pull request it names', async () => {
    const stem = await seedTask({ pullRequest: 673 })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 673 }),
    ).toMatchObject({ ok: true, stem })
  })

  it('should resolve a task by the last number on its line', async () => {
    const stem = await seedTask({ pullRequest: [12, 673] })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 673 }),
    ).toMatchObject({ ok: true, stem })
  })

  it('should refuse an earlier slice even when every outcome is ticked', async () => {
    const stem = await seedTask({ pullRequest: [12, 673] })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 12 }),
    ).toMatchObject({ ok: false, reason: 'earlier-slice' })
    expect(existsSync(join(tasksDir(ROOT), `${stem}.md`))).toBe(true)
  })

  it('should refuse the last number while a branch is still pending', async () => {
    const stem = await seedTask({
      pullRequest: [12, 673],
      pending: ['feat/final-slice'],
    })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 673 }),
    ).toMatchObject({
      ok: false,
      reason: 'pending-branch',
      detail: ['feat/final-slice'],
    })
    expect(existsSync(join(tasksDir(ROOT), `${stem}.md`))).toBe(true)
  })

  it('should archive a task by stem while a branch is still pending', async () => {
    const stem = await seedTask({
      pullRequest: 673,
      pending: ['feat/abandoned'],
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      stem,
    })
  })

  it('should refuse when no task names the pull request', async () => {
    await seedTask({ pullRequest: 673 })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 999 }),
    ).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should refuse when two tasks name one pull request', async () => {
    await seedTask({ stem: 'v28.1-first', pullRequest: 673 })
    await seedTask({ stem: 'v28.2-second', pullRequest: 673 })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 673 }),
    ).toMatchObject({ ok: false, reason: 'ambiguous' })
  })

  it('should refuse when a second task lists the number later on its line', async () => {
    await seedTask({ stem: 'v28.1-first', pullRequest: 673 })
    await seedTask({ stem: 'v28.2-second', pullRequest: [12, 673] })

    expect(
      await archiveTask(ROOT, { kind: 'pull-request', number: 673 }),
    ).toMatchObject({ ok: false, reason: 'ambiguous' })
  })

  it('should clear the archived task row from the ordering file', async () => {
    const stem = await seedTask()
    const priority = join(tasksDir(ROOT), 'priority.md')
    await writeFile(
      priority,
      `| Task | Touches |\n| ---- | ------- |\n| [v28.1](${stem}.md) | \`src/\` |\n`,
    )

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true, priorityRowRemoved: true })
    expect(await readFile(priority, 'utf8')).not.toContain(`${stem}.md`)
  })

  it('should archive without an ordering file present', async () => {
    const stem = await seedTask()

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: true,
      priorityRowRemoved: false,
    })
  })
})

describe('archiveTask ready folder', () => {
  const FOLDER = '03-design-taste'
  const PLAN = 'feature-trigger.md'

  async function seedReady(name = FOLDER): Promise<string> {
    const dir = join(ROOT, '.canon', 'ready', name)
    mkdirSync(dir, { recursive: true })
    await writeFile(join(dir, 'overview.md'), '# Overview\n')
    return dir
  }

  async function seedPlanText(text: string): Promise<string> {
    const dir = join(ROOT, '.canon', 'plans')
    mkdirSync(dir, { recursive: true })
    const path = join(dir, PLAN)
    await writeFile(path, text)
    return path
  }

  const archivedReady = (name = FOLDER): string =>
    join(ROOT, '.canon', 'ready', 'archive', name)

  it('should move the ready folder its task names along with the plan', async () => {
    const folder = await seedReady()
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: true,
      ready: { from: folder, to: archivedReady() },
    })
    expect(existsSync(folder)).toBe(false)
    expect(existsSync(join(archivedReady(), 'overview.md'))).toBe(true)
  })

  it('should retarget the Ready line with its trailing slash', async () => {
    await seedReady()
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    await archiveTask(ROOT, { kind: 'stem', stem })

    const archived = await readFile(
      join(archiveDir(ROOT), `${stem}.md`),
      'utf8',
    )
    expect(archived).toContain(
      `Ready: [${FOLDER}](../../ready/archive/${FOLDER}/)\n`,
    )
    expect(archived).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md)',
    )
  })

  it('should rewrite the archived plan path to the folder', async () => {
    await seedReady()
    await seedPlanText(`Copy \`.canon/ready/${FOLDER}/\` verbatim.\n`)
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(await readFile(archivedPlan(), 'utf8')).toBe(
      `Copy \`.canon/ready/archive/${FOLDER}/\` verbatim.\n`,
    )
  })

  it('should leave other folder paths in the plan untouched', async () => {
    await seedReady()
    const other = '.canon/ready/archive/01-older/'
    await seedPlanText(`Copy \`.canon/ready/${FOLDER}/\`, cf. \`${other}\`.\n`)
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(await readFile(archivedPlan(), 'utf8')).toContain(`\`${other}\`.`)
  })

  it('should read the folder from the plan Constraints when the task has no Ready line', async () => {
    const folder = await seedReady()
    await seedPlanText(
      `**Constraints:**\n\n- Copy \`.canon/ready/${FOLDER}/\`.\n`,
    )
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: true,
      ready: { from: folder, to: archivedReady() },
    })
  })

  it('should leave the folder with a plan another live task still cites', async () => {
    const folder = await seedReady()
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '../plans/feature-trigger.md',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result.ok && result.ready).toBeUndefined()
    expect(existsSync(folder)).toBe(true)
  })

  it('should move nothing when the Ready target names no folder', async () => {
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.ready).toBeUndefined()
    expect(existsSync(archivedReady())).toBe(false)
  })

  it('should move nothing when the folder is already archived', async () => {
    const archived = archivedReady()
    mkdirSync(archived, { recursive: true })
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: `archive/${FOLDER}`,
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result.ok && result.ready).toBeUndefined()
    expect(existsSync(archived)).toBe(true)
  })

  it('should keep the source when the destination already exists', async () => {
    const folder = await seedReady()
    mkdirSync(archivedReady(), { recursive: true })
    await seedPlan()
    const stem = await seedTask({
      plan: '../plans/feature-trigger.md',
      ready: FOLDER,
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.ready).toBeUndefined()
    expect(existsSync(join(folder, 'overview.md'))).toBe(true)
  })
})

describe('declineLine', () => {
  it('should build the reason, who, and date into one line', () => {
    expect(declineLine('superseded by v30.2', 'Alex', '2026-09-08')).toBe(
      'Declined: superseded by v30.2, Alex on 2026-09-08',
    )
  })
})

describe('removeBacklogRow', () => {
  it('should drop the bullet linking to the declined task', () => {
    const text = [
      '- [v28.1 escalation](v28.1-trigger-escalation.md)',
      '- [v32.1 globs](v32.1-sync-glob-narrowing.md)',
    ].join('\n')

    const result = removeBacklogRow(text, 'v28.1-trigger-escalation')

    expect(result.removed).toBe(true)
    expect(result.text).not.toContain('v28.1-trigger-escalation.md')
    expect(result.text).toContain('v32.1-sync-glob-narrowing.md')
  })

  it('should report nothing removed when no bullet matches', () => {
    const text = '- [v32.1 globs](v32.1-sync-glob-narrowing.md)'

    expect(removeBacklogRow(text, 'v28.1-trigger-escalation').removed).toBe(
      false,
    )
  })

  it('should leave prose naming the task untouched', () => {
    const text = 'The v28.1-trigger-escalation.md track runs first.'

    expect(removeBacklogRow(text, 'v28.1-trigger-escalation')).toEqual({
      text,
      removed: false,
    })
  })
})

describe('declineTask', () => {
  it('should move a task carrying an open outcome, unlike archive', async () => {
    const stem = await seedTask({
      outcomes: '- [ ] Outcome: still pending',
    })

    const result = await declineTask(ROOT, stem, 'superseded by v30.2', 'Alex')

    expect(result.ok).toBe(true)
    expect(existsSync(join(tasksDir(ROOT), `${stem}.md`))).toBe(false)
    expect(existsSync(join(declinedDir(ROOT), `${stem}.md`))).toBe(true)
  })

  it('should move a task carrying no outcomes at all, unlike archive', async () => {
    const stem = await seedTask({ outcomes: '- A note, not an outcome' })

    expect(
      await declineTask(ROOT, stem, 'no longer needed', 'Alex'),
    ).toMatchObject({ ok: true })
  })

  it('should rebase links whose targets stayed put', async () => {
    const stem = await seedTask()
    const path = join(tasksDir(ROOT), `${stem}.md`)
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      text.replace(
        '# v28.1: A task\n',
        '# v28.1: A task\n\nGroundwork: [g](../groundwork/01-g/)\n',
      ),
    )

    await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(
      await readFile(join(declinedDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain('Groundwork: [g](../../groundwork/01-g/)')
  })

  it('should write the Declined: line under the origin lines', async () => {
    const stem = await seedTask()

    await declineTask(ROOT, stem, 'superseded by v30.2', 'Alex')

    const text = await readFile(join(declinedDir(ROOT), `${stem}.md`), 'utf8')
    expect(text).toMatch(
      /^Declined: superseded by v30\.2, Alex on \d{4}-\d{2}-\d{2}$/m,
    )
  })

  it('should refuse a stem that is not on the board', async () => {
    await seedTask()

    expect(
      await declineTask(ROOT, 'v99.9-absent', 'no longer needed', 'Alex'),
    ).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should refuse when the board does not exist', async () => {
    expect(
      await declineTask(ROOT, 'v28.1-anything', 'no longer needed', 'Alex'),
    ).toMatchObject({ ok: false, reason: 'no-board' })
  })

  it('should clear the row from the ordering file when present', async () => {
    const stem = await seedTask()
    const priority = join(tasksDir(ROOT), 'priority.md')
    await writeFile(
      priority,
      `| Task | Touches |\n| ---- | ------- |\n| [v28.1](${stem}.md) | \`src/\` |\n`,
    )

    const result = await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(result).toMatchObject({ ok: true, priorityRowRemoved: true })
    expect(await readFile(priority, 'utf8')).not.toContain(`${stem}.md`)
  })

  it('should clear the bullet from the backlog when present', async () => {
    const stem = await seedTask()
    const backlog = join(tasksDir(ROOT), 'backlog.md')
    await writeFile(backlog, `- [v28.1](${stem}.md)\n`)

    const result = await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(result).toMatchObject({ ok: true, backlogRowRemoved: true })
    expect(await readFile(backlog, 'utf8')).not.toContain(`${stem}.md`)
  })

  it('should clear neither surface when the row sits on neither', async () => {
    const stem = await seedTask()

    expect(
      await declineTask(ROOT, stem, 'no longer needed', 'Alex'),
    ).toMatchObject({
      ok: true,
      priorityRowRemoved: false,
      backlogRowRemoved: false,
    })
  })

  it('should carry a solo plan into the archive the same way archive does', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    const result = await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(result).toMatchObject({
      ok: true,
      plans: [{ from: plan, to: archivedPlan() }],
    })
    expect(existsSync(plan)).toBe(false)
    expect(existsSync(archivedPlan())).toBe(true)
  })

  it('should leave a plan another live task still cites', async () => {
    const plan = await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '../plans/feature-trigger.md',
    })

    const result = await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(result).toMatchObject({ ok: true })
    expect(result.ok && result.plans).toEqual([])
    expect(existsSync(plan)).toBe(true)
  })

  it('should carry every uncited plan a multi-link task names', async () => {
    const trigger = await seedPlan()
    const other = await seedPlan('feature-other.md')
    const stem = await seedTask({
      planLine:
        'Plan: [feature-trigger](../plans/feature-trigger.md), [feature-other](../plans/feature-other.md)',
    })

    const result = await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(result).toMatchObject({
      ok: true,
      plans: [
        { from: trigger, to: archivedPlan() },
        { from: other, to: archivedPlan('feature-other.md') },
      ],
    })
    expect(
      await readFile(join(declinedDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md), [feature-other](../../plans/archive/feature-other.md)\n',
    )
  })

  it('should point the declined task at the archived plan', async () => {
    await seedPlan()
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    await declineTask(ROOT, stem, 'no longer needed', 'Alex')

    expect(
      await readFile(join(declinedDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(
      'Plan: [feature-trigger](../../plans/archive/feature-trigger.md)',
    )
  })
})

describe('describeUnmatchedStem', () => {
  it('should name the one task a prefix resolves to', () => {
    expect(
      describeUnmatchedStem(['v28.1-trigger-escalation'], 'v28.1'),
    ).toEqual({
      reason: 'no-match',
      message:
        'v28.1 does not name a task by itself. One task starts with it: v28.1-trigger-escalation. Pass the full name instead.',
      detail: ['v28.1-trigger-escalation'],
    })
  })

  it('should name the count when a prefix resolves to several tasks', () => {
    expect(
      describeUnmatchedStem(['v28.1-alpha', 'v28.1-beta'], 'v28.1'),
    ).toEqual({
      reason: 'ambiguous',
      message:
        'v28.1 does not name a task by itself. 2 tasks start with it. Pass the full name instead.',
      detail: ['v28.1-alpha', 'v28.1-beta'],
    })
  })
})

describe('planCitations', () => {
  it('should name the one task a prefix resolves to, distinct from absence', async () => {
    const stem = await seedTask()

    expect(await planCitations(ROOT, 'v28.1')).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'no-match',
        message: `v28.1 does not name a task by itself. One task starts with it: ${stem}. Pass the full name instead.`,
        detail: [stem],
      }),
    )
  })

  it('should report a live plan no other task holds', async () => {
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'live',
      citedBy: [],
    })
  })

  it('should name the other live tasks sharing a plan', async () => {
    const stem = await seedTask({ plan: '../plans/feature-trigger.md' })
    await seedTask({
      stem: 'v28.2-sibling',
      plan: '.claude/plans/feature-trigger.md',
    })

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'live',
      citedBy: ['v28.2-sibling'],
    })
  })

  it('should report a plan an earlier sweep archived', async () => {
    const stem = await seedTask({
      plan: '../plans/archive/feature-trigger.md',
    })

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'archived',
      citedBy: [],
    })
  })

  it('should report a target resolving outside both plans folders', async () => {
    const stem = await seedTask({ plan: '../plans-legacy/feature-trigger.md' })

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'outside',
    })
  })

  it('should report every target of a line linking several plans', async () => {
    const stem = await seedTask({
      planLine: 'Plan: [a](../plans/a.md), [b](../plans/b.md)',
    })

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'several',
      target: undefined,
      targets: ['../plans/a.md', '../plans/b.md'],
      citedBy: [],
    })
  })

  it('should report a task carrying no plan line', async () => {
    const stem = await seedTask()

    expect(await planCitations(ROOT, stem)).toMatchObject({
      ok: true,
      location: 'unstated',
      target: undefined,
    })
  })

  it('should refuse a stem that is not on the board', async () => {
    await seedTask()

    expect(await planCitations(ROOT, 'v99.9-absent')).toMatchObject({
      ok: false,
      reason: 'no-match',
    })
  })

  it('should refuse when the board does not exist', async () => {
    expect(await planCitations(ROOT, 'v28.1-anything')).toMatchObject({
      ok: false,
      reason: 'no-board',
    })
  })
})
