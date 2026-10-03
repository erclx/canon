import { describe, expect, it } from 'vitest'
import { DESIGN_BUDGET, measureDesignProse } from '@/design/budget'

const words = (count: number): string =>
  Array.from({ length: count }, (_, index) => `w${index}`).join(' ')

const rules = (count: number, length = 5): string =>
  Array.from({ length: count }, () => `- ${words(length)}`).join('\n')

const TABLE = [
  '| Role | Intent | Value |',
  '| ---- | ------ | ----- |',
  `| background | ${words(40)} | #000000 |`,
].join('\n')

const record = (sections: Record<string, string>, lead = ''): string =>
  [
    '# Design',
    lead,
    ...Object.entries(sections).map(([heading, body]) =>
      [`## ${heading}`, body].join('\n\n'),
    ),
  ].join('\n\n')

describe('measureDesignProse', () => {
  it('passes a section holding a table and the rule cap', () => {
    const source = record({
      Color: `${rules(DESIGN_BUDGET.rules)}\n\n${TABLE}`,
    })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('fails a section holding one rule past the cap', () => {
    const source = record({ Color: rules(DESIGN_BUDGET.rules + 1) })

    expect(measureDesignProse(source)).toEqual([
      `Color holds ${DESIGN_BUDGET.rules + 1} rules against a cap of ${DESIGN_BUDGET.rules}`,
    ])
  })

  it('passes a section holding a table and no rules', () => {
    expect(measureDesignProse(record({ Color: TABLE }))).toEqual([])
  })

  it('never counts a table row, however long its cells', () => {
    const source = record({ Borders: `${TABLE}\n${TABLE}\n${TABLE}` })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('excludes a row whose code span carries a pipe or a tag', () => {
    const row = `| \`a | b\` | ${words(30)} | #fff ? verify |`
    const source = record({ Color: `${TABLE}\n${row}` })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('never counts an HTML comment or a fenced block', () => {
    const fence = ['```plaintext', ...Array(5).fill(words(30)), '```']
    const source = record({
      Motion: ['<!-- a note the preview drops -->', ...fence].join('\n'),
    })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('passes a rule at the word cap', () => {
    const source = record({ Motion: rules(1, DESIGN_BUDGET.ruleWords) })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('fails a rule one word past the cap', () => {
    const source = record({ Motion: rules(1, DESIGN_BUDGET.ruleWords + 1) })

    expect(measureDesignProse(source)).toEqual([
      `Motion rule 1 holds ${DESIGN_BUDGET.ruleWords + 1} words against a cap of ${DESIGN_BUDGET.ruleWords}`,
    ])
  })

  it('reads a bullet wrapping over several lines as one rule', () => {
    const wrapped = `- ${words(15)}\n  ${words(15)}`
    const source = record({ Layout: wrapped })

    expect(measureDesignProse(source)).toEqual([
      `Layout rule 1 holds 30 words against a cap of ${DESIGN_BUDGET.ruleWords}`,
    ])
  })

  it('counts a nested bullet as a rule of its own', () => {
    const nested = `${rules(DESIGN_BUDGET.rules)}\n  - ${words(3)}`
    const source = record({ Iconography: nested })

    expect(measureDesignProse(source)).toEqual([
      `Iconography holds ${DESIGN_BUDGET.rules + 1} rules against a cap of ${DESIGN_BUDGET.rules}`,
    ])
  })

  it('counts a plain paragraph as a rule', () => {
    const source = record({ Motion: words(DESIGN_BUDGET.ruleWords + 1) })

    expect(measureDesignProse(source)).toEqual([
      `Motion rule 1 holds ${DESIGN_BUDGET.ruleWords + 1} words against a cap of ${DESIGN_BUDGET.ruleWords}`,
    ])
  })

  it('passes a Personality paragraph at the word cap', () => {
    const source = record({
      Personality: words(DESIGN_BUDGET.personalityWords),
    })

    expect(measureDesignProse(source)).toEqual([])
  })

  it('fails a Personality paragraph one word past the cap', () => {
    const source = record({
      Personality: words(DESIGN_BUDGET.personalityWords + 1),
    })

    expect(measureDesignProse(source)).toEqual([
      `Personality holds ${DESIGN_BUDGET.personalityWords + 1} words against a cap of ${DESIGN_BUDGET.personalityWords}`,
    ])
  })

  it('fails a Personality of two paragraphs', () => {
    const source = record({ Personality: `${words(5)}\n\n${words(5)}` })

    expect(measureDesignProse(source)).toEqual([
      'Personality holds 2 paragraphs against a cap of 1',
    ])
  })

  it('passes a lead at the word cap', () => {
    const source = record({}, words(DESIGN_BUDGET.leadWords))

    expect(measureDesignProse(source)).toEqual([])
  })

  it('fails a lead one word past the cap', () => {
    const source = record({}, words(DESIGN_BUDGET.leadWords + 1))

    expect(measureDesignProse(source)).toEqual([
      `The lead holds ${DESIGN_BUDGET.leadWords + 1} words against a cap of ${DESIGN_BUDGET.leadWords}`,
    ])
  })

  it('reads an empty record as nothing to count', () => {
    expect(measureDesignProse('')).toEqual([])
  })

  it('reads a record with no Personality as nothing to count there', () => {
    expect(measureDesignProse(record({ Color: TABLE }))).toEqual([])
  })
})
