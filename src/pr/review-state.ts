import {
  type BaseReading,
  CHECKS_POLL_MS,
  type GateResult,
  type LiftApi,
  type LiftRefusal,
  nextPollMs,
  reviewGate,
  uiGate,
} from '@/pr/lift'
import type { CarriedAcross } from '@/pr/carry'
import { DEFAULT_PAINTED, type PaintedPatterns } from '@/pr/painted'
import {
  coversHead,
  type ReviewRow,
  type ReviewScope,
  resolveReviewScope,
  resolveUiScope,
  type UiScope,
} from '@/pr/review-scope'

/**
 * The reads the verb makes, a subset of the lift's so a worker waiting here and
 * a reviewer lifting read one answer. A read that failed returns undefined, and
 * the verb refuses `gh-failed` rather than reading absence as no pass.
 */
export type ReviewStateApi = Pick<
  LiftApi,
  | 'readReviews'
  | 'readEvidence'
  | 'readChanged'
  | 'readRebased'
  | 'readUnmerged'
  | 'sleep'
  | 'now'
> & {
  /** The branch tip from the remote, which is what a pass has to cover. */
  readTip(): Promise<string | undefined>
}

/** One family's standing at the tip. */
export interface FamilyState {
  /** The lift's refusal for this family, absent when its gate passes. */
  readonly reason?: LiftRefusal
  /**
   * True when the gate passes or the newest pass, open or unmarked, names the
   * tip. The reason cannot answer it, since the lift reads an open pass first.
   */
  readonly isCovered: boolean
  /** The commit the close covering the tip was read at, beside the record's `head`. */
  readonly carriedFrom?: string
  readonly carriedAcross?: CarriedAcross
  readonly differingPaths?: readonly string[]
}

export interface UiState extends UiScope, FamilyState {
  /** Whether the evidence comment carries a checklist, which binds the family. */
  readonly isBound: boolean
  readonly paintedPaths?: readonly string[]
  readonly drivenPaths?: readonly string[]
}

export interface ReviewStateRecord {
  readonly head: string
  readonly scope: ReviewScope
  readonly review: FamilyState
  readonly ui: UiState
}

export type ReviewStateRead =
  | { readonly kind: 'read'; readonly record: ReviewStateRecord }
  | { readonly kind: 'refused'; readonly reason: 'gh-failed' }

export type ReviewWait =
  | {
      readonly kind: 'read'
      readonly reason: 'covered' | 'timeout'
      readonly record: ReviewStateRecord
      readonly waitedSeconds: number
    }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed'
      readonly waitedSeconds: number
    }

export interface WaitOptions {
  readonly waitSeconds: number
  readonly pollMs?: number
  readonly painted?: PaintedPatterns
}

function familyOf(
  gate: GateResult,
  commit: string | undefined,
  tip: string,
): FamilyState {
  const { reason, carriedFrom, carriedAcross, differingPaths } = gate
  return {
    ...(reason !== undefined && { reason }),
    isCovered: gate.isOk || (commit !== undefined && coversHead(commit, tip)),
    ...(carriedFrom !== undefined && { carriedFrom }),
    ...(carriedAcross !== undefined && { carriedAcross }),
    ...(differingPaths !== undefined && { differingPaths }),
  }
}

/**
 * Both families at the tip through the lift's own gates, so a worker and the
 * lift never disagree on a reason. The evidence is read by the caller, since a
 * wait reads it once rather than once per poll.
 */
async function readAt(
  api: ReviewStateApi,
  hasDrivableBox: boolean,
  painted: PaintedPatterns,
): Promise<ReviewStateRead> {
  const [tip, reviews] = await Promise.all([api.readTip(), api.readReviews()])
  if (tip === undefined || reviews === undefined) {
    return { kind: 'refused', reason: 'gh-failed' }
  }

  const listing: { reviews: readonly ReviewRow[] } = { reviews }
  const scope = resolveReviewScope(listing)
  const uiScope = resolveUiScope(listing)
  const ui = await uiGate(api, painted, reviews, tip, hasDrivableBox)
  if (ui.reason === 'gh-failed') return { kind: 'refused', reason: 'gh-failed' }

  return {
    kind: 'read',
    record: {
      head: tip,
      scope,
      review: familyOf(await reviewGate(api, reviews, tip), scope.commit, tip),
      ui: {
        ...uiScope,
        ...familyOf(ui, uiScope.commit, tip),
        isBound: hasDrivableBox || uiScope.state === 'open',
        ...(ui.paintedPaths !== undefined && { paintedPaths: ui.paintedPaths }),
        ...(ui.drivenPaths !== undefined && { drivenPaths: ui.drivenPaths }),
      },
    },
  }
}

export async function readReviewState(
  api: ReviewStateApi,
  painted: PaintedPatterns = DEFAULT_PAINTED,
): Promise<ReviewStateRead> {
  const evidence = await api.readEvidence()
  if (evidence === undefined) return { kind: 'refused', reason: 'gh-failed' }
  return readAt(api, evidence.hasDrivableBox, painted)
}

/**
 * Holds until a pass covers the tip in every bound family, or the deadline.
 * The tip is reread every poll, so a push moves the target, and the evidence
 * once, since the waiting worker wrote any checklist before it started.
 */
export async function waitForReviews(
  api: ReviewStateApi,
  opts: WaitOptions,
): Promise<ReviewWait> {
  const pollMs = opts.pollMs ?? CHECKS_POLL_MS
  const painted = opts.painted ?? DEFAULT_PAINTED
  const started = api.now()
  const deadline = started + opts.waitSeconds * 1000
  const waited = () => Math.round((api.now() - started) / 1000)
  let gap = pollMs

  const evidence = await api.readEvidence()
  if (evidence === undefined) {
    return { kind: 'refused', reason: 'gh-failed', waitedSeconds: waited() }
  }

  for (;;) {
    const read = await readAt(api, evidence.hasDrivableBox, painted)
    if (read.kind === 'refused') {
      return { ...read, waitedSeconds: waited() }
    }
    const { record } = read
    if (record.review.isCovered && record.ui.isCovered) {
      return {
        kind: 'read',
        reason: 'covered',
        record,
        waitedSeconds: waited(),
      }
    }
    const left = deadline - api.now()
    if (left <= 0) {
      return {
        kind: 'read',
        reason: 'timeout',
        record,
        waitedSeconds: waited(),
      }
    }
    await api.sleep(Math.min(gap, left))
    gap = nextPollMs(gap)
  }
}

/**
 * The reads a standing wait makes. The tip and the standing are local git, so
 * a poll spends no GitHub quota, and the pull request state is read only where
 * the answer would change the ending.
 */
export interface StandingApi {
  /** The branch tip from the remote, undefined once the branch is gone or the read failed. */
  readTip(): Promise<string | undefined>
  readStanding(head: string): Promise<BaseReading>
  /** Whether the pull request is still open, undefined when the read failed. */
  readOpen(): Promise<boolean | undefined>
  sleep(ms: number): Promise<void>
  now(): number
}

export type StandingWait =
  | {
      readonly kind: 'read'
      readonly reason: 'stale'
      readonly head: string
      readonly moved: readonly string[]
      readonly waitedSeconds: number
    }
  | {
      readonly kind: 'read'
      readonly reason: 'conflict'
      readonly head: string
      readonly waitedSeconds: number
    }
  | {
      readonly kind: 'read'
      readonly reason: 'closed'
      /** Absent when the branch left the remote with the close. */
      readonly head?: string
      readonly waitedSeconds: number
    }
  | {
      readonly kind: 'read'
      readonly reason: 'timeout'
      readonly head: string
      readonly standing: 'fresh' | 'unknown'
      readonly waitedSeconds: number
    }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed'
      readonly waitedSeconds: number
    }

export interface StandingWaitOptions {
  readonly waitSeconds: number
  readonly pollMs?: number
}

/**
 * Holds until the base moves a path the branch writes, the two stop merging,
 * the pull request closes, or the deadline. Every ending reads the open state
 * first, since a squash merge reads as stale against the base it landed on.
 */
export async function waitForStanding(
  api: StandingApi,
  opts: StandingWaitOptions,
): Promise<StandingWait> {
  const started = api.now()
  const deadline = started + opts.waitSeconds * 1000
  const waited = () => Math.round((api.now() - started) / 1000)
  let gap = opts.pollMs ?? CHECKS_POLL_MS

  for (;;) {
    const head = await api.readTip()
    const reading =
      head === undefined ? undefined : await api.readStanding(head)
    const left = deadline - api.now()
    const hasMoved =
      reading?.standing === 'stale' || reading?.standing === 'conflict'

    if (reading === undefined || hasMoved || left <= 0) {
      const isOpen = await api.readOpen()
      const waitedSeconds = waited()
      if (isOpen === false) {
        return {
          kind: 'read',
          reason: 'closed',
          ...(head !== undefined && { head }),
          waitedSeconds,
        }
      }
      if (isOpen === undefined || head === undefined || reading === undefined) {
        return { kind: 'refused', reason: 'gh-failed', waitedSeconds }
      }
      if (reading.standing === 'stale') {
        const moved = reading.moved ?? []
        return { kind: 'read', reason: 'stale', head, moved, waitedSeconds }
      }
      if (reading.standing === 'conflict') {
        return { kind: 'read', reason: 'conflict', head, waitedSeconds }
      }
      const { standing } = reading
      return { kind: 'read', reason: 'timeout', head, standing, waitedSeconds }
    }

    await api.sleep(Math.min(gap, left))
    gap = nextPollMs(gap)
  }
}
