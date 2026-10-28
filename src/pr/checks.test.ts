import { describe, expect, it } from 'vitest'
import { collapseChecks, requiredChecks, withMergeState } from '@/pr/checks'

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

describe('collapseChecks over a required set', () => {
  const STATIC = '🛡️ Static Checks'
  const MAC = '🍎 macOS Unit Tests'
  const required = new Set([STATIC])
  const staticPassed = {
    head_sha: TIP,
    name: STATIC,
    status: 'completed',
    conclusion: 'success',
  }

  it('should read passing while an advisory run on the tip is still going', () => {
    const reading = collapseChecks(
      TIP,
      {
        total_count: 2,
        check_runs: [
          staticPassed,
          { head_sha: TIP, name: MAC, status: 'in_progress', conclusion: null },
        ],
      },
      required,
    )

    expect(reading).toMatchObject({ state: 'passing', advisory: [] })
  })

  it('should name a failing advisory run without failing the tip', () => {
    const reading = collapseChecks(
      TIP,
      {
        total_count: 2,
        check_runs: [
          staticPassed,
          {
            head_sha: TIP,
            name: MAC,
            status: 'completed',
            conclusion: 'failure',
          },
        ],
      },
      required,
    )

    expect(reading).toMatchObject({ state: 'passing', advisory: [MAC] })
  })

  it('should keep the foreign-run guard ahead of the required set', () => {
    const reading = collapseChecks(
      TIP,
      {
        total_count: 2,
        check_runs: [
          staticPassed,
          {
            head_sha: PRIOR,
            name: MAC,
            status: 'completed',
            conclusion: 'success',
          },
        ],
      },
      required,
    )

    expect(reading).toMatchObject({ state: 'pending', advisory: [] })
  })

  it('should carry no advisory field when no required set was read', () => {
    const reading = collapseChecks(TIP, {
      total_count: 1,
      check_runs: [
        {
          head_sha: TIP,
          name: MAC,
          status: 'completed',
          conclusion: 'failure',
        },
      ],
    })

    expect(reading.state).toBe('failing')
    expect(reading).not.toHaveProperty('advisory')
  })
})

describe('collapseChecks over a required commit status', () => {
  const STATIC = '🛡️ Static Checks'
  const DEPLOY = 'vercel'
  const required = new Set([STATIC, DEPLOY])
  const listing = {
    total_count: 1,
    check_runs: [
      {
        head_sha: TIP,
        name: STATIC,
        status: 'completed',
        conclusion: 'success',
      },
    ],
  }

  it('should read passing when the required status succeeded beside the run', () => {
    const reading = collapseChecks(TIP, listing, required, [
      { context: DEPLOY, state: 'success' },
    ])

    expect(reading.state).toBe('passing')
  })

  it('should read pending while the required status is pending', () => {
    const reading = collapseChecks(TIP, listing, required, [
      { context: DEPLOY, state: 'pending' },
    ])

    expect(reading.state).toBe('pending')
  })

  it('should read failing when the required status errored', () => {
    const reading = collapseChecks(TIP, listing, required, [
      { context: DEPLOY, state: 'error' },
    ])

    expect(reading.state).toBe('failing')
  })

  it('should read passing off statuses alone when the tip has no check run', () => {
    const reading = collapseChecks(
      TIP,
      { total_count: 0, check_runs: [] },
      new Set([DEPLOY]),
      [{ context: DEPLOY, state: 'success' }],
    )

    expect(reading.state).toBe('passing')
  })

  // The fallback is the verbs' behavior before the rules were read, which
  // never saw a commit status, so a status cannot start failing it.
  it('should leave statuses out when no required set was read', () => {
    const reading = collapseChecks(TIP, listing, undefined, [
      { context: DEPLOY, state: 'failure' },
    ])

    expect(reading.state).toBe('passing')
  })
})

describe('requiredChecks', () => {
  it('should read the contexts of every required status checks rule', () => {
    const rules = [
      { type: 'deletion' },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [
            { context: '🛡️ Static Checks', integration_id: 15368 },
          ],
        },
      },
    ]

    expect(requiredChecks(rules)).toEqual(new Set(['🛡️ Static Checks']))
  })

  it('should read an empty set when no rule requires a check', () => {
    expect(requiredChecks([{ type: 'deletion' }])).toEqual(new Set())
  })

  it('should read undefined when the answer is not a rule list', () => {
    expect(requiredChecks({ message: 'Not Found' })).toBeUndefined()
  })
})
