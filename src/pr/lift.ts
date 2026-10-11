import type { ChecksState } from '@/targets/pulls'
import {
  coversHead,
  type ReviewRow,
  resolveReviewScope,
  resolveUiScope,
} from '@/pr/review-scope'

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
  sleep(ms: number): Promise<void>
  now(): number
}

export interface LiftOptions {
  readonly isCheck: boolean
  readonly waitSeconds: number
  readonly pollMs?: number
}

export interface LiftRecord {
  readonly reason: 'lifted' | 'already-ready' | 'clear' | LiftRefusal
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
function reviewGate(reviews: readonly ReviewRow[], head: string): GateResult {
  const scope = resolveReviewScope({ reviews })
  if (scope.state === 'none') return fail('review', 'review-missing')
  if (scope.state === 'open') return fail('review', 'review-open')
  if (scope.source !== 'marker') return fail('review', 'review-unmarked')
  if (scope.commit === undefined || !coversHead(scope.commit, head)) {
    return fail('review', 'review-behind')
  }
  return pass('review')
}

/** Binds only where the evidence record carries a checklist to drive. */
function uiGate(
  reviews: readonly ReviewRow[],
  head: string,
  hasChecklist: boolean,
): GateResult {
  if (!hasChecklist) return pass('ui')

  const scope = resolveUiScope({ reviews })
  if (scope.state === 'none') return fail('ui', 'ui-missing')
  if (scope.state === 'open') return fail('ui', 'ui-open')
  if (scope.source !== 'marker') return fail('ui', 'ui-unmarked')
  if (scope.commit === undefined || !coversHead(scope.commit, head)) {
    return fail('ui', 'ui-behind')
  }
  return pass('ui')
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

  const pull = await api.readPull()
  if (pull === undefined) return refused('gh-failed', [], undefined)
  if (!pull.isOpen) return refused('pull-closed', [], pull.head)
  if (!pull.isDraft) {
    return {
      reason: 'already-ready',
      isLifted: false,
      isOk: true,
      head: pull.head,
      gates: [],
      waitedSeconds: 0,
    }
  }

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
    uiGate(reviews, tip, evidence.hasChecklist),
    evidence.isSettled ? pass('evidence') : fail('evidence', 'evidence-owed'),
    standingGate(standing),
  ]
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
    }
  }
  if (nowTip !== tip) return refused('head-moved', cleared, nowTip, ci.waited)

  const reread = [
    reviewGate(nowReviews, nowTip),
    uiGate(nowReviews, nowTip, evidence.hasChecklist),
  ].find((gate) => !gate.isOk)
  if (reread?.reason !== undefined) {
    return refused(reread.reason, cleared, nowTip, ci.waited)
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
