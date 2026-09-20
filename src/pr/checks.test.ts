import { describe, expect, it } from 'vitest'
import { collapseChecks, withMergeState } from '@/pr/checks'

const TIP = 'a0cf1a39aa1d0d510e16360e98a18129a8fddc78'
const PRIOR = '5653721cbb1d0d510e16360e98a18129a8fddc78'

describe('collapseChecks', () => {
  it('should read passing when every run belongs to the tip and completed clean', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        { head_sha: TIP, status: 'completed', conclusion: 'success' },
        { head_sha: TIP, status: 'completed', conclusion: 'skipped' },
      ],
    })

    expect(reading).toEqual({
      state: 'passing',
      tip: TIP,
      matched: 2,
      foreign: 0,
      reported: 2,
      collapsed: 0,
    })
  })

  it('should read pending when every run belongs to the commit before the tip', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        { head_sha: PRIOR, status: 'completed', conclusion: 'success' },
        { head_sha: PRIOR, status: 'completed', conclusion: 'success' },
      ],
    })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 0,
      foreign: 2,
      reported: 2,
      collapsed: 0,
    })
  })

  it('should read pending on a mixed listing rather than answering off the matching half', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        { head_sha: TIP, status: 'completed', conclusion: 'success' },
        { head_sha: PRIOR, status: 'completed', conclusion: 'success' },
      ],
    })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 1,
      foreign: 1,
      reported: 2,
      collapsed: 0,
    })
  })

  it('should read pending when the listing is empty and the count says runs exist', () => {
    const reading = collapseChecks(TIP, { total_count: 2, check_runs: [] })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 0,
      foreign: 0,
      reported: 2,
      collapsed: 0,
    })
  })

  it('should read pending when the tip has no run at all yet', () => {
    const reading = collapseChecks(TIP, { total_count: 0, check_runs: [] })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 0,
      foreign: 0,
      reported: 0,
      collapsed: 0,
    })
  })

  it('should let a failure outrank a run still going', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        { head_sha: TIP, status: 'in_progress' },
        { head_sha: TIP, status: 'completed', conclusion: 'failure' },
      ],
    })

    expect(reading).toEqual({
      state: 'failing',
      tip: TIP,
      matched: 2,
      foreign: 0,
      reported: 2,
      collapsed: 0,
    })
  })

  it('should read pending when the count exceeds the rows the page returned', () => {
    const reading = collapseChecks(TIP, {
      total_count: 31,
      check_runs: [
        { head_sha: TIP, status: 'completed', conclusion: 'success' },
      ],
    })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 1,
      foreign: 0,
      reported: 31,
      collapsed: 0,
    })
  })

  it('should read pending for a queued run belonging to the tip', () => {
    const reading = collapseChecks(TIP, {
      total_count: 1,
      check_runs: [{ head_sha: TIP, status: 'queued', conclusion: null }],
    })

    expect(reading).toEqual({
      state: 'pending',
      tip: TIP,
      matched: 1,
      foreign: 0,
      reported: 1,
      collapsed: 0,
    })
  })

  it('should let the higher id decide the state when it occurs after the lower one', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        {
          head_sha: TIP,
          name: 'build',
          id: 1,
          status: 'completed',
          conclusion: 'failure',
        },
        {
          head_sha: TIP,
          name: 'build',
          id: 2,
          status: 'completed',
          conclusion: 'success',
        },
      ],
    })

    expect(reading).toEqual({
      state: 'passing',
      tip: TIP,
      matched: 2,
      foreign: 0,
      reported: 2,
      collapsed: 1,
    })
  })

  it('should let the higher id decide the state when it occurs before the lower one', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        {
          head_sha: TIP,
          name: 'build',
          id: 2,
          status: 'completed',
          conclusion: 'success',
        },
        {
          head_sha: TIP,
          name: 'build',
          id: 1,
          status: 'completed',
          conclusion: 'failure',
        },
      ],
    })

    expect(reading).toEqual({
      state: 'passing',
      tip: TIP,
      matched: 2,
      foreign: 0,
      reported: 2,
      collapsed: 1,
    })
  })

  it('should fall back to the later occurrence when a same-name pair carries no id', () => {
    const reading = collapseChecks(TIP, {
      total_count: 2,
      check_runs: [
        {
          head_sha: TIP,
          name: 'build',
          status: 'completed',
          conclusion: 'failure',
        },
        {
          head_sha: TIP,
          name: 'build',
          status: 'completed',
          conclusion: 'success',
        },
      ],
    })

    expect(reading).toEqual({
      state: 'passing',
      tip: TIP,
      matched: 2,
      foreign: 0,
      reported: 2,
      collapsed: 1,
    })
  })
})

describe('withMergeState', () => {
  const listing = (runs: readonly object[]) => ({
    total_count: runs.length,
    check_runs: runs,
  })
  const completed = {
    head_sha: TIP,
    status: 'completed',
    conclusion: 'success',
  }

  it('should read conflicted when the branch is DIRTY and no run belongs to the tip', () => {
    const reading = withMergeState('DIRTY', collapseChecks(TIP, listing([])))

    expect(reading).toMatchObject({ state: 'pending', conflicted: true })
  })

  it('should keep the run verdict when the branch is DIRTY and a run completed', () => {
    const reading = withMergeState(
      'DIRTY',
      collapseChecks(TIP, listing([completed])),
    )

    expect(reading).toMatchObject({ state: 'passing', conflicted: false })
  })

  it.each(['UNKNOWN', 'CLEAN', undefined])(
    'should not read conflicted when the merge state is %s',
    (mergeState) => {
      const reading = withMergeState(
        mergeState,
        collapseChecks(TIP, listing([])),
      )

      expect(reading).toMatchObject({ state: 'pending', conflicted: false })
    },
  )

  it('should read conflicted when the branch is DIRTY and only a prior commit has runs', () => {
    const reading = withMergeState(
      'DIRTY',
      collapseChecks(TIP, listing([{ ...completed, head_sha: PRIOR }])),
    )

    expect(reading).toMatchObject({ state: 'pending', conflicted: true })
  })
})
