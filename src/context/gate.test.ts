import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  ExtraSectionFinding,
  LengthFinding,
  SectionFinding,
  ShapeFinding,
} from '@/context/audit'
import type { CoverageReport } from '@/context/coverage'
import {
  declaresContextGate,
  type GateInput,
  hasContextFolder,
  hasDrift,
  isGating,
} from '@/context/gate'
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

function makeExtra(
  overrides: Partial<ExtraSectionFinding> = {},
): ExtraSectionFinding {
  return { rel: 'canon/context/ci.md', headings: ['Triggers'], ...overrides }
}

function makeShape(overrides: Partial<ShapeFinding> = {}): ShapeFinding {
  return {
    rel: 'canon/context/ci.md',
    gated: false,
    issues: [{ line: 8, kind: 'retired-section', text: 'Decisions' }],
    ...overrides,
  }
}

function makeLength(overrides: Partial<LengthFinding> = {}): LengthFinding {
  return {
    rel: 'canon/context/ci.md',
    lines: 210,
    causes: [{ question: 'history', state: 'no' }],
    exempt: null,
    ...overrides,
  }
}

const UNNAMED: CoverageReport = {
  kind: 'measured',
  roots: ['src'],
  findings: { unnamed: ['src/x'], doubled: [], missingRoots: [] },
}

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    unresolvedCitations: 0,
    requirementsOverWords: false,
    sections: [],
    extraSections: [],
    shape: [],
    drift: [],
    coverage: { kind: 'no-root' },
    length: [],
    gateLength: false,
    gateKeyFaults: [],
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

  it('should fail a requirements record past its own word cap under the narrow gate', () => {
    expect(isGating(makeInput({ requirementsOverWords: true }))).toBe(true)
  })

  it('should leave a missing required section advisory under the narrow gate', () => {
    expect(isGating(makeInput({ sections: [makeSection()] }))).toBe(false)
  })

  it('should fail a missing required section under the widened gate', () => {
    const input = makeInput({ sections: [makeSection()], widened: true })

    expect(isGating(input)).toBe(true)
  })

  it('should leave an off-set section advisory under the narrow gate', () => {
    expect(isGating(makeInput({ extraSections: [makeExtra()] }))).toBe(false)
  })

  it('should fail an off-set section under the widened gate', () => {
    const input = makeInput({ extraSections: [makeExtra()], widened: true })

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

  it('should pass an ungated shape finding under the widened gate', () => {
    const input = makeInput({ shape: [makeShape()], widened: true })

    expect(isGating(input)).toBe(false)
  })

  it('should fail a gated shape finding under the widened gate', () => {
    const input = makeInput({
      shape: [makeShape({ gated: true })],
      widened: true,
    })

    expect(isGating(input)).toBe(true)
  })

  it('should pass a gated shape finding outside the widened gate', () => {
    const input = makeInput({ shape: [makeShape({ gated: true })] })

    expect(isGating(input)).toBe(false)
  })

  it('should leave a coverage finding advisory under the narrow gate', () => {
    expect(isGating(makeInput({ coverage: UNNAMED }))).toBe(false)
  })

  it('should fail a coverage finding under the widened gate', () => {
    expect(isGating(makeInput({ coverage: UNNAMED, widened: true }))).toBe(true)
  })

  it('should pass a widened gate that found no code root or an opt-out', () => {
    expect(isGating(makeInput({ widened: true }))).toBe(false)
    expect(
      isGating(makeInput({ coverage: { kind: 'opted-out' }, widened: true })),
    ).toBe(false)
  })

  it('should fail a long entry under the widened gate with gate-length set', () => {
    const input = makeInput({
      length: [makeLength()],
      gateLength: true,
      widened: true,
    })

    expect(isGating(input)).toBe(true)
  })

  it('should pass a long entry under the widened gate without gate-length', () => {
    const input = makeInput({ length: [makeLength()], widened: true })

    expect(isGating(input)).toBe(false)
  })

  it('should pass a long entry with gate-length set outside the widened gate', () => {
    const input = makeInput({ length: [makeLength()], gateLength: true })

    expect(isGating(input)).toBe(false)
  })

  it('should pass a long entry carrying an exemption with gate-length set', () => {
    const input = makeInput({
      length: [makeLength({ exempt: 'a verbatim run record' })],
      gateLength: true,
      widened: true,
    })

    expect(isGating(input)).toBe(false)
  })

  it('should fail a gate key fault under the widened gate', () => {
    const input = makeInput({
      gateKeyFaults: ['canon/config/context.toml needs gate-length as true'],
      widened: true,
    })

    expect(isGating(input)).toBe(true)
  })

  it('should leave a gate key fault advisory under the narrow gate', () => {
    const input = makeInput({
      gateKeyFaults: ['canon/config/context.toml needs gate-length as true'],
    })

    expect(isGating(input)).toBe(false)
  })
})

describe('the context stage reads', () => {
  let root: string

  const write = (rel: string, body: string): void => {
    mkdirSync(join(root, rel, '..'), { recursive: true })
    writeFileSync(join(root, rel), body)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'canon-context-gate-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('should find a context folder under either surface root', () => {
    mkdirSync(join(root, '.claude', 'context'), { recursive: true })

    expect(hasContextFolder(root)).toBe(true)
  })

  it('should find no context folder in a project carrying neither', () => {
    expect(hasContextFolder(root)).toBe(false)
  })

  it('should read no gate opt-in where the project has no context config', () => {
    expect(declaresContextGate(root)).toBe(false)
  })

  it('should read the opt-in from a declared gated list, even an empty one', () => {
    write('canon/config/context.toml', 'gated = []\n')

    expect(declaresContextGate(root)).toBe(true)
  })

  it('should read the opt-in from gate-length set to true', () => {
    write('canon/config/context.toml', 'gate-length = true\n')

    expect(declaresContextGate(root)).toBe(true)
  })

  it('should read no opt-in from gate-length set to false', () => {
    write('canon/config/context.toml', 'gate-length = false\n')

    expect(declaresContextGate(root)).toBe(false)
  })

  it('should read the opt-in from a gated key in a shape the audit cannot use', () => {
    write('canon/config/context.toml', 'gated = "canon/context"\n')

    expect(declaresContextGate(root)).toBe(true)
  })
})
