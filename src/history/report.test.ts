import { describe, expect, it } from 'vitest'
import type { Merge, MergeClass } from '@/history/log'
import {
  isoWeek,
  rankHotspots,
  summarize,
  windowWeeks,
  type SummaryInput,
} from '@/history/report'

let sequence = 0

function merge(
  date: string,
  subject: { type?: string; class?: MergeClass } = { type: 'feat' },
  files: string[] = ['src/a.ts'],
): Merge {
  sequence += 1
  const kind = subject.class ?? (subject.type ? 'typed' : 'untyped')
  return {
    sha: `sha${sequence}`,
    date,
    subject: subject.type
      ? `${subject.type}: change ${sequence}`
      : `change ${sequence}`,
    author: 'Ann',
    class: kind,
    ...(kind === 'typed' && subject.type ? { type: subject.type } : {}),
    files,
  }
}

function input(
  merges: Merge[],
  overrides: Partial<SummaryInput> = {},
): SummaryInput {
  return {
    merges,
    slots: windowWeeks('2026-11-12', 4),
    firstDate: '2026-01-01',
    excluded: () => false,
    ...overrides,
  }
}

describe('isoWeek', () => {
  it('should open a mid-November week on its Monday', () => {
    expect(isoWeek('2026-11-12')).toEqual({
      week: '2026-W46',
      from: '2026-11-09',
    })
  })

  it('should put a January day into the prior year when its Thursday falls there', () => {
    expect(isoWeek('2027-01-01')).toEqual({
      week: '2026-W53',
      from: '2026-12-28',
    })
  })

  it('should read a Sunday as the last day of its week', () => {
    expect(isoWeek('2026-11-15').from).toBe('2026-11-09')
  })
})

describe('windowWeeks', () => {
  it('should list the window oldest first ending on the given week', () => {
    expect(windowWeeks('2026-11-12', 3).map((slot) => slot.week)).toEqual([
      '2026-W44',
      '2026-W45',
      '2026-W46',
    ])
  })
})

describe('summarize', () => {
  describe('weekly figures', () => {
    it('should count each week by type, most first', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { type: 'fix' }),
          merge('2026-11-11', { type: 'feat' }),
          merge('2026-11-12', { type: 'feat' }),
        ]),
      )

      expect(summary.weeks[3].types).toEqual({ feat: 2, fix: 1 })
      expect(Object.keys(summary.weeks[3].types ?? {})).toEqual(['feat', 'fix'])
    })

    it('should compute fix share over typed merges alone', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { type: 'fix' }),
          merge('2026-11-11', { type: 'feat' }),
          merge('2026-11-11', { type: 'feat' }),
          merge('2026-11-11', { type: 'chore' }),
          merge('2026-11-12', {}),
        ]),
      )

      expect(summary.weeks[3].fixShare).toBe(0.25)
      expect(summary.weeks[3].untyped).toBe(1)
      expect(summary.weeks[3].merges).toBe(5)
    })

    it('should report a week with no merges at zero with a null fix share', () => {
      const summary = summarize(input([merge('2026-11-10', { type: 'fix' })]))

      expect(summary.weeks[0]).toEqual({
        week: '2026-W43',
        from: '2026-10-19',
        merges: 0,
        types: {},
        untyped: 0,
        fixShare: null,
        fixShareRolling: null,
        rollingWeeks: 4,
        featFilesMedian: null,
      })
    })

    it('should roll the fix share across four weeks, reading merges before the window', () => {
      const summary = summarize(
        input([
          merge('2026-10-05', { type: 'fix' }),
          merge('2026-10-13', { type: 'feat' }),
          merge('2026-10-20', { type: 'feat' }),
          merge('2026-10-27', { type: 'fix' }),
        ]),
      )

      expect(summary.weeks[0].fixShareRolling).toBe(1 / 3)
      expect(summary.weeks[1].fixShareRolling).toBe(0.5)
    })

    it('should say the rolling share covers fewer weeks near the first commit', () => {
      const summary = summarize(
        input(
          [
            merge('2026-11-03', { type: 'fix' }),
            merge('2026-11-10', { type: 'feat' }),
          ],
          {
            firstDate: '2026-11-03',
          },
        ),
      )

      expect(summary.weeks.map((week) => week.rollingWeeks)).toEqual([
        0, 0, 1, 2,
      ])
      expect(summary.weeks[3].fixShareRolling).toBe(0.5)
    })
  })

  describe('feat files', () => {
    it('should take the median of files per feat, averaging an even count', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { type: 'feat' }, ['a', 'b']),
          merge('2026-11-10', { type: 'feat' }, ['a', 'b', 'c', 'd']),
          merge('2026-11-10', { type: 'fix' }, [
            'a',
            'b',
            'c',
            'd',
            'e',
            'f',
            'g',
          ]),
        ]),
      )

      expect(summary.weeks[3].featFilesMedian).toBe(3)
    })

    it('should count a feat touching only markdown by its markdown files, never as zero', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { type: 'feat' }, ['docs/a.md', 'claude/b.md']),
        ]),
      )

      expect(summary.weeks[3].featFilesMedian).toBe(2)
    })

    it('should leave lock and generated files out of the count', () => {
      const summary = summarize(
        input(
          [merge('2026-11-10', { type: 'feat' }, ['src/a.ts', 'bun.lock'])],
          {
            excluded: (path) => path === 'bun.lock',
          },
        ),
      )

      expect(summary.weeks[3].featFilesMedian).toBe(1)
    })
  })

  describe('exclusions', () => {
    it('should drop a bot and a release from every figure and count them apart', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { class: 'bot' }, ['package.json']),
          merge('2026-11-10', { class: 'release' }, ['package.json']),
          merge('2026-11-11', { type: 'feat' }, ['src/a.ts']),
        ]),
      )

      expect(summary.excluded).toEqual({ bots: 1, releases: 1 })
      expect(summary.weeks[3].merges).toBe(1)
      expect(summary.coverage).toEqual({ merges: 1, typed: 1, share: 1 })
      expect([...summary.changes.keys()]).toEqual(['src/a.ts'])
    })

    it('should not count a bot or release dated before the window', () => {
      const summary = summarize(
        input([merge('2026-09-01', { class: 'release' })]),
      )

      expect(summary.excluded).toEqual({ bots: 0, releases: 0 })
    })
  })

  describe('coverage floor', () => {
    it('should read type figures as null when under half the merges parse', () => {
      const summary = summarize(
        input([
          merge('2026-11-10', { type: 'fix' }),
          merge('2026-11-10', {}),
          merge('2026-11-11', {}),
        ]),
      )

      expect(summary.coverage).toEqual({ merges: 3, typed: 1, share: 1 / 3 })
      expect(summary.weeks[3]).toMatchObject({
        merges: 3,
        untyped: 2,
        types: null,
        fixShare: null,
        fixShareRolling: null,
        featFilesMedian: null,
      })
    })

    it('should still rank hotspots under the floor', () => {
      const summary = summarize(input([merge('2026-11-10', {}, ['src/a.ts'])]))

      expect(summary.changes.get('src/a.ts')).toEqual({
        changes: 1,
        fixTouches: 0,
      })
    })

    it('should read coverage share as null on a window with no merges', () => {
      expect(summarize(input([])).coverage).toEqual({
        merges: 0,
        typed: 0,
        share: null,
      })
    })

    it('should carry no score, grade, or threshold field', () => {
      const summary = summarize(input([merge('2026-11-10', { type: 'feat' })]))

      expect(Object.keys(summary).sort()).toEqual([
        'changes',
        'coverage',
        'excluded',
        'weeks',
      ])
      expect(Object.keys(summary.weeks[3]).sort()).toEqual([
        'featFilesMedian',
        'fixShare',
        'fixShareRolling',
        'from',
        'merges',
        'rollingWeeks',
        'types',
        'untyped',
        'week',
      ])
    })
  })
})

describe('rankHotspots', () => {
  it('should rank by changes times current lines, then by path', () => {
    const changes = new Map([
      ['b.ts', { changes: 2, fixTouches: 1 }],
      ['a.ts', { changes: 4, fixTouches: 0 }],
      ['c.ts', { changes: 1, fixTouches: 0 }],
    ])
    const lines = new Map([
      ['a.ts', 10],
      ['b.ts', 20],
      ['c.ts', 50],
    ])

    expect(rankHotspots(changes, lines)).toEqual([
      { path: 'c.ts', changes: 1, lines: 50, weight: 50, fixTouches: 0 },
      { path: 'a.ts', changes: 4, lines: 10, weight: 40, fixTouches: 0 },
      { path: 'b.ts', changes: 2, lines: 20, weight: 40, fixTouches: 1 },
    ])
  })

  it('should leave out a binary or deleted path that has no current line count', () => {
    const changes = new Map([
      ['assets/shot.png', { changes: 187, fixTouches: 0 }],
      ['src/a.ts', { changes: 1, fixTouches: 0 }],
    ])

    expect(
      rankHotspots(changes, new Map([['src/a.ts', 3]])).map((hot) => hot.path),
    ).toEqual(['src/a.ts'])
  })

  it('should leave out a path holding no lines', () => {
    const changes = new Map([['empty.ts', { changes: 3, fixTouches: 0 }]])

    expect(rankHotspots(changes, new Map([['empty.ts', 0]]))).toEqual([])
  })

  it('should stop at the limit', () => {
    const changes = new Map([
      ['a.ts', { changes: 1, fixTouches: 0 }],
      ['b.ts', { changes: 2, fixTouches: 0 }],
    ])
    const lines = new Map([
      ['a.ts', 1],
      ['b.ts', 1],
    ])

    expect(rankHotspots(changes, lines, 1).map((hot) => hot.path)).toEqual([
      'b.ts',
    ])
  })
})
