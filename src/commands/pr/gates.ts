import { join } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  type CheckRunListing,
  collapseChecks,
  missesGatingCheck,
  type RawStatus,
  type RawWorkflowRun,
  requiredChecks,
  STALL_SECONDS,
  type StalledRun,
  stallCandidates,
  stalledRuns,
  withMergeState,
} from '@/pr/checks'
import {
  type ChecksGate,
  type EvidenceGate,
  type LiftRefusal,
  readsDrivableBox,
  UNWAIVABLE_REEL_SKIPS,
} from '@/pr/lift'
import { mergeStateOf, type RestPull } from '@/pr/rest'
import { PROJECT_ROOT } from '@/roots/project'
import { logWarn } from '@/cli/ui'
import { GH_TIMEOUT_MS, PULL_REFUSALS, gh } from '@/commands/pr/pull'

export const LIFT_REFUSALS: Record<
  LiftRefusal | 'bad-wait' | 'gh-missing',
  string
> = {
  'bad-wait': '--wait takes a whole number of seconds, zero or more.',
  'gh-missing': PULL_REFUSALS['gh-missing'],
  'pull-closed': 'The pull request is closed, so there is no mark to lift.',
  'review-missing': 'The thread carries no code review, so none has closed.',
  'review-open':
    'The newest code review is open, so a finding still owes a fix.',
  'review-unmarked':
    'The newest code review carries no read-time marker, so the commit it covers is a GitHub stamp this gate does not trust.',
  'review-behind':
    'The newest code review closed on an earlier commit than the head.',
  'ui-missing':
    'The evidence comment carries a checklist holding a box a driver can run, and no UI review has been posted.',
  'ui-open': 'The newest UI review is open, so a box still owes a fix.',
  'ui-unmarked':
    'The newest UI review carries no head marker, so the commit it covers is a GitHub stamp this gate does not trust.',
  'ui-behind':
    'The newest UI review closed on an earlier commit than the head.',
  'ui-undriven':
    'The newest UI review closed having driven no box, so it looked at nothing. Re-drive the checklist on an address that answers.',
  'evidence-owed':
    'The evidence check reads owed, so the ship chain left a step undone.',
  'painted-uncaptured':
    'A painted path changed with no capture, no reel at the head, and no waiver in a review. Capture it, or have a review waive it.',
  'reel-unsettled': `The checklist holds a box a driver can run, and no reel is filmed at the head. The posted skip, if any, is one a builder can fix. Film the reel, or have a review waive it. A waiver over a ${UNWAIVABLE_REEL_SKIPS.join(' or ')} skip settles nothing, and the gate entry names one it ignored as \`reelWaiverRefused\`.`,
  'standing-stale':
    'The base moved under a path this branch writes since it branched, so CI measured a tree that is gone.',
  'standing-conflict': 'The head does not merge cleanly into the base.',
  'standing-unknown':
    'The head or the base did not resolve, which a fork or a deleted head leaves, so its standing is unread and waits on a person.',
  'ci-pending': 'A check run on the tip has yet to conclude.',
  'ci-failing': 'A check run on the tip failed.',
  'ci-conflicted':
    'The branch conflicts with its base, so no run will start for the tip.',
  'ci-stalled':
    'A workflow run on the tip has sat queued with no job past 10 minutes, and a cancel or rerun does not restart it. Close and reopen the pull request to start a fresh run.',
  'ci-timeout': 'A check run was still pending when --wait ran out.',
  'head-moved':
    'A push landed during the wait, so the gates cleared a commit that is no longer the head.',
  'ready-withdrawn':
    'The pull request went back to draft during the wait, so its mark is left as someone set it.',
  'gh-failed':
    'A read or the mutation was refused, so nothing is reported as lifted.',
}

/**
 * Reads the evidence check through this checkout's own CLI rather than a
 * second copy of its logic, so the lift and a caller running
 * `canon pr evidence --check` read one answer.
 */
export async function readEvidenceGate(
  root: string,
  number: string,
): Promise<EvidenceGate | undefined> {
  const result = await execa(
    process.execPath,
    [
      join(PROJECT_ROOT, 'src', 'cli.ts'),
      'pr',
      'evidence',
      number,
      '--check',
      '--json',
      '--root',
      root,
    ],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS * 2,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  const last = String(result.stdout)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .at(-1)
  if (last === undefined) return undefined

  let record: {
    reason?: unknown
    owed?: unknown
    checklist?: unknown
    drivable?: unknown
    uncaptured?: unknown
    reel?: unknown
    reelSkip?: unknown
  }
  try {
    record = JSON.parse(last)
  } catch {
    return undefined
  }
  if (record.reason !== 'settled' && record.reason !== 'owed') return undefined

  const reelHead = readReelHead(record.reel)
  return {
    isSettled: record.reason === 'settled',
    owed: Array.isArray(record.owed) ? record.owed.map(String) : [],
    hasDrivableBox: readsDrivableBox(record),
    // Absent stays absent, since it means the base keeps no captures and
    // the gate passes as it did before the list existed.
    ...(Array.isArray(record.uncaptured) && {
      uncaptured: record.uncaptured.map(String),
    }),
    ...(reelHead !== undefined && { reelHead }),
    ...(typeof record.reelSkip === 'string' && { reelSkip: record.reelSkip }),
  }
}

function readReelHead(reel: unknown): string | undefined {
  if (typeof reel !== 'object' || reel === null || !('head' in reel)) {
    return undefined
  }
  return typeof reel.head === 'string' && reel.head !== ''
    ? reel.head
    : undefined
}

export async function readChecksGate(
  root: string,
  number: string,
  tip: string,
): Promise<ChecksGate | undefined> {
  // A status read that fails leaves a required status context unseen, which
  // reads pending rather than passing, so it needs no refusal of its own.
  const [listed, pulled, combined] = await Promise.all([
    gh(root, [
      'api',
      `repos/{owner}/{repo}/commits/${tip}/check-runs?per_page=100`,
    ]),
    gh(root, ['api', `repos/{owner}/{repo}/pulls/${number}`]),
    gh(root, [
      'api',
      `repos/{owner}/{repo}/commits/${tip}/status?per_page=100`,
    ]),
  ])
  if (listed === null) return undefined
  try {
    const row = pulled === null ? undefined : (JSON.parse(pulled) as RestPull)
    const required = await readRequiredChecks(root, row?.base?.ref)
    const statuses =
      combined === null
        ? []
        : ((JSON.parse(combined) as { statuses?: readonly RawStatus[] })
            .statuses ?? [])
    const listing = JSON.parse(listed) as CheckRunListing
    const reading = withMergeState(
      mergeStateOf(row?.mergeable_state),
      collapseChecks(tip, listing, required, statuses),
    )
    // Only a reading that would refuse `ci-pending` pays for the runs read, so
    // a pass, a failure, or a conflict keeps its reason and its cost. A gating
    // check with a row is a run still going, which a stall elsewhere must not
    // cut short.
    const stalled =
      reading.state === 'pending' &&
      !reading.conflicted &&
      missesGatingCheck(tip, listing, required, statuses)
        ? await readStalledRuns(root, tip)
        : []
    return {
      state: reading.state,
      isConflicted: reading.conflicted,
      ...(reading.advisory !== undefined && { advisory: reading.advisory }),
      ...(stalled.length > 0 && { stalled }),
    }
  } catch {
    return undefined
  }
}

/**
 * The tip's workflow runs GitHub queued past the bound and never gave a job.
 * Any read that fails or does not parse finds no stall, so the reading stays
 * `ci-pending`, which still refuses the merge, rather than a pass or a
 * refusal of its own.
 */
async function readStalledRuns(
  root: string,
  tip: string,
): Promise<readonly StalledRun[]> {
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/actions/runs?head_sha=${tip}&per_page=100`,
  ])
  if (listed === null) return []
  let runs: readonly RawWorkflowRun[]
  try {
    const parsed = JSON.parse(listed) as { workflow_runs?: unknown }
    if (!Array.isArray(parsed.workflow_runs)) return []
    runs = parsed.workflow_runs as readonly RawWorkflowRun[]
  } catch {
    return []
  }

  const now = Date.now()
  const candidates = stallCandidates(tip, runs, now, STALL_SECONDS)
  const counts = await Promise.all(
    candidates.map(
      async (run) => [run.id, await readJobCount(root, run.id)] as const,
    ),
  )
  const jobCounts = new Map<number, number>()
  for (const [id, count] of counts) {
    if (count !== undefined) jobCounts.set(id, count)
  }
  return stalledRuns(tip, runs, jobCounts, now, STALL_SECONDS)
}

/** A run's job count, undefined when the read failed or carried none. */
async function readJobCount(
  root: string,
  id: number,
): Promise<number | undefined> {
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/actions/runs/${id}/jobs?per_page=1`,
  ])
  if (listed === null) return undefined
  try {
    const count = (JSON.parse(listed) as { total_count?: unknown }).total_count
    return typeof count === 'number' ? count : undefined
  } catch {
    return undefined
  }
}

/**
 * The checks the base branch's rules require, so a check they leave out runs
 * without holding the gate. Undefined on any read that fails, which gates by
 * every check as the verbs did before the rules were read.
 */
async function readRequiredChecks(
  root: string,
  base: string | undefined,
): Promise<ReadonlySet<string> | undefined> {
  if (base === undefined || base === '') return undefined
  const rules = await gh(root, [
    'api',
    `repos/{owner}/{repo}/rules/branches/${base}`,
  ])
  if (rules === null) return undefined
  try {
    return requiredChecks(JSON.parse(rules))
  } catch {
    return undefined
  }
}

export function warnAdvisory(advisory: readonly string[] | undefined): void {
  for (const name of advisory ?? []) {
    logWarn(
      `advisory: ${name} failed, which the base's rules do not require, so it did not block`,
    )
  }
}
