import { type ChecksState, type RawCheck, rollup } from '@/targets/pulls'

/** One row of `repos/{owner}/{repo}/commits/<sha>/check-runs`. */
export interface RawCheckRun {
  readonly head_sha?: string
  readonly status?: string
  readonly conclusion?: string | null
  readonly name?: string
  readonly id?: number
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
}

export interface ConflictedReading extends ChecksReading {
  /** The branch conflicts with its base, so no run will ever start for the tip. */
  readonly conflicted: boolean
  /** The pull request's `mergeStateStatus`, absent when the read carried none. */
  readonly mergeState?: string
}

/**
 * Tells a conflicted pull request from a tip whose runs have not started.
 *
 * A branch that conflicts with its base gets no merge ref, so no
 * `pull_request` workflow runs and the listing stays empty, which
 * `collapseChecks` can only call pending. Only `DIRTY` separates the two, and
 * only while no run belongs to the tip: a conflict arising after runs
 * completed leaves those runs standing as a real answer. `UNKNOWN` is
 * transient while GitHub computes it, so it reads as not conflicted and costs
 * a caller one more poll.
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
 * Puts a check-run row into the shape `rollup` reads.
 *
 * REST spells its statuses lowercase and `rollup` reads the GraphQL enum the
 * pull request listing returns, so the vocabulary is converted at this boundary
 * rather than teaching that function a second one. A null conclusion becomes an
 * absent one, since `rollup` reads absence as a run that has not concluded.
 */
function adapt(run: RawCheckRun): RawCheck {
  return {
    ...(run.status !== undefined && { status: run.status.toUpperCase() }),
    ...(run.conclusion !== undefined &&
      run.conclusion !== null && {
        conclusion: run.conclusion.toUpperCase(),
      }),
  }
}

/**
 * Keeps the newest run per check name, so a re-triggered gate's stale run
 * does not outvote its own rerun.
 *
 * A run with no name keys on its own position rather than joining an
 * unnamed group, since nothing ties two nameless runs to the same check. A
 * run carrying an `id` always outranks one without, and a tie on `id`,
 * including a pair both missing one, keeps whichever run occurs later in
 * the array.
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
 * Collapses a check-run listing to one word about one commit.
 *
 * Keying the query on a sha is necessary and not sufficient. The endpoint
 * returned `total_count` 2 with an empty row list during a measured window on
 * 2026-09-02, so a reader that finds no run for the tip and reports `passing`
 * reproduces the false green behind a better query. Both that case and a
 * listing carrying a run for another commit report `pending` instead.
 *
 * The foreign test runs ahead of the collapse rather than after it. A listing
 * that describes another commit says nothing about this one, so answering off
 * the matching half would report a verdict on a set known to be incomplete.
 *
 * The matched set can still repeat a check name, since a re-triggered gate
 * creates a second run rather than replacing the first. The final state
 * rolls up from `newestPerCheck`'s kept rows rather than from `matched`
 * directly, so a stale failing run left behind by a rerun no longer outvotes
 * the passing run beside it.
 */
export function collapseChecks(
  tip: string,
  listing: CheckRunListing,
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
  }

  if (reading.foreign > 0) return { ...reading, state: 'pending' }

  // A count above the rows returned is a listing this reader holds only part
  // of, whether the endpoint paged or answered inconsistently. Collapsing the
  // part in hand would report `passing` off a set a failing run can still be
  // sitting outside of, which is the false green keyed on a sha alone.
  if (reading.reported > runs.length) return { ...reading, state: 'pending' }

  if (matched.length === 0) return { ...reading, state: 'pending' }

  return { ...reading, state: rollup(kept.map(adapt)) ?? 'pending' }
}
