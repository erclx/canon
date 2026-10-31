import { resolve } from 'node:path'
import { isLegacyStamped } from '@/sync/stamp'
import {
  readTargetRegistry,
  type TargetRegistry,
  registryPath,
} from '@/targets/registry'
import {
  type SweepBound,
  type SweepOptions,
  sweepTargets,
} from '@/targets/sweep'

/**
 * Where a target came from, carried on the row rather than inferred.
 *
 * A caller deciding whether an answer is trustworthy needs to know which rows
 * the machine recorded for itself and which a walk guessed at, and the two
 * carry different bounds.
 */
export type TargetSource = 'given' | 'record' | 'sweep'

export interface KnownTarget {
  /** Every checkout of this project on this machine, one for the ordinary case. */
  readonly paths: readonly string[]
  readonly origin: string | null
  readonly source: TargetSource
  /** When a sync last recorded this target, or null for a row only a sweep found. */
  readonly stampedAt: string | null
  /** The subset of `paths` still carrying their stamp at the retired location, in `paths` order. */
  readonly legacyPaths: readonly string[]
}

export interface ResolvedTargets {
  readonly targets: readonly KnownTarget[]
  /** Null when the caller named its targets, so no registry read was attempted. */
  readonly registry: TargetRegistry | null
  /** Null when no sweep ran, which is the ordinary case. */
  readonly bound: SweepBound | null
}

export interface ResolveTargetsOptions extends SweepOptions {
  /** Paths the caller named. These win outright and suppress both other sources. */
  readonly paths?: readonly string[]
  /** Roots to walk, supplementing the record rather than replacing it. */
  readonly sweep?: readonly string[]
  readonly registryFile?: string
  /** Folders whose recorded rows are left out, defaulting to `scratchRoots()`. */
  readonly scratchRoots?: readonly string[]
}

/**
 * Answers which projects the toolkit has installed into.
 *
 * The record written at install time is the primary source and a walk is the
 * fallback, which is the shape the population needs: a sweep alone cannot see
 * another machine or a clone under a path nobody named, and that is exactly how
 * the count moved from four to seven inside one pass and was then wrong in both
 * directions at once.
 *
 * A caller naming paths gets those and no lookup at all, since it has already
 * answered the question this resolves.
 */
export async function resolveTargets(
  opts: ResolveTargetsOptions = {},
): Promise<ResolvedTargets> {
  if (opts.paths !== undefined && opts.paths.length > 0) {
    return {
      targets: opts.paths.map((path) => given(resolve(path))),
      registry: null,
      bound: null,
    }
  }

  const file = opts.registryFile ?? registryPath()
  const registry = readTargetRegistry(file, opts.scratchRoots)

  const recorded: KnownTarget[] =
    registry.kind === 'read'
      ? registry.targets.map((row) => ({
          paths: [row.path],
          origin: null,
          source: 'record' as const,
          stampedAt: row.stampedAt,
          legacyPaths: isLegacyStamped(row.path) ? [row.path] : [],
        }))
      : []

  if (opts.sweep === undefined || opts.sweep.length === 0) {
    return { targets: recorded, registry, bound: null }
  }

  const swept = await sweepTargets(opts.sweep, opts)
  const known = new Set(recorded.flatMap((target) => target.paths))

  // A sweep row whose paths the record already holds is the same project read
  // twice, so it adds nothing. A row holding one known path and one unknown one
  // is the second-clone case, and it replaces the record's row rather than
  // sitting beside it, since the sweep is the only source that can see both.
  const added: KnownTarget[] = []
  const superseded = new Set<string>()

  for (const target of swept.targets) {
    const overlap = target.paths.filter((path) => known.has(path))

    if (overlap.length === target.paths.length) continue

    for (const path of overlap) superseded.add(path)

    // The recorded clone leads, because the record only names one a sync
    // actually ran in, where the rest are checkouts a walk happened to find.
    // Every caller reading a single path takes the first, and picking that by
    // sort order is how a repair ran in one clone while the count was taken
    // against another and the target read as untouched.
    const paths = [
      ...overlap,
      ...target.paths.filter((path) => !known.has(path)),
    ]

    // Re-derived against this row's own order rather than carried from
    // `target.legacyPaths`, which is ordered by the sweep's sort and mismatches
    // `paths` the moment the recorded clone is not the one that sorts first.
    added.push({
      paths,
      origin: target.origin,
      source: overlap.length > 0 ? 'record' : 'sweep',
      stampedAt:
        recorded.find((row) => overlap.includes(row.paths[0] ?? ''))
          ?.stampedAt ?? null,
      legacyPaths: paths.filter((path) => isLegacyStamped(path)),
    })
  }

  const kept = recorded.filter(
    (row) => !row.paths.some((path) => superseded.has(path)),
  )

  return {
    targets: [...kept, ...added].sort((a, b) =>
      (a.paths[0] ?? '').localeCompare(b.paths[0] ?? ''),
    ),
    registry,
    bound: swept.bound,
  }
}

function given(path: string): KnownTarget {
  return {
    paths: [path],
    origin: null,
    source: 'given',
    stampedAt: null,
    legacyPaths: isLegacyStamped(path) ? [path] : [],
  }
}
