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
  isOverCount,
  isOverLength,
  hasRevisitSentence,
  isOverRisks,
  measureArchitecture,
  missingRevisit,
  overWords,
  readAllowances,
  readEntryCap,
  readRevisitRule,
  readRiskCap,
  readWordCap,
  riskBullets,
  risksSection,
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

  it('should resolve at .claude/ when only the old root carries the record', () => {
    mkdirSync(join(root, '.claude'), { recursive: true })
    writeFileSync(join(root, '.claude', 'ARCHITECTURE.md'), '# Architecture\n')

    expect(architectureRel(root)).toBe(join('.claude', 'ARCHITECTURE.md'))
  })

  it('should resolve at canon/ when neither root carries the record', () => {
    expect(architectureRel(root)).toBe(join('canon', 'ARCHITECTURE.md'))
  })
})

function makeReport(
  overrides: Partial<ArchitectureReport> = {},
): ArchitectureReport {
  return {
    rel: 'canon/ARCHITECTURE.md',
    lines: 100,
    words: 620,
    allowances: { frame: 34, perDecision: 6 },
    ceiling: 100,
    revisitRequired: false,
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
    words: 12,
    revisit: false,
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

describe('reading the entry cap a record states for itself', () => {
  it('should read a cap written in digits', () => {
    expect(readEntryCap('This record holds at most 12 decisions.')).toBe(12)
  })

  it('should read a cap spelled in words', () => {
    expect(readEntryCap('It holds at most nine decisions.')).toBe(9)
  })

  it('should read a cap spelled past twelve', () => {
    expect(readEntryCap('It holds at most fifteen decisions.')).toBe(15)
  })

  it('should read nothing from a record stating no cap', () => {
    expect(readEntryCap('# Architecture\n\n## Overview\n')).toBeUndefined()
  })
})

describe('the entry count against the cap', () => {
  const decisions = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      makeDecision({ heading: `Decision ${index}` }),
    )

  it('should pass a record holding exactly its cap', () => {
    const report = makeReport({ entryCap: 3, decisions: decisions(3) })

    expect(isOverCount(report)).toBe(false)
  })

  it('should fail a record holding one entry past its cap', () => {
    const report = makeReport({ entryCap: 3, decisions: decisions(4) })

    expect(isOverCount(report)).toBe(true)
  })

  it('should never fail a record that states no cap', () => {
    const report = makeReport({ decisions: decisions(40) })

    expect(isOverCount(report)).toBe(false)
  })
})

describe('measuring the entry cap', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
    mkdirSync(join(root, 'canon'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should report the cap and leave a fenced template heading uncounted', async () => {
    const source = [
      '# Architecture',
      '',
      'This record holds at most 1 decision.',
      '',
      '## Key technical decisions',
      '',
      '### Real',
      '',
      'Reasoning.',
      '',
      '```markdown',
      '### Decision name',
      '```',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report?.entryCap).toBe(1)
    expect(report?.decisions).toHaveLength(1)
  })

  it('should report no cap for a record stating none', async () => {
    writeFileSync(
      join(root, 'canon', 'ARCHITECTURE.md'),
      '# Architecture\n\n### One\n\nBody.\n',
    )

    const report = await measureArchitecture(root)

    expect(report?.entryCap).toBeUndefined()
  })
})

describe('reading the revisit clause a record states for itself', () => {
  it('should read the clause stated in the overview', () => {
    const source =
      '# Architecture\n\nEvery decision closes with a revisit sentence.\n'

    expect(readRevisitRule(source)).toBe(true)
  })

  it('should read nothing from a record stating no clause', () => {
    expect(readRevisitRule('# Architecture\n\n## Overview\n')).toBe(false)
  })

  it('should not read the clause quoted inside a fenced block', () => {
    const source = [
      '# Architecture',
      '',
      '```markdown',
      'Every decision closes with a revisit sentence.',
      '```',
      '',
    ].join('\n')

    expect(readRevisitRule(source)).toBe(false)
  })
})

describe('finding the revisit sentence in a decision', () => {
  it('should find a sentence opening with Revisit when', () => {
    const body =
      'Bun won over Node. Revisit when Node runs the source without a build.'

    expect(hasRevisitSentence(body)).toBe(true)
  })

  it('should find the sentence opening a paragraph', () => {
    const body = 'Bun won over Node.\n\nRevisit when Node runs the source.'

    expect(hasRevisitSentence(body)).toBe(true)
  })

  it('should not find the sentence in a decision lacking one', () => {
    expect(hasRevisitSentence('Bun won over Node.')).toBe(false)
  })

  it('should not count the phrase inside a code span', () => {
    const body = 'The standard asks for `Revisit when <finding>.` here.'

    expect(hasRevisitSentence(body)).toBe(false)
  })

  it('should not count the phrase in the middle of a sentence', () => {
    const body = 'Nobody says Revisit when anything changes.'

    expect(hasRevisitSentence(body)).toBe(false)
  })
})

describe('measuring the revisit sentence', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
    mkdirSync(join(root, 'canon'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const clause = 'Every decision closes with a revisit sentence.'

  it('should name the decision missing the sentence under the clause', async () => {
    const source = [
      '# Architecture',
      '',
      clause,
      '',
      '### Carries one',
      '',
      'Reasoning. Revisit when the reason goes.',
      '',
      '### Lacks one',
      '',
      'Reasoning.',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report?.revisitRequired).toBe(true)
    expect(report?.decisions.map((entry) => entry.revisit)).toEqual([
      true,
      false,
    ])
    expect(report && missingRevisit(report)).toEqual(['Lacks one'])
  })

  it('should not count the sentence inside a fenced block', async () => {
    const source = [
      '# Architecture',
      '',
      clause,
      '',
      '### Fenced only',
      '',
      'Reasoning.',
      '',
      '```markdown',
      'Revisit when the reason goes.',
      '```',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report && missingRevisit(report)).toEqual(['Fenced only'])
  })

  it('should not count a fenced template heading as a decision missing one', async () => {
    const source = [
      '# Architecture',
      '',
      clause,
      '',
      '### Real',
      '',
      'Reasoning. Revisit when the reason goes.',
      '',
      '```markdown',
      '### Decision name',
      '',
      'Reasoning.',
      '```',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report && missingRevisit(report)).toEqual([])
  })

  it('should report but never require the sentence without the clause', async () => {
    writeFileSync(
      join(root, 'canon', 'ARCHITECTURE.md'),
      '# Architecture\n\n### One\n\nBody.\n',
    )

    const report = await measureArchitecture(root)

    expect(report?.revisitRequired).toBe(false)
    expect(report?.decisions[0]?.revisit).toBe(false)
    expect(report && missingRevisit(report)).toEqual([])
  })
})

describe('extracting the Risks / open questions section', () => {
  it('should capture the section body up to the end of the file', () => {
    const source = [
      '### Only',
      '',
      'Reasoning.',
      '',
      '## Risks / open questions',
      '',
      '- A risk carrying no figure at all.',
      '',
    ].join('\n')

    expect(risksSection(source)).toContain('A risk carrying no figure')
  })

  it('should stop the section at the next H2', () => {
    const source = [
      '## Risks / open questions',
      '',
      '- Open.',
      '',
      '## Somewhere else',
      '',
      'Not a risk.',
    ].join('\n')

    expect(risksSection(source)).not.toContain('Not a risk')
  })

  it('should read nothing from a record carrying no Risks heading', () => {
    const source = ['# Architecture', '', '## Overview', '', 'Body.'].join('\n')

    expect(risksSection(source)).toBeUndefined()
  })
})

describe('measuring word weight', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should weigh a record whose paragraphs sit one to a source line', async () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    const source = [
      '# Architecture',
      '',
      '## Key technical decisions',
      '',
      '### A decision',
      '',
      'One paragraph occupies one long source line here so a line count would read it as a single unit while a word count reads its real weight.',
      '',
      '## Risks / open questions',
      '',
      '- Still open.',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report?.words).toBeGreaterThan(report?.lines ?? 0)
    expect(report?.decisions[0]?.words).toBeGreaterThan(0)
  })

  it('should weigh the Risks section in words', async () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    const source = [
      '# Architecture',
      '',
      '## Risks / open questions',
      '',
      '- The deploy target for the new stack is still undecided.',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report?.risksWords).toBe(11)
  })

  it('should leave risksWords absent for a record with no Risks heading', async () => {
    mkdirSync(join(root, 'canon'), { recursive: true })
    writeFileSync(
      join(root, 'canon', 'ARCHITECTURE.md'),
      '# Architecture\n\n## Overview\n\nBody.\n',
    )

    const report = await measureArchitecture(root)

    expect(report?.risksWords).toBeUndefined()
  })
})

describe('naming a gate module as a check', () => {
  let root: string

  const record = (span: string): string =>
    [
      '# Architecture',
      '',
      '## Key technical decisions',
      '',
      '### A boundary',
      '',
      `Nothing under the plugin reaches internal files, which \`${span}\` walks.`,
      '',
    ].join('\n')

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
    mkdirSync(join(root, 'canon'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should count a code span naming an existing gate module as a named check', async () => {
    mkdirSync(join(root, 'src/gate'), { recursive: true })
    writeFileSync(join(root, 'src/gate/boundaries.ts'), '')
    writeFileSync(
      join(root, 'canon/ARCHITECTURE.md'),
      record('src/gate/boundaries.ts'),
    )

    const report = await measureArchitecture(root)

    expect(report?.decisions[0]?.checks).toEqual(['src/gate/boundaries.ts'])
  })

  it('should not count a gate module that is absent', async () => {
    writeFileSync(
      join(root, 'canon/ARCHITECTURE.md'),
      record('src/gate/boundaries.ts'),
    )

    const report = await measureArchitecture(root)

    expect(report?.decisions[0]?.checks).toEqual([])
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

describe('reading the word and risk caps a record states for itself', () => {
  const clause =
    'This record holds at most 12 decisions, at most 150 words a decision, and at most 6 risk bullets.'

  it('should read the per-decision word cap', () => {
    expect(readWordCap(clause)).toBe(150)
  })

  it('should read the risk-bullet cap', () => {
    expect(readRiskCap(clause)).toBe(6)
  })

  it('should leave the entry cap reading unchanged beside both', () => {
    expect(readEntryCap(clause)).toBe(12)
  })

  it('should read neither from a record stating no such clause', () => {
    const source = '# Architecture\n\nThis record holds at most 12 decisions.\n'

    expect(readWordCap(source)).toBeUndefined()
    expect(readRiskCap(source)).toBeUndefined()
  })
})

describe('counting risk bullets', () => {
  it('should count nested bullets alongside top-level ones', () => {
    const source = [
      '## Risks / open questions',
      '',
      '- First.',
      '  - Nested under the first.',
      '- Second.',
      '',
    ].join('\n')

    expect(riskBullets(source)).toBe(3)
  })

  it('should not count a bullet inside a fenced block', () => {
    const source = [
      '## Risks / open questions',
      '',
      '- Real.',
      '',
      '```markdown',
      '- Template.',
      '```',
      '',
    ].join('\n')

    expect(riskBullets(source)).toBe(1)
  })

  it('should read nothing from a record carrying no Risks heading', () => {
    expect(riskBullets('# Architecture\n\n## Overview\n')).toBeUndefined()
  })
})

describe('the decision word count against the cap', () => {
  it('should pass a decision of exactly the cap', () => {
    const report = makeReport({
      wordCap: 150,
      decisions: [makeDecision({ words: 150 })],
    })

    expect(overWords(report)).toEqual([])
  })

  it('should fail a decision one word past the cap', () => {
    const report = makeReport({
      wordCap: 150,
      decisions: [makeDecision({ heading: 'Long', words: 151 })],
    })

    expect(overWords(report).map((entry) => entry.heading)).toEqual(['Long'])
  })

  it('should never fail a record that states no word cap', () => {
    const report = makeReport({ decisions: [makeDecision({ words: 900 })] })

    expect(overWords(report)).toEqual([])
  })
})

describe('the risk bullet count against the cap', () => {
  it('should pass a section holding exactly the cap', () => {
    const report = makeReport({ riskCap: 6, risksBullets: 6 })

    expect(isOverRisks(report)).toBe(false)
  })

  it('should fail a section holding one bullet past the cap', () => {
    const report = makeReport({ riskCap: 6, risksBullets: 7 })

    expect(isOverRisks(report)).toBe(true)
  })

  it('should never fail a record that states no risk cap', () => {
    const report = makeReport({ risksBullets: 40 })

    expect(isOverRisks(report)).toBe(false)
  })

  it('should not read an absent Risks section as over the cap', () => {
    const report = makeReport({ riskCap: 6 })

    expect(isOverRisks(report)).toBe(false)
  })
})

describe('measuring the word and risk caps', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-architecture-'))
    mkdirSync(join(root, 'canon'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should count a decision in prose words, leaving its heading and fenced lines out', async () => {
    const source = [
      '# Architecture',
      '',
      'At most 4 words a decision and at most 2 risk bullets.',
      '',
      '### A heading of several words',
      '',
      'Three words here.',
      '',
      '```markdown',
      'fenced words that never count',
      '```',
      '',
      '## Risks / open questions',
      '',
      '- One.',
      '  - Two.',
      '',
    ].join('\n')
    writeFileSync(join(root, 'canon', 'ARCHITECTURE.md'), source)

    const report = await measureArchitecture(root)

    expect(report?.decisions[0]?.words).toBe(3)
    expect(report?.wordCap).toBe(4)
    expect(report?.riskCap).toBe(2)
    expect(report?.risksBullets).toBe(2)
  })
})
