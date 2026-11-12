import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  archiveDir,
  describeUnmatchedStem,
  planCitations,
  readOutcomes,
  readPlanTarget,
  readPlanTargets,
  readPullRequest,
  rebaseRelativeLinks,
  removePriorityRow,
  retargetPlanLine,
  tasksDir,
} from '@/tasks/archive'
import { ROOT, seedTask, useRoot } from '@/tasks/archive/fixture'

useRoot()

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
      operator: [],
    })
  })

  it('should ignore bullets that carry no checkbox', () => {
    expect(readOutcomes('- A finding, not an outcome\n')).toEqual({
      open: [],
      closed: [],
      cut: [],
      operator: [],
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
      operator: [],
    })
  })

  it('should read a struck outcome with no checkbox as cut', () => {
    expect(readOutcomes('- ~~Outcome: dropped~~ Cut 2026-09-02\n')).toEqual({
      open: [],
      closed: [],
      cut: ['~~Outcome: dropped~~ Cut 2026-09-02'],
      operator: [],
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

  it('should read an unticked operator check as neither open nor closed', () => {
    expect(readOutcomes('- [ ] Operator check: run it on a Mac\n')).toEqual({
      open: [],
      closed: [],
      cut: [],
      operator: ['Operator check: run it on a Mac'],
    })
  })

  it('should read a ticked operator check as closed', () => {
    const outcomes = readOutcomes('- [x] Operator check: run it on a Mac\n')

    expect(outcomes.closed).toEqual(['Operator check: run it on a Mac'])
    expect(outcomes.operator).toEqual([])
  })

  it('should read a struck operator check as cut', () => {
    const outcomes = readOutcomes(
      '- [ ] ~~Operator check: run it on a Mac~~ Cut 2026-09-02\n',
    )

    expect(outcomes.cut).toHaveLength(1)
    expect(outcomes.operator).toEqual([])
  })

  it('should keep the mark to one spelling at the start of the body', () => {
    const outcomes = readOutcomes(
      '- [ ] Outcome: operator check: a Mac\n- [ ] operator check: a Mac\n',
    )

    expect(outcomes.open).toHaveLength(2)
    expect(outcomes.operator).toEqual([])
  })

  it('should ignore an operator check inside a fenced block', () => {
    const text = '```markdown\n- [ ] Operator check: a sample\n```\n'

    expect(readOutcomes(text).operator).toEqual([])
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
