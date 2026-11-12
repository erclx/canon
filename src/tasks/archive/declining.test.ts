import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  archiveDir,
  declinedDir,
  declineLine,
  declineTask,
  removeBacklogRow,
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

describe('declineTask inbound links', () => {
  const STEM = 'v28.1-trigger-escalation'

  it('should repoint a live sibling link at the declined path', async () => {
    await seedTask()
    const sibling = await seedSibling(
      tasksDir(ROOT),
      'v28.2-next',
      `See [it](${STEM}.md).`,
    )

    const result = await declineTask(ROOT, STEM, 'not needed', 'Alex')

    expect(await readFile(sibling, 'utf8')).toContain(
      `[it](declined/${STEM}.md)`,
    )
    expect(result).toMatchObject({
      ok: true,
      relinked: [{ file: sibling, links: 1 }],
    })
  })

  it('should repoint an archived sibling link into the declined folder', async () => {
    await seedTask()
    const sibling = await seedSibling(
      archiveDir(ROOT),
      'v27.1-older',
      `Follows [it](../${STEM}.md).`,
    )

    await declineTask(ROOT, STEM, 'not needed', 'Alex')

    expect(await readFile(sibling, 'utf8')).toContain(
      `[it](../declined/${STEM}.md)`,
    )
  })

  it('should repoint a declined sibling link to <stem>.md', async () => {
    await seedTask()
    const sibling = await seedSibling(
      declinedDir(ROOT),
      'v27.2-dropped',
      `Follows [it](../${STEM}.md).`,
    )

    await declineTask(ROOT, STEM, 'not needed', 'Alex')

    expect(await readFile(sibling, 'utf8')).toContain(`[it](${STEM}.md)`)
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

  it('should keep a bullet for another task that cites the task later', () => {
    const text =
      '- [globs](v32.1-sync-glob-narrowing.md): after [escalation](v28.1-trigger-escalation.md) ships'

    expect(removeBacklogRow(text, 'v28.1-trigger-escalation')).toEqual({
      text,
      removed: false,
    })
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

  it('should write the Declined: line below the Sessions: line', async () => {
    const stem = await seedTask()
    const path = join(tasksDir(ROOT), `${stem}.md`)
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      text.replace(
        '# v28.1: A task\n',
        '# v28.1: A task\n\nSessions: worker-canon-a (0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0)\n',
      ),
    )

    await declineTask(ROOT, stem, 'superseded by v30.2', 'Alex')

    const declined = await readFile(
      join(declinedDir(ROOT), `${stem}.md`),
      'utf8',
    )
    expect(declined).toMatch(
      /^Sessions: worker-canon-a \(0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0\)\nDeclined: superseded by v30\.2, Alex on \d{4}-\d{2}-\d{2}$/m,
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
