import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  architectureRel,
  type ArchitectureReport,
  ceilingFor,
  classifyDecision,
  coveredCount,
  isOverLength,
  readAllowances,
  splitDecisions,
  testableCount,
} from '@/context/architecture'

describe('architectureRel', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should resolve at canon/ when the project has moved', () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), '# Architecture\n')

    expect(architectureRel(root)).toBe(join('canon', 'ARCHITECTURE.md'))
  })

  it('should resolve at .claude/ when neither root carries the record', () => {
    expect(architectureRel(root)).toBe(join('.claude', 'ARCHITECTURE.md'))
  })
})

function makeReport(
  overrides: Partial<ArchitectureReport> = {},
): ArchitectureReport {
  return {
    rel: '.claude/ARCHITECTURE.md',
    lines: 100,
    allowances: { frame: 34, perDecision: 6 },
    ceiling: 100,
    decisions: [],
    ...overrides,
  }
}

function makeDecision(
  overrides: Partial<ArchitectureReport['decisions'][number]> = {},
): ArchitectureReport['decisions'][number] {
  return {
    heading: 'A decision',
    line: 13,
    claim: 'neither',
    figures: [],
    checks: [],
    ...overrides,
  }
}

describe('classifying a decision entry', () => {
  it('should read an entry carrying a digit figure as countable', () => {
    const body =
      'The fan-out stands at 11 copies from 6 sources, so the corpus stays out of it.'

    const result = classifyDecision(body)

    expect(result.claim).toBe('countable')
    expect(result.figures).toEqual(['11', '6'])
  })

  it('should read an entry quantifying over a named tree as invariant', () => {
    const body =
      'Toolkit-internal content lives under `internal/`, a tree nothing inside `claude/` reaches.'

    const result = classifyDecision(body)

    expect(result.claim).toBe('invariant')
    expect(result.quantified).toContain('internal/')
  })

  it('should read an entry giving only reasoning as neither', () => {
    const body =
      'Copied content is what a project edits and owns, while a skill is process that goes stale the moment it is copied.'

    const result = classifyDecision(body)

    expect(result.claim).toBe('neither')
    expect(result.figures).toEqual([])
    expect(result.quantified).toBeUndefined()
  })

  it('should take the countable reading when an entry carries both', () => {
    const body =
      'Every file under `internal/` is checked, and 5 of them reached a plugin cache.'

    expect(classifyDecision(body).claim).toBe('countable')
  })

  it('should not read an anchor date as a figure', () => {
    const body =
      'The alternative was declined. Measured at `abc1234` on 2026-08-20.'

    expect(classifyDecision(body).claim).toBe('neither')
  })

  it('should not read a figure inside a code span as a claim', () => {
    const body = 'The seed ships `v1.2.3` and nothing else.'

    expect(classifyDecision(body).figures).toEqual([])
  })

  it('should not read a quantifier far from a path as governing it', () => {
    const body =
      'Every session pays for this, which is a cost nobody measured against a rule stated somewhere in a document under `docs/index.md`.'

    expect(classifyDecision(body).claim).toBe('neither')
  })
})

describe('splitting the record into decisions', () => {
  it('should read one entry per third-level heading', () => {
    const source = [
      '# Architecture',
      '',
      '## Key technical decisions',
      '',
      '### First',
      '',
      'Reasoning.',
      '',
      '### Second',
      '',
      'More reasoning.',
      '',
    ].join('\n')

    const decisions = splitDecisions(source)

    expect(decisions.map((entry) => entry.heading)).toEqual(['First', 'Second'])
    expect(decisions[0]?.line).toBe(5)
  })

  it('should close the last entry at the section that follows it', () => {
    const source = [
      '### Only',
      '',
      'Reasoning.',
      '',
      '## Risks / open questions',
      '',
      '- A risk carrying 42 as a figure.',
      '',
    ].join('\n')

    const decisions = splitDecisions(source)

    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.body).not.toContain('42')
  })

  it('should skip a heading inside a fenced template block', () => {
    const source = [
      '### Real',
      '',
      'Reasoning.',
      '',
      '```markdown',
      '### Decision name',
      '```',
      '',
    ].join('\n')

    expect(splitDecisions(source).map((entry) => entry.heading)).toEqual([
      'Real',
    ])
  })

  it('should count one heading holding several decisions once', () => {
    const source = [
      '### One heading, three decisions',
      '',
      'The first. The second. The third.',
      '',
    ].join('\n')

    expect(splitDecisions(source)).toHaveLength(1)
  })
})

describe('reading the allowances a record states for itself', () => {
  it('should read a frame written in digits and a decision spelled in words', () => {
    const source =
      'The self-imposed 150-line total is restated as a 34-line frame plus six lines a decision.'

    expect(readAllowances(source)).toEqual({ frame: 34, perDecision: 6 })
  })

  it('should read both halves written in digits', () => {
    const source = 'A 20-line frame plus 4 lines a decision.'

    expect(readAllowances(source)).toEqual({ frame: 20, perDecision: 4 })
  })

  it('should read nothing from a record stating no length rule', () => {
    const source = [
      '# Architecture',
      '',
      '## Risks / open questions',
      '',
      '- The deploy target is undecided.',
    ].join('\n')

    expect(readAllowances(source)).toBeUndefined()
  })

  it('should read nothing when only one half of the formula is stated', () => {
    expect(readAllowances('A 34-line frame and nothing else.')).toBeUndefined()
    expect(readAllowances('Six lines a decision and no frame.')).toBeUndefined()
  })
})

describe('the ceiling the record derives for itself', () => {
  const stated = { frame: 34, perDecision: 6 }

  it('should grant the frame plus an allowance per decision', () => {
    expect(ceilingFor(stated, 24)).toBe(178)
  })

  it('should grant the frame alone to a record holding no decision', () => {
    expect(ceilingFor(stated, 0)).toBe(stated.frame)
  })

  it('should derive from the allowances the record stated, not a fixed pair', () => {
    expect(ceilingFor({ frame: 20, perDecision: 4 }, 3)).toBe(32)
  })

  it('should pass a record at its ceiling', () => {
    expect(isOverLength(makeReport({ lines: 178, ceiling: 178 }))).toBe(false)
  })

  it('should fail a record one line past its ceiling', () => {
    expect(isOverLength(makeReport({ lines: 179, ceiling: 178 }))).toBe(true)
  })

  /**
   * A project that never wrote a length rule owes nothing to one. Gating it
   * against a pair held in code audits a target against a rule it never
   * adopted, which is the failure the folder scope already answers.
   */
  it('should never fail a record that states no allowances', () => {
    const report = makeReport({
      lines: 620,
      allowances: undefined,
      ceiling: undefined,
    })

    expect(isOverLength(report)).toBe(false)
  })
})

describe('coverage across the classified entries', () => {
  it('should count an entry carrying either testable claim', () => {
    const report = makeReport({
      decisions: [
        makeDecision({ claim: 'countable' }),
        makeDecision({ claim: 'invariant' }),
        makeDecision({ claim: 'neither' }),
      ],
    })

    expect(testableCount(report)).toBe(2)
  })

  it('should count a testable entry naming a check as covered', () => {
    const report = makeReport({
      decisions: [
        makeDecision({
          claim: 'invariant',
          checks: ['scripts/core/check-plugin-boundary.sh'],
        }),
        makeDecision({ claim: 'countable' }),
      ],
    })

    expect(coveredCount(report)).toBe(1)
  })

  it('should not count an unverifiable entry naming a check as covered', () => {
    const report = makeReport({
      decisions: [
        makeDecision({ claim: 'neither', checks: ['canon markdown audit'] }),
      ],
    })

    expect(coveredCount(report)).toBe(0)
  })
})
