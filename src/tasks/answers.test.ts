import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type AnswersOutcome,
  planAnswers,
  planCandidates,
  resolvePlanReference,
} from '@/tasks/answers'

let ROOT: string

interface QuestionFixture {
  readonly suggested: string
  readonly answer?: string
}

function planBody(questions: readonly QuestionFixture[]): string {
  const block = questions.flatMap(({ suggested, answer = '' }, index) => [
    `${index + 1}. Question ${index + 1}?`,
    `   - Suggested: ${suggested}`,
    `   - Answer:${answer ? ` ${answer}` : ''}`,
  ])

  return [
    '# Feature: A plan under test',
    '',
    '## Summary',
    '',
    '- It ships something.',
    '',
    '**Files to touch:**',
    '',
    '- `src/a.ts`: the thing.',
    '',
    '**Questions:**',
    '',
    ...block,
    '',
  ].join('\n')
}

async function writePlan(
  slug: string,
  questions: readonly QuestionFixture[],
): Promise<void> {
  await writeFile(
    join(ROOT, '.canon', 'plans', `feature-${slug}.md`),
    planBody(questions),
    'utf8',
  )
}

function assertOk(
  outcome: AnswersOutcome,
): asserts outcome is Extract<AnswersOutcome, { ok: true }> {
  expect(outcome.ok).toBe(true)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'answers-'))
  mkdirSync(join(ROOT, '.canon', 'plans'), { recursive: true })
  mkdirSync(join(ROOT, '.canon', 'tasks'), { recursive: true })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('planAnswers', () => {
  it('should hold a plan whose operator call still has an empty answer slot', async () => {
    await writePlan('gate', [
      { suggested: 'needs your call, the two shapes cost the same.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(false)
    expect(outcome.open).toHaveLength(1)
  })

  it('should launch the same plan once the operator has filled the slot', async () => {
    await writePlan('gate', [
      {
        suggested: 'needs your call, the two shapes cost the same.',
        answer: 'Take the second.',
      },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(true)
    expect(outcome.open).toEqual([])
  })

  it('should name the question and the reason rather than report a count', async () => {
    await writePlan('gate', [
      {
        suggested: 'needs your call, it turns on how loud you want the report.',
      },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.open[0]?.label).toBe('1. Question 1?')
    expect(outcome.open[0]?.why).toBe(
      'it turns on how loud you want the report.',
    )
  })

  it('should strip a full stop as well as a comma from in front of the reason', async () => {
    await writePlan('gate', [
      { suggested: 'needs your call. Retiring is also defensible.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.open[0]?.why).toBe('Retiring is also defensible.')
  })

  it('should launch a plan whose blank slots sit under ordinary suggestions', async () => {
    await writePlan('gate', [
      { suggested: 'the first, since the group already carries a verb.' },
      { suggested: 'the verb, since a rule the model talks past is not one.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(true)
  })

  it('should report every open call when a plan carries more than one', async () => {
    await writePlan('gate', [
      { suggested: 'needs your call, the first.' },
      { suggested: 'a technical default settles it.' },
      { suggested: 'needs your call, the third.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.open.map(({ label }) => label)).toEqual([
      '1. Question 1?',
      '3. Question 3?',
    ])
  })

  it('should read an operator call the author capitalized', async () => {
    await writePlan('gate', [
      { suggested: 'Needs your call, the standard writes it lowercase.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(false)
  })

  it('should not garble a canonical reason mentioning the paraphrase itself', async () => {
    await writePlan('gate', [
      {
        suggested:
          "needs your call, since the operator's call outranks a default.",
      },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.open[0]?.why).toBe(
      "since the operator's call outranks a default.",
    )
  })

  it("should hold a plan carrying the operator's call paraphrase", async () => {
    await writePlan('gate', [
      {
        suggested: "needs operator's call, the paraphrase this task measured.",
      },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(false)
    expect(outcome.open[0]?.why).toBe('the paraphrase this task measured.')
  })

  it("should hold a plan carrying the the-operator's-call paraphrase", async () => {
    await writePlan('gate', [
      {
        suggested:
          "needs the operator's call, the longer variant this task measured.",
      },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(false)
    expect(outcome.open[0]?.why).toBe('the longer variant this task measured.')
  })

  it('should hold a plan staging a batch inside one file', async () => {
    await writeFile(
      join(ROOT, '.canon', 'plans', 'feature-staged.md'),
      [
        '# Feature: A staged plan',
        '',
        '## Summary',
        '',
        '- It ships something.',
        '',
        '**Batch 1: The first slice**',
        '',
        '**Files to touch:**',
        '',
        '- `src/a.ts`: the thing.',
        '',
      ].join('\n'),
      'utf8',
    )

    const outcome = await planAnswers(ROOT, 'staged')

    assertOk(outcome)
    expect(outcome.launchable).toBe(false)
    expect(outcome.open.map(({ label }) => label)).toContain('Files to touch')
  })

  it('should launch an ordinary plan carrying no staged batch', async () => {
    await writePlan('gate', [
      { suggested: 'the first, since the group already carries a verb.' },
    ])

    const outcome = await planAnswers(ROOT, 'gate')

    assertOk(outcome)
    expect(outcome.launchable).toBe(true)
  })

  it('should launch a plan carrying no questions section at all', async () => {
    await writeFile(
      join(ROOT, '.canon', 'plans', 'feature-bare.md'),
      [
        '# Feature: Bare',
        '',
        '**Files to touch:**',
        '',
        '- `src/a.ts`: it.',
        '',
      ].join('\n'),
      'utf8',
    )

    const outcome = await planAnswers(ROOT, 'bare')

    assertOk(outcome)
    expect(outcome.launchable).toBe(true)
  })

  it('should refuse a reference that resolves to no file', async () => {
    const outcome = await planAnswers(ROOT, 'absent')

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.reason).toBe('no-plan')
  })

  it('should refuse an empty reference as bad input rather than as a missing plan', async () => {
    const outcome = await planAnswers(ROOT, '  ')

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.reason).toBe('bad-input')
  })

  it('should read a plan named by path as well as by slug', async () => {
    await writePlan('gate', [{ suggested: 'needs your call, either.' }])

    const outcome = await planAnswers(ROOT, '.canon/plans/feature-gate.md')

    assertOk(outcome)
    expect(outcome.plan).toBe(join('.canon', 'plans', 'feature-gate.md'))
  })

  it('should read the task-relative link a board row writes', async () => {
    await writePlan('gate', [{ suggested: 'needs your call, either.' }])

    const outcome = await planAnswers(ROOT, '../plans/feature-gate.md')

    assertOk(outcome)
    expect(outcome.plan).toBe(join('.canon', 'plans', 'feature-gate.md'))
    expect(outcome.launchable).toBe(false)
  })

  it('should refuse a plan sitting in the archive as already shipped', async () => {
    mkdirSync(join(ROOT, '.canon', 'plans', 'archive'), { recursive: true })
    await writeFile(
      join(ROOT, '.canon', 'plans', 'archive', 'feature-gate.md'),
      planBody([{ suggested: 'a technical default settles it.' }]),
      'utf8',
    )

    const outcome = await planAnswers(
      ROOT,
      '.canon/plans/archive/feature-gate.md',
    )

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.reason).toBe('archived')
  })

  it('should name every base it looked under when nothing resolves', async () => {
    const outcome = await planAnswers(ROOT, '../plans/feature-absent.md')

    expect(outcome.ok).toBe(false)
    expect(outcome.ok === false && outcome.message).toContain(
      join('.canon', 'plans', 'feature-absent.md'),
    )
  })
})

describe('resolvePlanReference', () => {
  it('should carry both the absolute path and the root-relative spelling', async () => {
    await writePlan('gate', [])

    const outcome = resolvePlanReference(ROOT, 'gate')

    expect(outcome.ok).toBe(true)
    expect(outcome.ok === true && outcome.path).toBe(
      join(ROOT, '.canon', 'plans', 'feature-gate.md'),
    )
    expect(outcome.ok === true && outcome.plan).toBe(
      join('.canon', 'plans', 'feature-gate.md'),
    )
  })

  it('should refuse a plan in the archive without reading its questions', async () => {
    mkdirSync(join(ROOT, '.canon', 'plans', 'archive'), { recursive: true })
    await writeFile(
      join(ROOT, '.canon', 'plans', 'archive', 'feature-gate.md'),
      planBody([]),
      'utf8',
    )

    const outcome = resolvePlanReference(
      ROOT,
      '.canon/plans/archive/feature-gate.md',
    )

    expect(outcome.ok === false && outcome.reason).toBe('archived')
  })
})

describe('planCandidates', () => {
  it('should add the folder, the prefix, and the extension to a bare slug', () => {
    expect(planCandidates('/root', 'gate')).toEqual([
      join('/root', '.canon', 'plans', 'feature-gate.md'),
    ])
  })

  it('should not repeat a prefix the caller already spelled', () => {
    expect(planCandidates('/root', 'feature-gate')).toEqual([
      join('/root', '.canon', 'plans', 'feature-gate.md'),
    ])
  })

  it('should offer the root before the board for a relative path', () => {
    expect(
      planCandidates('/root', '.claude/plans/archive/feature-gate.md'),
    ).toEqual([
      join('/root', '.claude', 'plans', 'archive', 'feature-gate.md'),
      join(
        '/root',
        '.canon',
        'tasks',
        '.claude',
        'plans',
        'archive',
        'feature-gate.md',
      ),
    ])
  })

  it('should land a board link on the plans folder through its second base', () => {
    expect(planCandidates('/root', '../plans/feature-gate.md')[1]).toBe(
      join('/root', '.canon', 'plans', 'feature-gate.md'),
    )
  })

  it('should leave an absolute path as the caller wrote it', () => {
    expect(planCandidates('/root', '/elsewhere/feature-gate.md')).toEqual([
      '/elsewhere/feature-gate.md',
    ])
  })
})
