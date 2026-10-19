import type { ChecksState } from '@/targets/pulls'
import {
  coversHead,
  type ReviewRow,
  resolveReviewScope,
  resolveUiScope,
  type UiCounts,
} from '@/pr/review-scope'
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
  | 'standing-stale'
  | 'standing-conflict'
  | 'standing-unknown'
  | 'ci-pending'
  | 'ci-failing'
  | 'ci-conflicted'
  | 'ci-timeout'
  | 'head-moved'
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
  /** Whether the marked comment carries a visual checklist, which binds the UI gate. */
  readonly hasChecklist: boolean
}

export interface ChecksGate {
  readonly state: ChecksState
  readonly isConflicted: boolean
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
  readonly isLifted: boolean
  /** Whether the caller can treat the pull request as ready afterwards. */
  readonly isOk: boolean
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

/** What the UI gate says about a close carried across commits, for a record. */
function carried(gates: readonly GateResult[]): {
  carriedFrom?: string
  paintedPaths?: readonly string[]
} {
  const ui = gates.find((gate) => gate.gate === 'ui')
  return {
    ...(ui?.carriedFrom !== undefined && { carriedFrom: ui.carriedFrom }),
    ...(ui?.paintedPaths !== undefined && { paintedPaths: ui.paintedPaths }),
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
 * A close behind the head still holds when it is an ancestor of the head and
 * no painted path changed since, since a push that paints nothing leaves the
 * checklist the reviewer drove as true as it was. A close that is not an
 * ancestor, which a force-push or a rebase leaves, never carries.
 */
export async function uiGate(
  api: Pick<LiftApi, 'readChanged'>,
  painted: PaintedPatterns,
  reviews: readonly ReviewRow[],
  head: string,
  hasChecklist: boolean,
): Promise<GateResult> {
  if (!hasChecklist) return pass('ui')

  const scope = resolveUiScope({ reviews })
  if (scope.state === 'none') return fail('ui', 'ui-missing')
  if (scope.state === 'open') return fail('ui', 'ui-open')
  if (scope.source !== 'marker') return fail('ui', 'ui-unmarked')
  if (scope.commit === undefined) return fail('ui', 'ui-behind')
  // Ahead of the head test so a close carried across commits is refused too.
  // A verdict whose count line did not parse reads as unchecked and goes on.
  if (droveNothing(scope.counts)) return fail('ui', 'ui-undriven')
  if (coversHead(scope.commit, head)) return pass('ui')

  const changed = await api.readChanged(scope.commit, head)
  if (changed === undefined) return fail('ui', 'gh-failed')
  if (!changed.isAncestor) return fail('ui', 'ui-behind')

  const paintedPaths = changed.paths.filter((path) => isPainted(path, painted))
  if (paintedPaths.length > 0) {
    return { ...fail('ui', 'ui-behind'), paintedPaths }
  }
  return { ...pass('ui'), carriedFrom: scope.commit }
}

function standingGate(standing: Standing): GateResult {
  if (standing === 'fresh') return pass('standing')
  return fail('standing', `standing-${standing}`)
}

type CiOutcome =
  | { readonly kind: 'passing'; readonly waited: number }
  | {
      readonly kind: 'refused'
      readonly reason: LiftRefusal
      readonly waited: number
    }

/**
 * Reads the check runs until they conclude, the deadline passes, or a run can
 * no longer start. A conflicted branch gets no merge ref, so no run ever
 * starts and waiting on it is the one wait that cannot end.
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
    if (reading.state === 'passing') return { kind: 'passing', waited }
    if (reading.state === 'failing') {
      return { kind: 'refused', reason: 'ci-failing', waited }
    }
    if (reading.isConflicted) {
      return { kind: 'refused', reason: 'ci-conflicted', waited }
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

/**
 * Reads a ready pull request against the gates a person's ready mark vouched
 * for. A failing review, UI, or evidence gate returns it to draft, since the
 * mark no longer holds. Standing and CI are reported and never written on, as
 * either would flap a merge-ready pull request on a run still going.
 */
async function settleReady(
  api: LiftApi,
  opts: LiftOptions,
  pull: PullState,
  tip: string,
  gates: readonly GateResult[],
): Promise<LiftRecord> {
  const blocked = gates.find(
    (gate) => REDRAFT_GATES.includes(gate.gate) && !gate.isOk,
  )
  if (blocked?.reason === undefined) {
    return {
      reason: 'already-ready',
      isLifted: false,
      isOk: true,
      head: tip,
      gates,
      waitedSeconds: 0,
      ...carried(gates),
    }
  }
  if (opts.isCheck || blocked.reason === 'gh-failed') {
    return refused(blocked.reason, gates, tip)
  }

  const isDrafted = await api.markDraft(pull.nodeId)
  if (!isDrafted) return refused('gh-failed', gates, tip)

  return {
    reason: 'redrafted',
    failed: blocked.reason,
    isLifted: false,
    isOk: false,
    head: tip,
    gates,
    waitedSeconds: 0,
    ...carried(gates),
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
    await uiGate(api, painted, reviews, tip, evidence.hasChecklist),
    evidence.isSettled ? pass('evidence') : fail('evidence', 'evidence-owed'),
    standingGate(standing),
  ]
  if (!pull.isDraft) return settleReady(api, opts, pull, tip, gates)

  const blocked = gates.find((gate) => !gate.isOk)

  if (opts.isCheck) {
    const reading = await api.readChecks(tip)
    if (reading === undefined) {
      return refused('gh-failed', gates, tip)
    }
    const ci =
      reading.state === 'passing'
        ? pass('ci')
        : reading.state === 'failing'
          ? fail('ci', 'ci-failing')
          : reading.isConflicted
            ? fail('ci', 'ci-conflicted')
            : fail('ci', 'ci-pending')
    const all = [...gates, ci]
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
    }
  }

  if (blocked?.reason !== undefined) return refused(blocked.reason, gates, tip)

  const ci = await waitForChecks(api, tip, opts.waitSeconds, pollMs)
  if (ci.kind === 'refused') {
    return refused(ci.reason, [...gates, fail('ci', ci.reason)], tip, ci.waited)
  }
  const cleared = [...gates, pass('ci')]

  // The re-read: whatever the gates cleared above was cleared at `tip`.
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
    return refused('gh-failed', cleared, tip, ci.waited)
  }
  if (!nowPull.isDraft) {
    return {
      reason: 'already-ready',
      isLifted: false,
      isOk: true,
      head: nowTip,
      gates: cleared,
      waitedSeconds: ci.waited,
      ...carried(cleared),
    }
  }
  if (nowTip !== tip) return refused('head-moved', cleared, nowTip, ci.waited)

  const reread = [
    reviewGate(nowReviews, nowTip),
    await uiGate(api, painted, nowReviews, nowTip, evidence.hasChecklist),
  ].find((gate) => !gate.isOk)
  if (reread?.reason !== undefined) {
    return refused(reread.reason, cleared, nowTip, ci.waited)
  }

  // Standing is read again too, since a sibling merging during the wait can
  // leave a branch that read fresh before it stale.
  const laterStanding = standingGate(await api.readStanding(nowTip))
  if (laterStanding.reason !== undefined) {
    return refused(laterStanding.reason, cleared, nowTip, ci.waited)
  }

  const isMarked = await api.markReady(pull.nodeId)
  if (!isMarked) return refused('gh-failed', cleared, nowTip, ci.waited)

  return {
    reason: 'lifted',
    isLifted: true,
    isOk: true,
    head: nowTip,
    gates: cleared,
    waitedSeconds: ci.waited,
    ...carried(cleared),
  }
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
