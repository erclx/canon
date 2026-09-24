import { describe, expect, it } from 'vitest'
import type { SectionFinding } from '@/context/audit'
import {
  type GateInput,
  hasDrift,
  hasSketchWithEvidence,
  hasStatesMismatch,
  isGating,
} from '@/context/gate'
import type { FolderDrift } from '@/context/index-drift'
import type { WireframeStatesReport } from '@/context/wireframe-states'

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

function makeWireframe(
  overrides: Partial<WireframeStatesReport> = {},
): WireframeStatesReport {
  return {
    rel: 'canon/wireframes/header.md',
    rows: [],
    missingFolders: [],
    unlistedFolders: [],
    sketchWithEvidence: false,
    ...overrides,
  }
}

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    unresolvedCitations: 0,
    recordOverLength: false,
    recordOverCount: false,
    sections: [],
    drift: [],
    wireframes: [],
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

  it('should fail a record past its own entry cap under the narrow gate', () => {
    expect(isGating(makeInput({ recordOverCount: true }))).toBe(true)
  })

  it('should fail a record past its own entry cap under the widened gate', () => {
    const input = makeInput({ recordOverCount: true, widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a missing required section advisory under the narrow gate', () => {
    expect(isGating(makeInput({ sections: [makeSection()] }))).toBe(false)
  })

  it('should fail a missing required section under the widened gate', () => {
    const input = makeInput({ sections: [makeSection()], widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a wireframe missing a required section advisory under the narrow gate', () => {
    const section = makeSection({
      rel: 'canon/wireframes/header.md',
      missing: ['Regions'],
    })

    expect(isGating(makeInput({ sections: [section] }))).toBe(false)
  })

  it('should fail a wireframe missing a required section under the widened gate', () => {
    const section = makeSection({
      rel: 'canon/wireframes/header.md',
      missing: ['Regions'],
    })

    expect(isGating(makeInput({ sections: [section], widened: true }))).toBe(
      true,
    )
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

  it('should leave a states mismatch advisory under the narrow gate', () => {
    const wireframe = makeWireframe({
      missingFolders: [
        { line: 20, state: 'empty', path: 'web/evidence/empty' },
      ],
    })

    expect(isGating(makeInput({ wireframes: [wireframe] }))).toBe(false)
  })

  it('should fail a states mismatch under the widened gate', () => {
    const wireframe = makeWireframe({
      unlistedFolders: [{ root: 'web/evidence', folder: 'answered' }],
    })
    const input = makeInput({ wireframes: [wireframe], widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a sketch beside existing evidence advisory under the narrow gate', () => {
    const wireframe = makeWireframe({
      sketchWithEvidence: true,
      sketchLine: 12,
    })

    expect(isGating(makeInput({ wireframes: [wireframe] }))).toBe(false)
  })

  it('should leave a sketch beside existing evidence advisory under the widened gate too', () => {
    const wireframe = makeWireframe({
      sketchWithEvidence: true,
      sketchLine: 12,
    })
    const input = makeInput({ wireframes: [wireframe], widened: true })

    expect(isGating(input)).toBe(false)
  })

  it('should pass a widened gate reading a clean wireframe report', () => {
    const input = makeInput({ wireframes: [makeWireframe()], widened: true })

    expect(isGating(input)).toBe(false)
  })
})

describe('hasStatesMismatch', () => {
  it('should report no mismatch when every wireframe is clean', () => {
    expect(hasStatesMismatch([makeWireframe()])).toBe(false)
  })

  it('should report a mismatch from a missing folder', () => {
    const wireframe = makeWireframe({
      missingFolders: [
        { line: 20, state: 'empty', path: 'web/evidence/empty' },
      ],
    })

    expect(hasStatesMismatch([wireframe])).toBe(true)
  })

  it('should report a mismatch from an unlisted folder', () => {
    const wireframe = makeWireframe({
      unlistedFolders: [{ root: 'web/evidence', folder: 'answered' }],
    })

    expect(hasStatesMismatch([wireframe])).toBe(true)
  })
})

describe('hasSketchWithEvidence', () => {
  it('should report false when no wireframe carries the finding', () => {
    expect(hasSketchWithEvidence([makeWireframe()])).toBe(false)
  })

  it('should report true when a wireframe carries the finding', () => {
    const wireframe = makeWireframe({
      sketchWithEvidence: true,
      sketchLine: 12,
    })

    expect(hasSketchWithEvidence([wireframe])).toBe(true)
  })
})
