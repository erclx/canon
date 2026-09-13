import { describe, expect, it } from 'vitest'
import type { SectionFinding } from '@/context/audit'
import { type GateInput, hasDrift, isGating } from '@/context/gate'
import type { FolderDrift } from '@/context/index-drift'

function makeDrift(overrides: Partial<FolderDrift> = {}): FolderDrift {
  return { rel: 'canon/context', unlisted: [], missing: [], ...overrides }
}

function makeSection(overrides: Partial<SectionFinding> = {}): SectionFinding {
  return {
    rel: 'canon/context/ci.md',
    missing: ['Overview'],
    ...overrides,
  }
}

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    unresolvedCitations: 0,
    recordOverLength: false,
    sections: [],
    drift: [],
    widened: false,
    ...overrides,
  }
}

describe('hasDrift', () => {
  it('should report no drift for a folder agreeing with its index', () => {
    expect(hasDrift([makeDrift()])).toBe(false)
  })

  it('should report no drift when every audited folder is clean', () => {
    expect(
      hasDrift([makeDrift(), makeDrift({ rel: '.claude/diagrams' })]),
    ).toBe(false)
  })

  it('should report drift when an entry is absent from the index', () => {
    expect(hasDrift([makeDrift({ unlisted: ['cli.md'] })])).toBe(true)
  })

  it('should report drift when the index links a file that is gone', () => {
    expect(hasDrift([makeDrift({ missing: ['old.md'] })])).toBe(true)
  })
})

describe('isGating', () => {
  it('should pass a clean audit under the narrow gate', () => {
    expect(isGating(makeInput())).toBe(false)
  })

  it('should pass a clean audit under the widened gate', () => {
    expect(isGating(makeInput({ widened: true }))).toBe(false)
  })

  it('should fail an unresolved citation under the narrow gate', () => {
    expect(isGating(makeInput({ unresolvedCitations: 1 }))).toBe(true)
  })

  it('should fail an unresolved citation under the widened gate', () => {
    const input = makeInput({ unresolvedCitations: 1, widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should fail a record past its own ceiling under the narrow gate', () => {
    expect(isGating(makeInput({ recordOverLength: true }))).toBe(true)
  })

  it('should fail a record past its own ceiling under the widened gate', () => {
    const input = makeInput({ recordOverLength: true, widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a missing required section advisory under the narrow gate', () => {
    expect(isGating(makeInput({ sections: [makeSection()] }))).toBe(false)
  })

  it('should fail a missing required section under the widened gate', () => {
    const input = makeInput({ sections: [makeSection()], widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave index drift advisory under the narrow gate', () => {
    const input = makeInput({ drift: [makeDrift({ unlisted: ['cli.md'] })] })

    expect(isGating(input)).toBe(false)
  })

  it('should fail index drift under the widened gate', () => {
    const input = makeInput({
      drift: [makeDrift({ unlisted: ['cli.md'] })],
      widened: true,
    })

    expect(isGating(input)).toBe(true)
  })

  it('should pass a widened gate reading a record per clean folder', () => {
    const input = makeInput({ drift: [makeDrift()], widened: true })

    expect(isGating(input)).toBe(false)
  })
})
