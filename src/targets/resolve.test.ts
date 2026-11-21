import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recordTarget } from '@/targets/registry'
import { resolveTargets } from '@/targets/resolve'

let ROOT: string
let FILE: string

function stamp(...segments: string[]): string {
  const target = join(ROOT, ...segments)
  const path = join(target, '.claude', 'canon', 'config.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ covers: [], domains: {} }))
  return target
}

function stampLegacy(...segments: string[]): string {
  const target = join(ROOT, ...segments)
  const path = join(target, '.claude', 'aitk.json')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ covers: [], domains: {} }))
  return target
}

const noOrigin = async (): Promise<string | null> => null

/**
 * Every fixture sits under the OS temp folder, which the index refuses, so
 * these cases name no scratch roots to let a recorded fixture stay listed.
 */
const NO_ROOTS: readonly string[] = []

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-resolve-'))
  FILE = join(ROOT, 'targets.json')
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('resolveTargets', () => {
  it('should take the paths the caller named and read no source of its own', async () => {
    const report = await resolveTargets({
      paths: [join(ROOT, 'birch')],
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
    })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.source).toBe('given')
    expect(report.registry).toBeNull()
    expect(report.bound).toBeNull()
  })

  it('should report every target the record holds', async () => {
    recordTarget(stamp('birch'), new Date('2026-08-30'), FILE, NO_ROOTS)
    recordTarget(stamp('delta'), new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
    })

    expect(report.targets.map((target) => target.source)).toEqual([
      'record',
      'record',
    ])
  })

  // A machine no sync has run on answers "unknown" rather than "none", and a caller must tell them apart.
  it('should carry an absent record through rather than reporting no targets', async () => {
    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
    })

    expect(report.registry?.kind).toBe('absent')
    expect(report.targets).toEqual([])
  })

  it('should run no sweep when the caller names no roots', async () => {
    recordTarget(join(ROOT, 'birch'), new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
    })

    expect(report.bound).toBeNull()
  })

  it('should add a target the sweep found and the record never held', async () => {
    stamp('delta')

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [ROOT],
      originOf: noOrigin,
    })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.source).toBe('sweep')
    expect(report.bound?.roots).toEqual([ROOT])
  })

  it('should not report a target twice when both sources hold it', async () => {
    const birch = stamp('birch')
    recordTarget(birch, new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [ROOT],
      originOf: noOrigin,
    })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.source).toBe('record')
  })

  // The record knows the clone a sync ran in and only the sweep sees the second, so the rows fold.
  it('should fold a recorded clone into the sweep row that found its sibling', async () => {
    const first = stamp('public', 'birch')
    const second = stamp('extensions', 'birch')
    recordTarget(first, new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [ROOT],
      originOf: async () => 'github.com/erclx/birch',
    })

    expect(report.targets).toHaveLength(1)
    expect([...(report.targets[0]?.paths ?? [])].sort()).toEqual(
      [first, second].sort(),
    )
    expect(report.targets[0]?.source).toBe('record')
    expect(report.targets[0]?.stampedAt).toBe('2026-08-30T00:00:00.000Z')
  })

  // Every caller reading one path takes the first, and the record names a clone a sync actually ran in.
  it('should lead with the recorded clone rather than the one that sorts first', async () => {
    stamp('aaa-first-by-sort', 'birch')

    const recorded = stamp('zzz-last-by-sort', 'birch')
    recordTarget(recorded, new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [ROOT],
      originOf: async () => 'github.com/erclx/birch',
    })

    expect(report.targets[0]?.paths[0]).toBe(recorded)
  })

  // The sweep sorts the second clone first and the merge leads with the recorded one, so a carried `legacyPaths` would mismatch.
  it('should re-derive legacy paths against the merged row rather than the sweep order', async () => {
    const recordedLegacy = stampLegacy('public', 'birch')
    const foundLegacy = stampLegacy('extensions', 'birch')
    recordTarget(recordedLegacy, new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [ROOT],
      originOf: async () => 'github.com/erclx/birch',
    })

    expect(report.targets).toHaveLength(1)
    expect(report.targets[0]?.paths).toEqual([recordedLegacy, foundLegacy])
    expect(report.targets[0]?.legacyPaths).toEqual([
      recordedLegacy,
      foundLegacy,
    ])
  })

  it('should keep a recorded target the sweep could not reach', async () => {
    const elsewhere = join(ROOT, 'elsewhere', 'cedar')
    const swept = join(ROOT, 'swept')
    mkdirSync(elsewhere, { recursive: true })
    mkdirSync(swept, { recursive: true })
    recordTarget(elsewhere, new Date('2026-08-30'), FILE, NO_ROOTS)

    const report = await resolveTargets({
      registryFile: FILE,
      scratchRoots: NO_ROOTS,
      sweep: [swept],
      originOf: noOrigin,
    })

    expect(report.targets.map((target) => target.paths[0])).toEqual([elsewhere])
  })
})
