import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type GhRunner,
  latestReview,
  readPullsAcross,
  readTargetPulls,
  rollup,
} from '@/targets/pulls'

let ROOT: string

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-pulls-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

/** Answers a `pr list` with the given pulls and every `pr view` with the given reviews. */
function stubGh(pulls: unknown, reviews: unknown = { reviews: [] }): GhRunner {
  return async (_cwd, args) =>
    args[1] === 'list' ? JSON.stringify(pulls) : JSON.stringify(reviews)
}

describe('rollup', () => {
  // No check and every check green are different answers. A target whose
  // workflow never fired reads as passing without this, which is the reading
  // that would let a wave merge on a suite that did not run.
  it('should report no check at all as null rather than as passing', () => {
    expect(rollup([])).toBeNull()
  })

  it('should report every completed success as passing', () => {
    expect(
      rollup([
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
      ]),
    ).toBe('passing')
  })

  it('should report a run still going as pending', () => {
    expect(
      rollup([
        { status: 'COMPLETED', conclusion: 'SUCCESS' },
        { status: 'IN_PROGRESS' },
      ]),
    ).toBe('pending')
  })

  // A job that already failed cannot be cleared by one still running, so
  // reporting the head as pending would invite a wait for an answer that has
  // already arrived.
  it('should let a failure outrank a run still going', () => {
    expect(
      rollup([
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETED', conclusion: 'FAILURE' },
      ]),
    ).toBe('failing')
  })

  it('should read a legacy status context by its state field', () => {
    expect(rollup([{ state: 'FAILURE' }])).toBe('failing')
    expect(rollup([{ state: 'SUCCESS' }])).toBe('passing')
    expect(rollup([{ state: 'PENDING' }])).toBe('pending')
  })

  it('should treat a cancelled or timed out job as failing', () => {
    expect(rollup([{ status: 'COMPLETED', conclusion: 'CANCELLED' }])).toBe(
      'failing',
    )
    expect(rollup([{ status: 'COMPLETED', conclusion: 'TIMED_OUT' }])).toBe(
      'failing',
    )
  })
})

describe('latestReview', () => {
  it('should report no pass as null rather than as closed', () => {
    expect(latestReview([])).toBeNull()
  })

  it('should read an open pass from its first line', () => {
    expect(latestReview([{ body: '## Review\n\n- a finding\n' }])).toBe('open')
  })

  // The pass that closed the thread is the last one, and a target leaves a wave
  // on that heading rather than on the worker's reply.
  it('should take the newest pass when a close-out follows an open one', () => {
    expect(
      latestReview([
        { body: '## Review\n\n- a finding\n' },
        { body: '## Review closed\n\nnothing open\n' },
      ]),
    ).toBe('closed')
  })

  it('should ignore a pass carrying neither heading', () => {
    expect(
      latestReview([
        { body: '## Review closed\n' },
        { body: 'looks good to me\n' },
      ]),
    ).toBe('closed')
  })

  it('should read a restyled open pass from its first line', () => {
    const body = [
      '## Review',
      '',
      '0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.',
      '',
      '**`src/a.ts`**',
      '',
      '- **should-fix** ([line 3](https://example.com/a.ts#L3)): The guard never runs.',
      '  - Fix: move the guard above the return.',
      '',
      '<details>',
      '<summary>Review focus, 1 checked</summary>',
      '',
      '- The empty input: covered by `a.test.ts`',
      '',
      '</details>',
      '',
      '🤖 Reviewed by Claude Code',
      '',
      '<!-- review-pr: commit=a0cf1a3 read-at=2026-10-19T06:14:57Z -->',
    ].join('\n')

    expect(latestReview([{ body }])).toBe('open')
  })

  it('should read a restyled close from its first line', () => {
    const body = [
      '## Review closed',
      '',
      '✅ 1 prior finding addressed at `a0cf1a3`. Re-reviewed the commits since `5653721`.',
      '',
      '- **should-fix**, `src/a.ts`: the guard runs above the return',
      '',
      '🤖 Reviewed by Claude Code',
      '',
      '<!-- review-pr: commit=a0cf1a3 read-at=2026-10-19T06:14:57Z -->',
    ].join('\n')

    expect(latestReview([{ body }])).toBe('closed')
  })

  it('should read a heading written with carriage returns', () => {
    expect(latestReview([{ body: '## Review\r\n\r\n- a finding\r\n' }])).toBe(
      'open',
    )
  })
})

describe('readTargetPulls', () => {
  it('should refuse a path that is not a directory', async () => {
    const report = await readTargetPulls(join(ROOT, 'nowhere'), {
      run: stubGh([]),
    })

    expect(report).toEqual({
      kind: 'refused',
      path: join(ROOT, 'nowhere'),
      reason: 'not-a-directory',
    })
  })

  // A list that failed and a target with nothing open both arrive as no rows.
  // Reading the first as the second reports a target as done having read
  // nothing, which is the failure the shell loop this replaces could not see.
  it('should refuse a list it could not read rather than reporting no pulls', async () => {
    const report = await readTargetPulls(ROOT, { run: async () => null })

    expect(report).toEqual({
      kind: 'refused',
      path: ROOT,
      reason: 'list-failed',
    })
  })

  it('should report a target with nothing open as read and holding no pulls', async () => {
    const report = await readTargetPulls(ROOT, { run: stubGh([]) })

    expect(report).toEqual({ kind: 'read', path: ROOT, pulls: [] })
  })

  it('should carry the number, title, url, and head of each open pull', async () => {
    const report = await readTargetPulls(ROOT, {
      run: stubGh([
        {
          number: 115,
          title: 'chore(agents): sync toolkit governance',
          url: 'https://github.com/erclx/caret/pull/115',
          headRefOid: 'c47f060',
          statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'SUCCESS' }],
        },
      ]),
    })

    expect(report.kind === 'read' ? report.pulls[0] : null).toEqual({
      number: 115,
      title: 'chore(agents): sync toolkit governance',
      url: 'https://github.com/erclx/caret/pull/115',
      head: 'c47f060',
      checks: 'passing',
      review: null,
      reviewReadable: true,
    })
  })

  it('should carry the heading the newest review pass left', async () => {
    const report = await readTargetPulls(ROOT, {
      run: stubGh([{ number: 60 }], {
        reviews: [{ body: '## Review\n\n- two minor findings\n' }],
      }),
    })

    expect(report.kind === 'read' ? report.pulls[0]?.review : null).toBe('open')
  })

  it('should mark the review unreadable when its query failed', async () => {
    const report = await readTargetPulls(ROOT, {
      run: async (_cwd, args) =>
        args[1] === 'list' ? JSON.stringify([{ number: 60 }]) : null,
    })

    const pull = report.kind === 'read' ? report.pulls[0] : null

    expect(pull?.reviewReadable).toBe(false)
    expect(pull?.review).toBeNull()
  })

  it('should drop a row carrying no number rather than reporting a pull without one', async () => {
    const report = await readTargetPulls(ROOT, {
      run: stubGh([{ title: 'no number' }, { number: 7 }]),
    })

    expect(
      report.kind === 'read' ? report.pulls.map((pull) => pull.number) : [],
    ).toEqual([7])
  })
})

describe('readPullsAcross', () => {
  it('should report one entry per target in the order given', async () => {
    const missing = join(ROOT, 'nowhere')

    const reports = await readPullsAcross([ROOT, missing], { run: stubGh([]) })

    expect(reports.map((report) => report.kind)).toEqual(['read', 'refused'])
    expect(reports.map((report) => report.path)).toEqual([ROOT, missing])
  })

  // One unreachable target must not empty the answer for the others, which is
  // what a batch failing as a unit would do to a wave mid-flight.
  it('should keep reading after a target it could not reach', async () => {
    const reports = await readPullsAcross([join(ROOT, 'nowhere'), ROOT], {
      run: stubGh([{ number: 1 }]),
    })

    expect(reports[1]?.kind).toBe('read')
  })
})
