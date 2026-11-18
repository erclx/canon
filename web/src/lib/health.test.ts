import { describe, expect, it } from 'vitest'

import { readHealth, summarize } from './health'

function auditRecord(lines: number[] = [143, 265, 111, 90]) {
  return {
    files: 969,
    fileLimit: 2000,
    functionCheckpoint: 100,
    longFiles: [],
    longFunctions: lines.map((count, index) => ({
      file: `src/f${index}.ts`,
      lines: count,
      name: index === 1 ? null : `fn${index}`,
    })),
  }
}

function commentsRecord() {
  return {
    fileShareCap: 0.15,
    fileShareFloor: 50,
    snapshot: [
      {
        fileShares: [
          { textLines: 20, nonBlankLines: 100 },
          { textLines: 10, nonBlankLines: 100 },
          { textLines: 20, nonBlankLines: 40 },
        ],
      },
      { fileShares: [{ textLines: 30, nonBlankLines: 60 }] },
    ],
  }
}

function historyRecord(merges: number[] = [151, 137, 109]) {
  return {
    window: { to: '2026-11-18' },
    weeks: merges.map((count, index) => ({
      week: `2026-W${45 + index}`,
      merges: count,
    })),
  }
}

describe('summarize', () => {
  it('should list the three longest functions, longest first', () => {
    const health = summarize(auditRecord(), commentsRecord(), historyRecord())

    expect(health.functions.map((fn) => fn.lines)).toEqual([265, 143, 111])
  })

  it('should mark a function past the checkpoint and leave one under it', () => {
    const health = summarize(
      auditRecord([150, 99, 100]),
      commentsRecord(),
      historyRecord(),
    )

    expect(health.functions.map((fn) => fn.past)).toEqual([true, false, false])
  })

  it('should name an anonymous function rather than print null', () => {
    const health = summarize(auditRecord(), commentsRecord(), historyRecord())

    expect(health.functions[0]?.name).toBe('(anonymous)')
  })

  it('should count only files past the share cap and the line floor', () => {
    const health = summarize(auditRecord(), commentsRecord(), historyRecord())

    expect(health.denseFiles).toBe(2)
  })

  it('should label each week by its ISO number', () => {
    const health = summarize(auditRecord(), commentsRecord(), historyRecord())

    expect(health.weeks.map((week) => week.label)).toEqual([
      'w45',
      'w46',
      'w47',
    ])
  })

  it('should refuse a history with merges in one week', () => {
    const shallow = historyRecord([0, 0, 12])

    expect(() => summarize(auditRecord(), commentsRecord(), shallow)).toThrow(
      /shallow clone/,
    )
  })

  it('should refuse an audit that read no files', () => {
    const empty = { ...auditRecord(), files: 0 }

    expect(() => summarize(empty, commentsRecord(), historyRecord())).toThrow(
      /read no files/,
    )
  })

  it('should refuse an audit listing fewer functions than the rows', () => {
    const short = auditRecord([150, 120])

    expect(() => summarize(short, commentsRecord(), historyRecord())).toThrow(
      /fewer than the 3 rows/,
    )
  })
})

describe('readHealth', () => {
  it('should read this checkout into rows and a dated trend', () => {
    const health = readHealth()

    expect(health.functions).toHaveLength(3)
    expect(health.weeks.length).toBeGreaterThan(1)
    expect(health.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
