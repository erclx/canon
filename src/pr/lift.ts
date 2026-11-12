import type { ChecksState } from '@/targets/pulls'
import type { StalledRun } from '@/pr/checks'
import {
  coversHead,
  type ReviewRow,
  resolveReviewScope,
  resolveUiScope,
  standingPasses,
  type UiCounts,
} from '@/pr/review-scope'
import { isInert, readCarry } from '@/pr/carry'
import { readReelWaivers, readWaivers } from '@/pr/waiver'
import { DEFAULT_PAINTED, isPainted, type PaintedPatterns } from '@/pr/painted'

/** How long `--wait` holds for a pending CI run, in seconds, when none is named. */
export const DEFAULT_WAIT_SECONDS = 1200

/** The gap between two reads of the check runs while the verb waits on them. */
export const CHECKS_POLL_MS = 30_000

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
export type GateName = 'review' | 'ui' | 'evidence' | 'standing' | 'ci'

export interface GateResult {
  readonly gate: GateName
  readonly isOk: boolean
  /** Absent when the gate passed. */
  readonly reason?: LiftRefusal
  /** The commit a UI close was carried forward from, when it covered an earlier head. */
  readonly carriedFrom?: string
  /** The painted paths that kept a UI close from carrying forward. */
  readonly paintedPaths?: readonly string[]
  /** Every path a box can observe that kept a UI close from carrying forward. */
  readonly drivenPaths?: readonly string[]
  /** The tip runs queued with no job past the bound, named on a `ci-stalled` refusal. */
  readonly stalled?: readonly StalledRun[]
  /** The painted paths changed with no capture, reel at the head, or waiver, sorted. */
  readonly uncaptured?: readonly string[]
  /** The uncaptured paths a review waived, sorted. */
  readonly waived?: readonly string[]
  /** The posted reel skip, named when a drivable checklist has no reel at the head. */
  readonly reelSkip?: string
  /** The reason on the standing reel waiver that settled a drivable checklist with no reel. */
  readonly reelWaived?: string
  /** The earlier commit a reel was filmed at, when it carried to the head across pushes no box can observe. */
  readonly reelCarriedFrom?: string
}

/** How an earlier commit sits against the head, and what changed since. */
export interface ChangedRead {
  /** False when the commit is rewritten away or does not resolve. */
  readonly isAncestor: boolean
  readonly paths: readonly string[]
}

/** How the head sits against the base the pull request targets. */
export type Standing = 'fresh' | 'stale' | 'conflict' | 'unknown'

export interface PullState {
  readonly isDraft: boolean
  readonly isOpen: boolean
  /** The id the ready-for-review mutation takes. */
  readonly nodeId: string
  readonly branch: string
  /** The head the pull request object reports, which lags the tip. */
  readonly head: string
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
  /** The head the marked comment's reel was filmed at, when it embeds one. */
  readonly reelHead?: string
  /** The text after the marked comment's `**No reel:**` label, when it carries one. */
  readonly reelSkip?: string
}

/**
 * The reel skip codes that settle a drivable checklist with no reel. Each is a
 * filter result or a hosting limit no builder can change. Every other code,
 * and free text no procedure emits, is fixable by the builder or its machine,
 * so it holds the lift until a reel lands or a review waives it.
 */
export const SETTLING_REEL_SKIPS: readonly string[] = [
  'no-interactive-box',
  'no-visible-change',
  'reel-too-large',
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
  readonly paintedPaths?: readonly string[]
  readonly drivenPaths?: readonly string[]
  /** The tip runs queued with no job past the bound, on a `ci-stalled` refusal. */
  readonly stalled?: readonly StalledRun[]
  /** Failing checks the base does not require, named so a reader sees them before merging. */
  readonly advisory?: readonly string[]
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
 * The code review gate. A pass with no marker is refused rather than lifted,
 * since the commit it covers is a stamp GitHub wrote at submission, which the
 * marker exists to replace.
 */
export function reviewGate(
  reviews: readonly ReviewRow[],
  head: string,
): GateResult {
  const scope = resolveReviewScope({ reviews })
  if (scope.state === 'none') return fail('review', 'review-missing')
  if (scope.state === 'open') return fail('review', 'review-open')
  if (scope.source !== 'marker') return fail('review', 'review-unmarked')
  if (scope.commit === undefined || !coversHead(scope.commit, head)) {
    return fail('review', 'review-behind')
  }
  return pass('review')
}

/**
 * What the UI gate says about a close carried across commits, and the runs the
 * ci gate found stalled, lifted from the gates onto a record.
 */
function carried(gates: readonly GateResult[]): {
  carriedFrom?: string
  paintedPaths?: readonly string[]
  drivenPaths?: readonly string[]
  stalled?: readonly StalledRun[]
} {
  const ui = gates.find((gate) => gate.gate === 'ui')
  const ci = gates.find((gate) => gate.gate === 'ci')
  return {
    ...(ui?.carriedFrom !== undefined && { carriedFrom: ui.carriedFrom }),
    ...(ui?.paintedPaths !== undefined && { paintedPaths: ui.paintedPaths }),
    ...(ui?.drivenPaths !== undefined && { drivenPaths: ui.drivenPaths }),
    ...(ci?.stalled !== undefined && { stalled: ci.stalled }),
  }
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
 * Binds only where the evidence record carries a checklist to drive.
 *
 * A close behind the head still holds across the gap `readCarry` carries,
 * one changing no path a box can observe. A box drives behavior, so a push to
 * a non-painted source file moves the verdict too, and `drivenPaths` names
 * every such path while `paintedPaths` keeps the painted subset. A close that
 * is not an ancestor, which a force-push or a rebase leaves, never carries.
 */
export async function uiGate(
  api: Pick<LiftApi, 'readChanged'>,
  painted: PaintedPatterns,
  reviews: readonly ReviewRow[],
  head: string,
  hasDrivableBox: boolean,
): Promise<GateResult> {
  const scope = resolveUiScope({ reviews })
  // An open verdict holds the gate even once no drivable box remains, so
  // dropping the checklist or marking a failed box taste never clears it.
  if (scope.state === 'open') return fail('ui', 'ui-open')
  if (!hasDrivableBox) return pass('ui')
  if (scope.state === 'none') return fail('ui', 'ui-missing')
  if (scope.source !== 'marker') return fail('ui', 'ui-unmarked')
  if (scope.commit === undefined) return fail('ui', 'ui-behind')
  // Ahead of the head test so a close carried across commits is refused too.
  // A verdict whose count line did not parse reads as unchecked and goes on.
  if (droveNothing(scope.counts)) return fail('ui', 'ui-undriven')

  const carry = await readCarry(
    (from, to) => api.readChanged(from, to),
    scope.commit,
    head,
  )
  if (carry.kind === 'covered') return pass('ui')
  if (carry.kind === 'failed') return fail('ui', 'gh-failed')
  if (carry.kind === 'not-ancestor') return fail('ui', 'ui-behind')
  if (carry.kind === 'carried') {
    return { ...pass('ui'), carriedFrom: carry.carriedFrom }
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

/**
 * The evidence gate. An owed step refuses first. Then every painted path the
 * pull request changed with no capture refuses, unless a reel shows it or a
 * standing pass waived it by the path as the list spells it. A reel shows the
 * list when it was filmed at the head or `readReelCarry` carried it there,
 * since a reel at an earlier head that did not carry may miss a path a later
 * push added. For the same reason a waiver counts only while the newest pass
 * of its family restates it.
 *
 * Last, a checklist holding a drivable box owes a reel the same way. A skip
 * whose code is in `SETTLING_REEL_SKIPS` settles it, and so does a standing
 * reel waiver, and anything else refuses `reel-unsettled`.
 */
export function evidenceGate(
  evidence: EvidenceGate,
  reviews: readonly ReviewRow[],
  head: string,
  reelCarriedFrom?: string,
): GateResult {
  if (!evidence.isSettled) return fail('evidence', 'evidence-owed')

  const standing = standingPasses(reviews)
  const isAtHead =
    evidence.reelHead !== undefined && coversHead(evidence.reelHead, head)
  const isFilmed = isAtHead || reelCarriedFrom !== undefined
  const carried = !isAtHead && reelCarriedFrom !== undefined
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
  if (carried) return { ...pass('evidence'), ...lists, reelCarriedFrom }
  if (!evidence.hasDrivableBox || isFilmed) {
    return { ...pass('evidence'), ...lists }
  }

  const { reelSkip } = evidence
  const skipField = reelSkip !== undefined && { reelSkip }
  if (
    reelSkip !== undefined &&
    SETTLING_REEL_SKIPS.includes(reelSkipCode(reelSkip))
  ) {
    return { ...pass('evidence'), ...lists, ...skipField }
  }
  const reelWaived = readReelWaivers(standing).at(-1)
  if (reelWaived !== undefined) {
    return { ...pass('evidence'), ...lists, ...skipField, reelWaived }
  }
  return { ...fail('evidence', 'reel-unsettled'), ...lists, ...skipField }
}

/**
 * Which changed paths move a reel. A project declaring `reelInputs` names what
 * a reel reads beyond the painted set, so any other source change leaves the
 * pixels alone. With no declaration, every path outside the inert set moves
 * it, the rule `uiGate` carries a close by.
 */
function reelMoves(painted: PaintedPatterns): (path: string) => boolean {
  const { reelInputs } = painted
  if (reelInputs === undefined) return (path) => !isInert(path)
  return (path) =>
    !isInert(path) &&
    (isPainted(path, painted) ||
      reelInputs.some((glob) => new Bun.Glob(glob).match(path)))
}

/**
 * The commit a reel carries from when it was filmed before the head and no
 * push since changed a path `reelMoves` names. A rewritten reel commit or a
 * failed read carries nothing, so both evidence halves decide as if no reel
 * stood at the head.
 */
async function readReelCarry(
  api: Pick<LiftApi, 'readChanged'>,
  painted: PaintedPatterns,
  evidence: EvidenceGate,
  head: string,
): Promise<string | undefined> {
  const { reelHead } = evidence
  if (reelHead === undefined) return undefined
  const carry = await readCarry(
    (from, to) => api.readChanged(from, to),
    reelHead,
    head,
    reelMoves(painted),
  )
  return carry.kind === 'carried' ? carry.carriedFrom : undefined
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
 * Reads the check runs until they conclude, the deadline passes, or a run can
 * no longer start. A conflicted branch gets no merge ref, so no run ever
 * starts and waiting on it is the one wait that cannot end. A stalled run
 * ends the wait the same way, since none of the measured stalls cleared
 * before a close and reopen started a fresh run.
 */
async function waitForChecks(
  api: LiftApi,
  tip: string,
  waitSeconds: number,
  pollMs: number,
): Promise<CiOutcome> {
  const started = api.now()
  const deadline = started + waitSeconds * 1000

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
    if (api.now() + pollMs > deadline) {
      return { kind: 'refused', reason: 'ci-timeout', waited }
    }
    await api.sleep(pollMs)
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
 * Reads a ready pull request against every gate, and reports `already-ready`
 * only when all of them, standing and CI included, read clear at the tip.
 *
 * A failing review, UI, or evidence gate returns it to draft, since the mark
 * no longer holds. A failing standing or CI gate refuses and writes nothing,
 * as either would flap a merge-ready pull request on a run still going.
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

  // The redraft gates come first in the list, so a standing failure reaches
  // this branch only once the mark itself still holds.
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
 * Settles a run whose gates and CI cleared at `tip`, after a wait that could
 * have moved any of them. The head, the reviews, and the standing are read
 * again, and the draft state too, so a pull request another session readied
 * or drafted during the wait is settled by the state it holds now. CI read at
 * `tip` vouches for nothing else, so a moved head refuses before any branch.
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
    reviewGate(nowReviews, nowTip),
    await uiGate(api, painted, nowReviews, nowTip, hasDrivableBox),
  ].find((gate) => !gate.isOk)
  if (reread?.reason !== undefined) return refuse(reread.reason, nowTip)

  // Standing is read again too, since a sibling merging during the wait can
  // leave a branch that read fresh before it stale.
  const laterStanding = standingGate(await api.readStanding(nowTip))
  if (laterStanding.reason !== undefined) {
    return refuse(laterStanding.reason, nowTip)
  }

  if (!nowPull.isDraft) {
    return alreadyReady(cleared, nowTip, ci.waited, ci.reading)
  }
  // Evidence is not read again, so a draft written during the wait may rest on
  // a gate this run never saw fail. Re-marking it would undo that write.
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
  }
}

/**
 * Lifts the draft mark when every gate reads clear at the head.
 *
 * The reads that need no wait all run before the CI wait, so a reviewer whose
 * partner is still driving refuses at once rather than holding a turn through
 * a CI run. The head and the reviews are read again after the wait and before
 * the mutation, since a push during the wait moves the head off the commit
 * every earlier gate cleared.
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

  // The tip, not the object's head, since the object lags the ref by up to a
  // minute after a push and a review marker names the commit it read.
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
    reviewGate(reviews, tip),
    await uiGate(api, painted, reviews, tip, evidence.hasDrivableBox),
    evidenceGate(
      evidence,
      reviews,
      tip,
      await readReelCarry(api, painted, evidence, tip),
    ),
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
 * Reads where a head stands against the base, ported from the orchestrator
 * poll's own read so the lift and the poll answer one question the same way.
 *
 * merge-tree answers locally, because `mergeable_state` reads unknown while
 * GitHub computes it, which is exactly when a verb asks. Only a change to a
 * path the branch writes makes it stale, since re-testing after every merge to
 * the base is a merge queue's cost without its batching. A head or base that
 * does not resolve, which a fork or a deleted head leaves, reads `unknown`.
 */
export async function readBaseStanding(
  git: GitRunner,
  number: number,
  head: string,
  ref: string,
): Promise<Standing> {
  // The base is fetched as well as the head. A tracking ref is only as current
  // as the last fetch, so a sibling merging since then would read as fresh.
  const baseBranch = ref.startsWith('origin/')
    ? ref.slice('origin/'.length)
    : ref
  await git(['fetch', '-q', 'origin', baseBranch])
  await git(['fetch', '-q', 'origin', `pull/${number}/head`])

  const hasHead =
    (await git(['cat-file', '-e', `${head}^{commit}`])) !== undefined
  const hasRef = (await git(['rev-parse', '--verify', '-q', ref])) !== undefined
  if (!hasHead || !hasRef) return 'unknown'

  const merged = await git(['merge-tree', '--write-tree', ref, head])
  if (merged === undefined) return 'conflict'

  const forkPoint = (await git(['merge-base', ref, head]))?.trim()
  if (forkPoint === undefined || forkPoint === '') return 'unknown'

  const written = await git([
    'diff',
    '--name-only',
    '--no-renames',
    forkPoint,
    head,
  ])
  if (written === undefined) return 'unknown'

  const paths = nonEmptyLines(written)
  if (paths.length === 0) return 'fresh'

  const moved = await git([
    '--literal-pathspecs',
    'diff',
    '--name-only',
    '--no-renames',
    forkPoint,
    ref,
    '--',
    ...paths,
  ])
  if (moved === undefined) return 'unknown'

  return nonEmptyLines(moved).length > 0 ? 'stale' : 'fresh'
}

/**
 * Reads what changed between a close commit and the head. A commit that does
 * not resolve, or that the head does not descend from, reads as not an
 * ancestor and carries nothing. A head that does not resolve, or a diff that
 * fails, is a read that failed, so the gate refuses rather than passes.
 *
 * The abbreviated marker resolves first, so the ancestry test runs on the full
 * sha. Renames are split into both sides so a move out of a painted path
 * still reads as painted.
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
