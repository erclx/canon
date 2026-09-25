import { describe, expect, it } from 'vitest'
import { type GateInput, isGating } from '@/markdown/gate'
import type { LinkFinding } from '@/markdown/links'
import type { BanFinding } from '@/markdown/scan'
import type { StructureReport } from '@/markdown/structure'

function makeBan(overrides: Partial<BanFinding> = {}): BanFinding {
  return { line: 12, column: 4, kind: 'character', term: '—', ...overrides }
}

function makeLink(overrides: Partial<LinkFinding> = {}): LinkFinding {
  return {
    line: 12,
    column: 15,
    destination: 'docs/agents/commands.md',
    ...overrides,
  }
}

function makeStructure(
  overrides: Partial<StructureReport> = {},
): StructureReport {
  return {
    rel: 'docs/agents/commands.md',
    longestRun: 0,
    longestRunLine: 0,
    heavyBullets: [],
    heavyParagraphs: [],
    cadence: {
      measured: 0,
      flat: 0,
      repeating: 0,
      flattest: undefined,
      mostRepeated: undefined,
    },
    ...overrides,
  }
}

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return { bans: [], links: [], structure: [], ...overrides }
}

describe('isGating', () => {
  it('should pass a corpus carrying no finding at all', () => {
    expect(isGating(makeInput())).toBe(false)
  })

  it('should pass a corpus measured clean against every structural checkpoint', () => {
    const input = makeInput({ structure: [makeStructure()] })

    expect(isGating(input)).toBe(false)
  })

  it('should fail a banned character', () => {
    const input = makeInput({ bans: [makeBan()] })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a heavy bullet advisory', () => {
    const input = makeInput({
      structure: [
        makeStructure({ heavyBullets: [{ line: 8, characters: 512 }] }),
      ],
    })

    expect(isGating(input)).toBe(false)
  })

  it('should leave a heavy paragraph advisory', () => {
    const input = makeInput({
      structure: [
        makeStructure({
          heavyParagraphs: [{ line: 30, sentences: 3, characters: 780 }],
        }),
      ],
    })

    expect(isGating(input)).toBe(false)
  })

  it('should leave a flat cadence advisory', () => {
    const input = makeInput({
      structure: [
        makeStructure({
          cadence: {
            measured: 4,
            flat: 3,
            repeating: 1,
            flattest: {
              line: 12,
              sentences: 4,
              spread: 1,
              repeats: 3,
              opener: 'the',
            },
            mostRepeated: {
              line: 12,
              sentences: 4,
              spread: 1,
              repeats: 3,
              opener: 'the',
            },
          },
        }),
      ],
    })

    expect(isGating(input)).toBe(false)
  })

  it('should leave a run past the depth checkpoint advisory', () => {
    const input = makeInput({
      structure: [makeStructure({ longestRun: 61, longestRunLine: 44 })],
    })

    expect(isGating(input)).toBe(false)
  })

  it('should fail a ban hit sitting beside a structural finding', () => {
    const input = makeInput({
      bans: [makeBan()],
      structure: [
        makeStructure({ heavyBullets: [{ line: 8, characters: 512 }] }),
      ],
    })

    expect(isGating(input)).toBe(true)
  })

  it('should fail a dead link', () => {
    const input = makeInput({ links: [makeLink()] })

    expect(isGating(input)).toBe(true)
  })

  it('should fail a ban hit sitting beside a dead link', () => {
    const input = makeInput({ bans: [makeBan()], links: [makeLink()] })

    expect(isGating(input)).toBe(true)
  })
})
