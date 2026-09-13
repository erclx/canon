import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BASELINE_REL,
  baselineFrom,
  compareBaseline,
  readBaseline,
  writeBaseline,
} from '@/audits/baseline'
import type { Delta } from '@/audits/baseline'
import type { AuditResult } from '@/audits/catalog'

/** Narrows to the one variant carrying key movements, so a test can read them. */
function compared(delta: Delta | undefined) {
  if (delta?.kind !== 'compared') {
    throw new Error(`Expected a compared delta, got ${delta?.kind}`)
  }
  return delta
}

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-audits-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function result(
  id: string,
  counts: Record<string, number> | undefined,
  tracked = true,
  corpus: AuditResult['corpus'] = tracked ? 'tracked' : 'per-machine',
): AuditResult {
  return {
    id,
    label: id,
    status: counts === undefined ? 'unmeasured' : 'reported',
    tracked,
    corpus,
    exitCode: 0,
    counts,
    ms: 0,
  }
}

describe('recording a baseline from a run', () => {
  it('should keep only the checks whose corpus every clone shares', () => {
    const baseline = baselineFrom(
      [
        result('markdown', { bans: 0, heavyBullets: 50 }),
        result('records-plans', { findings: 4 }, false),
        result('tasks', { findings: 0, untested: 2 }, false),
      ],
      { recordedAt: '2026-08-20', commit: 'abc1234' },
    )

    expect(Object.keys(baseline.checks)).toEqual(['markdown'])
    expect(baseline.recordedAt).toBe('2026-08-20')
    expect(baseline.commit).toBe('abc1234')
  })

  /**
   * A check that did not report has no counts, and writing zeros for it would
   * record a clean corpus the run never measured. The next run then reads its
   * real numbers as a regression against a floor nobody took.
   */
  it('should leave an unmeasured check out of the record entirely', () => {
    const baseline = baselineFrom(
      [result('markdown', { bans: 0 }), result('context', undefined)],
      { recordedAt: '2026-08-20', commit: 'abc1234' },
    )

    expect(Object.keys(baseline.checks)).toEqual(['markdown'])
  })
})

describe('comparing a run against the recorded baseline', () => {
  const recorded = {
    recordedAt: '2026-08-06',
    commit: 'aaaaaaa',
    checks: {
      markdown: { bans: 0, heavyBullets: 1, heavyParagraphs: 22 },
      context: { unresolvedCitations: 0 },
    },
  }

  it('should report the direction each count moved', () => {
    const deltas = compareBaseline(recorded, [
      result('markdown', { bans: 0, heavyBullets: 50, heavyParagraphs: 12 }),
    ])

    expect(deltas).toEqual([
      {
        id: 'markdown',
        kind: 'compared',
        moved: [
          { key: 'heavyBullets', from: 1, to: 50, delta: 49 },
          { key: 'heavyParagraphs', from: 22, to: 12, delta: -10 },
        ],
        steady: ['bans'],
        added: [],
        dropped: [],
      },
    ])
  })

  it('should name a key the run produced that the baseline never recorded', () => {
    const deltas = compareBaseline(recorded, [
      result('markdown', {
        bans: 0,
        heavyBullets: 1,
        heavyParagraphs: 22,
        filesPastDepth: 67,
      }),
    ])

    expect(compared(deltas[0]).added).toEqual([
      { key: 'filesPastDepth', to: 67 },
    ])
  })

  it('should name a key the baseline holds that the run never produced', () => {
    const deltas = compareBaseline(recorded, [
      result('markdown', { bans: 0, heavyBullets: 1 }),
    ])

    expect(compared(deltas[0]).dropped).toEqual([
      { key: 'heavyParagraphs', from: 22 },
    ])
  })

  /**
   * The first run is the case the plan calls out. A delta of zero against an
   * absent baseline is indistinguishable from a corpus that did not move, so
   * the comparison says it had nothing to compare against instead.
   */
  it('should report a check with no recorded baseline as unrecorded', () => {
    const deltas = compareBaseline(recorded, [result('skills', { readme: 3 })])

    expect(deltas).toEqual([{ id: 'skills', kind: 'unrecorded' }])
  })

  it('should report every check as unrecorded when no baseline exists', () => {
    const deltas = compareBaseline(undefined, [
      result('markdown', { bans: 0 }),
      result('context', { unresolvedCitations: 0 }),
    ])

    expect(deltas.every((delta) => delta.kind === 'unrecorded')).toBe(true)
  })

  it('should leave a per-machine check out of the comparison', () => {
    const deltas = compareBaseline(recorded, [
      result('records-plans', { findings: 4 }, false),
    ])

    expect(deltas).toEqual([{ id: 'records-plans', kind: 'per-machine' }])
  })

  /**
   * Named for its own corpus rather than folded into per-machine. Both stay
   * out of the record, and the reasons are opposites: one count describes a
   * disk nobody else has, and this one moves when somebody publishes.
   */
  it('should leave an upstream check out under its own kind', () => {
    const deltas = compareBaseline(recorded, [
      result('deps', { 'advisories-high': 21 }, false, 'upstream'),
    ])

    expect(deltas).toEqual([{ id: 'deps', kind: 'upstream' }])
  })

  it('should keep an upstream check out of a recorded baseline', () => {
    const baseline = baselineFrom(
      [result('deps', { 'advisories-high': 21 }, false, 'upstream')],
      { recordedAt: '2026-08-21', commit: 'abc1234' },
    )

    expect(baseline.checks).toEqual({})
  })

  it('should report a check that did not report as unmeasured', () => {
    const deltas = compareBaseline(recorded, [result('context', undefined)])

    expect(deltas).toEqual([{ id: 'context', kind: 'unmeasured' }])
  })
})

describe('reading and writing the baseline file', () => {
  it('should round-trip a written baseline', async () => {
    const baseline = baselineFrom([result('markdown', { bans: 0 })], {
      recordedAt: '2026-08-20',
      commit: 'abc1234',
    })

    await writeBaseline(ROOT, baseline)

    expect(await readBaseline(ROOT)).toEqual(baseline)
  })

  it('should write the file with a trailing newline', async () => {
    await writeBaseline(
      ROOT,
      baselineFrom([result('markdown', { bans: 0 })], {
        recordedAt: '2026-08-20',
        commit: 'abc1234',
      }),
    )

    const raw = await readFile(join(ROOT, BASELINE_REL), 'utf8')

    expect(raw.endsWith('\n')).toBe(true)
  })

  it('should read an absent baseline as undefined rather than refusing', async () => {
    expect(await readBaseline(ROOT)).toBeUndefined()
  })

  /**
   * A hand-edited baseline is a file someone can break, and reading a broken
   * one as absent would silently reset the floor the record exists to hold.
   */
  it('should refuse a baseline that does not parse', async () => {
    const path = join(ROOT, BASELINE_REL)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '{ not json', 'utf8')

    await expect(readBaseline(ROOT)).rejects.toThrow(BASELINE_REL)
  })

  it('should refuse a baseline carrying no checks object', async () => {
    const path = join(ROOT, BASELINE_REL)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '{"recordedAt":"2026-08-20"}', 'utf8')

    await expect(readBaseline(ROOT)).rejects.toThrow(BASELINE_REL)
  })

  it('should fall back to .claude/canon/baseline.json for a target that has not moved', async () => {
    const baseline = baselineFrom([result('markdown', { bans: 0 })], {
      recordedAt: '2026-08-20',
      commit: 'abc1234',
    })
    const legacyPath = join(ROOT, '.claude', 'canon', 'baseline.json')
    await mkdir(dirname(legacyPath), { recursive: true })
    await writeFile(
      legacyPath,
      `${JSON.stringify(baseline, null, 2)}\n`,
      'utf8',
    )

    expect(await readBaseline(ROOT)).toEqual(baseline)
  })

  it('should prefer canon/config/baseline.json over the legacy path when both exist', async () => {
    const legacy = baselineFrom([result('markdown', { bans: 0 })], {
      recordedAt: '2026-08-19',
      commit: 'old0000',
    })
    const current = baselineFrom([result('markdown', { bans: 0 })], {
      recordedAt: '2026-08-20',
      commit: 'new1111',
    })
    const legacyPath = join(ROOT, '.claude', 'canon', 'baseline.json')
    await mkdir(dirname(legacyPath), { recursive: true })
    await writeFile(legacyPath, `${JSON.stringify(legacy, null, 2)}\n`, 'utf8')
    await writeBaseline(ROOT, current)

    expect(await readBaseline(ROOT)).toEqual(current)
  })
})
