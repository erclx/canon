import { join } from 'node:path'
import { execa } from 'execa'
import type { Delta } from '@/audits/baseline'
import {
  type AuditResult,
  type AuditSpec,
  classify,
  type Corpus,
} from '@/audits/catalog'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'

/** Every value a corpus filter accepts, matching the `Corpus` union. */
export const CORPORA: readonly Corpus[] = ['tracked', 'per-machine', 'upstream']

/**
 * The catalog scoped to the requested corpora, or the whole set when none
 * were named. `--corpus` on `audits run` reads this, and so does `auditSet`
 * in `src/gate/measures.ts`, which excludes the upstream corpus so the gate
 * reads only what describes this tree.
 */
export function auditsFor(
  specs: readonly AuditSpec[],
  requested: readonly string[],
): readonly AuditSpec[] {
  if (requested.length === 0) return specs
  return specs.filter((spec) => requested.includes(spec.corpus))
}

/** At least one audit reported a finding that is a fact. */
export const EXIT_FINDING = 2

/** At least one audit did not report, so the run measured less than the set. */
export const EXIT_UNMEASURED = 3

export type Verdict =
  /** Every audit reported and every count it produced was zero. */
  | 'clean'
  /** Every audit reported and at least one carries a judgment finding. */
  | 'reported'
  /** At least one audit carries a finding that is a fact. */
  | 'findings'
  /** At least one audit did not report, so this is not a pass. */
  | 'incomplete'

export interface SpawnResult {
  readonly exitCode: number
  readonly stdout: string
}

export type Spawn = (spec: AuditSpec) => Promise<SpawnResult>

/**
 * Runs each verb out of the checkout this CLI is executing from.
 *
 * `process.execPath` and the resolved `cli.ts` rather than a bare `canon`, for
 * the reason `cliRunner` in `src/gate/sequencer.ts` already names: a globally
 * installed binary resolves to
 * the main checkout no matter which worktree is running, so the aggregate would
 * measure the wrong tree and report a pass over a branch it never read.
 *
 * `reject: false` because a findings exit is the ordinary outcome for half of
 * these verbs, and a throw there would be an error path for a working check.
 */
export function spawnAudit(root: string): Spawn {
  const cli = join(PROJECT_ROOT, 'src', 'cli.ts')

  return async (spec) => {
    const result = await execa(process.execPath, [cli, ...spec.argv], {
      cwd: root,
      reject: false,
      // `gitEnv` already returns the whole ambient environment minus git's
      // resolution variables, so it replaces the environment rather than
      // extending it. Spreading `process.env` alongside would put back the very
      // variables it strips, and a hook's `GIT_DIR` would then point every
      // history-reading verb at a repository nobody asked about.
      env: { ...gitEnv(), CANON_NON_INTERACTIVE: '1' },
      extendEnv: false,
    })

    return { exitCode: result.exitCode ?? 1, stdout: result.stdout }
  }
}

/**
 * Runs every audit and reads each one's own record shape.
 *
 * The verbs walk separate trees and share no state, so they run together
 * rather than in sequence. Serially, the aggregate would be the slowest thing
 * in the verify pipeline for no reason beyond the order they were written in.
 *
 * A spawn that throws becomes an `unmeasured` result rather than a rejection.
 * One absent binary would otherwise take the whole aggregate down and report
 * nothing about the audits that did run.
 */
export async function runAudits(
  specs: readonly AuditSpec[],
  spawn: Spawn,
): Promise<AuditResult[]> {
  return Promise.all(
    specs.map(async (spec) => {
      const startedAt = performance.now()
      try {
        const { exitCode, stdout } = await spawn(spec)
        return classify(spec, exitCode, stdout, performance.now() - startedAt)
      } catch (error) {
        return {
          id: spec.id,
          label: spec.label,
          status: 'unmeasured' as const,
          tracked: spec.corpus === 'tracked',
          corpus: spec.corpus,
          exitCode: 1,
          reason: `could not be started: ${error instanceof Error ? error.message : String(error)}`,
          ms: performance.now() - startedAt,
        }
      }
    }),
  )
}

/**
 * The single verdict over the set.
 *
 * `incomplete` outranks a quiet set on purpose. An aggregate reporting a pass
 * over a tree it did not finish measuring is the failure this whole command
 * exists against, and an empty set takes it for the same reason: nothing ran,
 * so nothing passed.
 *
 * An `absent` per-machine corpus does not reach it. That folder is gitignored
 * and missing on every fresh clone, so folding it in would pin the verdict at
 * `incomplete` on every CI run and leave the word meaning nothing.
 */
export function verdictOf(results: readonly AuditResult[]): Verdict {
  if (results.length === 0) return 'incomplete'
  if (results.some((result) => result.status === 'finding')) return 'findings'
  if (results.some((result) => result.status === 'unmeasured')) {
    return 'incomplete'
  }
  if (results.some((result) => result.status === 'reported')) return 'reported'
  return 'clean'
}

/**
 * Exits non-zero only on a fact, which is the split this aggregate inherits
 * rather than moves. A growing judgment count reports as a delta and fails
 * nothing, because the standards behind those measures set no hard cap.
 *
 * An audit that did not report takes its own code rather than the findings one.
 * The two mean opposite things to whoever reads the exit: a fact is a defect in
 * the tree, and an unmeasured audit is a defect in the run.
 */
export function exitCodeFor(results: readonly AuditResult[]): number {
  const verdict = verdictOf(results)
  if (verdict === 'findings') return EXIT_FINDING
  if (verdict === 'incomplete') return EXIT_UNMEASURED
  return 0
}

export interface Summary {
  readonly verdict: Verdict
  /** Audits that reported, out of the whole set. */
  readonly audited: number
  /** Audits carrying a finding that is a fact. */
  readonly facts: number
  /** Audits that did not report at all. */
  readonly unmeasured: number
  /**
   * Audits whose per-machine folder is not on this disk.
   *
   * Published rather than folded into `audited`, so a run stating twelve
   * audits never implies twelve corpora were read.
   */
  readonly absent: number
  /** Tracked counts that rose against the recorded floor. */
  readonly grown: number
  /** Tracked counts that fell against the recorded floor. */
  readonly shrunk: number
  /** Tracked audits with no recorded floor to compare against. */
  readonly unrecorded: number
}

/**
 * The flat reading a shell stage takes without parsing the nested record.
 *
 * Published rather than left to a consumer to derive, for the reason the
 * context audit already gives about its own join: deriving it means restating
 * which question each number answers, and one wrong restatement is growth
 * reported against a measure that never moved. Every key here is unique across
 * the whole record, so a grep for one reaches the top level alone.
 */
export function summarize(
  results: readonly AuditResult[],
  deltas: readonly Delta[],
): Summary {
  let grown = 0
  let shrunk = 0
  let unrecorded = 0

  for (const delta of deltas) {
    if (delta.kind === 'unrecorded') {
      unrecorded += 1
      continue
    }
    if (delta.kind !== 'compared') continue

    for (const moved of delta.moved) {
      if (moved.delta > 0) grown += 1
      else shrunk += 1
    }
  }

  const counting = (status: AuditResult['status']) =>
    results.filter((result) => result.status === status).length

  return {
    verdict: verdictOf(results),
    audited: results.filter(
      (result) => result.status !== 'unmeasured' && result.status !== 'absent',
    ).length,
    facts: counting('finding'),
    unmeasured: counting('unmeasured'),
    absent: counting('absent'),
    grown,
    shrunk,
    unrecorded,
  }
}
