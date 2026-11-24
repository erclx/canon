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
  classesFor,
  DEVICE_CLASSES,
  type DeviceClass,
  readDeviceConfig,
} from '@/design/device-classes'
import {
  DEFAULT_REEL_WIDTH,
  defaultReelWidth,
  owedReelWidths,
  readChecklistBoxes,
} from '@/pr/evidence'
import {
  type ChecksGate,
  type EvidenceGate,
  type EvidenceGateReel,
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
  'reel-unsettled': `The checklist holds a box a driver can run, and a width it owes has no reel filmed at the head, which the gate entry names as \`reelWidths\`. The skip posted for that width, if any, is one a builder can fix. Film the reel, or have a review waive it. A waiver over a ${UNWAIVABLE_REEL_SKIPS.join(' or ')} skip settles nothing, and the gate entry names one it ignored as \`reelWaiverRefused\`.`,
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

  let record: EvidenceCheckRecord
  try {
    record = JSON.parse(last)
  } catch {
    return undefined
  }
  return toEvidenceGate(
    record,
    readClassList(record.deviceClasses) === undefined
      ? readSupportedClasses(root)
      : undefined,
  )
}

/**
 * The classes `canon/config/design.toml` gives the painted paths a change touched, the default for none, read by
 * the lift and the evidence comment alike. A config the reader refuses warns and reads as all three, so a reel is
 * owed at every width rather than fewer.
 */
export function readSupportedClasses(
  root: string,
  paintedPaths: readonly string[] = [],
): readonly DeviceClass[] {
  const read = readDeviceConfig(root)
  if (read.ok) return classesFor(read.config, { paths: paintedPaths }).classes
  logWarn(`${read.message} Every class's width is owed a reel.`)
  return DEVICE_CLASSES
}

function readClassList(value: unknown): DeviceClass[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const classes = DEVICE_CLASSES.filter((deviceClass) =>
    value.includes(deviceClass),
  )
  return classes.length === value.length ? classes : undefined
}

/** The `canon pr evidence --check --json` fields the lift reads, each unchecked until `toEvidenceGate` narrows it. */
export interface EvidenceCheckRecord {
  readonly reason?: unknown
  readonly owed?: unknown
  readonly checklist?: unknown
  readonly drivable?: unknown
  readonly uncaptured?: unknown
  readonly reels?: unknown
  readonly reelSkip?: unknown
  readonly reelSkips?: unknown
  readonly deviceClasses?: unknown
}

/**
 * The gate a check record reads as, undefined for a record that is not a
 * check. The owed widths come off the checklist text, so a box naming no
 * width or a malformed one owes the default. A record carrying its own
 * `deviceClasses` governs over `fallback`, since the check read the changed set.
 */
export function toEvidenceGate(
  record: EvidenceCheckRecord,
  fallback: readonly DeviceClass[] = DEVICE_CLASSES,
): EvidenceGate | undefined {
  if (record.reason !== 'settled' && record.reason !== 'owed') return undefined

  const classes = readClassList(record.deviceClasses) ?? fallback
  const reels = readReels(record.reels)
  const reelSkips = readReelSkips(record.reelSkips)
  const defaultWidth = defaultReelWidth(classes)
  return {
    isSettled: record.reason === 'settled',
    owed: Array.isArray(record.owed) ? record.owed.map(String) : [],
    hasDrivableBox: readsDrivableBox(record),
    // Absent stays absent, since the base keeps no captures and the gate passes as before.
    ...(Array.isArray(record.uncaptured) && {
      uncaptured: record.uncaptured.map(String),
    }),
    ...(reels.length > 0 && { reels }),
    ...(typeof record.reelSkip === 'string' && { reelSkip: record.reelSkip }),
    ...(reelSkips.size > 0 && { reelSkips }),
    ...(typeof record.checklist === 'string' && {
      owedWidths: owedReelWidths(readChecklistBoxes(record.checklist), classes),
    }),
    ...(defaultWidth !== DEFAULT_REEL_WIDTH && { defaultWidth }),
  }
}

/** Each well-formed reel on the record, dropping an entry with no width or head rather than guessing one. */
function readReels(reels: unknown): EvidenceGateReel[] {
  if (!Array.isArray(reels)) return []
  return reels.flatMap((reel: unknown) => {
    if (typeof reel !== 'object' || reel === null) return []
    const { width, head } = reel as { width?: unknown; head?: unknown }
    return typeof width === 'number' && typeof head === 'string' && head !== ''
      ? [{ width, head }]
      : []
  })
}

/** The per-width skips on the record, keyed by width. */
function readReelSkips(skips: unknown): Map<number, string> {
  if (!Array.isArray(skips)) return new Map()
  return new Map(
    skips.flatMap((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return []
      const { width, skip } = entry as { width?: unknown; skip?: unknown }
      return typeof width === 'number' && typeof skip === 'string'
        ? [[width, skip] as const]
        : []
    }),
  )
}

export async function readChecksGate(
  root: string,
  number: string,
  tip: string,
): Promise<ChecksGate | undefined> {
  // A failed status read leaves a required context unseen, which reads pending.
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
    // Only a reading that would refuse `ci-pending` pays for the runs read.
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
 * A read that fails or does not parse finds no stall, so the reading stays
 * `ci-pending`, which still refuses the merge, rather than a pass or refusal.
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
