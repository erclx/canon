import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import type {
  CommandResult,
  Emission,
  MeasureContext,
  RunCommand,
} from '@/gate/measures'
import { HELD_LOCK_VARIABLE } from '@/gate/hand-suite'
import type { Check, Stage } from '@/gate/stages'
import {
  acquireSuiteLock,
  type LockHolder,
  machineLockPath,
} from '@/gate/suite-lock'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/roots/project'

export type StageStatus =
  /** Every check ran and none found a fact. */
  | 'passed'
  /** The changed set carries nothing this stage reads. */
  | 'skipped'
  /** The stage could not read its input, so it has no verdict to give. */
  | 'unmeasured'
  /** A check found a fact, which stops the run here. */
  | 'failed'

export interface StageResult {
  readonly id: string
  readonly label: string
  readonly status: StageStatus
  readonly emissions: readonly Emission[]
  /** The remedy line a failed stage prints, naming what to do about it. */
  readonly failure?: string
  /**
   * Wall time the stage took, including every process spawn and, on a stage
   * holding a machine lock, the time it queued behind another worktree.
   */
  readonly ms: number
  /**
   * The part of `ms` spent queued behind another worktree's hold on the stage's
   * machine lock. Absent where the stage never waited.
   */
  readonly queuedMs?: number
}

export interface LoadReading {
  /** The 1-minute load average. */
  readonly loadAverage: number
  readonly cores: number
  /**
   * The `some avg10` stall share per resource from `/proc/pressure`, which the
   * load average folds into one number. Absent where the kernel has no PSI.
   */
  readonly pressure?: PressureReading
}

export interface PressureReading {
  readonly cpu: number
  readonly memory: number
  readonly io: number
}

/**
 * Reads the `some avg10` percentage from one `/proc/pressure/<resource>` file.
 * A file that does not parse answers `undefined`, which drops the clause.
 */
export function parsePressure(text: string): number | undefined {
  const match = /^some\b.*\bavg10=(\d+(?:\.\d+)?)\b/m.exec(text)
  if (match === null) return undefined
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) ? value : undefined
}

function readPressure(): PressureReading | undefined {
  try {
    const read = (name: string) =>
      parsePressure(readFileSync(`/proc/pressure/${name}`, 'utf8'))
    const cpu = read('cpu')
    const memory = read('memory')
    const io = read('io')
    if (cpu === undefined || memory === undefined || io === undefined) {
      return undefined
    }
    return { cpu, memory, io }
  } catch {
    // PSI off or absent: the files may exist and still fail with EOPNOTSUPP.
    return undefined
  }
}

/**
 * Reads the 1-minute load average from `/proc/loadavg`. A platform without
 * it, as macOS, has no reading to give, so this answers `undefined` rather
 * than throwing into a stage that has already failed.
 */
export function readProcLoad(): LoadReading | undefined {
  try {
    const first = readFileSync('/proc/loadavg', 'utf8').split(' ')[0]
    const loadAverage = Number.parseFloat(first)
    if (!Number.isFinite(loadAverage)) return undefined
    const pressure = readPressure()
    return {
      loadAverage,
      cores: availableParallelism(),
      ...(pressure === undefined ? {} : { pressure }),
    }
  } catch {
    return undefined
  }
}

export interface GateContext extends MeasureContext {
  /**
   * The changed set a scoped stage is read against, or `undefined` where
   * scoping is off and every stage runs.
   */
  readonly changed?: readonly string[]
  /**
   * Told when a stage starts queuing on its machine lock. A stage prints only
   * once it returns, so without this a queued gate is silent for the whole
   * wait and reads as a hung suite.
   */
  readonly onQueue?: (label: string, holder: LockHolder) => void
  /**
   * Reads the machine load a failed locked stage ran under. Defaults to
   * `/proc/loadavg`, and answers `undefined` where there is none.
   */
  readonly readLoad?: () => LoadReading | undefined
}

export interface ChangedSet {
  /** `false` where no usable baseline resolved, which runs every stage. */
  readonly scoped: boolean
  readonly files: readonly string[]
  /** What to say about a baseline that did not resolve, if anything. */
  readonly notice?: string
}

/**
 * The branch's committed diff, the working tree, and untracked files as one
 * set. A wider set only means running more stages, so every fallback widens.
 *
 * The baseline is `origin/main` rather than local `main`. On `main` itself the
 * local ref is HEAD, so a merge base against it resolves to HEAD and every
 * commit not yet pushed drops out of the changed set, which would skip the
 * scoped stages on a direct push.
 */
export async function collectChangedFiles(
  run: RunCommand,
): Promise<ChangedSet> {
  const remote = await run(['git', 'merge-base', 'HEAD', 'origin/main'])
  let base = remote.exitCode === 0 ? remote.stdout.trim() : ''
  let localBaseline = false

  if (base === '') {
    localBaseline = true
    const local = await run(['git', 'merge-base', 'HEAD', 'main'])
    base = local.exitCode === 0 ? local.stdout.trim() : ''
  }

  if (base === '') {
    return {
      scoped: false,
      files: [],
      notice: 'No merge base with main. Running every stage.',
    }
  }

  // Without a remote baseline, a merge base equal to HEAD hides committed work.
  if (localBaseline) {
    const head = await run(['git', 'rev-parse', 'HEAD'])
    const revision = head.exitCode === 0 ? head.stdout.trim() : ''
    if (revision === '' || revision === base) {
      return {
        scoped: false,
        files: [],
        notice: 'No pushed baseline to compare against. Running every stage.',
      }
    }
  }

  const listings = await Promise.all([
    run(['git', 'diff', '--name-only', base, 'HEAD']),
    run(['git', 'diff', '--name-only', 'HEAD']),
    run(['git', 'ls-files', '--others', '--exclude-standard']),
  ])

  const files = [
    ...new Set(
      listings
        .flatMap((listing) => listing.stdout.split('\n'))
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    ),
  ].sort()

  return { scoped: true, files }
}

/**
 * Whether a scoped stage has anything to read. Scoping being off answers yes
 * for every stage, which is what `--all` and an absent baseline both mean.
 */
export function hasChanged(
  scope: RegExp,
  changed: readonly string[] | undefined,
): boolean {
  if (changed === undefined) return true
  return changed.some((file) => scope.test(file))
}

/**
 * Runs one stage's checks in order, stopping at the first that finds a fact.
 *
 * Borrowed output is piped whether the check passed or failed, which is what
 * the script this replaces did with a `2>&1` capture and a single
 * `pipe_output`. Keeping the pass side means a run of the old script and a run
 * of this one can be diffed line for line, which is the only evidence
 * available that a port of this size changed no verdict.
 */
export async function runStage(
  stage: Stage,
  ctx: GateContext,
): Promise<StageResult> {
  const startedAt = performance.now()
  const result = await executeStage(stage, ctx)
  return { ...result, ms: performance.now() - startedAt }
}

type StageOutcome = Omit<StageResult, 'ms'>

async function executeStage(
  stage: Stage,
  ctx: GateContext,
): Promise<StageOutcome> {
  if (stage.scope !== undefined && !hasChanged(stage.scope, ctx.changed)) {
    return {
      id: stage.id,
      label: stage.label,
      status: 'skipped',
      emissions: [
        { kind: 'info', text: stage.skipped ?? 'Skipped, nothing to read' },
      ],
    }
  }

  // CI runs one suite per runner, so a lock there queues behind nothing.
  if (stage.lock === undefined || ctx.ci) return runChecks(stage, ctx, [], {})

  const held = await acquireSuiteLock({
    path: machineLockPath(stage.lock),
    root: ctx.root,
    onWait: (holder) => ctx.onQueue?.(stage.label, holder),
  })
  const queued: Emission[] =
    held.waitedOn === undefined
      ? []
      : [
          {
            kind: 'info',
            text: `Waited ${Math.round(held.waitedMs / 1000)}s for the ${stage.label} stage another worktree held, at ${held.waitedOn.root}`,
          },
        ]

  try {
    // The suite's own global setup takes this lock for a hand run, so the
    // child is told its parent holds it rather than waiting on the parent.
    const outcome = withLoadLine(
      await runChecks(stage, ctx, queued, { [HELD_LOCK_VARIABLE]: stage.lock }),
      stage,
      ctx,
    )
    return held.waitedOn === undefined
      ? outcome
      : { ...outcome, queuedMs: held.waitedMs }
  } finally {
    held.release()
  }
}

/**
 * The lock serializes suites and does nothing about the rest of the box, so a
 * starved spawn test and a real failure read alike. The load beside the
 * failure is what lets a report tell them apart.
 */
function withLoadLine(
  outcome: StageOutcome,
  stage: Stage,
  ctx: GateContext,
): StageOutcome {
  if (outcome.status !== 'failed') return outcome

  const reading = (ctx.readLoad ?? readProcLoad)()
  if (reading === undefined) return outcome

  const { pressure } = reading
  const stalls =
    pressure === undefined
      ? ''
      : `, pressure cpu ${pressure.cpu.toFixed(1)}% memory ${pressure.memory.toFixed(1)}% io ${pressure.io.toFixed(1)}% over 10s,`
  const text = `Load average ${reading.loadAverage} on ${reading.cores} cores${stalls} when the ${stage.label} stage failed`
  return {
    ...outcome,
    emissions: [...outcome.emissions, { kind: 'info', text }],
  }
}

async function runChecks(
  stage: Stage,
  ctx: GateContext,
  leading: readonly Emission[],
  env: Readonly<Record<string, string>>,
): Promise<StageOutcome> {
  const emissions: Emission[] = [...leading]

  for (const check of stage.checks) {
    const outcome = await runCheck(check, ctx, env)
    emissions.push(...outcome.emissions)

    if (outcome.failure !== undefined) {
      return {
        id: stage.id,
        label: stage.label,
        status: 'failed',
        emissions,
        failure: outcome.failure,
      }
    }

    if (outcome.unmeasured !== undefined) {
      // Under CI an absent input is a broken runner rather than a machine
      // mid-setup, so the same reading refuses there and warns here. Skipping
      // on both would report the pass the stage exists to withhold.
      if (ctx.ci) {
        return {
          id: stage.id,
          label: stage.label,
          status: 'failed',
          emissions,
          failure: `${outcome.unmeasured} Under CI that is a broken runner rather than a machine mid-setup, so this refuses rather than passing.`,
        }
      }
      emissions.push({ kind: 'warn', text: outcome.unmeasured })
      return {
        id: stage.id,
        label: stage.label,
        status: 'unmeasured',
        emissions,
      }
    }
  }

  if (stage.success !== undefined) {
    emissions.push({ kind: 'info', text: stage.success })
  }

  return { id: stage.id, label: stage.label, status: 'passed', emissions }
}

interface CheckOutcome {
  readonly emissions: readonly Emission[]
  readonly failure?: string
  readonly unmeasured?: string
}

async function runCheck(
  check: Check,
  ctx: GateContext,
  env: Readonly<Record<string, string>>,
): Promise<CheckOutcome> {
  if (check.kind === 'measure') {
    const report = await check.measure(ctx)
    return {
      emissions: report.emissions,
      failure: report.failure,
      unmeasured: report.unmeasured,
    }
  }

  if (check.kind === 'drift') {
    return runDrift(check.pathspec, check.failure, ctx)
  }

  const run = check.kind === 'cli' ? ctx.cli : ctx.run
  const argv =
    check.kind === 'command' &&
    check.changedArgv !== undefined &&
    ctx.changed !== undefined
      ? check.changedArgv(ctx.changed)
      : check.argv
  const result = await run(argv, env)
  return {
    emissions: [{ kind: 'output', text: result.all }],
    failure: result.exitCode === 0 ? undefined : check.failure,
  }
}

/**
 * A regenerated surface asserted against both the index and the untracked set.
 *
 * The diff alone passes a regen that emitted a file nobody ever committed, so
 * the listing beside it is what makes the assert cover an arrival as well as an
 * edit. Either read failing yields the stage's one remedy line rather than a
 * message of its own, which is what the shell this replaces did with the same
 * string on both of its calls: the remedy is the same either way, since the
 * fix is to stage what the regen wrote.
 */
async function runDrift(
  pathspec: string,
  failure: string,
  ctx: GateContext,
): Promise<CheckOutcome> {
  const diff = await ctx.run([
    'git',
    'diff',
    '--exit-code',
    '--quiet',
    '--',
    pathspec,
  ])
  const untracked = await ctx.run([
    'git',
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    pathspec,
  ])

  const emissions: Emission[] = [
    { kind: 'output', text: diff.all },
    { kind: 'output', text: untracked.all },
  ]

  const drifted = diff.exitCode !== 0 || untracked.stdout.trim() !== ''
  return { emissions, failure: drifted ? failure : undefined }
}

/**
 * Runs the stages in table order and stops at the first failure.
 *
 * Stopping is what the script this replaces did with `set -e` and an exiting
 * log line, and it is load bearing for the regenerate-then-assert stages:
 * clearing one reveals the next behind it, so a branch touching several
 * regenerated surfaces costs a stage per surface rather than one round.
 */
export async function runStages(
  stages: readonly Stage[],
  ctx: GateContext,
  onResult?: (result: StageResult) => void,
): Promise<StageResult[]> {
  const results: StageResult[] = []

  for (const stage of stages) {
    const result = await runStage(stage, ctx)
    results.push(result)
    onResult?.(result)
    if (result.status === 'failed') break
  }

  return results
}

export interface Summary {
  /** Stages that ran, whatever they concluded. */
  readonly ran: number
  readonly passed: number
  readonly skipped: number
  readonly unmeasured: number
  readonly failed: number
}

export function summarize(results: readonly StageResult[]): Summary {
  const counting = (status: StageStatus) =>
    results.filter((result) => result.status === status).length

  return {
    ran: results.length,
    passed: counting('passed'),
    skipped: counting('skipped'),
    unmeasured: counting('unmeasured'),
    failed: counting('failed'),
  }
}

/**
 * One code for a failure, which is what a `bun run` caller and a git hook both
 * read. A stage that could not measure does not take a code of its own here,
 * because it has already refused under CI and reports on a contributor's
 * machine, so a second code would name a state no caller branches on.
 */
export function exitCodeFor(results: readonly StageResult[]): number {
  return results.some((result) => result.status === 'failed') ? 1 : 0
}

/**
 * Spawns a command from the project root with git's resolution variables
 * stripped.
 *
 * A git hook exports `GIT_DIR`, which takes precedence over the working
 * directory, so a stage reading history would resolve against whatever
 * repository the hook points at rather than the tree being verified.
 */
export function commandRunner(root: string): RunCommand {
  return async (argv, env) => spawn(argv[0], argv.slice(1), root, env)
}

/**
 * Spawns this checkout's own CLI rather than whatever `canon` resolves to.
 *
 * A globally installed binary resolves to the main checkout no matter which
 * worktree is running, so a gate reading through it would measure the wrong
 * tree and report a pass over a branch it never opened.
 */
export function cliRunner(root: string): RunCommand {
  const cli = join(PROJECT_ROOT, 'src', 'cli.ts')
  return async (argv, env) => spawn(process.execPath, [cli, ...argv], root, env)
}

async function spawn(
  file: string,
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>> = {},
): Promise<CommandResult> {
  const result = await execa(file, [...args], {
    cwd,
    reject: false,
    all: true,
    env: { ...gitEnv(), ...env },
    extendEnv: false,
  })

  const code = (result as { code?: string }).code
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    all: result.all ?? '',
    spawnError: code === 'ENOENT' ? `${file} is not on PATH` : undefined,
  }
}
