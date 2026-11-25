import type { ChecksState } from '@/targets/pulls'
import {
  type PendingMeasurement,
  pendingMeasurements,
} from '@/labels/measurement'
import { EXAMPLES_DIR, EXAMPLES_INDEX, stampedStandards } from '@/gate/examples'
import type { StalledRun } from '@/pr/checks'
import {
  coversHead,
  type ReviewRow,
  resolveReviewScope,
  resolveUiScope,
  standingPasses,
  type UiCounts,
} from '@/pr/review-scope'
import {
  type CarriedAcross,
  type RebaseRead,
  readMergeCarry,
  readRebaseCarry,
  readReelCarry as readReelCarryAcross,
  readUiCarry,
} from '@/pr/carry'
import { DEFAULT_REEL_WIDTH } from '@/pr/evidence'
import { readReelWaivers, readUndrivenWaivers, readWaivers } from '@/pr/waiver'
import { DEFAULT_PAINTED, isPainted, type PaintedPatterns } from '@/pr/painted'

/** How long `--wait` holds for a pending CI run, in seconds, when none is named. */
export const DEFAULT_WAIT_SECONDS = 1200

/** The first gap between two reads while a verb waits, which grows from here. */
export const CHECKS_POLL_MS = 30_000

/** The widest gap a wait grows to, so a pass is reported at most this late. */
export const CHECKS_POLL_CAP_MS = 120_000

/**
 * The gap after `gap`, half again up to the cap, so a wave of concurrent waits
 * on one token spends a fraction of the calls a fixed gap does. A first gap
 * already past the cap is kept rather than shrunk.
 */
export function nextPollMs(gap: number): number {
  return Math.min(gap * 1.5, Math.max(gap, CHECKS_POLL_CAP_MS))
}

/** Why the verb did not lift, in the order the gates are read. */
export type LiftRefusal =
  | 'pull-closed'
  | 'review-missing'
  | 'review-open'
  | 'review-unmarked'
  | 'review-behind'
  | 'ui-missing'
  | 'ui-open'
  | 'ui-unmarked'
  | 'ui-behind'
  | 'ui-undriven'
  | 'evidence-owed'
  | 'painted-uncaptured'
  | 'reel-unsettled'
  | 'measurement-pending'
  | 'standing-stale'
  | 'standing-conflict'
  | 'standing-unknown'
  | 'ci-pending'
  | 'ci-failing'
  | 'ci-conflicted'
  | 'ci-stalled'
  | 'ci-timeout'
  | 'head-moved'
  | 'ready-withdrawn'
  | 'gh-failed'

/** The gates a pull request clears, named so a record can report each one. */
export type GateName =
  | 'review'
  | 'ui'
  | 'evidence'
  | 'measurement'
  | 'standing'
  | 'ci'

export interface GateResult {
  readonly gate: GateName
  readonly isOk: boolean
  /** Absent when the gate passed. */
  readonly reason?: LiftRefusal
  /** The commit a close was carried forward from, when it covered an earlier head. */
  readonly carriedFrom?: string
  readonly carriedAcross?: CarriedAcross
  /** The paths whose branch diff differs across a rebase or a base merge, which kept a code review close from carrying. */
  readonly differingPaths?: readonly string[]
  /** The painted paths that kept a UI close from carrying forward. */
  readonly paintedPaths?: readonly string[]
  /** Every path a box can observe that kept a UI close from carrying forward. */
  readonly drivenPaths?: readonly string[]
  /** The boxes the newest UI verdict left undriven and waived, on a passing `ui` gate. */
  readonly undrivenWaived?: number
  /** The tip runs queued with no job past the bound, named on a `ci-stalled` refusal. */
  readonly stalled?: readonly StalledRun[]
  /** The results rows still pending, named on a `measurement-pending` refusal. */
  readonly pending?: readonly PendingRow[]
  /** The painted paths changed with no capture, reel at the head, or waiver, sorted. */
  readonly uncaptured?: readonly string[]
  /** The uncaptured paths a review waived, sorted. */
  readonly waived?: readonly string[]
  /** The posted reel skip, named when a drivable checklist has no reel at the head. */
  readonly reelSkip?: string
  /** The reason on the standing reel waiver that settled a drivable checklist with no reel. */
  readonly reelWaived?: string
  /** The reason on a standing reel waiver the gate ignored, since the skip is one no waiver settles. */
  readonly reelWaiverRefused?: string
  /** The earlier commit a reel was filmed at, when it carried to the head across pushes no box can observe. */
  readonly reelCarriedFrom?: string
  /** The commit the posted reel at the first unsettled width was filmed at, named on a `reel-unsettled` refusal when one trails the head. */
  readonly reelHead?: string
  /** The widths no reel, skip, or waiver settled, narrowest first, named on a `reel-unsettled` refusal. */
  readonly reelWidths?: readonly number[]
}

/** How an earlier commit sits against the head, and what changed since. */
export interface ChangedRead {
  /** False when the commit is rewritten away or does not resolve. */
  readonly isAncestor: boolean
  readonly paths: readonly string[]
}

/** How the head sits against the base the pull request targets. */
export type Standing = 'fresh' | 'stale' | 'conflict' | 'unknown'

/** A standing with the written or stamped paths the base changed, present only on `stale`. */
export interface BaseReading {
  readonly standing: Standing
  readonly moved?: readonly string[]
}

export interface PullState {
  readonly isDraft: boolean
  readonly isOpen: boolean
  /** The id the ready-for-review mutation takes. */
  readonly nodeId: string
  readonly branch: string
  /** The head the pull request object reports, which lags the tip. */
  readonly head: string
  /** The description, read for a results row still pending. */
  readonly body: string
}

/** A results row still pending, with the run it links and, once read, that run's state. */
export interface PendingRow extends PendingMeasurement {
  /** The run's `status` or `conclusion` from the API, absent when unread. */
  readonly state?: string
}

/** What the evidence check says about the comment the ship chain posts. */
export interface EvidenceGate {
  readonly isSettled: boolean
  readonly owed: readonly string[]
  /** Whether the marked comment's checklist holds a box a driver can run, which binds the UI gate. */
  readonly hasDrivableBox: boolean
  /**
   * The painted paths changed while no evidence image did, absent where the
   * base keeps no captures, which reads as unchecked and passes.
   */
  readonly uncaptured?: readonly string[]
  /** Each reel the marked comment embeds, with the width and head it was filmed at. */
  readonly reels?: readonly EvidenceGateReel[]
  /** The text after the marked comment's `**No reel:**` label, which names every width, when it carries one. */
  readonly reelSkip?: string
  /** The text after each `**No reel at <width>:**` label, which governs its width over `reelSkip`. */
  readonly reelSkips?: ReadonlyMap<number, string>
  /** The widths a drivable box owes a reel at. Absent or empty reads as `defaultWidth` alone. */
  readonly owedWidths?: readonly number[]
  /** The width a drivable box owes when none survives, the widest supported class's. Absent reads as 1280. */
  readonly defaultWidth?: number
}

export interface EvidenceGateReel {
  readonly width: number
  readonly head: string
}

/**
 * Reel skips that settle a drivable checklist with no reel: filter results and
 * hosting limits no builder can change. Any other text holds the lift.
 */
export const SETTLING_REEL_SKIPS: readonly string[] = [
  'no-interactive-box',
  'no-visible-change',
  'reel-too-large',
]

/**
 * Reel skips no waiver settles, since a builder clears each, bar `deferred`,
 * which ends on the controller's ask once the merge order reaches it.
 */
export const UNWAIVABLE_REEL_SKIPS: readonly string[] = [
  'target-missing',
  'target-offscreen',
  'target-covered',
  'target-ambiguous',
  'no-server',
  'deferred',
]

/** The reason code a skip line opens with, the text before its first colon. */
function reelSkipCode(skip: string): string {
  return (skip.split(':')[0] ?? '').trim()
}

/**
 * Whether an evidence record binds the UI family. A checklist binds unless
 * the record counts zero drivable boxes, so a missing or unreadable count
 * fails closed rather than reading as unbound.
 */
export function readsDrivableBox(record: {
  readonly checklist?: unknown
  readonly drivable?: unknown
}): boolean {
  if (typeof record.checklist !== 'string' || record.checklist === '') {
    return false
  }
  const { drivable } = record
  return !(
    typeof drivable === 'number' &&
    Number.isInteger(drivable) &&
    drivable === 0
  )
}

export interface ChecksGate {
  /** The state over the checks the base requires, or every check when none were read. */
  readonly state: ChecksState
  readonly isConflicted: boolean
  /** Failing checks outside the required set, which are reported and never gate. */
  readonly advisory?: readonly string[]
  /** Checks outside the required set still going, which are reported and never gate. */
  readonly running?: readonly string[]
  /**
   * Tip runs GitHub queued and never gave a job, read only on a pending,
   * unconflicted reading. Absent or empty leaves the reading `ci-pending`.
   */
  readonly stalled?: readonly StalledRun[]
}

/** The advisory field a record carries, absent when no advisory check failed. */
export function advisoryOf(reading: ChecksGate): {
  advisory?: readonly string[]
} {
  const advisory = reading.advisory ?? []
  return advisory.length > 0 ? { advisory } : {}
}

/** The running field a record carries, absent when nothing outside the required set runs. */
export function runningOf(reading: ChecksGate): {
  running?: readonly string[]
} {
  const running = reading.running ?? []
  return running.length > 0 ? { running } : {}
}

/**
 * Everything the verb reads or writes, injected so the gates and the wait run
 * without a network. A read that failed returns undefined, and the verb
 * refuses `gh-failed` rather than reading absence as a pass.
 */
export interface LiftApi {
  readPull(): Promise<PullState | undefined>
  /** The branch tip from the remote, which is the authority for the head. */
  readTip(branch: string): Promise<string | undefined>
  readReviews(): Promise<readonly ReviewRow[] | undefined>
  readEvidence(): Promise<EvidenceGate | undefined>
  readStanding(head: string): Promise<Standing>
  readChecks(tip: string): Promise<ChecksGate | undefined>
  /** The one GraphQL call the verb makes. */
  markReady(nodeId: string): Promise<boolean>
  /** The paths changed from an earlier commit to the head, undefined when the read failed. */
  readChanged(from: string, to: string): Promise<ChangedRead | undefined>
  /** The branch diff compared at an earlier commit and the head, undefined when the read failed. */
  readRebased(from: string, to: string): Promise<RebaseRead | undefined>
  /** The commits from an earlier commit to the head that are neither merges nor on the base, undefined when the read failed. */
  readUnmerged(from: string, to: string): Promise<readonly string[] | undefined>
  /** The one GraphQL call that returns a ready pull request to draft. */
  markDraft(nodeId: string): Promise<boolean>
  sleep(ms: number): Promise<void>
  now(): number
}

export interface LiftOptions {
  readonly isCheck: boolean
  readonly waitSeconds: number
  readonly pollMs?: number
  readonly painted?: PaintedPatterns
}

export interface LiftRecord {
  readonly reason:
    | 'lifted'
    | 'already-ready'
    | 'redrafted'
    | 'clear'
    | LiftRefusal
  /** The gate that read not clear when a ready pull request went back to draft. */
  readonly failed?: LiftRefusal
  readonly carriedFrom?: string
  readonly reviewCarriedFrom?: string
  readonly paintedPaths?: readonly string[]
  readonly drivenPaths?: readonly string[]
  /** The tip runs queued with no job past the bound, on a `ci-stalled` refusal. */
  readonly stalled?: readonly StalledRun[]
  /** The results rows still pending, on a `measurement-pending` refusal. */
  readonly pending?: readonly PendingRow[]
  /** Failing checks the base does not require, named so a reader sees them before merging. */
  readonly advisory?: readonly string[]
  /**
   * Checks the base does not require still going at the head, which never gate,
   * named so a reader waiting on every check knows the head has not settled.
   */
  readonly running?: readonly string[]
  readonly isLifted: boolean
  /** Whether the caller can treat the pull request as ready afterwards. */
  readonly isOk: boolean
  /**
   * Whether the pull request is out of draft when the verb returns, carried on
   * the ready path alone. A refusal beside it names a gate that holds the merge
   * rather than the mark.
   */
  readonly isReady?: boolean
  readonly head?: string
  readonly gates: readonly GateResult[]
  readonly waitedSeconds: number
}

function pass(gate: GateName): GateResult {
  return { gate, isOk: true }
}

function fail(gate: GateName, reason: LiftRefusal): GateResult {
  return { gate, isOk: false, reason }
}

/**
 * The code review gate. An unmarked pass is refused, since its commit is a
 * submission stamp. A close carries across a rebase or base merges leaving
 * every branch path equal, never across a commit of the branch's own.
 */
export async function reviewGate(
  api: Pick<LiftApi, 'readChanged' | 'readRebased' | 'readUnmerged'>,
  reviews: readonly ReviewRow[],
  head: string,
): Promise<GateResult> {
  const scope = resolveReviewScope({ reviews })
  if (scope.state === 'none') return fail('review', 'review-missing')
  if (scope.state === 'open') return fail('review', 'review-open')
  if (scope.source !== 'marker') return fail('review', 'review-unmarked')
  if (scope.commit === undefined) return fail('review', 'review-behind')
  if (coversHead(scope.commit, head)) return pass('review')

  const changed = await api.readChanged(scope.commit, head)
  if (changed === undefined) return fail('review', 'review-behind')
  const readRebased = (from: string, to: string) => api.readRebased(from, to)
  const carry = changed.isAncestor
    ? await readMergeCarry(
        {
          readUnmerged: (from, to) => api.readUnmerged(from, to),
          readRebased,
        },
        scope.commit,
        head,
      )
    : await readRebaseCarry(readRebased, scope.commit, head)
  if (carry.kind === 'rebased' || carry.kind === 'merged') {
    return {
      ...pass('review'),
      carriedFrom: carry.carriedFrom,
      carriedAcross: carry.kind === 'rebased' ? 'rebase' : 'merge',
    }
  }
  return {
    ...fail('review', 'review-behind'),
    ...(carry.kind === 'changed' && { differingPaths: carry.differingPaths }),
  }
}

/**
 * What the review gates say about a close carried across commits, and the
 * runs the ci gate found stalled, lifted from the gates onto a record.
 */
function carried(gates: readonly GateResult[]): {
  carriedFrom?: string
  reviewCarriedFrom?: string
  paintedPaths?: readonly string[]
  drivenPaths?: readonly string[]
  stalled?: readonly StalledRun[]
  pending?: readonly PendingRow[]
} {
  const measurement = gates.find((gate) => gate.gate === 'measurement')
  const review = gates.find((gate) => gate.gate === 'review')
  const ui = gates.find((gate) => gate.gate === 'ui')
  const ci = gates.find((gate) => gate.gate === 'ci')
  return {
    ...(ui?.carriedFrom !== undefined && { carriedFrom: ui.carriedFrom }),
    ...(review?.carriedFrom !== undefined && {
      reviewCarriedFrom: review.carriedFrom,
    }),
    ...(ui?.paintedPaths !== undefined && { paintedPaths: ui.paintedPaths }),
    ...(ui?.drivenPaths !== undefined && { drivenPaths: ui.drivenPaths }),
    ...(ci?.stalled !== undefined && { stalled: ci.stalled }),
    ...(measurement?.pending !== undefined && {
      pending: measurement.pending,
    }),
  }
}

/**
 * Holds the pull request while a results row reads pending, whatever the title.
 * It sits outside the re-draft gates, since a pending run says nothing about
 * whether the ready mark was earned.
 */
export function measurementGate(body: string): GateResult {
  const pending = pendingMeasurements(body)
  if (pending.length === 0) return pass('measurement')
  return { ...fail('measurement', 'measurement-pending'), pending }
}

/**
 * Whether a verdict's counts show boxes left undriven and none driven. An empty
 * pass, with nothing not driven either, looked at no box because none was owed.
 */
function droveNothing(counts: UiCounts | undefined): boolean {
  return (
    counts !== undefined &&
    counts.failed === 0 &&
    counts.eyes === 0 &&
    counts.passed === 0 &&
    counts.notDriven > 0
  )
}

/**
 * Whether the newest UI verdict waives exactly the boxes it left undriven. Only
 * that verdict's own body is read, since an older one waived a different pass.
 */
function waivesUndriven(
  reviews: readonly ReviewRow[],
  notDriven: number,
): boolean {
  const verdict = reviews.findLast(
    (row) => resolveUiScope({ reviews: [row] }).state !== 'none',
  )
  const standing = verdict === undefined ? [] : standingPasses([verdict])
  return readUndrivenWaivers(standing).includes(notDriven)
}

/**
 * Binds only where the evidence record carries a checklist to drive. A close
 * behind the head holds, its waiver with it, across what `readUiCarry` carries,
 * and a refusal names `drivenPaths` with the painted subset beside it.
 */
export async function uiGate(
  api: Pick<LiftApi, 'readChanged' | 'readRebased' | 'readUnmerged'>,
  painted: PaintedPatterns,
  reviews: readonly ReviewRow[],
  head: string,
  hasDrivableBox: boolean,
): Promise<GateResult> {
  const scope = resolveUiScope({ reviews })
  // An open verdict holds even with no drivable box left, so a dropped box never clears it.
  if (scope.state === 'open') return fail('ui', 'ui-open')
  if (!hasDrivableBox) return pass('ui')
  if (scope.state === 'none') return fail('ui', 'ui-missing')
  if (scope.source !== 'marker') return fail('ui', 'ui-unmarked')
  if (scope.commit === undefined) return fail('ui', 'ui-behind')
  // Before the head test, so a carried close is refused too. An unparsed count reads unchecked.
  const notDriven = scope.counts?.notDriven ?? 0
  if (
    notDriven > 0 &&
    (droveNothing(scope.counts) || !waivesUndriven(reviews, notDriven))
  ) {
    return fail('ui', 'ui-undriven')
  }
  const waived = notDriven > 0 && { undrivenWaived: notDriven }

  const carry = await readUiCarry(
    {
      readChanged: (from, to) => api.readChanged(from, to),
      readRebased: (from, to) => api.readRebased(from, to),
      readUnmerged: (from, to) => api.readUnmerged(from, to),
    },
    scope.commit,
    head,
  )
  if (carry.kind === 'covered') return { ...pass('ui'), ...waived }
  if (carry.kind === 'failed') return fail('ui', 'gh-failed')
  if (carry.kind === 'behind') return fail('ui', 'ui-behind')
  if (carry.kind === 'carried') {
    const { carriedFrom, carriedAcross } = carry
    return { ...pass('ui'), carriedFrom, carriedAcross, ...waived }
  }

  const paintedPaths = carry.drivenPaths.filter((path) =>
    isPainted(path, painted),
  )
  return {
    ...fail('ui', 'ui-behind'),
    ...(paintedPaths.length > 0 && { paintedPaths }),
    drivenPaths: carry.drivenPaths,
  }
}

/** How one owed width settled, or that it did not. */
type WidthSettle =
  | { readonly kind: 'filmed' }
  | { readonly kind: 'carried'; readonly from: string }
  | { readonly kind: 'skipped'; readonly skip: string }
  | { readonly kind: 'waived'; readonly skip?: string; readonly reason: string }
  | {
      readonly kind: 'unsettled'
      readonly skip?: string
      readonly refusedWaiver?: string
    }

/**
 * One width, settled in the gate's order: a reel at the head, one carried to
 * it, a skip no builder can change, then a standing waiver over any skip but
 * an unwaivable one. The width's own skip line governs it over the bare one.
 */
function settleWidth(
  width: number,
  evidence: EvidenceGate,
  head: string,
  carriedFrom: ReadonlyMap<number, string>,
  waiver: string | undefined,
): WidthSettle {
  const reel = evidence.reels?.find((entry) => entry.width === width)
  if (reel !== undefined && coversHead(reel.head, head)) {
    return { kind: 'filmed' }
  }
  const from = carriedFrom.get(width)
  if (from !== undefined) return { kind: 'carried', from }
  const skip = evidence.reelSkips?.get(width) ?? evidence.reelSkip
  const code = skip === undefined ? undefined : reelSkipCode(skip)
  if (skip !== undefined && SETTLING_REEL_SKIPS.includes(code ?? '')) {
    return { kind: 'skipped', skip }
  }
  const skipField = skip !== undefined && { skip }
  if (waiver === undefined) return { kind: 'unsettled', ...skipField }
  if (code !== undefined && UNWAIVABLE_REEL_SKIPS.includes(code)) {
    return { kind: 'unsettled', ...skipField, refusedWaiver: waiver }
  }
  return { kind: 'waived', ...skipField, reason: waiver }
}

/**
 * Refuses an owed step, an uncaptured painted path no head reel or restated
 * waiver covers, then a drivable checklist leaving a width it owes that no
 * reel, skip, or waiver settles, naming those widths as `reelWidths`.
 */
export function evidenceGate(
  evidence: EvidenceGate,
  reviews: readonly ReviewRow[],
  head: string,
  carriedFrom: ReadonlyMap<number, string> = new Map(),
): GateResult {
  if (!evidence.isSettled) return fail('evidence', 'evidence-owed')

  const standing = standingPasses(reviews)
  const isAtHead = (evidence.reels ?? []).some((reel) =>
    coversHead(reel.head, head),
  )
  const isFilmed = isAtHead || carriedFrom.size > 0
  const listed = isFilmed ? [] : (evidence.uncaptured ?? [])
  const named = new Set(readWaivers(standing).map((waiver) => waiver.path))
  const waived = listed.filter((path) => named.has(path)).toSorted()
  const uncaptured = listed.filter((path) => !named.has(path)).toSorted()

  const lists = {
    ...(uncaptured.length > 0 && { uncaptured }),
    ...(waived.length > 0 && { waived }),
  }
  if (uncaptured.length > 0) {
    return { ...fail('evidence', 'painted-uncaptured'), ...lists }
  }
  const firstCarried = isAtHead ? undefined : [...carriedFrom.values()][0]
  const carriedField = firstCarried !== undefined && {
    reelCarriedFrom: firstCarried,
  }
  if (!evidence.hasDrivableBox) {
    return { ...pass('evidence'), ...lists, ...carriedField }
  }

  // A drivable box with no width read owes the default, so an unread checklist fails closed.
  const owed =
    evidence.owedWidths !== undefined && evidence.owedWidths.length > 0
      ? evidence.owedWidths
      : [evidence.defaultWidth ?? DEFAULT_REEL_WIDTH]
  const waiver = readReelWaivers(standing).at(-1)
  const settles = owed.map((width) => ({
    width,
    settle: settleWidth(width, evidence, head, carriedFrom, waiver),
  }))
  const left = settles.filter(({ settle }) => settle.kind === 'unsettled')

  if (left.length > 0) {
    const first = left[0]?.settle
    const trailing = evidence.reels?.find(
      (reel) => reel.width === left[0]?.width,
    )?.head
    const refused = left
      .map(({ settle }) =>
        settle.kind === 'unsettled' ? settle.refusedWaiver : undefined,
      )
      .find((reason) => reason !== undefined)
    return {
      ...fail('evidence', 'reel-unsettled'),
      ...lists,
      ...(first?.kind === 'unsettled' &&
        first.skip !== undefined && { reelSkip: first.skip }),
      ...(trailing !== undefined && { reelHead: trailing }),
      reelWidths: left.map(({ width }) => width),
      ...(refused !== undefined && { reelWaiverRefused: refused }),
    }
  }

  const carriedFromWidth = settles
    .map(({ settle }) => (settle.kind === 'carried' ? settle.from : undefined))
    .find((from) => from !== undefined)
  const reelSkip = settles
    .map(({ settle }) =>
      settle.kind === 'skipped' || settle.kind === 'waived'
        ? settle.skip
        : undefined,
    )
    .find((skip) => skip !== undefined)
  const reelWaived = settles.some(({ settle }) => settle.kind === 'waived')
  return {
    ...pass('evidence'),
    ...lists,
    ...(carriedFromWidth !== undefined && {
      reelCarriedFrom: carriedFromWidth,
    }),
    ...(reelSkip !== undefined && { reelSkip }),
    ...(reelWaived && waiver !== undefined && { reelWaived: waiver }),
  }
}

/**
 * The commit each reel filmed before the head carries from, by width, when no
 * later push moved a `reelMoves` path the branch wrote. A rewritten commit or failed read
 * carries nothing, and a reel at the head needs no carry.
 */
async function readReelCarry(
  api: Pick<LiftApi, 'readChanged' | 'readRebased' | 'readUnmerged'>,
  painted: PaintedPatterns,
  evidence: EvidenceGate,
  head: string,
): Promise<ReadonlyMap<number, string>> {
  const trailing = (evidence.reels ?? []).filter(
    (reel) => !coversHead(reel.head, head),
  )
  const carries = await Promise.all(
    trailing.map(async (reel) => {
      const carry = await readReelCarryAcross(
        {
          readChanged: (from, to) => api.readChanged(from, to),
          readRebased: (from, to) => api.readRebased(from, to),
          readUnmerged: (from, to) => api.readUnmerged(from, to),
        },
        painted,
        reel.head,
        head,
      )
      return carry.kind === 'carried'
        ? ([[reel.width, carry.carriedFrom]] as const)
        : []
    }),
  )
  return new Map(carries.flat())
}

function standingGate(standing: Standing): GateResult {
  if (standing === 'fresh') return pass('standing')
  return fail('standing', `standing-${standing}`)
}

type CiOutcome =
  | {
      readonly kind: 'passing'
      readonly waited: number
      readonly reading: ChecksGate
    }
  | {
      readonly kind: 'refused'
      readonly reason: LiftRefusal
      readonly waited: number
      readonly stalled?: readonly StalledRun[]
    }

/** The ci gate a refused wait leaves, carrying the runs a stall named. */
function ciRefused(ci: Extract<CiOutcome, { kind: 'refused' }>): GateResult {
  return {
    ...fail('ci', ci.reason),
    ...(ci.stalled !== undefined && { stalled: ci.stalled }),
  }
}

/**
 * Waits on the check runs, ending early on a conflict, which gets no merge ref,
 * and on a stall, since no measured stall cleared without a close and reopen.
 */
async function waitForChecks(
  api: LiftApi,
  tip: string,
  waitSeconds: number,
  pollMs: number,
): Promise<CiOutcome> {
  const started = api.now()
  const deadline = started + waitSeconds * 1000
  let gap = pollMs

  for (;;) {
    const reading = await api.readChecks(tip)
    const waited = Math.round((api.now() - started) / 1000)
    if (reading === undefined) {
      return { kind: 'refused', reason: 'gh-failed', waited }
    }
    if (reading.state === 'passing') {
      return { kind: 'passing', waited, reading }
    }
    if (reading.state === 'failing') {
      return { kind: 'refused', reason: 'ci-failing', waited }
    }
    if (reading.isConflicted) {
      return { kind: 'refused', reason: 'ci-conflicted', waited }
    }
    if (reading.stalled !== undefined && reading.stalled.length > 0) {
      return {
        kind: 'refused',
        reason: 'ci-stalled',
        waited,
        stalled: reading.stalled,
      }
    }
    const left = deadline - api.now()
    if (left <= 0) return { kind: 'refused', reason: 'ci-timeout', waited }
    await api.sleep(Math.min(gap, left))
    gap = nextPollMs(gap)
  }
}

function refused(
  reason: LiftRefusal,
  gates: readonly GateResult[],
  head: string | undefined,
  waitedSeconds = 0,
): LiftRecord {
  return {
    reason,
    isLifted: false,
    isOk: false,
    ...(head !== undefined && { head }),
    gates,
    waitedSeconds,
    ...carried(gates),
  }
}

/** The gates whose failure sends a ready pull request back to draft. */
const REDRAFT_GATES: readonly GateName[] = ['review', 'ui', 'evidence']

/** The ci gate one reading of the check runs gives, read once and never waited on. */
function ciGate(reading: ChecksGate): GateResult {
  if (reading.state === 'passing') return pass('ci')
  if (reading.state === 'failing') return fail('ci', 'ci-failing')
  if (reading.isConflicted) return fail('ci', 'ci-conflicted')
  if (reading.stalled !== undefined && reading.stalled.length > 0) {
    return { ...fail('ci', 'ci-stalled'), stalled: reading.stalled }
  }
  return fail('ci', 'ci-pending')
}

/** Marks a record as one whose pull request is out of draft when the verb returns. */
function stillReady(record: LiftRecord): LiftRecord {
  return { ...record, isReady: true }
}

function alreadyReady(
  gates: readonly GateResult[],
  head: string,
  waitedSeconds: number,
  reading: ChecksGate,
): LiftRecord {
  return stillReady({
    reason: 'already-ready',
    isLifted: false,
    isOk: true,
    head,
    gates,
    waitedSeconds,
    ...carried(gates),
    ...advisoryOf(reading),
    ...runningOf(reading),
  })
}

/** Returns a ready pull request to draft on a gate its ready mark vouched for. */
async function redraft(
  api: LiftApi,
  pull: PullState,
  tip: string,
  gates: readonly GateResult[],
  reason: LiftRefusal,
): Promise<LiftRecord> {
  if (reason === 'gh-failed') return stillReady(refused(reason, gates, tip))

  const isDrafted = await api.markDraft(pull.nodeId)
  if (!isDrafted) return stillReady(refused('gh-failed', gates, tip))

  return {
    reason: 'redrafted',
    failed: reason,
    isLifted: false,
    isOk: false,
    isReady: false,
    head: tip,
    gates,
    waitedSeconds: 0,
    ...carried(gates),
  }
}

/**
 * `already-ready` only when every gate reads clear at the tip. A review, UI, or
 * evidence failure re-drafts, and a standing or CI one writes nothing, to avoid a flap.
 */
async function settleReady(
  api: LiftApi,
  opts: LiftOptions,
  resolved: { readonly pollMs: number; readonly painted: PaintedPatterns },
  pull: PullState,
  tip: string,
  gates: readonly GateResult[],
  evidence: EvidenceGate,
): Promise<LiftRecord> {
  const { pollMs, painted } = resolved
  const { hasDrivableBox } = evidence
  if (opts.isCheck) {
    const reading = await api.readChecks(tip)
    if (reading === undefined) {
      return stillReady(refused('gh-failed', gates, tip))
    }
    const all = [...gates, ciGate(reading)]
    const first = all.find((gate) => !gate.isOk)
    if (first?.reason !== undefined) {
      return stillReady(refused(first.reason, all, tip))
    }
    return alreadyReady(all, tip, 0, reading)
  }

  // Redraft gates list first, so a standing failure lands here only while the mark holds.
  const blocked = gates.find((gate) => !gate.isOk)
  if (blocked?.reason !== undefined) {
    return REDRAFT_GATES.includes(blocked.gate)
      ? redraft(api, pull, tip, gates, blocked.reason)
      : stillReady(refused(blocked.reason, gates, tip))
  }

  const ci = await waitForChecks(api, tip, opts.waitSeconds, pollMs)
  if (ci.kind === 'refused') {
    const failed = [...gates, ciRefused(ci)]
    return stillReady(refused(ci.reason, failed, tip, ci.waited))
  }
  return settleAfterWait(api, painted, pull, tip, hasDrivableBox, gates, ci)
}

/**
 * Re-reads head, reviews, standing, and draft state after the CI wait, since a
 * session may have moved any of them. CI at `tip` vouches only for `tip`.
 */
async function settleAfterWait(
  api: LiftApi,
  painted: PaintedPatterns,
  pull: PullState,
  tip: string,
  hasDrivableBox: boolean,
  gates: readonly GateResult[],
  ci: Extract<CiOutcome, { kind: 'passing' }>,
): Promise<LiftRecord> {
  const cleared = [...gates, pass('ci')]
  const [nowPull, nowTip, nowReviews] = await Promise.all([
    api.readPull(),
    api.readTip(pull.branch),
    api.readReviews(),
  ])
  if (
    nowPull === undefined ||
    nowTip === undefined ||
    nowReviews === undefined
  ) {
    const record = refused('gh-failed', cleared, tip, ci.waited)
    return pull.isDraft ? record : stillReady(record)
  }
  const refuse = (reason: LiftRefusal, head: string): LiftRecord => {
    const record = refused(reason, cleared, head, ci.waited)
    return nowPull.isDraft ? record : stillReady(record)
  }
  if (nowTip !== tip) return refuse('head-moved', nowTip)

  const reread = [
    await reviewGate(api, nowReviews, nowTip),
    await uiGate(api, painted, nowReviews, nowTip, hasDrivableBox),
  ].find((gate) => !gate.isOk)
  if (reread?.reason !== undefined) return refuse(reread.reason, nowTip)

  // Standing is re-read, since a sibling merging during the wait can make it stale.
  const laterStanding = standingGate(await api.readStanding(nowTip))
  if (laterStanding.reason !== undefined) {
    return refuse(laterStanding.reason, nowTip)
  }

  if (!nowPull.isDraft) {
    return alreadyReady(cleared, nowTip, ci.waited, ci.reading)
  }
  // Evidence is not re-read, so re-marking would undo a draft written during the wait.
  if (!pull.isDraft) return refuse('ready-withdrawn', nowTip)

  const isMarked = await api.markReady(pull.nodeId)
  if (!isMarked) return refuse('gh-failed', nowTip)

  return {
    reason: 'lifted',
    isLifted: true,
    isOk: true,
    isReady: true,
    head: nowTip,
    gates: cleared,
    waitedSeconds: ci.waited,
    ...carried(cleared),
    ...advisoryOf(ci.reading),
    ...runningOf(ci.reading),
  }
}

/**
 * Lifts the draft mark when every gate reads clear at the head. Gates needing
 * no wait run first, so a reviewer refuses at once rather than through a CI run.
 */
export async function lift(
  api: LiftApi,
  opts: LiftOptions,
): Promise<LiftRecord> {
  const pollMs = opts.pollMs ?? CHECKS_POLL_MS
  const painted = opts.painted ?? DEFAULT_PAINTED

  const pull = await api.readPull()
  if (pull === undefined) return refused('gh-failed', [], undefined)
  if (!pull.isOpen) return refused('pull-closed', [], pull.head)

  // The tip, since the object's head lags the ref up to a minute after a push.
  const tip = await api.readTip(pull.branch)
  if (tip === undefined) return refused('gh-failed', [], pull.head)

  const [reviews, evidence, standing] = await Promise.all([
    api.readReviews(),
    api.readEvidence(),
    api.readStanding(tip),
  ])
  if (reviews === undefined || evidence === undefined) {
    return refused('gh-failed', [], tip)
  }

  const gates: GateResult[] = [
    await reviewGate(api, reviews, tip),
    await uiGate(api, painted, reviews, tip, evidence.hasDrivableBox),
    evidenceGate(
      evidence,
      reviews,
      tip,
      await readReelCarry(api, painted, evidence, tip),
    ),
    measurementGate(pull.body),
    standingGate(standing),
  ]
  if (!pull.isDraft) {
    return settleReady(
      api,
      opts,
      { pollMs, painted },
      pull,
      tip,
      gates,
      evidence,
    )
  }

  const blocked = gates.find((gate) => !gate.isOk)

  if (opts.isCheck) {
    const reading = await api.readChecks(tip)
    if (reading === undefined) {
      return refused('gh-failed', gates, tip)
    }
    const all = [...gates, ciGate(reading)]
    const first = all.find((gate) => !gate.isOk)
    if (first?.reason !== undefined) return refused(first.reason, all, tip)
    return {
      reason: 'clear',
      isLifted: false,
      isOk: true,
      head: tip,
      gates: all,
      waitedSeconds: 0,
      ...carried(all),
      ...advisoryOf(reading),
      ...runningOf(reading),
    }
  }

  if (blocked?.reason !== undefined) return refused(blocked.reason, gates, tip)

  const ci = await waitForChecks(api, tip, opts.waitSeconds, pollMs)
  if (ci.kind === 'refused') {
    return refused(ci.reason, [...gates, ciRefused(ci)], tip, ci.waited)
  }
  return settleAfterWait(
    api,
    painted,
    pull,
    tip,
    evidence.hasDrivableBox,
    gates,
    ci,
  )
}

/** One git invocation, answering its stdout or undefined when it failed. */
export type GitRunner = (args: readonly string[]) => Promise<string | undefined>

function nonEmptyLines(output: string): string[] {
  return output.split('\n').filter((line) => line !== '')
}

/**
 * The standards the examples gate stage stamps at the head, for a branch writing
 * an example, since a base edit to one fails that stage after the merge. A head
 * with no index stamps nothing, and a failed read answers undefined.
 */
async function readStampedPaths(
  git: GitRunner,
  head: string,
  writes: readonly string[],
): Promise<readonly string[] | undefined> {
  if (!writes.some((path) => path.startsWith(`${EXAMPLES_DIR}/`))) return []

  // Listed first, since `git show` fails alike on an absent file and a failed read.
  const listed = await git([
    'ls-tree',
    '--full-tree',
    '--name-only',
    head,
    '--',
    EXAMPLES_INDEX,
  ])
  if (listed === undefined) return undefined
  if (nonEmptyLines(listed).length === 0) return []

  const source = await git(['show', `${head}:${EXAMPLES_INDEX}`])
  return source === undefined ? undefined : stampedStandards(source)
}

/**
 * The orchestrator poll's read, through merge-tree since `mergeable_state` is
 * unknown while computed. Only a base change to a path the branch writes, or a
 * standard its examples stamp, makes it stale.
 */
export async function readBaseStanding(
  git: GitRunner,
  number: number,
  head: string,
  ref: string,
): Promise<Standing> {
  return (await readBaseReading(git, number, head, ref)).standing
}

/**
 * The standing `readBaseStanding` answers, read from the fork point, with the
 * paths that made it stale so a refusal can name the collision.
 */
export async function readBaseReading(
  git: GitRunner,
  number: number,
  head: string,
  ref: string,
): Promise<BaseReading> {
  // A failed base fetch leaves the last fetched ref, where a sibling merged since reads as fresh.
  const baseBranch = ref.startsWith('origin/')
    ? ref.slice('origin/'.length)
    : ref
  if ((await git(['fetch', '-q', 'origin', baseBranch])) === undefined) {
    return { standing: 'unknown' }
  }
  await git(['fetch', '-q', 'origin', `pull/${number}/head`])

  const hasHead =
    (await git(['cat-file', '-e', `${head}^{commit}`])) !== undefined
  const hasRef = (await git(['rev-parse', '--verify', '-q', ref])) !== undefined
  if (!hasHead || !hasRef) return { standing: 'unknown' }

  const merged = await git(['merge-tree', '--write-tree', ref, head])
  if (merged === undefined) return { standing: 'conflict' }

  const forkPoint = (await git(['merge-base', ref, head]))?.trim()
  if (forkPoint === undefined || forkPoint === '')
    return { standing: 'unknown' }

  const written = await git([
    'diff',
    '--name-only',
    '--no-renames',
    forkPoint,
    head,
  ])
  if (written === undefined) return { standing: 'unknown' }

  const paths = nonEmptyLines(written)
  if (paths.length === 0) return { standing: 'fresh' }

  const stamped = await readStampedPaths(git, head, paths)
  if (stamped === undefined) return { standing: 'unknown' }

  const moved = await git([
    '--literal-pathspecs',
    'diff',
    '--name-only',
    '--no-renames',
    forkPoint,
    ref,
    '--',
    ...paths,
    ...stamped,
  ])
  if (moved === undefined) return { standing: 'unknown' }

  const changed = nonEmptyLines(moved)
  return changed.length > 0
    ? { standing: 'stale', moved: changed }
    : { standing: 'fresh' }
}

/**
 * A close that is not an ancestor carries nothing, and a failed head or diff
 * read refuses. Renames split so a move out of a painted path still paints.
 */
export async function readChangedPaths(
  git: GitRunner,
  from: string,
  to: string,
): Promise<ChangedRead | undefined> {
  if ((await git(['cat-file', '-e', `${to}^{commit}`])) === undefined) {
    return undefined
  }

  const full = (
    await git(['rev-parse', '--verify', '-q', `${from}^{commit}`])
  )?.trim()
  if (full === undefined || full === '') return { isAncestor: false, paths: [] }

  const base = (await git(['merge-base', full, to]))?.trim()
  if (base !== full) return { isAncestor: false, paths: [] }

  const diff = await git(['diff', '--name-only', '--no-renames', full, to])
  if (diff === undefined) return undefined

  return { isAncestor: true, paths: nonEmptyLines(diff) }
}

/**
 * The commits from `from` to `to` that are neither merges nor on `ref`. A range
 * holding no merge lists every commit without fetching the base, since it can
 * carry nothing. Any read that fails answers undefined.
 */
export async function readUnmergedCommits(
  git: GitRunner,
  ref: string,
  from: string,
  to: string,
): Promise<readonly string[] | undefined> {
  const full = (
    await git(['rev-parse', '--verify', '-q', `${from}^{commit}`])
  )?.trim()
  if (full === undefined || full === '') return undefined
  const range = [to, `^${full}`]

  const merges = (
    await git(['rev-list', '--min-parents=2', '--count', ...range])
  )?.trim()
  if (merges === undefined || !/^\d+$/.test(merges)) return undefined
  if (merges === '0') {
    const commits = await git(['rev-list', ...range])
    return commits === undefined ? undefined : nonEmptyLines(commits)
  }

  if (ref.startsWith('origin/')) {
    await git(['fetch', '-q', 'origin', ref.slice('origin/'.length)])
  }
  const commits = await git(['rev-list', '--no-merges', ...range, `^${ref}`])
  return commits === undefined ? undefined : nonEmptyLines(commits)
}

const FILE_HEADER = 'diff --git '

/**
 * One patch text per path, without the blob ids and hunk line numbers a rebase
 * shifts. Context stays, so a base change beside the branch's own differs. A
 * quoted path stays quoted, as `--name-only` spells it, matching no inert glob.
 */
function patchesByPath(patch: string): Map<string, string> {
  const files = new Map<string, string>()
  let path: string | undefined
  let lines: string[] = []
  const flush = () => {
    if (path !== undefined) files.set(path, lines.join('\n'))
  }
  for (const line of patch.replace(/\n+$/, '').split('\n')) {
    if (line.startsWith(FILE_HEADER)) {
      flush()
      const sides = line.slice(FILE_HEADER.length)
      const old = sides.slice(0, (sides.length - 1) / 2)
      path = old.startsWith('"') ? `"${old.slice(3)}` : old.slice(2)
      lines = []
    } else if (line.startsWith('@@')) {
      lines.push('@@')
    } else if (!line.startsWith('index ')) {
      lines.push(line)
    }
  }
  flush()
  return files
}

/**
 * Which paths of the branch's own diff differ between a reviewed commit and a
 * head, each diffed against its own merge base with `ref`. Any read that fails
 * answers undefined, which carries nothing.
 */
export async function readRebasedPaths(
  git: GitRunner,
  ref: string,
  from: string,
  to: string,
): Promise<RebaseRead | undefined> {
  if (ref.startsWith('origin/')) {
    await git(['fetch', '-q', 'origin', ref.slice('origin/'.length)])
  }
  const branchDiff = async (commit: string) => {
    const base = (await git(['merge-base', ref, commit]))?.trim()
    if (base === undefined || base === '') return undefined
    const patch = await git([
      'diff',
      '--no-renames',
      '--binary',
      '--no-color',
      '--no-ext-diff',
      '--no-textconv',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      base,
      commit,
    ])
    return patch === undefined ? undefined : patchesByPath(patch)
  }

  const full = (
    await git(['rev-parse', '--verify', '-q', `${from}^{commit}`])
  )?.trim()
  if (full === undefined || full === '') return undefined
  const [before, after] = await Promise.all([branchDiff(full), branchDiff(to)])
  if (before === undefined || after === undefined) return undefined

  const ownPaths = [...new Set([...before.keys(), ...after.keys()])].toSorted()
  const differingPaths = ownPaths.filter(
    (path) => before.get(path) !== after.get(path),
  )
  return { differingPaths, ownPaths }
}
