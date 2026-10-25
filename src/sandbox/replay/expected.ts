import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StepResult } from '@/sandbox/replay/run'

/** Sits in a snapshot's folder beside its `.fixture` files and never reaches the replay tree. */
export const EXPECTED_FILE = 'expected.json'

export interface StepExpectation {
  readonly exit: number | null
  readonly findings: number
}

/**
 * A snapshot's recorded answer, keyed by step name. It pins the exit and the
 * finding count rather than the finding lines, so rewording a warning moves
 * nothing while a seed sync newly calls missing still drifts.
 */
export interface ReplayExpectation {
  readonly steps: Readonly<Record<string, StepExpectation>>
}

const RECORD_HINT =
  'run bun src/cli.ts sandbox replay --record if the change meant it'

export function expectationOf(steps: readonly StepResult[]): ReplayExpectation {
  return {
    steps: Object.fromEntries(
      steps.map((s) => [s.step, { exit: s.exit, findings: s.findings.length }]),
    ),
  }
}

function isStepExpectation(value: unknown): value is StepExpectation {
  if (typeof value !== 'object' || value === null) return false
  const { exit, findings } = value as Record<string, unknown>

  return (
    (exit === null || typeof exit === 'number') && typeof findings === 'number'
  )
}

/**
 * The expectation recorded in `dir`, or undefined when none is. Throws naming
 * the file and the step when the file holds anything but the recorded shape.
 */
export function readExpectation(dir: string): ReplayExpectation | undefined {
  const path = join(dir, EXPECTED_FILE)
  if (!existsSync(path)) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new Error(`${path} does not parse as JSON`)
  }
  const steps =
    typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>).steps
      : undefined
  if (typeof steps !== 'object' || steps === null)
    throw new Error(`${path} carries no steps object`)
  for (const [name, value] of Object.entries(steps))
    if (!isStepExpectation(value))
      throw new Error(
        `${path}: step ${name} needs an exit and a findings count`,
      )

  return { steps: steps as ReplayExpectation['steps'] }
}

/** Written the way oxfmt leaves JSON, so a recorded file never fails the format stage. */
export function writeExpectation(
  dir: string,
  expectation: ReplayExpectation,
): void {
  writeFileSync(
    join(dir, EXPECTED_FILE),
    `${JSON.stringify(expectation, null, 2)}\n`,
  )
}

function driftOf(
  run: StepResult,
  recorded: StepExpectation | undefined,
): string | undefined {
  if (recorded === undefined) return `no recorded answer, ${RECORD_HINT}`
  if (run.exit !== recorded.exit)
    return `exit ${run.exit}, recorded ${recorded.exit}`
  if (run.findings.length !== recorded.findings)
    return `${run.findings.length} findings, recorded ${recorded.findings}`

  return undefined
}

/**
 * Judges a snapshot's steps against its recorded answer. A step that already
 * failed keeps its verdict, since a crash names more than a changed exit. A
 * step either side lacks drifts, and with no expectation at all every step
 * does, since a missing input read as a pass is what the replay exists to stop.
 */
export function judgeDrift(
  steps: readonly StepResult[],
  expectation: ReplayExpectation | undefined,
): StepResult[] {
  if (expectation === undefined)
    return steps.map((s) =>
      s.verdict === 'ok'
        ? {
            ...s,
            verdict: 'drifted',
            detail: `no ${EXPECTED_FILE} for this snapshot, run bun src/cli.ts sandbox replay --record`,
          }
        : s,
    )

  const judged = steps.map((s) => {
    if (s.verdict !== 'ok') return s
    const detail = driftOf(s, expectation.steps[s.step])

    return detail === undefined
      ? s
      : { ...s, verdict: 'drifted' as const, detail }
  })
  const ran = new Set(steps.map((s) => s.step))
  const dropped = Object.keys(expectation.steps)
    .filter((name) => !ran.has(name))
    .map((name): StepResult => ({
      step: name,
      argv: [],
      exit: null,
      verdict: 'drifted',
      detail: `recorded but did not run, ${RECORD_HINT}`,
      findings: [],
    }))

  return [...judged, ...dropped]
}
