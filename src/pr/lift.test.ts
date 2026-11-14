import { describe, expect, it } from 'vitest'
import {
  type ChangedRead,
  type ChecksGate,
  type EvidenceGate,
  type GateResult,
  type GitRunner,
  lift,
  type LiftApi,
  type PullState,
  readBaseStanding,
  readChangedPaths,
  readsDrivableBox,
  type Standing,
} from '@/pr/lift'
import { DEFAULT_PAINTED, type PaintedPatterns } from '@/pr/painted'
import type { ReviewRow } from '@/pr/review-scope'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const MOVED = '1111111111111111111111111111111111111111'
const READ_AT = '2026-10-12T10:00:00Z'

const CODE_CLOSED: ReviewRow = {
  body: `## Review closed\n\nclean\n<!-- review-pr: commit=${HEAD} read-at=${READ_AT} -->`,
}
const CODE_OPEN: ReviewRow = {
  body: `## Review\n\n1 should-fix\n<!-- review-pr: commit=${HEAD} read-at=${READ_AT} -->`,
}
const UI_CLOSED: ReviewRow = {
  body: `## UI review closed\n\nall boxes\n<!-- review-ui: head=${HEAD} -->`,
}
const UNDRIVEN_LINE = '0 failed · 0 need your eyes · 0 passed · 10 not driven'
const UI_OPEN: ReviewRow = {
  body: `## UI review\n\n1 failed\n<!-- review-ui: head=${HEAD} -->`,
}
const UI_CLOSED_UNDRIVEN: ReviewRow = {
  body: `## UI review closed\n\n${UNDRIVEN_LINE}\n<!-- review-ui: head=${HEAD} -->`,
}
const UI_CLOSED_UNDRIVEN_AT_MOVED: ReviewRow = {
  body: `## UI review closed\n\n${UNDRIVEN_LINE}\n<!-- review-ui: head=${MOVED} -->`,
}
const UI_CLOSED_EYES_ONLY: ReviewRow = {
  body: `## UI review closed\n\n0 failed · 3 need your eyes · 0 passed · 0 not driven\n<!-- review-ui: head=${HEAD} -->`,
}
const UI_CLOSED_EMPTY: ReviewRow = {
  body: `## UI review closed\n\n0 failed · 0 need your eyes · 0 passed · 0 not driven\n<!-- review-ui: head=${HEAD} -->`,
}
const UI_CLOSED_AT_MOVED: ReviewRow = {
  body: `## UI review closed\n\nall boxes\n<!-- review-ui: head=${MOVED} -->`,
}

// A close rewritten in place by a `PUT`: GitHub keeps the stamp on the head the
// comment was first posted against, and the body's marker names the new head.
const CODE_CLOSED_EDITED: ReviewRow = {
  body: CODE_CLOSED.body,
  commit: { oid: MOVED },
}
const UI_CLOSED_EDITED: ReviewRow = {
  body: UI_CLOSED.body,
  commit: { oid: MOVED },
}

interface Fixture {
  pull?: Partial<PullState>
  tip?: string
  reviews?: readonly ReviewRow[]
  evidence?: Partial<EvidenceGate>
  standing?: Standing
  /** One reading per call, the last repeating. */
  checks?: readonly (ChecksGate | undefined)[]
  isMarked?: boolean
  isDrafted?: boolean
  /** What the read answers, null for one that failed. */
  changed?: ChangedRead | null
}

interface Harness {
  readonly api: LiftApi
  readonly calls: {
    marks: string[]
    drafts: string[]
    reads: (readonly [string, string])[]
    checks: number
    sleeps: number[]
  }
}

/** The api over a fake clock that only `sleep` advances. */
function makeApi(fixture: Fixture = {}): Harness {
  const calls = {
    marks: [] as string[],
    drafts: [] as string[],
    reads: [] as (readonly [string, string])[],
    checks: 0,
    sleeps: [] as number[],
  }
  let clock = 0
  const pull: PullState = {
    isDraft: true,
    isOpen: true,
    nodeId: 'PR_node',
    branch: 'feat/x',
    head: HEAD,
    ...fixture.pull,
  }
  const readings = fixture.checks ?? [{ state: 'passing', isConflicted: false }]
  const evidence: EvidenceGate = {
    isSettled: true,
    owed: [],
    hasDrivableBox: false,
    ...fixture.evidence,
  }

  const api: LiftApi = {
    readPull: async () => pull,
    readTip: async () => fixture.tip ?? HEAD,
    readReviews: async () => fixture.reviews ?? [CODE_CLOSED],
    readEvidence: async () => evidence,
    readStanding: async () => fixture.standing ?? 'fresh',
    readChecks: async () => {
      const reading = readings[Math.min(calls.checks, readings.length - 1)]
      calls.checks += 1
      return reading
    },
    markReady: async (nodeId) => {
      calls.marks.push(nodeId)
      return fixture.isMarked ?? true
    },
    readChanged: async (from, to) => {
      calls.reads.push([from, to])
      if (fixture.changed === null) return undefined
      return fixture.changed ?? { isAncestor: true, paths: [] }
    },
    markDraft: async (nodeId) => {
      calls.drafts.push(nodeId)
      return fixture.isDrafted ?? true
    },
    sleep: async (ms) => {
      calls.sleeps.push(ms)
      clock += ms
    },
    now: () => clock,
  }
  return { api, calls }
}

const PENDING: ChecksGate = { state: 'pending', isConflicted: false }
const PASSING: ChecksGate = { state: 'passing', isConflicted: false }
const STUCK_RUN = { id: 43095326656, workflow: 'Verify', queuedSeconds: 900 }
const STALLED: ChecksGate = {
  state: 'pending',
  isConflicted: false,
  stalled: [STUCK_RUN],
}

describe('lift', () => {
  it('should lift and report lifted when every gate passes', async () => {
    const { api, calls } = makeApi()

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record.reason).toBe('lifted')
    expect(calls.marks).toEqual(['PR_node'])
  })

  describe('advisory checks', () => {
    const advisoryFailing: ChecksGate = {
      state: 'passing',
      isConflicted: false,
      advisory: ['🍎 macOS Unit Tests'],
    }

    it('should lift past a failing advisory check and name it in the record', async () => {
      const { api, calls } = makeApi({ checks: [advisoryFailing] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'lifted',
        isOk: true,
        advisory: ['🍎 macOS Unit Tests'],
      })
      expect(calls.marks).toEqual(['PR_node'])
    })

    it('should read clear under --check and name the failing advisory check', async () => {
      const { api } = makeApi({ checks: [advisoryFailing] })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'clear',
        advisory: ['🍎 macOS Unit Tests'],
      })
    })

    it('should carry no advisory field when none failed', async () => {
      const { api } = makeApi({
        checks: [{ state: 'passing', isConflicted: false, advisory: [] }],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).not.toHaveProperty('advisory')
    })
  })

  describe('ready pull request', () => {
    const ready = { pull: { isDraft: false } }

    it('should stay ready and call no mutation when every gate clears', async () => {
      const { api, calls } = makeApi(ready)

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'already-ready', isOk: true })
      expect(calls.marks).toEqual([])
      expect(calls.drafts).toEqual([])
    })

    it.each([
      ['review-open', { reviews: [CODE_OPEN] }],
      ['review-missing', { reviews: [] }],
      ['evidence-owed', { evidence: { isSettled: false } }],
      ['painted-uncaptured', { evidence: { uncaptured: ['src/App.tsx'] } }],
      [
        'ui-missing',
        { evidence: { hasDrivableBox: true }, reviews: [CODE_CLOSED] },
      ],
    ] as const)('should return to draft naming %s', async (failed, fixture) => {
      const { api, calls } = makeApi({ ...ready, ...fixture })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'redrafted',
        isOk: false,
        failed,
      })
      expect(calls.drafts).toEqual(['PR_node'])
    })

    it('should return to draft on a painted push after a UI close', async () => {
      const { api, calls } = makeApi({
        ...ready,
        evidence: { hasDrivableBox: true },
        reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
        changed: { isAncestor: true, paths: ['src/App.tsx'] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'redrafted',
        failed: 'ui-behind',
        paintedPaths: ['src/App.tsx'],
      })
      expect(calls.drafts).toEqual(['PR_node'])
    })

    it('should stay ready on a test-only push after a UI close', async () => {
      const { api, calls } = makeApi({
        ...ready,
        evidence: { hasDrivableBox: true, reelHead: MOVED },
        reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
        changed: { isAncestor: true, paths: ['src/App.test.tsx'] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'already-ready',
        carriedFrom: MOVED,
      })
      expect(calls.drafts).toEqual([])
    })

    const failingRun = {
      checks: [{ state: 'failing', isConflicted: false }],
    } as const
    it.each([
      ['standing-stale', false, { standing: 'stale' }],
      ['standing-stale', true, { standing: 'stale' }],
      ['ci-failing', false, failingRun],
      ['ci-failing', true, failingRun],
    ] as const)(
      'should refuse %s with isCheck %s and leave the ready mark in place',
      async (reason, isCheck, fixture) => {
        const { api, calls } = makeApi({ ...ready, ...fixture })

        const record = await lift(api, { isCheck, waitSeconds: 60 })

        expect(record).toMatchObject({ reason, isOk: false, isReady: true })
        expect(calls.drafts).toEqual([])
      },
    )

    it('should refuse a stale standing before it reads the check runs', async () => {
      const { api, calls } = makeApi({
        ...ready,
        standing: 'stale',
        checks: [PENDING],
      })

      await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(calls.checks).toBe(0)
      expect(calls.sleeps).toEqual([])
    })

    it('should report ci-pending under --check without waiting or writing', async () => {
      const { api, calls } = makeApi({ ...ready, checks: [PENDING] })

      const record = await lift(api, { isCheck: true, waitSeconds: 600 })

      expect(record).toMatchObject({
        reason: 'ci-pending',
        isOk: false,
        isReady: true,
      })
      expect(calls.sleeps).toEqual([])
      expect(calls.drafts).toEqual([])
    })

    it('should wait on a pending run and report already-ready once it passes', async () => {
      const { api, calls } = makeApi({
        ...ready,
        checks: [PENDING, PASSING],
      })

      const record = await lift(api, {
        isCheck: false,
        waitSeconds: 600,
        pollMs: 30_000,
      })

      expect(record).toMatchObject({
        reason: 'already-ready',
        isOk: true,
        isReady: true,
        waitedSeconds: 30,
      })
      expect(calls.marks).toEqual([])
    })

    it('should refuse ci-timeout on a run still pending at the deadline', async () => {
      const { api, calls } = makeApi({ ...ready, checks: [PENDING] })

      const record = await lift(api, {
        isCheck: false,
        waitSeconds: 60,
        pollMs: 30_000,
      })

      expect(record).toMatchObject({ reason: 'ci-timeout', isReady: true })
      expect(calls.drafts).toEqual([])
    })

    it('should refuse head-moved when a push lands during the wait', async () => {
      const harness = makeApi({ ...ready, checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readTip: async () => {
          reads += 1
          return reads === 1 ? HEAD : MOVED
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record).toMatchObject({ reason: 'head-moved', head: MOVED })
    })

    it('should refuse a review reopened during the wait and stay ready', async () => {
      const harness = makeApi({ ...ready, checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readReviews: async () => {
          reads += 1
          return reads === 1 ? [CODE_CLOSED] : [CODE_CLOSED, CODE_OPEN]
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record).toMatchObject({ reason: 'review-open', isReady: true })
      expect(harness.calls.drafts).toEqual([])
    })

    it('should refuse a standing that went stale during the wait', async () => {
      const harness = makeApi({ ...ready, checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readStanding: async () => {
          reads += 1
          return reads === 1 ? 'fresh' : 'stale'
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record).toMatchObject({ reason: 'standing-stale', isReady: true })
    })

    it('should refuse ready-withdrawn and mark nothing when drafted during the wait', async () => {
      const harness = makeApi({ ...ready, checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readPull: async () => {
          reads += 1
          const pull = await harness.api.readPull()
          return pull && { ...pull, isDraft: reads > 1 }
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('ready-withdrawn')
      expect(record).not.toHaveProperty('isReady')
      expect(harness.calls.marks).toEqual([])
    })

    it('should keep the ci gate beside an open review under --check', async () => {
      const { api } = makeApi({
        ...ready,
        reviews: [CODE_OPEN],
        checks: [PENDING],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record.reason).toBe('review-open')
      expect(record.gates.find((gate) => gate.gate === 'ci')).toMatchObject({
        isOk: false,
        reason: 'ci-pending',
      })
    })

    it('should carry a failing advisory check on already-ready', async () => {
      const { api } = makeApi({
        ...ready,
        checks: [
          { state: 'passing', isConflicted: false, advisory: ['🍎 macOS'] },
        ],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'already-ready',
        advisory: ['🍎 macOS'],
      })
    })

    it('should mark a redrafted record as no longer ready', async () => {
      const { api } = makeApi({ ...ready, reviews: [CODE_OPEN] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'redrafted', isReady: false })
    })

    it('should refuse gh-failed when the draft mutation does not take', async () => {
      const { api } = makeApi({
        ...ready,
        reviews: [CODE_OPEN],
        isDrafted: false,
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('gh-failed')
    })

    it('should report a failing gate under --check and write nothing', async () => {
      const { api, calls } = makeApi({ ...ready, reviews: [CODE_OPEN] })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'review-open', isOk: false })
      expect(calls.drafts).toEqual([])
    })

    it('should report already-ready under --check when every gate clears', async () => {
      const { api, calls } = makeApi(ready)

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'already-ready', isOk: true })
      expect(calls.drafts).toEqual([])
    })
  })

  it('should refuse a closed pull request', async () => {
    const { api } = makeApi({ pull: { isOpen: false } })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record.reason).toBe('pull-closed')
  })

  describe('review gate', () => {
    it.each([
      ['review-missing', []],
      ['review-open', [CODE_OPEN]],
      [
        'review-unmarked',
        [{ body: '## Review closed\n\nclean', commit: { oid: HEAD } }],
      ],
      [
        'review-behind',
        [
          {
            body: `## Review closed\n<!-- review-pr: commit=${MOVED} read-at=${READ_AT} -->`,
          },
        ],
      ],
    ] as const)(
      'should refuse %s and call no mutation',
      async (reason, reviews) => {
        const { api, calls } = makeApi({ reviews })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe(reason)
        expect(calls.marks).toEqual([])
      },
    )
  })

  describe('review gate on a rewritten close', () => {
    it('should pass on a code close rewritten in place to the head', async () => {
      const { api, calls } = makeApi({ reviews: [CODE_CLOSED_EDITED] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
      expect(calls.marks).toEqual(['PR_node'])
    })
  })

  describe('UI gate', () => {
    // A reel at the head settles the evidence gate's reel half, so these
    // cases read the UI gate alone.
    const withDrivable = { hasDrivableBox: true, reelHead: HEAD }

    it('should still refuse ui-open when the checklist holds no drivable box', async () => {
      const { api } = makeApi({
        evidence: { hasDrivableBox: false },
        reviews: [CODE_CLOSED, UI_OPEN],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-open')
    })

    it('should pass with no UI review on a checklist holding only taste boxes', async () => {
      const { api } = makeApi({
        evidence: {
          hasDrivableBox: readsDrivableBox({
            checklist: '- [ ] calm (taste)',
            drivable: 0,
          }),
        },
        reviews: [CODE_CLOSED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should refuse ui-missing on a checklist holding one drivable box beside taste ones', async () => {
      const { api } = makeApi({
        evidence: {
          hasDrivableBox: readsDrivableBox({
            checklist: '- [ ] opens\n- [ ] calm (taste)\n- [ ] paces (taste)',
            drivable: 1,
          }),
        },
        reviews: [CODE_CLOSED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-missing')
    })

    it('should not bind when the evidence record carries no checklist', async () => {
      const { api } = makeApi({ reviews: [CODE_CLOSED] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should pass when the UI verdict is closed at the head', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should pass on a UI close rewritten in place to the head', async () => {
      const { api, calls } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_EDITED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
      expect(calls.reads).toEqual([])
    })

    it('should refuse ui-behind on a rewritten close whose marker names an older head', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [
          CODE_CLOSED,
          { body: UI_CLOSED_AT_MOVED.body, commit: { oid: HEAD } },
        ],
        changed: { isAncestor: false, paths: [] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-behind')
    })

    it('should refuse ui-missing when a checklist exists and no verdict does', async () => {
      const { api } = makeApi({ evidence: withDrivable })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-missing')
    })

    it('should refuse ui-open on an open verdict', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [
          CODE_CLOSED,
          { body: `## UI review\n<!-- review-ui: head=${HEAD} -->` },
        ],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-open')
    })

    it('should refuse ui-behind on a close behind the head', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
        changed: { isAncestor: false, paths: [] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-behind')
    })

    it('should refuse ui-undriven on a close that drove no box at the head', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_UNDRIVEN],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-undriven')
    })

    it('should refuse ui-undriven on a close carried from an older head', async () => {
      const { api, calls } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_UNDRIVEN_AT_MOVED],
        changed: { isAncestor: true, paths: ['README.md'] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-undriven')
      expect(calls.reads).toEqual([])
    })

    it('should lift on a close holding only needs-eyes boxes', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_EYES_ONLY],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should not read an empty pass as undriven', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [CODE_CLOSED, UI_CLOSED_EMPTY],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    describe('carried forward', () => {
      it('should carry a close across a push of tests and markdown', async () => {
        const { api, calls } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: { isAncestor: true, paths: ['src/a.test.ts', 'README.md'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(record.carriedFrom).toBe(MOVED)
        expect(calls.reads[0]).toEqual([MOVED, HEAD])
      })

      it('should read a close covering the head without a diff', async () => {
        const { api, calls } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.carriedFrom).toBeUndefined()
        expect(calls.reads).toEqual([])
      })

      it('should refuse ui-behind and name only the painted path of a mixed push', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: {
            isAncestor: true,
            paths: ['src/a.test.ts', 'src/App.tsx'],
          },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record).toMatchObject({
          reason: 'ui-behind',
          paintedPaths: ['src/App.tsx'],
        })
        expect(record.carriedFrom).toBeUndefined()
      })

      it('should carry a close across a push of evidence captures alone', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: {
            isAncestor: true,
            paths: ['evidence/board/light.png', 'evidence/board/dark.png'],
          },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(record.carriedFrom).toBe(MOVED)
      })

      it('should refuse ui-behind and name the source path of a gap that paints nothing', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: {
            isAncestor: true,
            paths: ['src/gesture.ts', 'src/gesture.test.ts'],
          },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record).toMatchObject({
          reason: 'ui-behind',
          drivenPaths: ['src/gesture.ts'],
        })
        expect(record.paintedPaths).toBeUndefined()
        expect(record.carriedFrom).toBeUndefined()
      })

      it('should name a painted path in both lists', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: { isAncestor: true, paths: ['src/Card.tsx'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record).toMatchObject({
          reason: 'ui-behind',
          paintedPaths: ['src/Card.tsx'],
          drivenPaths: ['src/Card.tsx'],
        })
      })

      it('should refuse ui-behind and carry nothing when the close is not an ancestor', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: { isAncestor: false, paths: [] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('ui-behind')
        expect(record.carriedFrom).toBeUndefined()
      })

      it('should refuse gh-failed when the diff read fails', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: null,
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('gh-failed')
      })

      it('should never carry an open verdict', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [
            CODE_CLOSED,
            UI_CLOSED_AT_MOVED,
            { body: `## UI review\n<!-- review-ui: head=${MOVED} -->` },
          ],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('ui-open')
      })

      it('should never carry a close with no marker', async () => {
        const { api } = makeApi({
          evidence: withDrivable,
          reviews: [
            CODE_CLOSED,
            { body: '## UI review closed', commit: { oid: MOVED } },
          ],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('ui-unmarked')
      })
    })

    it('should refuse ui-unmarked on a verdict stamped at the head with no marker', async () => {
      const { api } = makeApi({
        evidence: withDrivable,
        reviews: [
          CODE_CLOSED,
          { body: '## UI review closed\n\nall boxes', commit: { oid: HEAD } },
        ],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-unmarked')
    })
  })

  describe('evidence and standing gates', () => {
    it('should refuse evidence-owed', async () => {
      const { api } = makeApi({
        evidence: { isSettled: false, owed: ['preview'] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('evidence-owed')
    })

    describe('painted paths with no capture', () => {
      const waiver = (path: string): ReviewRow => ({
        body: `## UI review closed\n\n- **Waived capture:** \`${path}\`: focus order only\n<!-- review-ui: head=${HEAD} -->`,
      })

      it('should refuse painted-uncaptured, listing the paths sorted', async () => {
        const { api, calls } = makeApi({
          evidence: { uncaptured: ['src/b.tsx', 'src/a.css'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
        expect(record.gates.find((gate) => gate.gate === 'evidence')).toEqual({
          gate: 'evidence',
          isOk: false,
          reason: 'painted-uncaptured',
          uncaptured: ['src/a.css', 'src/b.tsx'],
        })
        expect(calls.marks).toEqual([])
      })

      it('should clear only the path a waiver names', async () => {
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx', 'src/a.css'] },
          reviews: [CODE_CLOSED, waiver('src/b.tsx')],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
        expect(
          record.gates.find((gate) => gate.gate === 'evidence'),
        ).toMatchObject({ uncaptured: ['src/a.css'], waived: ['src/b.tsx'] })
      })

      it('should lift once a waiver covers every path, reporting the waived', async () => {
        const { api, calls } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'] },
          reviews: [CODE_CLOSED, waiver('src/b.tsx')],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(record.gates.find((gate) => gate.gate === 'evidence')).toEqual({
          gate: 'evidence',
          isOk: true,
          waived: ['src/b.tsx'],
        })
        expect(calls.marks).toEqual(['PR_node'])
      })

      it('should clear nothing for a waiver naming a path the list does not hold', async () => {
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'] },
          reviews: [CODE_CLOSED, waiver('./src/b.tsx'), waiver('src/c.tsx')],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
        expect(
          record.gates.find((gate) => gate.gate === 'evidence'),
        ).not.toHaveProperty('waived')
      })

      it('should drop a waiver the newest pass of its family no longer restates', async () => {
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'] },
          reviews: [CODE_CLOSED, waiver('src/b.tsx'), UI_CLOSED],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
      })

      it('should read a waiver from the newest code pass beside a UI close', async () => {
        const codeWaiver: ReviewRow = {
          body: `## Review closed\n\n- **Waived capture:** \`src/b.tsx\`: focus order only\n<!-- review-pr: commit=${HEAD} read-at=${READ_AT} -->`,
        }
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'] },
          reviews: [codeWaiver, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
      })

      it.each([
        [
          'a review with no pass heading',
          { body: '- **Waived capture:** `src/b.tsx`: focus order only' },
        ],
        [
          'a pass with no marker',
          {
            body: '## UI review closed\n\n- **Waived capture:** `src/b.tsx`: focus order only',
          },
        ],
        [
          'a dismissed pass',
          {
            ...waiver('src/b.tsx'),
            state: 'DISMISSED',
          },
        ],
      ] as const)(
        'should clear nothing for a waiver in %s',
        async (_, row: ReviewRow) => {
          const { api } = makeApi({
            evidence: { uncaptured: ['src/b.tsx'] },
            reviews: [CODE_CLOSED, row],
          })

          const record = await lift(api, { isCheck: true, waitSeconds: 60 })

          expect(record.reason).toBe('painted-uncaptured')
        },
      )

      it('should clear the list with a reel filmed at the head', async () => {
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'], reelHead: HEAD.slice(0, 7) },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
      })

      it('should not clear the list with a reel filmed before a push to a painted path', async () => {
        const { api } = makeApi({
          evidence: { uncaptured: ['src/b.tsx'], reelHead: MOVED },
          changed: { isAncestor: true, paths: ['src/b.tsx'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
      })

      describe('a reel carried from an earlier head', () => {
        const TAKE: PaintedPatterns = {
          painted: [...DEFAULT_PAINTED.painted, 'src/take/**'],
          unpainted: DEFAULT_PAINTED.unpainted,
          repainted: ['src/take/**'],
          reelInputs: ['src/browser/engine.ts', 'bun.lock'],
        }
        const filmedEarlier = {
          uncaptured: ['src/take/film.ts'],
          reelHead: MOVED,
        }

        it('should clear the list across a push to a source path the reel does not read, naming where it was filmed', async () => {
          const { api } = makeApi({
            evidence: filmedEarlier,
            changed: { isAncestor: true, paths: ['src/capture/render.ts'] },
          })

          const record = await lift(api, {
            isCheck: false,
            waitSeconds: 60,
            painted: TAKE,
          })

          expect(record.reason).toBe('lifted')
          expect(record.gates.find((gate) => gate.gate === 'evidence')).toEqual(
            { gate: 'evidence', isOk: true, reelCarriedFrom: MOVED },
          )
        })

        it.each([
          ['a painted path', { isAncestor: true, paths: ['src/take/film.ts'] }],
          [
            'a filmed fixture',
            { isAncestor: true, paths: ['src/take/fixtures/motion.html'] },
          ],
          [
            'the fixture harness',
            { isAncestor: true, paths: ['src/take/fixtures/film-suite.ts'] },
          ],
          [
            'a declared reel input',
            { isAncestor: true, paths: ['src/browser/engine.ts'] },
          ],
          ['a rewritten reel commit', { isAncestor: false, paths: [] }],
          ['a failed read', null],
        ] as const)(
          'should refuse painted-uncaptured across %s',
          async (_, changed) => {
            const { api } = makeApi({ evidence: filmedEarlier, changed })

            const record = await lift(api, {
              isCheck: true,
              waitSeconds: 60,
              painted: TAKE,
            })

            expect(record.reason).toBe('painted-uncaptured')
          },
        )

        it('should refuse across a source push when the project declares no reel inputs', async () => {
          const { api } = makeApi({
            evidence: filmedEarlier,
            changed: { isAncestor: true, paths: ['src/capture/render.ts'] },
          })

          const record = await lift(api, {
            isCheck: true,
            waitSeconds: 60,
            painted: { ...TAKE, reelInputs: undefined },
          })

          expect(record.reason).toBe('painted-uncaptured')
        })

        it('should refuse across a filmed fixture push when the project declares no reel inputs', async () => {
          const { api } = makeApi({
            evidence: filmedEarlier,
            changed: {
              isAncestor: true,
              paths: ['src/take/fixtures/motion.html'],
            },
          })

          const record = await lift(api, {
            isCheck: true,
            waitSeconds: 60,
            painted: { ...TAKE, reelInputs: undefined },
          })

          expect(record.reason).toBe('painted-uncaptured')
        })

        it('should carry across a docs-only push when the project declares no reel inputs', async () => {
          const { api } = makeApi({
            evidence: filmedEarlier,
            changed: { isAncestor: true, paths: ['README.md'] },
          })

          const record = await lift(api, { isCheck: false, waitSeconds: 60 })

          expect(record.reason).toBe('lifted')
        })
      })

      it('should pass as today when the record carries no uncaptured list', async () => {
        const { api } = makeApi({ evidence: { uncaptured: undefined } })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(record.gates.find((gate) => gate.gate === 'evidence')).toEqual({
          gate: 'evidence',
          isOk: true,
        })
      })

      it('should refuse evidence-owed ahead of painted-uncaptured', async () => {
        const { api } = makeApi({
          evidence: { isSettled: false, uncaptured: ['src/b.tsx'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('evidence-owed')
      })
    })

    describe('a drivable checklist with no reel at the head', () => {
      const drivable = { hasDrivableBox: true }
      const reelWaiver = (reason: string): ReviewRow => ({
        body: `## UI review closed\n\n- **Waived reel:** ${reason}\n<!-- review-ui: head=${HEAD} -->`,
      })
      const evidenceEntry = (record: { gates: readonly GateResult[] }) =>
        record.gates.find((gate) => gate.gate === 'evidence')

      it('should refuse reel-unsettled when no reel and no skip line are posted', async () => {
        const { api, calls } = makeApi({
          evidence: drivable,
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('reel-unsettled')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: false,
          reason: 'reel-unsettled',
        })
        expect(calls.marks).toEqual([])
      })

      it.each([
        'not-filmed: the reel step was not run',
        'target-missing: beat 2: no match',
        'server-unreachable: connection refused',
      ])('should refuse reel-unsettled on the skip %s', async (reelSkip) => {
        const { api } = makeApi({
          evidence: { ...drivable, reelSkip },
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('reel-unsettled')
        expect(evidenceEntry(record)).toMatchObject({ reelSkip })
      })

      it.each([
        'no-interactive-box: every box asks only to look',
        'no-visible-change: box 3: hover only',
        'reel-too-large',
      ])('should settle on the skip %s', async (reelSkip) => {
        const { api } = makeApi({
          evidence: { ...drivable, reelSkip },
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: true,
          reelSkip,
        })
      })

      it('should settle on a reel filmed at the head beside an unsettled skip', async () => {
        const { api } = makeApi({
          evidence: {
            ...drivable,
            reelHead: HEAD.slice(0, 7),
            reelSkip: 'not-filmed',
          },
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({ gate: 'evidence', isOk: true })
      })

      it('should decide on the skip rather than a reel filmed at an earlier head', async () => {
        const settling = makeApi({
          evidence: {
            ...drivable,
            reelHead: MOVED,
            reelSkip: 'no-visible-change',
          },
          reviews: [CODE_CLOSED, UI_CLOSED],
          changed: { isAncestor: true, paths: ['src/App.tsx'] },
        })
        const unsettled = makeApi({
          evidence: { ...drivable, reelHead: MOVED, reelSkip: 'wrong-state' },
          reviews: [CODE_CLOSED, UI_CLOSED],
          changed: { isAncestor: true, paths: ['src/App.tsx'] },
        })

        const settled = await lift(settling.api, {
          isCheck: true,
          waitSeconds: 60,
        })
        const refused = await lift(unsettled.api, {
          isCheck: true,
          waitSeconds: 60,
        })

        expect(settled.reason).toBe('clear')
        expect(refused.reason).toBe('reel-unsettled')
      })

      it('should carry a reel across a push no box can observe, naming where it was filmed', async () => {
        const { api } = makeApi({
          evidence: { ...drivable, reelHead: MOVED },
          reviews: [CODE_CLOSED, UI_CLOSED],
          changed: { isAncestor: true, paths: ['src/App.test.tsx'] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: true,
          reelCarriedFrom: MOVED,
        })
      })

      it.each([
        [
          'a push a box can observe',
          { isAncestor: true, paths: ['src/App.tsx'] },
        ],
        ['a rewritten reel commit', { isAncestor: false, paths: [] }],
        ['a failed read', null],
      ] as const)('should not carry a reel across %s', async (_, changed) => {
        const { api } = makeApi({
          evidence: { ...drivable, reelHead: MOVED },
          reviews: [CODE_CLOSED, UI_CLOSED],
          changed,
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('reel-unsettled')
      })

      it('should settle on a reel waiver in the newest pass, naming its reason', async () => {
        const { api } = makeApi({
          evidence: { ...drivable, reelSkip: 'wrong-state: beat 1' },
          reviews: [CODE_CLOSED, reelWaiver('hover-only tooltip')],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: true,
          reelSkip: 'wrong-state: beat 1',
          reelWaived: 'hover-only tooltip',
        })
      })

      it('should settle on a reel waiver when no skip line is posted', async () => {
        const { api } = makeApi({
          evidence: drivable,
          reviews: [CODE_CLOSED, reelWaiver('screenshots show every box')],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: true,
          reelWaived: 'screenshots show every box',
        })
      })

      it.each([
        'target-missing: beat 1: button[name=Save]',
        'target-offscreen: beat 2',
        ' target-missing ',
      ])(
        'should refuse a reel waiver over the skip %s, naming the waiver',
        async (reelSkip) => {
          const { api, calls } = makeApi({
            evidence: { ...drivable, reelSkip },
            reviews: [CODE_CLOSED, reelWaiver('hover-only tooltip')],
          })

          const record = await lift(api, { isCheck: false, waitSeconds: 60 })

          expect(record.reason).toBe('reel-unsettled')
          expect(evidenceEntry(record)).toEqual({
            gate: 'evidence',
            isOk: false,
            reason: 'reel-unsettled',
            reelSkip,
            reelWaiverRefused: 'hover-only tooltip',
          })
          expect(calls.marks).toEqual([])
        },
      )

      it('should settle on a settling skip beside a reel waiver without naming the waiver', async () => {
        const { api } = makeApi({
          evidence: { ...drivable, reelSkip: 'no-visible-change' },
          reviews: [CODE_CLOSED, reelWaiver('hover-only tooltip')],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({
          gate: 'evidence',
          isOk: true,
          reelSkip: 'no-visible-change',
        })
      })

      it('should settle on a reel filmed at the head beside a target-missing skip and a waiver', async () => {
        const { api } = makeApi({
          evidence: {
            ...drivable,
            reelHead: HEAD.slice(0, 7),
            reelSkip: 'target-missing: beat 1',
          },
          reviews: [CODE_CLOSED, reelWaiver('hover-only tooltip')],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({ gate: 'evidence', isOk: true })
      })

      it('should drop a reel waiver the newest pass of its family no longer restates', async () => {
        const { api } = makeApi({
          evidence: { ...drivable, reelSkip: 'target-missing: beat 1' },
          reviews: [CODE_CLOSED, reelWaiver('hover-only tooltip'), UI_CLOSED],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('reel-unsettled')
      })

      it('should not read a capture waiver as a reel waiver', async () => {
        const captureOnly: ReviewRow = {
          body: `## UI review closed\n\n- **Waived capture:** \`src/b.tsx\`: focus order only\n<!-- review-ui: head=${HEAD} -->`,
        }
        const { api } = makeApi({
          evidence: drivable,
          reviews: [CODE_CLOSED, captureOnly],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('reel-unsettled')
      })

      it('should owe no reel when the checklist holds no drivable box', async () => {
        const { api } = makeApi({
          evidence: { hasDrivableBox: false, reelSkip: 'not-filmed' },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('lifted')
        expect(evidenceEntry(record)).toEqual({ gate: 'evidence', isOk: true })
      })

      it('should refuse painted-uncaptured ahead of reel-unsettled', async () => {
        const { api } = makeApi({
          evidence: { ...drivable, uncaptured: ['src/b.tsx'] },
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: true, waitSeconds: 60 })

        expect(record.reason).toBe('painted-uncaptured')
      })

      it('should return a ready pull request to draft naming reel-unsettled', async () => {
        const { api, calls } = makeApi({
          pull: { isDraft: false },
          evidence: { ...drivable, reelSkip: 'not-filmed' },
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record).toMatchObject({
          reason: 'redrafted',
          failed: 'reel-unsettled',
        })
        expect(calls.drafts).toEqual(['PR_node'])
      })
    })

    it.each(['stale', 'conflict', 'unknown'] as const)(
      'should refuse a %s standing',
      async (standing) => {
        const { api, calls } = makeApi({ standing })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe(`standing-${standing}`)
        expect(calls.marks).toEqual([])
      },
    )
  })

  describe('CI wait', () => {
    it('should wait on a pending run and lift once it passes', async () => {
      const { api, calls } = makeApi({ checks: [PENDING, PENDING, PASSING] })

      const record = await lift(api, {
        isCheck: false,
        waitSeconds: 600,
        pollMs: 30_000,
      })

      expect(record.reason).toBe('lifted')
      expect(calls.sleeps).toEqual([30_000, 30_000])
    })

    it('should refuse ci-timeout when the run is still pending at the deadline', async () => {
      const { api, calls } = makeApi({ checks: [PENDING] })

      const record = await lift(api, {
        isCheck: false,
        waitSeconds: 60,
        pollMs: 30_000,
      })

      expect(record.reason).toBe('ci-timeout')
      expect(calls.marks).toEqual([])
    })

    it('should stop waiting at once on a conflicted branch', async () => {
      const { api, calls } = makeApi({
        checks: [{ state: 'pending', isConflicted: true }],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('ci-conflicted')
      expect(calls.sleeps).toEqual([])
    })

    it('should stop waiting at once on a stalled run and name it', async () => {
      const { api, calls } = makeApi({ checks: [STALLED] })

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('ci-stalled')
      expect(record.stalled).toEqual([STUCK_RUN])
      expect(calls.sleeps).toEqual([])
    })

    it('should refuse ci-failing without waiting', async () => {
      const { api, calls } = makeApi({
        checks: [{ state: 'failing', isConflicted: false }],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('ci-failing')
      expect(calls.sleeps).toEqual([])
    })

    it('should refuse an open review before it reads the check runs', async () => {
      const { api, calls } = makeApi({
        reviews: [CODE_OPEN],
        checks: [PENDING],
      })

      await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(calls.checks).toBe(0)
    })

    it('should refuse head-moved when a push lands during the wait', async () => {
      const harness = makeApi({ checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readTip: async () => {
          reads += 1
          return reads === 1 ? HEAD : MOVED
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('head-moved')
      expect(harness.calls.marks).toEqual([])
    })

    it('should refuse head-moved when another session readied it and a push landed', async () => {
      const harness = makeApi({ checks: [PENDING, PASSING] })
      let pulls = 0
      let tips = 0
      const api: LiftApi = {
        ...harness.api,
        readPull: async () => {
          pulls += 1
          const pull = await harness.api.readPull()
          return pull && { ...pull, isDraft: pulls === 1 }
        },
        readTip: async () => {
          tips += 1
          return tips === 1 ? HEAD : MOVED
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record).toMatchObject({
        reason: 'head-moved',
        head: MOVED,
        isReady: true,
      })
    })

    it('should re-read the standing and refuse one that went stale during the wait', async () => {
      const harness = makeApi({ checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readStanding: async () => {
          reads += 1
          return reads === 1 ? 'fresh' : 'stale'
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('standing-stale')
      expect(harness.calls.marks).toEqual([])
    })

    it('should re-read the reviews and refuse one that opened during the wait', async () => {
      const harness = makeApi({ checks: [PENDING, PASSING] })
      let reads = 0
      const api: LiftApi = {
        ...harness.api,
        readReviews: async () => {
          reads += 1
          return reads === 1 ? [CODE_CLOSED] : [CODE_CLOSED, CODE_OPEN]
        },
      }

      const record = await lift(api, { isCheck: false, waitSeconds: 600 })

      expect(record.reason).toBe('review-open')
      expect(harness.calls.marks).toEqual([])
    })
  })

  describe('mutation', () => {
    it('should refuse gh-failed on a blocked mutation rather than reporting a lift', async () => {
      const { api } = makeApi({ isMarked: false })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'gh-failed', isLifted: false })
    })
  })

  describe('--check', () => {
    it('should report every gate and call no mutation when all pass', async () => {
      const { api, calls } = makeApi()

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record.reason).toBe('clear')
      expect(record.gates.map((gate) => gate.gate)).toEqual([
        'review',
        'ui',
        'evidence',
        'standing',
        'ci',
      ])
      expect(calls.marks).toEqual([])
    })

    it('should read a pending run once rather than wait on it', async () => {
      const { api, calls } = makeApi({ checks: [PENDING] })

      const record = await lift(api, { isCheck: true, waitSeconds: 600 })

      expect(record.reason).toBe('ci-pending')
      expect(calls.sleeps).toEqual([])
    })

    it('should report a stalled run as ci-stalled with its id', async () => {
      const { api } = makeApi({ checks: [STALLED] })

      const record = await lift(api, { isCheck: true, waitSeconds: 600 })

      expect(record.reason).toBe('ci-stalled')
      expect(record.stalled).toEqual([STUCK_RUN])
    })

    it('should keep ci-pending when the reading names no stalled run', async () => {
      const { api } = makeApi({ checks: [{ ...PENDING, stalled: [] }] })

      const record = await lift(api, { isCheck: true, waitSeconds: 600 })

      expect(record.reason).toBe('ci-pending')
      expect(record.stalled).toBeUndefined()
    })

    it('should keep every failing gate in the record, not the first alone', async () => {
      const { api } = makeApi({
        reviews: [CODE_OPEN],
        evidence: { isSettled: false },
        standing: 'stale',
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(
        record.gates.filter((gate) => !gate.isOk).map((gate) => gate.reason),
      ).toEqual(['review-open', 'evidence-owed', 'standing-stale'])
    })
  })
})

describe('readChangedPaths', () => {
  const FULL = MOVED

  function gitOf(answers: Record<string, string | undefined>): GitRunner {
    return async (args) => {
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      return answers[verb]
    }
  }

  it('should list the paths changed since an ancestor close', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': `${FULL}\n`,
      diff: 'src/a.ts\nsrc/App.tsx\n',
    })

    expect(await readChangedPaths(git, '1111111', HEAD)).toEqual({
      isAncestor: true,
      paths: ['src/a.ts', 'src/App.tsx'],
    })
  })

  it('should read not an ancestor when the close was rewritten away', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': 'ffffffffffffffffffffffffffffffffffffffff\n',
    })

    expect(await readChangedPaths(git, FULL, HEAD)).toEqual({
      isAncestor: false,
      paths: [],
    })
  })

  it('should read not an ancestor when the close does not resolve', async () => {
    const git = gitOf({ 'cat-file': '', 'rev-parse': undefined })

    expect(await readChangedPaths(git, FULL, HEAD)).toEqual({
      isAncestor: false,
      paths: [],
    })
  })

  it('should read a failed read when the head does not resolve', async () => {
    const git = gitOf({ 'cat-file': undefined })

    expect(await readChangedPaths(git, FULL, HEAD)).toBeUndefined()
  })

  it('should read a failed read when the diff fails', async () => {
    const git = gitOf({
      'cat-file': '',
      'rev-parse': `${FULL}\n`,
      'merge-base': `${FULL}\n`,
      diff: undefined,
    })

    expect(await readChangedPaths(git, FULL, HEAD)).toBeUndefined()
  })
})

describe('readBaseStanding', () => {
  /** Answers by the first git argument that names the command. */
  function gitOf(answers: Record<string, string | undefined>): GitRunner {
    return async (args) => {
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      return answers[verb]
    }
  }

  it('should read fresh when the base moved no path the branch writes', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': '',
      'rev-parse': 'abc',
      'merge-tree': 'tree',
      'merge-base': 'fork\n',
      diff: '',
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('fresh')
  })

  it('should fetch the base before it measures against it', async () => {
    const calls: string[][] = []
    const git: GitRunner = async (args) => {
      calls.push([...args])
      return args.includes('merge-base') ? 'fork\n' : ''
    }

    await readBaseStanding(git, 1, HEAD, 'origin/main')

    expect(calls).toContainEqual(['fetch', '-q', 'origin', 'main'])
  })

  it('should read conflict when merge-tree fails on resolvable refs', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': '',
      'rev-parse': 'abc',
      'merge-tree': undefined,
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('conflict')
  })

  it('should read unknown when the head does not resolve', async () => {
    const git = gitOf({
      fetch: '',
      'cat-file': undefined,
      'rev-parse': 'abc',
    })

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('unknown')
  })

  it('should read stale when the base changed a path the branch writes', async () => {
    const calls: string[][] = []
    const git: GitRunner = async (args) => {
      calls.push([...args])
      const verb = args.find((arg) => !arg.startsWith('-')) ?? ''
      if (verb === 'diff') {
        return args.includes('--') ? 'src/a.ts\n' : 'src/a.ts\nsrc/b.ts\n'
      }
      if (verb === 'merge-base') return 'fork\n'
      return ''
    }

    expect(await readBaseStanding(git, 1, HEAD, 'origin/main')).toBe('stale')
  })
})

describe('readsDrivableBox', () => {
  it.each([
    [{}, false],
    [{ checklist: '' }, false],
    [{ checklist: '- [ ] calm (taste)', drivable: 0 }, false],
    [{ checklist: '- [ ] opens', drivable: 1 }, true],
    [{ checklist: '- [ ] opens' }, true],
    [{ checklist: '- [ ] opens', drivable: '0' }, true],
    [{ checklist: '- [ ] opens', drivable: -1 }, true],
  ])('should read %j as binding %s', (record, expected) => {
    expect(readsDrivableBox(record)).toBe(expected)
  })
})
