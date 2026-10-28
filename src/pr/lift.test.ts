import { describe, expect, it } from 'vitest'
import {
  type ChangedRead,
  type ChecksGate,
  type EvidenceGate,
  type GitRunner,
  lift,
  type LiftApi,
  type PullState,
  readBaseStanding,
  readChangedPaths,
  type Standing,
} from '@/pr/lift'
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
    hasChecklist: false,
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
      [
        'ui-missing',
        { evidence: { hasChecklist: true }, reviews: [CODE_CLOSED] },
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
        evidence: { hasChecklist: true },
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
        evidence: { hasChecklist: true },
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

    it.each([
      ['a stale standing', { standing: 'stale' }],
      [
        'a failing run',
        { checks: [{ state: 'failing', isConflicted: false }] },
      ],
    ] as const)('should stay ready on %s', async (_label, fixture) => {
      const { api, calls } = makeApi({ ...ready, ...fixture })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({ reason: 'already-ready', isOk: true })
      expect(calls.drafts).toEqual([])
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
    const withChecklist = { hasChecklist: true }

    it('should not bind when the evidence record carries no checklist', async () => {
      const { api } = makeApi({ reviews: [CODE_CLOSED] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should pass when the UI verdict is closed at the head', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should pass on a UI close rewritten in place to the head', async () => {
      const { api, calls } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_EDITED],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
      expect(calls.reads).toEqual([])
    })

    it('should refuse ui-behind on a rewritten close whose marker names an older head', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
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
      const { api } = makeApi({ evidence: withChecklist })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-missing')
    })

    it('should refuse ui-open on an open verdict', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
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
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
        changed: { isAncestor: false, paths: [] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-behind')
    })

    it('should refuse ui-undriven on a close that drove no box at the head', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_UNDRIVEN],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-undriven')
    })

    it('should refuse ui-undriven on a close carried from an older head', async () => {
      const { api, calls } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_UNDRIVEN_AT_MOVED],
        changed: { isAncestor: true, paths: ['README.md'] },
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-undriven')
      expect(calls.reads).toEqual([])
    })

    it('should lift on a close holding only needs-eyes boxes', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_EYES_ONLY],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    it('should not read an empty pass as undriven', async () => {
      const { api } = makeApi({
        evidence: withChecklist,
        reviews: [CODE_CLOSED, UI_CLOSED_EMPTY],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('lifted')
    })

    describe('carried forward', () => {
      it('should carry a close across a push of tests and markdown', async () => {
        const { api, calls } = makeApi({
          evidence: withChecklist,
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
          evidence: withChecklist,
          reviews: [CODE_CLOSED, UI_CLOSED],
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.carriedFrom).toBeUndefined()
        expect(calls.reads).toEqual([])
      })

      it('should refuse ui-behind and name only the painted path of a mixed push', async () => {
        const { api } = makeApi({
          evidence: withChecklist,
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
          evidence: withChecklist,
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
          evidence: withChecklist,
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
          evidence: withChecklist,
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
          evidence: withChecklist,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: { isAncestor: false, paths: [] },
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('ui-behind')
        expect(record.carriedFrom).toBeUndefined()
      })

      it('should refuse gh-failed when the diff read fails', async () => {
        const { api } = makeApi({
          evidence: withChecklist,
          reviews: [CODE_CLOSED, UI_CLOSED_AT_MOVED],
          changed: null,
        })

        const record = await lift(api, { isCheck: false, waitSeconds: 60 })

        expect(record.reason).toBe('gh-failed')
      })

      it('should never carry an open verdict', async () => {
        const { api } = makeApi({
          evidence: withChecklist,
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
          evidence: withChecklist,
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
        evidence: withChecklist,
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
