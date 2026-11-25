import type {
  ChangedRead,
  ChecksGate,
  EvidenceGate,
  LiftApi,
  PullState,
  Standing,
} from '@/pr/lift'
import type { RebaseRead } from '@/pr/carry'
import type { ReviewRow } from '@/pr/review-scope'

export const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
export const READ_AT = '2026-10-12T10:00:00Z'

export const CODE_CLOSED: ReviewRow = {
  body: `## Review closed\n\nclean\n<!-- review-pr: commit=${HEAD} read-at=${READ_AT} -->`,
}

export interface Fixture {
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
  /** What the rebase comparison answers, a failed read when absent. */
  rebased?: RebaseRead
  /** The commits the head adds that are neither merges nor on the base, a failed read when absent. */
  unmerged?: readonly string[]
}

export interface Harness {
  readonly api: LiftApi
  readonly calls: {
    marks: string[]
    drafts: string[]
    reads: (readonly [string, string])[]
    rebases: (readonly [string, string])[]
    unmerged: (readonly [string, string])[]
    checks: number
    sleeps: number[]
  }
}

/** The api over a fake clock that only `sleep` advances. */
export function makeApi(fixture: Fixture = {}): Harness {
  const calls = {
    marks: [] as string[],
    drafts: [] as string[],
    reads: [] as (readonly [string, string])[],
    rebases: [] as (readonly [string, string])[],
    unmerged: [] as (readonly [string, string])[],
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
    body: '',
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
    readRebased: async (from, to) => {
      calls.rebases.push([from, to])
      return fixture.rebased
    },
    readUnmerged: async (from, to) => {
      calls.unmerged.push([from, to])
      return fixture.unmerged
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
