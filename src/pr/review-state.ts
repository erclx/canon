import {
  CHECKS_POLL_MS,
  type GateResult,
  type LiftApi,
  type LiftRefusal,
  nextPollMs,
  reviewGate,
  uiGate,
} from '@/pr/lift'
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
  readonly carriedAcross?: 'push' | 'rebase'
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
