import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import type { AuditResult } from '@/audits/catalog'
import { resolveExisting } from '@/roots/legacy'

/**
 * Where the retained counts live, relative to the project root.
 * Committed so a fresh checkout inherits whether a number grew, and outside
 * `src/`, which ships to targets that would measure against these counts.
 */
export const BASELINE_REL = join('canon', 'config', 'baseline.json')

/**
 * Where the baseline wrote before this move, `.claude/canon/baseline.json`.
 * `readBaseline` falls back to it so a target that has not moved still reads
 * its recorded floor, and the write no longer lands there.
 */
const LEGACY_BASELINE_REL = join('.claude', 'canon', 'baseline.json')

export interface Baseline {
  /** The day the record was taken, as `YYYY-MM-DD`. */
  readonly recordedAt: string
  /** The commit the counts were read at, so a reader can reproduce them. */
  readonly commit: string
  readonly checks: Readonly<Record<string, Readonly<Record<string, number>>>>
}

export interface Stamp {
  readonly recordedAt: string
  readonly commit: string
}

export interface MovedCount {
  readonly key: string
  readonly from: number
  readonly to: number
  readonly delta: number
  /**
   * Present only on a growth inside the key's tolerance, which the summary
   * leaves out of `grown`. The key stays in `moved` rather than `steady`,
   * since `steady` promises the count reproduced exactly.
   */
  readonly tolerated?: true
}

/**
 * Growth fractions by audit id, then by count key. A key with no entry
 * compares exactly.
 */
export type Tolerances = Readonly<
  Record<string, Readonly<Record<string, number>> | undefined>
>

/**
 * Whether a growth from `from` to `to` sits inside `fraction` of the recorded
 * value, floored to a whole count so float error cannot decide a boundary.
 * A shrink is never tolerated, since a fall is the ratchet the baseline locks.
 */
function withinTolerance(
  from: number,
  to: number,
  fraction: number | undefined,
): boolean {
  if (fraction === undefined || to <= from) return false
  const allowance = Math.floor(from * fraction + 1e-9)
  return to - from <= allowance
}

export type Delta =
  | {
      readonly id: string
      readonly kind: 'compared'
      readonly moved: readonly MovedCount[]
      /** Keys the run reproduced exactly. */
      readonly steady: readonly string[]
      /** Keys the run produced that the baseline never recorded. */
      readonly added: readonly { key: string; to: number }[]
      /** Keys the baseline holds that this run did not produce. */
      readonly dropped: readonly { key: string; from: number }[]
    }
  /** No recorded floor, so a zero delta would be indistinguishable from quiet. */
  | { readonly id: string; readonly kind: 'unrecorded' }
  /** Gitignored scratch, whose counts are one machine's and answer nobody else. */
  | { readonly id: string; readonly kind: 'per-machine' }
  /** A network index, whose count moves when someone publishes rather than edits. */
  | { readonly id: string; readonly kind: 'upstream' }
  /** The audit did not report, so there is nothing to compare. */
  | { readonly id: string; readonly kind: 'unmeasured' }

/**
 * Builds the record a run leaves behind, keeping only tracked corpora, since
 * a gitignored folder or an upstream count sets a floor no other clone holds.
 * An audit that did not report is left out, never written as zero.
 */
export function baselineFrom(
  results: readonly AuditResult[],
  stamp: Stamp,
): Baseline {
  const checks: Record<string, Record<string, number>> = {}

  for (const result of results) {
    if (!result.tracked || result.counts === undefined) continue
    checks[result.id] = { ...result.counts }
  }

  return { recordedAt: stamp.recordedAt, commit: stamp.commit, checks }
}

/**
 * Compares this run against the recorded floor, one audit at a time.
 * A first run reports `unrecorded`, since a zero delta against an absent
 * baseline reads the same as a corpus that did not move.
 */
export function compareBaseline(
  baseline: Baseline | undefined,
  results: readonly AuditResult[],
  tolerances: Tolerances = {},
): Delta[] {
  return results.map((result) => {
    if (result.corpus === 'upstream') {
      return { id: result.id, kind: 'upstream' as const }
    }
    if (!result.tracked) return { id: result.id, kind: 'per-machine' as const }
    if (result.counts === undefined) {
      return { id: result.id, kind: 'unmeasured' as const }
    }

    const recorded = baseline?.checks[result.id]
    if (recorded === undefined) {
      return { id: result.id, kind: 'unrecorded' as const }
    }

    const moved: MovedCount[] = []
    const steady: string[] = []
    const added: { key: string; to: number }[] = []
    const dropped: { key: string; from: number }[] = []
    const tolerance = tolerances[result.id] ?? {}

    for (const [key, to] of Object.entries(result.counts)) {
      const from = recorded[key]
      if (from === undefined) {
        added.push({ key, to })
      } else if (from === to) {
        steady.push(key)
      } else {
        const count = { key, from, to, delta: to - from }
        moved.push(
          withinTolerance(from, to, tolerance[key])
            ? { ...count, tolerated: true }
            : count,
        )
      }
    }

    for (const [key, from] of Object.entries(recorded)) {
      if (!(key in result.counts)) dropped.push({ key, from })
    }

    return {
      id: result.id,
      kind: 'compared' as const,
      moved,
      steady,
      added,
      dropped,
    }
  })
}

function isBaseline(value: unknown): value is Baseline {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.recordedAt === 'string' &&
    typeof record.commit === 'string' &&
    typeof record.checks === 'object' &&
    record.checks !== null &&
    !Array.isArray(record.checks)
  )
}

/**
 * Reads the recorded floor, or `undefined` when none has been taken.
 * Absent is a first run. A broken file throws, since reading it as absent
 * would silently reset the floor the file exists to hold.
 */
export async function readBaseline(
  root: string,
): Promise<Baseline | undefined> {
  const path = resolveExisting([
    join(root, BASELINE_REL),
    join(root, LEGACY_BASELINE_REL),
  ])
  const rel = relative(root, path)

  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return undefined
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${rel} does not parse as JSON. Fix or delete it.`)
  }

  if (!isBaseline(parsed)) {
    throw new Error(
      `${rel} carries no recordedAt, commit, and checks. Fix or delete it.`,
    )
  }

  return parsed
}

export async function writeBaseline(
  root: string,
  baseline: Baseline,
): Promise<string> {
  const path = join(root, BASELINE_REL)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
  return path
}
