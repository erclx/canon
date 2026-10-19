import { describe, expect, it } from 'vitest'
import {
  intakeSpill,
  intakeStructure,
  structureFindings,
} from '@/records/structure'

function criteria(text: string): string[] {
  return structureFindings(text).map((entry) => entry.criterion)
}

function bullets(count: number, prefix = ''): string[] {
  return Array.from({ length: count }, (_, i) => `- ${prefix}item ${i + 1}`)
}

describe('structureFindings', () => {
  it('should report S1 on a bold label standing alone as a section', () => {
    const text = [
      '# Feature: A',
      '',
      '**Files to touch:**',
      '',
      '- `a.ts`: x',
    ].join('\n')

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S1', line: 3 },
    ])
  })

  it('should not report S1 on an H2 section', () => {
    const text = [
      '# Feature: A',
      '',
      '## Files to touch',
      '',
      '- `a.ts`: x',
    ].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should report S1 on the bold section alone in a plan mixing spellings', () => {
    const text = [
      '# Feature: A',
      '',
      '## Summary',
      '',
      '- Goal: one',
      '',
      '**Risks:**',
      '',
      '- One risk',
    ].join('\n')

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S1', line: 7 },
    ])
  })

  it('should report S2 on a section past 5 plain bullets', () => {
    const text = ['## Risks', '', ...bullets(6)].join('\n')

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S2', line: 3 },
    ])
  })

  it('should not report S2 on a section of exactly 5 plain bullets', () => {
    const text = ['## Risks', '', ...bullets(5)].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should exempt a run of 7 labeled field bullets from S2', () => {
    const text = ['## Fields', '', ...bullets(7, '**Field:** ')].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should report S3 on an H3 opening straight onto bullets', () => {
    const text = ['## Files to touch', '', '### Area', '', '- `a.ts`: x'].join(
      '\n',
    )

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S3', line: 3 },
    ])
  })

  it('should not report S3 on an H3 opening with a lead sentence', () => {
    const text = [
      '## Files to touch',
      '',
      '### Area',
      '',
      'These share one reason.',
      '',
      '- `a.ts`: x',
    ].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should report S4 on a bullet past 200 characters', () => {
    const text = ['## Risks', '', `- ${'a'.repeat(201)}`].join('\n')

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S4', line: 3 },
    ])
  })

  it('should not report S4 on a bullet of exactly 200 characters', () => {
    const text = ['## Risks', '', `- ${'a'.repeat(200)}`].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should report S5 on an H4', () => {
    const text = ['## Risks', '', '#### Deep', '', 'Prose.'].join('\n')

    expect(criteria(text)).toEqual(['S5'])
  })

  it('should stay silent on a plan with no H3 and four bullets per section', () => {
    const text = [
      '# Feature: A',
      '',
      '## Summary',
      '',
      ...bullets(4),
      '',
      '## Risks',
      '',
      ...bullets(4),
    ].join('\n')

    expect(criteria(text)).toEqual([])
  })

  it('should number lines against the whole file when frontmatter leads it', () => {
    const text = ['---', 'title: A', '---', '', '**Risks:**'].join('\n')

    expect(structureFindings(text)).toMatchObject([
      { criterion: 'S1', line: 5 },
    ])
  })

  it('should read a section marker inside a fence as an example', () => {
    const text = ['## Example', '', '```markdown', '**Risks:**', '```'].join(
      '\n',
    )

    expect(criteria(text)).toEqual([])
  })

  it('should report every section of an old bold-label plan under S1 alone', () => {
    const text = [
      '# Feature: Old',
      '',
      '## Summary',
      '',
      '- Goal: one',
      '',
      '**Files to touch:**',
      '',
      '- `a.ts`: x',
      '',
      '**Verification:**',
      '',
      '- `bun test`',
    ].join('\n')

    expect(criteria(text)).toEqual(['S1', 'S1'])
  })
})

describe('intakeSpill', () => {
  it('should report a field ending on a colon with nested bullets', () => {
    const text = [
      '### 1. `review/` holds seven kinds',
      '',
      '- **Problem:** What each one is and who writes it:',
      '  - `branch/`: reports from review-branch.',
      '  - `feedback/`: reports about the toolkit.',
      '  - `memory/`: receipts.',
      '  - `evidence/`: screenshots.',
      '  - `design/`: previews.',
      '- **Fix:** Keep `review/` for reviews.',
      '- **Worth it:** Yes.',
      '- **You:**',
    ].join('\n')

    expect(intakeSpill(text)).toMatchObject([
      { criterion: 'intake-spill', line: 4 },
    ])
  })

  it('should name the field and the item the spill sits under', () => {
    const text = ['### 3a. Split', '', '- **Problem:** A:', '  - nested'].join(
      '\n',
    )

    expect(intakeSpill(text)[0].message).toContain(
      'the Problem field of item 3a',
    )
  })

  it('should report a paragraph trailing the last field', () => {
    const text = [
      '### 1. Item',
      '',
      '- **Problem:** One line.',
      '- **You:** ok',
      '',
      '**Earlier answers this reverses:** intake 40.',
    ].join('\n')

    expect(intakeSpill(text)).toMatchObject([{ line: 6 }])
  })

  it('should stay silent on an item whose every field sits on its line', () => {
    const text = [
      '### 1. Item',
      '',
      '- **Problem:** One line.',
      '- **Fix:** One change.',
      '- **Worth it:** Yes.',
      '- **You:**',
    ].join('\n')

    expect(intakeSpill(text)).toEqual([])
  })

  it('should leave prose under a non-item heading alone', () => {
    const text = ['## Cluster', '', 'Lead prose for the cluster.'].join('\n')

    expect(intakeSpill(text)).toEqual([])
  })
})

describe('intakeStructure', () => {
  it('should exempt an item heading from S3 and a long field from S4', () => {
    const text = [
      '## Cluster',
      '',
      'Lead.',
      '',
      '### 1. Item',
      '',
      `- **Problem:** ${'a'.repeat(250)}`,
      '- **You:**',
    ].join('\n')

    expect(intakeStructure(text)).toEqual([])
  })

  it('should still report S3 on an H3 that is not an item', () => {
    const text = ['### Notes', '', '- one'].join('\n')

    expect(intakeStructure(text).map((entry) => entry.criterion)).toEqual([
      'S3',
    ])
  })
})
