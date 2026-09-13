import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AuditResult } from '@/audits/catalog'

/**
 * Where the retained counts live, relative to the project root.
 *
 * Committed rather than per-machine, because the question this half answers is
 * whether a number grew since anyone last looked, and a fresh checkout has to
 * inherit that answer. A per-machine record makes every contributor's first run
 * a first run.
 *
 * Under the project root rather than beside the aggregator in `src/`, because
 * the numbers describe one repository's corpus and `src/` ships to every target
 * that installs the CLI. A baseline in the package would hand a target this
 * repository's counts to measure its own tree against.
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
 * Builds the record a run leaves behind.
 *
 * Only a tracked corpus is retained. A gitignored record folder holds one
 * machine's session scratch, so committing its counts writes a floor no other
 * clone can reproduce, and every contributor would read a regression against a
 * number that describes somebody else's disk. An upstream count is left out
 * for the mirror-image reason: it moves when an advisory is published, so a
 * recorded floor would report growth against a tree nobody touched.
 *
 * An audit that did not report is left out rather than written as zero. Zeros
 * there record a clean corpus nobody measured, and the next run reads its real
 * numbers as a regression against a floor that was never taken.
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
 *
 * A first run reports `unrecorded` rather than a delta of zero. A zero delta
 * against an absent baseline says the same thing as a corpus that did not move,
 * and those are the two states this repository has already had to separate
 * twice elsewhere.
 */
export function compareBaseline(
  baseline: Baseline | undefined,
  results: readonly AuditResult[],
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

    for (const [key, to] of Object.entries(result.counts)) {
      const from = recorded[key]
      if (from === undefined) {
        added.push({ key, to })
      } else if (from === to) {
        steady.push(key)
      } else {
        moved.push({ key, from, to, delta: to - from })
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
 *
 * An absent file and a broken one are different answers. Absent is a first run.
 * Broken is a record someone hand-edited into a shape nothing can read, and
 * reading that as absent would silently reset the floor the file exists to hold.
 */
export async function readBaseline(
  root: string,
): Promise<Baseline | undefined> {
  const rel = existsSync(join(root, BASELINE_REL))
    ? BASELINE_REL
    : LEGACY_BASELINE_REL
  const path = join(root, rel)

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
