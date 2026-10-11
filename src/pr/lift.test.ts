import { describe, expect, it } from 'vitest'
import {
  type ChecksGate,
  type EvidenceGate,
  type GitRunner,
  lift,
  type LiftApi,
  type PullState,
  readBaseStanding,
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

interface Fixture {
  pull?: Partial<PullState>
  tip?: string
  reviews?: readonly ReviewRow[]
  evidence?: Partial<EvidenceGate>
  standing?: Standing
  /** One reading per call, the last repeating. */
  checks?: readonly (ChecksGate | undefined)[]
  isMarked?: boolean
}

interface Harness {
  readonly api: LiftApi
  readonly calls: { marks: string[]; checks: number; sleeps: number[] }
}

/** The api over a fake clock that only `sleep` advances. */
function makeApi(fixture: Fixture = {}): Harness {
  const calls = { marks: [] as string[], checks: 0, sleeps: [] as number[] }
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

  it('should report already-ready and call no mutation when the mark is already off', async () => {
    const { api, calls } = makeApi({ pull: { isDraft: false } })

    const record = await lift(api, { isCheck: false, waitSeconds: 60 })

    expect(record).toMatchObject({ reason: 'already-ready', isOk: true })
    expect(calls.marks).toEqual([])
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
        reviews: [
          CODE_CLOSED,
          { body: `## UI review closed\n<!-- review-ui: head=${MOVED} -->` },
        ],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record.reason).toBe('ui-behind')
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
