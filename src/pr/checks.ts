import {
  type ChecksState,
  type RawCheck,
  rollupRequired,
} from '@/targets/pulls'

/** One row of `repos/{owner}/{repo}/commits/<sha>/check-runs`. */
export interface RawCheckRun {
  readonly head_sha?: string
  readonly status?: string
  readonly conclusion?: string | null
  readonly name?: string
  readonly id?: number
}

/** One row of `repos/{owner}/{repo}/commits/<sha>/status`, newest per context already. */
export interface RawStatus {
  readonly context?: string
  readonly state?: string
}

/** What that endpoint returns, count and rows apart. */
export interface CheckRunListing {
  readonly total_count?: number
  readonly check_runs?: readonly RawCheckRun[]
}

export interface ChecksReading {
  readonly state: ChecksState
  /** The commit the answer describes. */
  readonly tip: string
  /** Runs the listing carried for the tip. */
  readonly matched: number
  /** Runs the listing carried for some other commit. */
  readonly foreign: number
  /** What the endpoint said it holds, which can exceed the rows it returned. */
  readonly reported: number
  /** Runs `matched` carried for a check name this reading already kept a newer run for. */
  readonly collapsed: number
  /**
   * Failing checks outside the required set, present only when a required set
   * was read, so a reading over every check keeps its old shape.
   */
  readonly advisory?: readonly string[]
}

/**
 * Reads the check names a base branch's rules require, from
 * `repos/{owner}/{repo}/rules/branches/<base>`. Undefined when the answer is not
 * a rule list, so the caller falls back to every check, as for classic protection.
 */
export function requiredChecks(
  rules: unknown,
): ReadonlySet<string> | undefined {
  if (!Array.isArray(rules)) return undefined

  const names = new Set<string>()
  for (const rule of rules as readonly RequiredRule[]) {
    if (rule?.type !== 'required_status_checks') continue
    for (const check of rule.parameters?.required_status_checks ?? []) {
      if (typeof check.context === 'string') names.add(check.context)
    }
  }
  return names
}

interface RequiredRule {
  readonly type?: string
  readonly parameters?: {
    readonly required_status_checks?: readonly { readonly context?: unknown }[]
  }
}

export interface ConflictedReading extends ChecksReading {
  /** The branch conflicts with its base, so no run will ever start for the tip. */
  readonly conflicted: boolean
  /** The pull request's `mergeStateStatus`, absent when the read carried none. */
  readonly mergeState?: string
}

/**
 * Tells a conflicted pull request from a tip whose runs have not started, since
 * a conflict gets no merge ref and an empty listing reads pending. Only `DIRTY`
 * separates them, and only while no run belongs to the tip; `UNKNOWN` is not one.
 */
export function withMergeState(
  mergeState: string | undefined,
  reading: ChecksReading,
): ConflictedReading {
  return {
    ...reading,
    conflicted: mergeState === 'DIRTY' && reading.matched === 0,
    ...(mergeState !== undefined && { mergeState }),
  }
}

/**
 * Puts a check-run row into the shape `rollup` reads. REST spells statuses
 * lowercase and `rollup` reads the GraphQL enum, so the vocabulary converts at
 * this boundary, and a null conclusion becomes absent, meaning not concluded.
 */
function adapt(run: RawCheckRun): RawCheck {
  return {
    ...(run.name !== undefined && { name: run.name }),
    ...(run.status !== undefined && { status: run.status.toUpperCase() }),
    ...(run.conclusion !== undefined &&
      run.conclusion !== null && {
        conclusion: run.conclusion.toUpperCase(),
      }),
  }
}

/**
 * Keeps the newest run per check name, so a re-triggered gate's stale run does
 * not outvote its rerun. A nameless run keys on its own position, a run with an
 * `id` outranks one without, and a tie keeps whichever occurs later.
 */
function newestPerCheck(runs: readonly RawCheckRun[]): {
  readonly kept: readonly RawCheckRun[]
  readonly collapsed: number
} {
  const bestByKey = new Map<string, RawCheckRun>()

  runs.forEach((run, index) => {
    const key = run.name !== undefined ? `name:${run.name}` : `pos:${index}`
    const existing = bestByKey.get(key)
    const keepCurrent =
      existing === undefined ||
      (existing.id === undefined && run.id === undefined) ||
      (run.id !== undefined &&
        (existing.id === undefined || run.id >= existing.id))
    if (keepCurrent) bestByKey.set(key, run)
  })

  const kept = [...bestByKey.values()]
  return { kept, collapsed: runs.length - kept.length }
}

/**
 * Collapses a check-run listing to one word about one commit. A sha is not
 * enough, since a count with an empty row list, or a run for another commit,
 * reads `pending` rather than a false `passing`, and the rollup reads kept rows.
 */
export function collapseChecks(
  tip: string,
  listing: CheckRunListing,
  required?: ReadonlySet<string>,
  statuses: readonly RawStatus[] = [],
): ChecksReading {
  const runs = listing.check_runs ?? []
  const matched = runs.filter((run) => run.head_sha === tip)
  const { kept, collapsed } = newestPerCheck(matched)
  const reading = {
    tip,
    matched: matched.length,
    foreign: runs.length - matched.length,
    reported: listing.total_count ?? runs.length,
    collapsed,
    ...(required !== undefined && { advisory: [] }),
  }

  if (reading.foreign > 0) return { ...reading, state: 'pending' }

  // A count above the rows returned is a partial listing, which could hide a failing run.
  if (reading.reported > runs.length) return { ...reading, state: 'pending' }

  const statusRows: RawCheck[] =
    required === undefined || required.size === 0
      ? []
      : statuses.map((status) => ({
          ...(status.context !== undefined && { name: status.context }),
          state: (status.state ?? '').toUpperCase(),
        }))
  const rows = [...kept.map(adapt), ...statusRows]
  if (rows.length === 0) return { ...reading, state: 'pending' }

  const { state, advisory } = rollupRequired(rows, required)
  return {
    ...reading,
    state: state ?? 'pending',
    ...(required !== undefined && { advisory }),
  }
}

/** One row of `repos/{owner}/{repo}/actions/runs?head_sha=<sha>`. */
export interface RawWorkflowRun {
  readonly id?: number
  readonly workflow_id?: number
  readonly name?: string
  readonly event?: string
  readonly status?: string
  readonly head_sha?: string
  readonly created_at?: string
}

/** How long a run may sit queued with no job before it reads as stalled. */
export const STALL_SECONDS = 600

/**
 * Whether a gating check has no row on the tip, the only pending reading a
 * stalled run can explain. A non-empty required set gates by name, and an unread
 * or empty one by every check, so a stalled run nothing requires ends no wait.
 */
export function missesGatingCheck(
  tip: string,
  listing: CheckRunListing,
  required: ReadonlySet<string> | undefined,
  statuses: readonly RawStatus[] = [],
): boolean {
  const reported = new Set<string>()
  for (const run of listing.check_runs ?? []) {
    if (run.head_sha === tip && run.name !== undefined) reported.add(run.name)
  }
  if (required === undefined || required.size === 0) return reported.size === 0

  for (const status of statuses) {
    if (status.context !== undefined) reported.add(status.context)
  }
  return [...required].some((name) => !reported.has(name))
}

/** A run GitHub queued for the tip and never gave a job. */
export interface StalledRun {
  readonly id: number
  readonly workflow: string
  readonly queuedSeconds: number
}

/**
 * The newest run per workflow and event on the tip that has sat queued past the
 * bound. The key excludes a stuck run once a close and reopen replaces it, and
 * the event joins it since a `workflow_dispatch` run replaces nothing it gates.
 */
export function stallCandidates(
  tip: string,
  runs: readonly RawWorkflowRun[],
  now: number,
  boundSeconds: number,
): readonly StalledRun[] {
  const newest = new Map<string, RawWorkflowRun & { readonly id: number }>()
  for (const run of runs) {
    if (run.head_sha !== tip || run.id === undefined) continue
    const key = `${run.workflow_id ?? run.name}:${run.event}`
    const existing = newest.get(key)
    if (existing === undefined || run.id > existing.id) {
      newest.set(key, { ...run, id: run.id })
    }
  }

  const candidates: StalledRun[] = []
  for (const run of newest.values()) {
    if (run.status !== 'queued') continue
    const created = Date.parse(run.created_at ?? '')
    if (Number.isNaN(created)) continue
    const queuedSeconds = Math.floor((now - created) / 1000)
    if (queuedSeconds < boundSeconds) continue
    candidates.push({
      id: run.id,
      workflow: run.name ?? String(run.workflow_id ?? run.id),
      queuedSeconds,
    })
  }
  return candidates
}

/**
 * The candidates whose jobs read answered zero. A run missing from
 * `jobCounts`, whose read failed, is not stalled, so a failed read leaves the
 * reading pending rather than inventing a stall.
 */
export function stalledRuns(
  tip: string,
  runs: readonly RawWorkflowRun[],
  jobCounts: ReadonlyMap<number, number>,
  now: number,
  boundSeconds: number,
): readonly StalledRun[] {
  return stallCandidates(tip, runs, now, boundSeconds).filter(
    (run) => jobCounts.get(run.id) === 0,
  )
}
