import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import type { Merge } from '@/history/log'
import { windowWeeks } from '@/history/report'
import { linesAt, sampleWeeks, sizeSeries, weekEnds } from '@/history/size'

function merge(sha: string, date: string): Merge {
  return {
    sha,
    date,
    subject: 'feat: x',
    author: 'Ann',
    class: 'typed',
    type: 'feat',
    files: [],
  }
}

const SLOTS = windowWeeks('2026-11-12', 3)

describe('weekEnds', () => {
  it("should pick each week's newest commit from a newest-first log", () => {
    const ends = weekEnds(
      [
        merge('late', '2026-11-12'),
        merge('early', '2026-11-09'),
        merge('prior', '2026-10-27'),
      ],
      SLOTS,
    )

    expect(Object.fromEntries(ends)).toEqual({
      '2026-11-09': 'late',
      '2026-10-26': 'prior',
    })
  })

  it('should leave out a commit dated before the window', () => {
    const ends = weekEnds([merge('old', '2026-09-01')], SLOTS)

    expect(ends.size).toBe(0)
  })
})

describe('sampleWeeks', () => {
  it('should keep every week holding a commit when under the cap', () => {
    const ends = new Map([
      ['2026-10-26', 'a'],
      ['2026-11-09', 'b'],
    ])

    expect([...sampleWeeks(ends, SLOTS, 12).keys()]).toEqual([
      '2026-10-26',
      '2026-11-09',
    ])
  })

  it('should spread the points evenly past the cap and keep the newest week', () => {
    const slots = windowWeeks('2026-11-12', 5)
    const ends = new Map(slots.map((slot, index) => [slot.from, `c${index}`]))

    expect([...sampleWeeks(ends, slots, 3).values()]).toEqual([
      'c0',
      'c2',
      'c4',
    ])
  })
})

describe('on a temporary repository', () => {
  let ROOT: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', ROOT, ...args], {
      env: gitEnv(),
      extendEnv: false,
    }).stdout
  }

  function write(path: string, body: string): void {
    const full = join(ROOT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, body)
  }

  function commit(date: string): string {
    git('add', '--all')
    execaSync('git', ['-C', ROOT, 'commit', '--quiet', '-m', 'feat: x'], {
      env: { ...gitEnv(), GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
      extendEnv: false,
    })
    return git('rev-parse', 'HEAD')
  }

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), 'canon-history-size-'))
    git('init', '--quiet', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
  })

  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true })
  })

  it('should size each week at its last commit and give an empty week no point', async () => {
    write('a.ts', 'one\n')
    const first = commit('2026-10-27T10:00:00Z')
    write('a.ts', 'one\ntwo\n')
    const second = commit('2026-11-10T10:00:00Z')
    write('b.ts', 'three\n')
    const third = commit('2026-11-11T10:00:00Z')

    const series = await sizeSeries(
      ROOT,
      [
        merge(third, '2026-11-11'),
        merge(second, '2026-11-10'),
        merge(first, '2026-10-27'),
      ],
      SLOTS,
    )

    expect(Object.fromEntries(series)).toEqual({
      '2026-10-26': {
        rev: first,
        files: 1,
        skipped: 0,
        lines: 1,
        byExtension: [{ extension: 'ts', files: 1, lines: 1 }],
      },
      '2026-11-09': {
        rev: third,
        files: 2,
        skipped: 0,
        lines: 3,
        byExtension: [{ extension: 'ts', files: 2, lines: 3 }],
      },
    })
  })

  it('should read current lines for text files and leave binaries and deleted paths out', async () => {
    write('a.ts', 'one\ntwo\n')
    writeFileSync(join(ROOT, 'shot.png'), Buffer.from([0x00, 0x01]))
    const rev = commit('2026-11-10T10:00:00Z')

    const lines = await linesAt(
      ROOT,
      rev,
      new Set(['a.ts', 'shot.png', 'gone.ts']),
    )

    expect(Object.fromEntries(lines)).toEqual({ 'a.ts': 2 })
  })
})
