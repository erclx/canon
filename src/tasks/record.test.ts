import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordDir } from '@/record-root'
import { tasksDir } from '@/tasks/archive'
import {
  closeOutcomeLines,
  closeOutcomes,
  recordPlan,
  recordPullRequest,
  writePlanLine,
  writePullRequestLine,
} from '@/tasks/record'

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
  readonly plan?: string
  readonly pullRequest?: number
  readonly outcomes?: readonly string[]
}

function taskBody({
  plan,
  pullRequest,
  outcomes = ['- [ ] Outcome: it ships'],
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

  if (plan) lines.push(`Plan: [${plan}](../plans/${plan}.md)`)
  if (pullRequest) lines.push(`Pull request: #${pullRequest}`)

  lines.push(
    '',
    '## Outcomes',
    '',
    ...outcomes,
    '',
    '## Findings',
    '',
    '- A note.',
  )

  return `${lines.join('\n')}\n`
}

async function seedTask(fixture: TaskFixture = {}): Promise<string> {
  const stem = fixture.stem ?? 'v28.1-trigger-escalation'
  const dir = tasksDir(ROOT)

  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, 'index.md'), INDEX_SEED)
  await writeFile(join(dir, `${stem}.md`), taskBody(fixture))

  return stem
}

function readTask(stem: string): Promise<string> {
  return readFile(join(tasksDir(ROOT), `${stem}.md`), 'utf8')
}

async function seedPlan(slug: string): Promise<void> {
  const dir = recordDir(ROOT, 'plans')

  mkdirSync(dir, { recursive: true })
  await writeFile(join(dir, `feature-${slug}.md`), `# Feature: ${slug}\n`)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-tasks-record-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('writePullRequestLine', () => {
  it('should add the line under the last origin line', () => {
    const text =
      '# A task\n\nPlan: [p](../plans/p.md)\nIssue: #12\n\n## Outcomes\n'

    const { text: written, action } = writePullRequestLine(text, 673)

    expect(action).toBe('added')
    expect(written).toContain('Issue: #12\nPull request: #673\n')
  })

  it('should append the number when the line already names another', () => {
    const text = '# A task\n\nPlan: [p](../plans/p.md)\nPull request: #12\n'

    const { text: written, action } = writePullRequestLine(text, 673)

    expect(action).toBe('appended')
    expect(written).toContain('Pull request: #12, #673\n')
  })

  it('should append to a line already listing three numbers', () => {
    const text = '# A task\n\nPull request: #1, #2, #3\n'

    const { text: written, action } = writePullRequestLine(text, 4)

    expect(action).toBe('appended')
    expect(written).toBe('# A task\n\nPull request: #1, #2, #3, #4\n')
  })

  it('should report no change when the number already matches', () => {
    const text = '# A task\n\nPull request: #673\n'

    expect(writePullRequestLine(text, 673)).toEqual({
      text,
      action: 'unchanged',
    })
  })

  it('should report no change when a list already carries the number', () => {
    const text = '# A task\n\nPull request: #12, #673, #700\n'

    expect(writePullRequestLine(text, 673)).toEqual({
      text,
      action: 'unchanged',
    })
  })

  it('should correct a line it cannot read as a list of numbers', () => {
    const text = '# A task\n\nPull request: #12 (closed)\n'

    const { text: written, action } = writePullRequestLine(text, 673)

    expect(action).toBe('corrected')
    expect(written).toBe('# A task\n\nPull request: #673\n')
  })

  it('should fall back to the heading when the task carries no origin line', () => {
    const { text } = writePullRequestLine('# A task\n\n## Outcomes\n', 673)

    expect(text).toBe('# A task\n\nPull request: #673\n\n## Outcomes\n')
  })
})

describe('writePlanLine', () => {
  it('should add the line right after the H1', () => {
    expect(
      writePlanLine('# A task\n\n## Outcomes\n', '../plans/feature-x.md'),
    ).toEqual({
      ok: true,
      text: '# A task\n\nPlan: [feature-x](../plans/feature-x.md)\n\n## Outcomes\n',
      action: 'added',
      replaced: undefined,
    })
  })

  it('should correct the target and name the link it replaced', () => {
    const text = '# A task\n\nPlan: [feature-old](../plans/feature-old.md)\n'

    expect(writePlanLine(text, '../plans/feature-new.md')).toEqual({
      ok: true,
      text: '# A task\n\nPlan: [feature-new](../plans/feature-new.md)\n',
      action: 'corrected',
      replaced: '../plans/feature-old.md',
    })
  })

  it('should report no change when the target already matches', () => {
    const text = '# A task\n\nPlan: [feature-x](../plans/feature-x.md)\n'

    expect(writePlanLine(text, '../plans/feature-x.md')).toEqual({
      ok: true,
      text,
      action: 'unchanged',
      replaced: undefined,
    })
  })

  it('should refuse a line linking several plans and leave it unchanged', () => {
    const text = '# A task\n\nPlan: [a](../plans/a.md), [b](../plans/b.md)\n'

    expect(writePlanLine(text, '../plans/a.md')).toEqual({
      ok: false,
      targets: ['../plans/a.md', '../plans/b.md'],
    })
  })

  it('should leave a plan line inside a fenced sample alone', () => {
    const text = [
      '# A task',
      '',
      'Plan: [feature-old](../plans/feature-old.md)',
      '',
      '```markdown',
      'Plan: [sample](../plans/sample.md)',
      '```',
      '',
    ].join('\n')
    const fenced = [
      '# A task',
      '',
      '```markdown',
      'Plan: [sample](../plans/sample.md)',
      '```',
      '',
    ].join('\n')

    expect(writePlanLine(fenced, '../plans/feature-new.md')).toMatchObject({
      ok: true,
      action: 'added',
      text: [
        '# A task',
        '',
        'Plan: [feature-new](../plans/feature-new.md)',
        '',
        '```markdown',
        'Plan: [sample](../plans/sample.md)',
        '```',
        '',
      ].join('\n'),
    })
    expect(writePlanLine(text, '../plans/feature-new.md')).toMatchObject({
      ok: true,
      action: 'corrected',
      text: text.replace(
        'Plan: [feature-old](../plans/feature-old.md)',
        'Plan: [feature-new](../plans/feature-new.md)',
      ),
    })
  })
})

describe('closeOutcomeLines', () => {
  it('should mark only the named position', () => {
    const text = '- [ ] Outcome: one\n- [ ] Outcome: two\n'

    const result = closeOutcomeLines(text, [2])

    expect(result.text).toBe('- [ ] Outcome: one\n- [x] Outcome: two\n')
    expect(result.closed).toEqual(['Outcome: two'])
  })

  it('should report a position that is already closed rather than rewriting it', () => {
    const result = closeOutcomeLines('- [x] Outcome: one\n', [1])

    expect(result.closed).toEqual([])
    expect(result.alreadyClosed).toEqual(['Outcome: one'])
  })

  it('should count every checkbox in file order', () => {
    expect(closeOutcomeLines('- [x] a\n- [ ] b\n- [ ] c\n', []).total).toBe(3)
  })

  it('should leave bullets that carry no checkbox untouched', () => {
    const text = '- A finding\n- [ ] Outcome: one\n'

    expect(closeOutcomeLines(text, [1]).text).toBe(
      '- A finding\n- [x] Outcome: one\n',
    )
  })

  it('should not count a checkbox inside a fenced block', () => {
    const text =
      '```markdown\n- [ ] Outcome: a sample\n```\n- [ ] Outcome: one\n'

    const result = closeOutcomeLines(text, [1])

    expect(result.total).toBe(1)
    expect(result.closed).toEqual(['Outcome: one'])
    expect(result.text).toContain('```markdown\n- [ ] Outcome: a sample\n```')
  })

  it('should count positions past a fenced block against the real list', () => {
    const text =
      '- [ ] Outcome: one\n\n```\n- [ ] Outcome: a sample\n```\n\n- [ ] Outcome: two\n'

    expect(closeOutcomeLines(text, [2]).closed).toEqual(['Outcome: two'])
  })
})

describe('recordPullRequest', () => {
  it('should write the number onto a task named by stem', async () => {
    const stem = await seedTask({ plan: 'feature-worktree-scratch-routing' })

    const outcome = await recordPullRequest(ROOT, { kind: 'stem', stem }, 673)

    expect(outcome.ok).toBe(true)
    await expect(readTask(stem)).resolves.toContain('Pull request: #673')
  })

  it('should select a task by the plan its Plan line names', async () => {
    const stem = await seedTask({ plan: 'feature-worktree-scratch-routing' })

    const outcome = await recordPullRequest(
      ROOT,
      { kind: 'plan', plan: 'worktree-scratch-routing' },
      673,
    )

    expect(outcome).toMatchObject({ ok: true, stem, action: 'added' })
  })

  it('should match a plan named with its full filename', async () => {
    await seedTask({ plan: 'feature-worktree-scratch-routing' })

    const outcome = await recordPullRequest(
      ROOT,
      {
        kind: 'plan',
        plan: '.claude/plans/feature-worktree-scratch-routing.md',
      },
      673,
    )

    expect(outcome.ok).toBe(true)
  })

  it('should select a task whose Plan line links several plans', async () => {
    const stem = await seedTask({ stem: 'v1-one' })
    const path = join(tasksDir(ROOT), `${stem}.md`)
    await writeFile(
      path,
      (await readTask(stem)).replace(
        '# v28.1: A task\n',
        '# v28.1: A task\n\nPlan: [feature-a](../plans/feature-a.md), [feature-b](../plans/feature-b.md)\n',
      ),
    )

    const outcome = await recordPullRequest(
      ROOT,
      { kind: 'plan', plan: 'b' },
      673,
    )

    expect(outcome).toMatchObject({ ok: true, stem, action: 'added' })
  })

  it('should refuse when no task names the plan', async () => {
    await seedTask({ plan: 'feature-other' })

    const outcome = await recordPullRequest(
      ROOT,
      { kind: 'plan', plan: 'worktree-scratch-routing' },
      673,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should refuse when two tasks name the same plan', async () => {
    await seedTask({ stem: 'v1-one', plan: 'feature-shared' })
    await seedTask({ stem: 'v2-two', plan: 'feature-shared' })

    const outcome = await recordPullRequest(
      ROOT,
      { kind: 'plan', plan: 'shared' },
      673,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'ambiguous' })
  })

  it('should refuse when the board does not exist', async () => {
    const outcome = await recordPullRequest(
      ROOT,
      { kind: 'stem', stem: 'v1-one' },
      673,
    )

    expect(outcome).toMatchObject({ ok: false, reason: 'no-board' })
  })
})

describe('recordPlan', () => {
  it('should write the Plan: line onto the named task', async () => {
    const stem = await seedTask()
    await seedPlan('worktree-scratch-routing')

    const outcome = await recordPlan(ROOT, stem, 'worktree-scratch-routing')

    expect(outcome).toMatchObject({ ok: true, stem, action: 'added' })
    await expect(readTask(stem)).resolves.toContain(
      'Plan: [feature-worktree-scratch-routing](../plans/feature-worktree-scratch-routing.md)',
    )
  })

  it('should refuse a task whose Plan line links several plans', async () => {
    const stem = await seedTask()
    await seedPlan('worktree-scratch-routing')
    const path = join(tasksDir(ROOT), `${stem}.md`)
    const text = (await readTask(stem)).replace(
      '# v28.1: A task\n',
      '# v28.1: A task\n\nPlan: [a](../plans/a.md), [b](../plans/b.md)\n',
    )
    await writeFile(path, text)

    const outcome = await recordPlan(ROOT, stem, 'worktree-scratch-routing')

    expect(outcome).toMatchObject({
      ok: false,
      reason: 'several-plans',
      detail: ['../plans/a.md', '../plans/b.md'],
    })
    await expect(readTask(stem)).resolves.toBe(text)
  })

  it('should refuse when the task does not exist', async () => {
    await seedTask()
    await seedPlan('worktree-scratch-routing')

    const outcome = await recordPlan(ROOT, 'nope', 'worktree-scratch-routing')

    expect(outcome).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should name the one task a prefix resolves to, distinct from absence', async () => {
    const stem = await seedTask()
    await seedPlan('worktree-scratch-routing')

    const outcome = await recordPlan(ROOT, 'v28.1', 'worktree-scratch-routing')

    expect(outcome).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'no-match',
        message: `v28.1 does not name a task by itself. One task starts with it: ${stem}. Pass the full name instead.`,
        detail: [stem],
      }),
    )
  })

  it('should refuse when the plan reference resolves to no file', async () => {
    const stem = await seedTask()

    const outcome = await recordPlan(ROOT, stem, 'does-not-exist')

    expect(outcome).toMatchObject({ ok: false, reason: 'no-plan' })
  })
})

describe('closeOutcomes', () => {
  it('should mark the named outcomes on the task file', async () => {
    const stem = await seedTask({
      outcomes: ['- [ ] Outcome: one', '- [ ] Outcome: two'],
    })

    const outcome = await closeOutcomes(ROOT, { kind: 'stem', stem }, [1])

    expect(outcome).toMatchObject({ ok: true, closed: ['Outcome: one'] })
    await expect(readTask(stem)).resolves.toContain('- [x] Outcome: one')
  })

  it('should refuse a position past the end of the list', async () => {
    const stem = await seedTask({ outcomes: ['- [ ] Outcome: one'] })

    const outcome = await closeOutcomes(ROOT, { kind: 'stem', stem }, [4])

    expect(outcome).toMatchObject({ ok: false, reason: 'out-of-range' })
  })

  it('should refuse a task carrying no outcomes', async () => {
    const stem = await seedTask({ outcomes: ['- A finding, not an outcome'] })

    const outcome = await closeOutcomes(ROOT, { kind: 'stem', stem }, [1])

    expect(outcome).toMatchObject({ ok: false, reason: 'no-outcomes' })
  })

  it('should stay safe on a rerun against the same position', async () => {
    const stem = await seedTask({ outcomes: ['- [ ] Outcome: one'] })
    await closeOutcomes(ROOT, { kind: 'stem', stem }, [1])

    const outcome = await closeOutcomes(ROOT, { kind: 'stem', stem }, [1])

    expect(outcome).toMatchObject({
      ok: true,
      closed: [],
      alreadyClosed: ['Outcome: one'],
    })
  })
})
