import { describe, expect, it } from 'vitest'
import type { RebaseRead } from '@/pr/carry'
import {
  type BaseReading,
  type ChangedRead,
  type ChecksGate,
  type EvidenceGate,
  lift,
  type LiftApi,
  readsDrivableBox,
} from '@/pr/lift'
import type { ReviewRow } from '@/pr/review-scope'
import {
  readReviewState,
  type ReviewStateApi,
  type StandingApi,
  waitForReviews,
  waitForStanding,
} from '@/pr/review-state'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const PUSHED = '1111111111111111111111111111111111111111'
const READ_AT = '2026-10-12T10:00:00Z'

function codePass(heading: string, commit: string): ReviewRow {
  return {
    body: `${heading}\n\nfindings\n<!-- review-pr: commit=${commit} read-at=${READ_AT} -->`,
  }
}

function uiPass(heading: string, commit: string): ReviewRow {
  return { body: `${heading}\n\nboxes\n<!-- review-ui: head=${commit} -->` }
}

interface Fixture {
  /** One tip per read, the last repeating, null for a read that failed. */
  tips?: readonly (string | null)[]
  /** One review set per read, the last repeating, null for a read that failed. */
  reviews?: readonly (readonly ReviewRow[] | null)[]
  evidence?: Partial<EvidenceGate> | null
  changed?: ChangedRead | null
  /** What the rebase comparison answers, a failed read when absent. */
  rebased?: RebaseRead
  /** The commits the head adds that are neither merges nor on the base, a failed read when absent. */
  unmerged?: readonly string[]
}

interface Harness {
  readonly api: ReviewStateApi
  readonly calls: { evidence: number; sleeps: number[] }
}

/** The api over a fake clock that only `sleep` advances. */
function makeApi(fixture: Fixture = {}): Harness {
  const calls = { evidence: 0, sleeps: [] as number[] }
  const tips = fixture.tips ?? [HEAD]
  const reviews = fixture.reviews ?? [[]]
  let tipReads = 0
  let reviewReads = 0
  let clock = 0

  const api: ReviewStateApi = {
    readTip: async () => {
      const tip = tips[Math.min(tipReads, tips.length - 1)]
      tipReads += 1
      return tip ?? undefined
    },
    readReviews: async () => {
      const rows = reviews[Math.min(reviewReads, reviews.length - 1)]
      reviewReads += 1
      return rows ?? undefined
    },
    readEvidence: async () => {
      calls.evidence += 1
      if (fixture.evidence === null) return undefined
      return {
        isSettled: true,
        owed: [],
        hasDrivableBox: true,
        ...fixture.evidence,
      }
    },
    readChanged: async () => {
      if (fixture.changed === null) return undefined
      return fixture.changed ?? { isAncestor: true, paths: [] }
    },
    readRebased: async () => fixture.rebased,
    readUnmerged: async () => fixture.unmerged,
    sleep: async (ms) => {
      calls.sleeps.push(ms)
      clock += ms
    },
    now: () => clock,
  }
  return { api, calls }
}

describe('readReviewState', () => {
  it('should report both families with the reason the lift gives each', async () => {
    const { api } = makeApi({
      reviews: [
        [codePass('## Review', HEAD), uiPass('## UI review closed', '1234567')],
      ],
      changed: { isAncestor: false, paths: [] },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: {
        head: HEAD,
        scope: { state: 'open', commit: HEAD, source: 'marker' },
        review: { reason: 'review-open', isCovered: true },
        ui: {
          state: 'closed',
          commit: '1234567',
          reason: 'ui-behind',
          isBound: true,
          isCovered: false,
        },
      },
    })
  })

  it('should read a UI close posted as a pull request review, the #2385 case', async () => {
    const { api } = makeApi({
      reviews: [
        [
          codePass('## Review closed', HEAD),
          uiPass('## UI review closed', HEAD),
        ],
      ],
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { ui: { heading: '## UI review closed', isCovered: true } },
    })
    expect(result.kind === 'read' && result.record.ui.reason).toBeUndefined()
  })

  it('should pass an unbound UI family when the evidence carries no checklist', async () => {
    const { api } = makeApi({
      reviews: [[codePass('## Review closed', HEAD)]],
      evidence: { hasDrivableBox: false },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { ui: { state: 'none', isBound: false, isCovered: true } },
    })
    expect(result.kind === 'read' && result.record.ui.reason).toBeUndefined()
  })

  it('should leave the UI family unbound and covered on a checklist holding only taste boxes', async () => {
    const { api } = makeApi({
      reviews: [[codePass('## Review closed', HEAD)]],
      evidence: {
        hasDrivableBox: readsDrivableBox({
          checklist: '- [ ] calm (taste)\n- [ ] paces (taste) (local only)',
          drivable: 0,
        }),
      },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { ui: { isBound: false, isCovered: true } },
    })
  })

  it('should keep the UI family bound while its newest pass is open, drivable box or not', async () => {
    const { api } = makeApi({
      reviews: [
        [codePass('## Review closed', HEAD), uiPass('## UI review', HEAD)],
      ],
      evidence: { hasDrivableBox: false },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { ui: { isBound: true, reason: 'ui-open' } },
    })
  })

  it('should count an unmarked pass at the tip as covered and report it unmarked', async () => {
    const { api } = makeApi({
      reviews: [[{ body: '## Review closed\n\nclean', commit: { oid: HEAD } }]],
      evidence: { hasDrivableBox: false },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { review: { reason: 'review-unmarked', isCovered: true } },
    })
  })

  it('should cover the tip through a short-sha marker', async () => {
    const { api } = makeApi({
      reviews: [[codePass('## Review closed', HEAD.slice(0, 7))]],
      evidence: { hasDrivableBox: false },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { review: { isCovered: true } },
    })
  })

  it('should carry a UI close forward across a push of tests and markdown', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [
        [
          codePass('## Review closed', PUSHED),
          uiPass('## UI review closed', HEAD),
        ],
      ],
      changed: { isAncestor: true, paths: ['src/cli.test.ts', 'README.md'] },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: { ui: { carriedFrom: HEAD, isCovered: true } },
    })
  })

  it('should cover the tip with both closes carried across an equal rebase', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [
        [
          codePass('## Review closed', HEAD),
          uiPass('## UI review closed', HEAD),
        ],
      ],
      changed: { isAncestor: false, paths: [] },
      rebased: { differingPaths: [], ownPaths: [] },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: {
        head: PUSHED,
        review: { isCovered: true, carriedFrom: HEAD, carriedAcross: 'rebase' },
        ui: { isCovered: true, carriedFrom: HEAD, carriedAcross: 'rebase' },
      },
    })
  })

  it('should carry the code close across a base merge and hold the UI close behind it', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [
        [
          codePass('## Review closed', HEAD),
          uiPass('## UI review closed', HEAD),
        ],
      ],
      changed: { isAncestor: true, paths: ['src/cli.ts'] },
      rebased: { differingPaths: [], ownPaths: [] },
      unmerged: [],
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: {
        review: { isCovered: true, carriedFrom: HEAD, carriedAcross: 'merge' },
        ui: { reason: 'ui-behind', isCovered: false },
      },
    })
  })

  it('should name the differing path that kept a code close from carrying', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [[codePass('## Review closed', HEAD)]],
      changed: { isAncestor: false, paths: [] },
      rebased: { differingPaths: ['README.md'], ownPaths: ['README.md'] },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: {
        review: {
          reason: 'review-behind',
          isCovered: false,
          differingPaths: ['README.md'],
        },
      },
    })
  })

  it('should not cover the tip with a UI close behind a source push', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [
        [
          codePass('## Review closed', PUSHED),
          uiPass('## UI review closed', HEAD),
        ],
      ],
      changed: { isAncestor: true, paths: ['src/cli.ts'] },
    })

    const result = await readReviewState(api)

    expect(result).toMatchObject({
      kind: 'read',
      record: {
        ui: {
          reason: 'ui-behind',
          isCovered: false,
          drivenPaths: ['src/cli.ts'],
        },
      },
    })
  })
})

describe('gh-failed', () => {
  it('should refuse when the reviews read fails rather than read none', async () => {
    const { api } = makeApi({ reviews: [null] })

    const result = await readReviewState(api)

    expect(result).toEqual({ kind: 'refused', reason: 'gh-failed' })
  })

  it('should refuse when the tip read fails', async () => {
    const { api } = makeApi({ tips: [null] })

    const result = await readReviewState(api)

    expect(result).toEqual({ kind: 'refused', reason: 'gh-failed' })
  })

  it('should refuse when the evidence read fails', async () => {
    const { api } = makeApi({ evidence: null })

    const result = await readReviewState(api)

    expect(result).toEqual({ kind: 'refused', reason: 'gh-failed' })
  })

  it('should refuse when the carry-forward read fails', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [[uiPass('## UI review closed', HEAD)]],
      changed: null,
    })

    const result = await readReviewState(api)

    expect(result).toEqual({ kind: 'refused', reason: 'gh-failed' })
  })

  it('should refuse a wait whose read fails mid-wait, naming the seconds waited', async () => {
    const { api } = makeApi({ reviews: [[], null] })

    const result = await waitForReviews(api, { waitSeconds: 600, pollMs: 1000 })

    expect(result).toEqual({
      kind: 'refused',
      reason: 'gh-failed',
      waitedSeconds: 1,
    })
  })
})

describe('waitForReviews', () => {
  it('should return covered once a pass covers the tip for every bound family', async () => {
    const { api, calls } = makeApi({
      reviews: [
        [],
        [codePass('## Review', HEAD)],
        [codePass('## Review', HEAD), uiPass('## UI review', HEAD)],
      ],
    })

    const result = await waitForReviews(api, { waitSeconds: 600, pollMs: 1000 })

    expect(result).toMatchObject({
      kind: 'read',
      reason: 'covered',
      waitedSeconds: 3,
    })
    expect(calls.sleeps).toEqual([1000, 1500])
  })

  it('should read at most 14 times across a 1200s wait at the default gap', async () => {
    const { api, calls } = makeApi({ reviews: [[codePass('## Review', HEAD)]] })

    await waitForReviews(api, { waitSeconds: 1200, pollMs: 30_000 })

    expect(calls.sleeps.length + 1).toBeLessThanOrEqual(14)
  })

  it('should cut the last gap to the deadline rather than sleeping past it', async () => {
    const { api, calls } = makeApi({ reviews: [[codePass('## Review', HEAD)]] })

    const result = await waitForReviews(api, { waitSeconds: 3, pollMs: 1000 })

    expect(result).toMatchObject({ reason: 'timeout', waitedSeconds: 3 })
    expect(calls.sleeps).toEqual([1000, 1500, 500])
  })

  it('should return timeout past the deadline with the last record', async () => {
    const { api } = makeApi({ reviews: [[codePass('## Review', HEAD)]] })

    const result = await waitForReviews(api, { waitSeconds: 3, pollMs: 1000 })

    expect(result).toMatchObject({
      kind: 'read',
      reason: 'timeout',
      waitedSeconds: 3,
      record: { review: { isCovered: true }, ui: { isCovered: false } },
    })
  })

  it('should keep holding on an open pass at a commit the worker pushed past', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [[codePass('## Review', HEAD)]],
      evidence: { hasDrivableBox: false },
    })

    const result = await waitForReviews(api, { waitSeconds: 2, pollMs: 1000 })

    expect(result).toMatchObject({
      reason: 'timeout',
      record: { review: { reason: 'review-open', isCovered: false } },
    })
  })

  it('should take an open UI pass at the tip after an older close as covered', async () => {
    const { api } = makeApi({
      tips: [PUSHED],
      reviews: [
        [
          codePass('## Review closed', PUSHED),
          uiPass('## UI review closed', HEAD),
          uiPass('## UI review', PUSHED),
        ],
      ],
    })

    const result = await waitForReviews(api, { waitSeconds: 600, pollMs: 1000 })

    expect(result).toMatchObject({
      reason: 'covered',
      record: { ui: { reason: 'ui-open', isCovered: true } },
    })
  })

  it('should follow a push made during the wait', async () => {
    const { api } = makeApi({
      tips: [HEAD, PUSHED],
      reviews: [
        [],
        [codePass('## Review closed', HEAD)],
        [codePass('## Review closed', PUSHED)],
      ],
      evidence: { hasDrivableBox: false },
    })

    const result = await waitForReviews(api, { waitSeconds: 600, pollMs: 1000 })

    expect(result).toMatchObject({
      reason: 'covered',
      waitedSeconds: 3,
      record: { head: PUSHED },
    })
  })

  it('should read the evidence once across the whole wait', async () => {
    const { api, calls } = makeApi({ reviews: [[codePass('## Review', HEAD)]] })

    await waitForReviews(api, { waitSeconds: 3, pollMs: 1000 })

    expect(calls.evidence).toBe(1)
  })
})

describe('agrees with lift', () => {
  const cases: readonly (readonly [string, Fixture])[] = [
    ['no pass', { reviews: [[]] }],
    ['an open code pass', { reviews: [[codePass('## Review', HEAD)]] }],
    [
      'a code pass behind',
      { reviews: [[codePass('## Review closed', PUSHED)]] },
    ],
    [
      'an open UI pass',
      {
        reviews: [
          [codePass('## Review closed', HEAD), uiPass('## UI review', HEAD)],
        ],
      },
    ],
    [
      'both closed at the head',
      {
        reviews: [
          [
            codePass('## Review closed', HEAD),
            uiPass('## UI review closed', HEAD),
          ],
        ],
      },
    ],
    [
      'a UI close behind a source push',
      {
        tips: [PUSHED],
        reviews: [
          [
            codePass('## Review closed', PUSHED),
            uiPass('## UI review closed', HEAD),
          ],
        ],
        changed: { isAncestor: true, paths: ['src/cli.ts'] },
      },
    ],
    [
      'both closes across an equal rebase',
      {
        tips: [PUSHED],
        reviews: [
          [
            codePass('## Review closed', HEAD),
            uiPass('## UI review closed', HEAD),
          ],
        ],
        changed: { isAncestor: false, paths: [] },
        rebased: { differingPaths: [], ownPaths: [] },
      },
    ],
    [
      'a code close across a base merge',
      {
        tips: [PUSHED],
        reviews: [
          [
            codePass('## Review closed', HEAD),
            uiPass('## UI review closed', HEAD),
          ],
        ],
        changed: { isAncestor: true, paths: ['src/cli.ts'] },
        rebased: { differingPaths: [], ownPaths: [] },
        unmerged: [],
      },
    ],
    [
      'a rebase that changed a driven path',
      {
        tips: [PUSHED],
        reviews: [
          [
            codePass('## Review closed', HEAD),
            uiPass('## UI review closed', HEAD),
          ],
        ],
        changed: { isAncestor: false, paths: [] },
        rebased: { differingPaths: ['src/cli.ts'], ownPaths: ['src/cli.ts'] },
      },
    ],
  ]

  it.each(cases)(
    'should give the lift reason for each family on %s',
    async (_name, fixture) => {
      const { api } = makeApi(fixture)
      const passing: ChecksGate = { state: 'passing', isConflicted: false }
      const liftApi: LiftApi = {
        ...api,
        readTip: () => api.readTip(),
        readPull: async () => ({
          isDraft: true,
          isOpen: true,
          nodeId: 'PR_node',
          branch: 'feat/x',
          head: HEAD,
        }),
        readStanding: async () => 'fresh',
        readChecks: async () => passing,
        markReady: async () => true,
        markDraft: async () => true,
      }

      const [state, lifted] = await Promise.all([
        readReviewState(api),
        lift(liftApi, { isCheck: true, waitSeconds: 0 }),
      ])

      const gate = (name: string) =>
        lifted.gates.find((entry) => entry.gate === name)?.reason
      expect(state.kind).toBe('read')
      const record = state.kind === 'read' ? state.record : undefined
      expect([record?.review.reason, record?.ui.reason]).toEqual([
        gate('review'),
        gate('ui'),
      ])
    },
  )
})

interface StandingFixture {
  /** One tip per read, the last repeating, null for a read that failed. */
  tips?: readonly (string | null)[]
  /** One base reading per read, the last repeating. */
  readings?: readonly BaseReading[]
  /** One open read per call, the last repeating, null for a read that failed. */
  opens?: readonly (boolean | null)[]
}

interface StandingHarness {
  readonly api: StandingApi
  readonly calls: { opens: number; standings: string[]; sleeps: number[] }
}

/** The standing api over a fake clock that only `sleep` advances. */
function makeStandingApi(fixture: StandingFixture = {}): StandingHarness {
  const calls = { opens: 0, standings: [] as string[], sleeps: [] as number[] }
  const tips = fixture.tips ?? [HEAD]
  const readings = fixture.readings ?? [{ standing: 'fresh' }]
  const opens = fixture.opens ?? [true]
  let tipReads = 0
  let clock = 0

  const api: StandingApi = {
    readTip: async () => {
      const tip = tips[Math.min(tipReads, tips.length - 1)]
      tipReads += 1
      return tip ?? undefined
    },
    readStanding: async (head) => {
      const reading =
        readings[Math.min(calls.standings.length, readings.length - 1)]
      calls.standings.push(head)
      return reading ?? { standing: 'unknown' }
    },
    readOpen: async () => {
      const open = opens[Math.min(calls.opens, opens.length - 1)]
      calls.opens += 1
      return open ?? undefined
    },
    sleep: async (ms) => {
      calls.sleeps.push(ms)
      clock += ms
    },
    now: () => clock,
  }
  return { api, calls }
}

describe('waitForStanding', () => {
  it('should end as stale naming the moved paths once the base moves a branch path', async () => {
    const { api } = makeStandingApi({
      readings: [
        { standing: 'fresh' },
        { standing: 'stale', moved: ['src/a.ts'] },
      ],
    })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'read',
      reason: 'stale',
      head: HEAD,
      moved: ['src/a.ts'],
      waitedSeconds: 1,
    })
  })

  it('should end as conflict when the base no longer merges cleanly', async () => {
    const { api } = makeStandingApi({ readings: [{ standing: 'conflict' }] })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'read',
      reason: 'conflict',
      head: HEAD,
      waitedSeconds: 0,
    })
  })

  it('should end as closed rather than stale once the pull request merged', async () => {
    const { api } = makeStandingApi({
      readings: [{ standing: 'stale', moved: ['src/a.ts'] }],
      opens: [false],
    })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'read',
      reason: 'closed',
      head: HEAD,
      waitedSeconds: 0,
    })
  })

  it('should end as closed when the branch left the remote and the pull request closed', async () => {
    const { api } = makeStandingApi({ tips: [null], opens: [false] })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({ kind: 'read', reason: 'closed', waitedSeconds: 0 })
  })

  it('should refuse when the tip read fails on an open pull request', async () => {
    const { api } = makeStandingApi({ tips: [null], opens: [true] })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'refused',
      reason: 'gh-failed',
      waitedSeconds: 0,
    })
  })

  it('should refuse when the open read fails rather than act on a stale reading', async () => {
    const { api } = makeStandingApi({
      readings: [{ standing: 'stale', moved: ['src/a.ts'] }],
      opens: [null],
    })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'refused',
      reason: 'gh-failed',
      waitedSeconds: 0,
    })
  })

  it('should hold on a fresh base until the deadline and end as timeout', async () => {
    const { api, calls } = makeStandingApi()

    const result = await waitForStanding(api, { waitSeconds: 3, pollMs: 1000 })

    expect(result).toEqual({
      kind: 'read',
      reason: 'timeout',
      head: HEAD,
      standing: 'fresh',
      waitedSeconds: 3,
    })
    expect(calls.sleeps).toEqual([1000, 1500, 500])
  })

  it('should end as closed at the deadline for a pull request closed on a fresh base', async () => {
    const { api } = makeStandingApi({ opens: [false] })

    const result = await waitForStanding(api, { waitSeconds: 3, pollMs: 1000 })

    expect(result).toEqual({
      kind: 'read',
      reason: 'closed',
      head: HEAD,
      waitedSeconds: 3,
    })
  })

  it('should keep waiting through an unknown reading', async () => {
    const { api } = makeStandingApi({
      readings: [{ standing: 'unknown' }, { standing: 'conflict' }],
    })

    const result = await waitForStanding(api, {
      waitSeconds: 600,
      pollMs: 1000,
    })

    expect(result).toEqual({
      kind: 'read',
      reason: 'conflict',
      head: HEAD,
      waitedSeconds: 1,
    })
  })

  it('should read the pull request state only on a non-fresh reading or at the deadline', async () => {
    const { api, calls } = makeStandingApi()

    await waitForStanding(api, { waitSeconds: 3, pollMs: 1000 })

    expect(calls.opens).toBe(1)
  })

  it('should read the standing at a tip the worker pushed during the wait', async () => {
    const { api, calls } = makeStandingApi({
      tips: [HEAD, PUSHED],
      readings: [{ standing: 'fresh' }, { standing: 'conflict' }],
    })

    await waitForStanding(api, { waitSeconds: 600, pollMs: 1000 })

    expect(calls.standings).toEqual([HEAD, PUSHED])
  })
})
