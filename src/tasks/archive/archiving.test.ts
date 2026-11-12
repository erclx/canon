import { existsSync, mkdirSync } from 'node:fs'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  archiveDir,
  archiveTask,
  declinedDir,
  readPlanTargets,
  tasksDir,
} from '@/tasks/archive'
import {
  archivedPlan,
  ROOT,
  seedPlan,
  seedSibling,
  seedTask,
  useRoot,
} from '@/tasks/archive/fixture'

useRoot()

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

  it('should keep the Sessions line as written', async () => {
    const stem = await seedTask()
    const path = join(tasksDir(ROOT), `${stem}.md`)
    const text = await readFile(path, 'utf8')
    const line =
      'Sessions: worker-canon-a (0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0), cloud-a (session_01AbC)'
    await writeFile(
      path,
      text.replace('# v28.1: A task\n', `# v28.1: A task\n\n${line}\n`),
    )

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain(`${line}\n`)
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

  it('should archive a task whose only open outcomes are operator checks', async () => {
    const stem = await seedTask({
      outcomes: '- [x] Outcome: shipped\n- [ ] Operator check: run it on a Mac',
    })

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({
      ok: true,
      closed: 1,
      operatorChecks: ['Operator check: run it on a Mac'],
    })
    expect(
      await readFile(join(archiveDir(ROOT), `${stem}.md`), 'utf8'),
    ).toContain('- [ ] Operator check: run it on a Mac')
  })

  it('should still refuse a build outcome open beside an operator check', async () => {
    const stem = await seedTask({
      outcomes: '- [ ] Operator check: a Mac\n- [ ] Outcome: pending',
    })

    expect(await archiveTask(ROOT, { kind: 'stem', stem })).toMatchObject({
      ok: false,
      reason: 'open-outcomes',
      detail: ['Outcome: pending'],
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

  describe('a merged slice', () => {
    const SLICED =
      'Plan: [feature-first](../plans/feature-first.md), [feature-middle](../plans/feature-middle.md), [feature-last](../plans/feature-last.md)'

    function headOf(branches: Record<number, string>) {
      return { head: async (number: number) => branches[number] }
    }

    it('should archive the middle slice plan and keep the task open', async () => {
      const middle = await seedPlan('feature-middle.md')
      await seedPlan('feature-first.md')
      await seedPlan('feature-last.md')
      const stem = await seedTask({
        planLine: SLICED,
        pullRequest: [12, 673],
      })

      expect(
        await archiveTask(
          ROOT,
          { kind: 'pull-request', number: 12 },
          headOf({ 12: 'feat/middle' }),
        ),
      ).toMatchObject({
        ok: false,
        reason: 'earlier-slice',
        slice: { from: middle, to: archivedPlan('feature-middle.md') },
      })
      expect(existsSync(middle)).toBe(false)
      expect(existsSync(archivedPlan('feature-middle.md'))).toBe(true)
      const text = await readFile(join(tasksDir(ROOT), `${stem}.md`), 'utf8')
      expect(readPlanTargets(text)).toEqual([
        '../plans/feature-first.md',
        '../plans/archive/feature-middle.md',
        '../plans/feature-last.md',
      ])
    })

    it('should drop the merged slice from the board row', async () => {
      await seedPlan('feature-middle.md')
      await seedPlan('feature-first.md')
      await seedPlan('feature-last.md')
      const stem = await seedTask({
        planLine: SLICED,
        pullRequest: [12, 673],
      })
      const priority = join(tasksDir(ROOT), 'priority.md')
      await writeFile(
        priority,
        [
          '# Priority',
          '',
          '## Run now',
          '',
          '| Task | Touches | Plan |',
          '| ---- | ------- | ---- |',
          `| [v28.1: A task](${stem}.md) | | [first](../plans/feature-first.md), [middle](../plans/feature-middle.md), [last](../plans/feature-last.md) |`,
          '',
        ].join('\n'),
      )

      await archiveTask(
        ROOT,
        { kind: 'pull-request', number: 12 },
        headOf({ 12: 'feat/middle' }),
      )

      expect(await readFile(priority, 'utf8')).toContain(
        `| [v28.1: A task](${stem}.md) |  | [first](../plans/feature-first.md), [last](../plans/feature-last.md) |`,
      )
    })

    it('should archive the merged slice plan when the task keeps open outcomes', async () => {
      await seedPlan('feature-first.md')
      const last = await seedPlan('feature-last.md')
      await seedTask({
        planLine:
          'Plan: [feature-first](../plans/feature-first.md), [feature-last](../plans/feature-last.md)',
        pullRequest: 673,
        outcomes: '- [ ] Outcome: still open',
      })

      expect(
        await archiveTask(
          ROOT,
          { kind: 'pull-request', number: 673 },
          headOf({ 673: 'feat/last' }),
        ),
      ).toMatchObject({
        ok: false,
        reason: 'open-outcomes',
        slice: { from: last },
      })
      expect(existsSync(last)).toBe(false)
    })

    it('should close the task as today when the last slice merges', async () => {
      await seedPlan('feature-first.md')
      await seedPlan('feature-last.md')
      const stem = await seedTask({
        planLine:
          'Plan: [feature-first](../plans/feature-first.md), [feature-last](../plans/feature-last.md)',
        pullRequest: [12, 673],
      })

      expect(
        await archiveTask(
          ROOT,
          { kind: 'pull-request', number: 673 },
          headOf({ 673: 'feat/last' }),
        ),
      ).toMatchObject({
        ok: true,
        stem,
        plans: [
          { to: archivedPlan('feature-first.md') },
          { to: archivedPlan('feature-last.md') },
        ],
      })
    })

    it('should move nothing when the head branch matches no slice plan', async () => {
      const middle = await seedPlan('feature-middle.md')
      await seedPlan('feature-first.md')
      await seedPlan('feature-last.md')
      const stem = await seedTask({
        planLine: SLICED,
        pullRequest: [12, 673],
      })
      const before = await readFile(join(tasksDir(ROOT), `${stem}.md`), 'utf8')

      const outcome = await archiveTask(
        ROOT,
        { kind: 'pull-request', number: 12 },
        headOf({ 12: 'feat/renamed-by-hand' }),
      )

      expect(outcome).toMatchObject({ ok: false, reason: 'earlier-slice' })
      expect(outcome).not.toHaveProperty('slice')
      expect(existsSync(middle)).toBe(true)
      expect(await readFile(join(tasksDir(ROOT), `${stem}.md`), 'utf8')).toBe(
        before,
      )
    })

    it('should move nothing when the head branch cannot be read', async () => {
      const middle = await seedPlan('feature-middle.md')
      await seedPlan('feature-first.md')
      await seedTask({ planLine: SLICED, pullRequest: [12, 673] })

      expect(
        await archiveTask(
          ROOT,
          { kind: 'pull-request', number: 12 },
          headOf({}),
        ),
      ).not.toHaveProperty('slice')
      expect(existsSync(middle)).toBe(true)
    })

    it('should keep the only plan of a task that was never sliced', async () => {
      const plan = await seedPlan('feature-only.md')
      await seedTask({
        planLine: 'Plan: [feature-only](../plans/feature-only.md)',
        pullRequest: 673,
        outcomes: '- [ ] Outcome: still open',
      })

      expect(
        await archiveTask(
          ROOT,
          { kind: 'pull-request', number: 673 },
          headOf({ 673: 'feat/only' }),
        ),
      ).toMatchObject({ ok: false, reason: 'open-outcomes' })
      expect(existsSync(plan)).toBe(true)
    })
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

  it('should clear the archived task bullet from the backlog', async () => {
    const stem = await seedTask()
    const backlog = join(tasksDir(ROOT), 'backlog.md')
    await writeFile(
      backlog,
      `# Backlog\n\n- [v28.1](${stem}.md)\n- [v32.1 globs](v32.1-sync-glob-narrowing.md)\n`,
    )

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true, backlogRowRemoved: true })
    const text = await readFile(backlog, 'utf8')
    expect(text).not.toContain(`${stem}.md`)
    expect(text).toContain('v32.1-sync-glob-narrowing.md')
  })

  it('should report no backlog row removed when no backlog file exists', async () => {
    const stem = await seedTask()

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true, backlogRowRemoved: false })
    expect(existsSync(join(tasksDir(ROOT), 'backlog.md'))).toBe(false)
  })

  it('should keep another task bullet that cites the archived task after its own link', async () => {
    const stem = await seedTask()
    const backlog = join(tasksDir(ROOT), 'backlog.md')
    const body = `# Backlog\n\n- [globs](v32.1-sync-glob-narrowing.md): after [escalation](${stem}.md) ships\n`
    await writeFile(backlog, body)

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true, backlogRowRemoved: false })
    expect(await readFile(backlog, 'utf8')).toBe(body)
  })

  it('should report no backlog row removed when the backlog names other tasks', async () => {
    const stem = await seedTask()
    const backlog = join(tasksDir(ROOT), 'backlog.md')
    const body = '# Backlog\n\n- [v32.1 globs](v32.1-sync-glob-narrowing.md)\n'
    await writeFile(backlog, body)

    const result = await archiveTask(ROOT, { kind: 'stem', stem })

    expect(result).toMatchObject({ ok: true, backlogRowRemoved: false })
    expect(await readFile(backlog, 'utf8')).toBe(body)
  })
})

describe('archiveTask inbound links', () => {
  const STEM = 'v28.1-trigger-escalation'

  it('should repoint a live sibling body link at the archived path', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `See [it](${STEM}.md) first.`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(
      `See [it](archive/${STEM}.md) first.`,
    )
  })

  it('should repoint an archived sibling link from ../<stem>.md to <stem>.md', async () => {
    await seedTask()
    const sibling = await seedSibling(
      archiveDir(ROOT),
      'v27.1-older',
      `Follows [it](../${STEM}.md).`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(`[it](${STEM}.md)`)
  })

  it('should repoint a declined sibling link into the archive folder', async () => {
    await seedTask()
    const sibling = await seedSibling(
      declinedDir(ROOT),
      'v27.2-dropped',
      `Follows [it](../${STEM}.md).`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(
      `[it](../archive/${STEM}.md)`,
    )
  })

  it('should keep an anchor suffix and resolve a ./ prefix', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `See [it](./${STEM}.md#findings).`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(
      `[it](archive/${STEM}.md#findings)`,
    )
  })

  it('should change only the moved link when a line carries two', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `[a](${STEM}.md) and [b](v28.3-other.md)`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(
      `[a](archive/${STEM}.md) and [b](v28.3-other.md)`,
    )
  })

  it('should report each file written with its link count', async () => {
    await seedTask()
    await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `[a](${STEM}.md) and [b](${STEM}.md)`,
    )

    const result = await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(result).toMatchObject({
      ok: true,
      relinked: [{ file: join(tasksDir(ROOT), 'v28.2-next.md'), links: 2 }],
    })
  })

  it('should leave a fenced sample and an inline code span alone', async () => {
    await seedTask()
    const body = `\`[x](${STEM}.md)\`\n\n\`\`\`\n[x](${STEM}.md)\n\`\`\``
    const sibling = await seedSibling(tasksDir(ROOT), 'v28.2-next', body)

    const result = await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toBe(`# v28.2-next\n\n${body}\n`)
    expect(result).toMatchObject({ relinked: [] })
  })

  it('should leave an unrelated task link alone', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      '[o](v28.3-other.md)',
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toBe(
      '# v28.2-next\n\n[o](v28.3-other.md)\n',
    )
  })

  it('should leave a link already naming the archive alone', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `[a](archive/${STEM}.md)`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toBe(
      `# v28.2-next\n\n[a](archive/${STEM}.md)\n`,
    )
  })

  it('should not expand a replacement token in the moved filename', async () => {
    const stem = 'v28.1-a$&b'
    await seedTask({ stem })
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `[a](${stem}.md)`,
    )

    await archiveTask(ROOT, { kind: 'stem', stem })

    expect(await readFile(sibling, 'utf8')).toContain(`[a](archive/${stem}.md)`)
  })

  it('should leave priority.md and backlog.md untouched apart from the row removal', async () => {
    await seedTask()
    const priority = join(tasksDir(ROOT), 'priority.md')
    const backlog = join(tasksDir(ROOT), 'backlog.md')
    await writeFile(priority, `# Priority\n\nBlocked by [x](${STEM}.md)\n`)
    await writeFile(backlog, `# Backlog\n\nSee [x](${STEM}.md)\n`)

    await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(priority, 'utf8')).toBe(
      `# Priority\n\nBlocked by [x](${STEM}.md)\n`,
    )
    expect(await readFile(backlog, 'utf8')).toBe(
      `# Backlog\n\nSee [x](${STEM}.md)\n`,
    )
  })

  it('should report no relinked files when nothing cites the task', async () => {
    await seedTask()

    const result = await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(result).toMatchObject({ ok: true, relinked: [] })
  })
})

describe('archiveTask a failed repoint', () => {
  const STEM = 'v28.1-trigger-escalation'

  it('should still clear the ordering row and report the file it could not write', async () => {
    await seedTask()
    const priority = join(tasksDir(ROOT), 'priority.md')
    await writeFile(priority, `| [it](${STEM}.md) | \`src/\` |\n`)
    const locked = await seedSibling(
      tasksDir(ROOT),
      'v28.2-locked',
      `[a](${STEM}.md)`,
    )
    const open = await seedSibling(
      tasksDir(ROOT),
      'v28.3-open',
      `[a](${STEM}.md)`,
    )
    await chmod(locked, 0o444)

    const result = await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    await chmod(locked, 0o644)
    expect(result).toMatchObject({
      ok: true,
      priorityRowRemoved: true,
      relinked: [{ file: open, links: 1 }],
      relinkFailed: [{ file: locked }],
    })
    expect(await readFile(priority, 'utf8')).not.toContain(`${STEM}.md`)
  })

  it('should report an empty relinkFailed when every write lands', async () => {
    await seedTask()

    expect(await archiveTask(ROOT, { kind: 'stem', stem: STEM })).toMatchObject(
      { ok: true, relinkFailed: [] },
    )
  })
})

describe('archiveTask reference-style links', () => {
  const STEM = 'v28.1-trigger-escalation'

  it('should repoint a reference definition and leave another one alone', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `See [it][a] and [o][b].\n\n[a]: ${STEM}.md#findings\n[b]: v28.3-other.md`,
    )

    const result = await archiveTask(ROOT, { kind: 'stem', stem: STEM })

    expect(await readFile(sibling, 'utf8')).toContain(
      `[a]: archive/${STEM}.md#findings\n[b]: v28.3-other.md`,
    )
    expect(result).toMatchObject({ relinked: [{ file: sibling, links: 1 }] })
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
