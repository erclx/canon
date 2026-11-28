import { existsSync, readFileSync } from 'node:fs'
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
import type { Check, Stage, StageScope } from '@/gate/stages'
import {
  acquireSuiteLock,
  type LockHolder,
  machineLockPath,
} from '@/gate/suite-lock'
import { gitEnv } from '@/git/env'
import { isOwnCheckout, PROJECT_ROOT } from '@/roots/project'

export type StageStatus =
  /** Every check ran and none found a fact. */
  | 'passed'
  /** The changed set carries nothing this stage reads. */
  | 'skipped'
  /** The stage could not read its input, so it has no verdict to give. */
  | 'unmeasured'
  /** A check found a fact. */
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
  /** Stage ids the caller left out by flag, each recorded as skipped. */
  readonly skip?: ReadonlySet<string>
  /** The merge base `changed` was read against, so a stage can read changed lines. */
  readonly base?: string
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
  /** The merge base the files were read against, present only when scoped. */
  readonly base?: string
  /** What to say about a baseline that did not resolve, if anything. */
  readonly notice?: string
}

/**
 * The branch's committed diff, the working tree, and untracked files as one
 * set, against `origin/main`, since local `main` on `main` is HEAD. Every
 * fallback widens.
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

  return { scoped: true, files, base }
}

/** An inclusive range of new-side line numbers a branch wrote. */
export interface LineSpan {
  readonly start: number
  readonly end: number
}

/** A file's changed lines, or `whole` for a file git does not track yet. */
export type ChangedLines = 'whole' | readonly LineSpan[]

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/

/**
 * Reads `git diff -U0` output into changed spans per new-side path. A pure
 * deletion after line `n` reads as the span `n` to `n + 1`. Answers `undefined`
 * on a header it cannot place, so a caller widens rather than passes.
 */
export function parseChangedLines(
  diff: string,
): Map<string, LineSpan[]> | undefined {
  const spans = new Map<string, LineSpan[]>()
  let current: LineSpan[] | undefined
  let inHeader = false
  let deleted = false
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      inHeader = true
      deleted = false
      current = undefined
      continue
    }
    if (inHeader && line.startsWith('+++ ')) {
      const path = line.slice(4)
      if (path === '/dev/null') deleted = true
      else if (!path.startsWith('b/')) return undefined
      else spans.set(path.slice(2), (current = []))
      continue
    }
    const hunk = HUNK_HEADER.exec(line)
    if (hunk === null) continue
    inHeader = false
    if (deleted) continue
    if (current === undefined) return undefined
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    current.push({ start, end: count === 0 ? start + 1 : start + count - 1 })
  }
  return spans
}

/**
 * The lines each of `paths` changed since `base`, across commits, the working
 * tree, and untracked files. A path with no entry changed no line. Answers
 * `undefined` when git cannot, so a caller widens rather than passes.
 */
export async function readChangedLines(
  run: RunCommand,
  base: string,
  paths: readonly string[],
): Promise<ReadonlyMap<string, ChangedLines> | undefined> {
  if (paths.length === 0) return new Map()
  const [diff, untracked] = await Promise.all([
    run([
      'git',
      'diff',
      '-U0',
      '--no-color',
      '--no-ext-diff',
      '--src-prefix=a/',
      '--dst-prefix=b/',
      base,
      '--',
      ...paths,
    ]),
    run(['git', 'ls-files', '--others', '--exclude-standard', '--', ...paths]),
  ])
  if (diff.exitCode !== 0 || untracked.exitCode !== 0) return undefined

  const spans = parseChangedLines(diff.stdout)
  if (spans === undefined) return undefined

  const lines = new Map<string, ChangedLines>(spans)
  for (const path of untracked.stdout.split('\n')) {
    if (path.trim() !== '') lines.set(path.trim(), 'whole')
  }
  return lines
}

/**
 * Whether a scoped stage has anything to read. Scoping being off answers yes
 * for every stage, which is what `--all` and an absent baseline both mean.
 */
export function hasChanged(
  scope: StageScope,
  changed: readonly string[] | undefined,
): boolean {
  if (changed === undefined) return true
  return changed.some((file) => scope.test(file))
}

/**
 * Runs one stage's checks in order, stopping at the first that finds a fact,
 * and pipes borrowed output on a pass too.
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

  const absent = stage.absent?.(ctx.root)
  if (absent !== undefined) {
    return {
      id: stage.id,
      label: stage.label,
      status: 'skipped',
      emissions: [{ kind: 'info', text: absent }],
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
    // The suite's own setup takes this lock, so the child is told it is held.
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
      // Under CI an absent input is a broken runner, so it refuses there.
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
    check.kind === 'cli'
      ? typeof check.argv === 'function'
        ? check.argv(ctx.root)
        : check.argv
      : check.changedArgv !== undefined && ctx.changed !== undefined
        ? check.changedArgv(ctx.changed)
        : check.argv
  const result = await run(argv, env)
  const emissions: Emission[] = [{ kind: 'output', text: result.all }]
  if (
    check.kind === 'command' &&
    check.scopedNote !== undefined &&
    argv.join(' ') !== check.argv.join(' ')
  ) {
    emissions.push({ kind: 'info', text: check.scopedNote })
  }
  return {
    emissions,
    failure: result.exitCode === 0 ? undefined : check.failure,
  }
}

/**
 * A regenerated surface asserted against the index and the untracked set, so
 * a regen emitting a file nobody committed fails. Either read takes one remedy.
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

/** The one stage a failure holds, being the slow suite behind a lock. */
const HELD_STAGE_ID = 'tests'

/**
 * Runs every stage in table order past a failure, holding `tests` behind one.
 */
export async function runStages(
  stages: readonly Stage[],
  ctx: GateContext,
  onResult?: (result: StageResult) => void,
): Promise<StageResult[]> {
  const results: StageResult[] = []

  for (const stage of stages) {
    const failed = results.find((entry) => entry.status === 'failed')
    const result = ctx.skip?.has(stage.id)
      ? flaggedResult(stage)
      : stage.id === HELD_STAGE_ID && failed !== undefined
        ? heldResult(stage, failed)
        : await runStage(stage, ctx)
    results.push(result)
    onResult?.(result)
  }

  return results
}

function flaggedResult(stage: Stage): StageResult {
  return {
    id: stage.id,
    label: stage.label,
    status: 'skipped',
    emissions: [{ kind: 'info', text: 'Skipped by --skip' }],
    ms: 0,
  }
}

function heldResult(stage: Stage, failed: StageResult): StageResult {
  return {
    id: stage.id,
    label: stage.label,
    status: 'skipped',
    emissions: [
      { kind: 'info', text: `Held, the ${failed.label} stage failed` },
    ],
    ms: 0,
  }
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
 * One code for a failure. An unmeasured stage takes none, since it already
 * refuses under CI and a second code would name a state nobody branches on.
 */
export function exitCodeFor(results: readonly StageResult[]): number {
  return results.some((result) => result.status === 'failed') ? 1 : 0
}

/**
 * Spawns a command from the project root with git's resolution variables
 * stripped, since a hook's `GIT_DIR` beats the working directory.
 */
export function commandRunner(root: string): RunCommand {
  return async (argv, env) => spawn(argv[0], argv.slice(1), root, env)
}

/**
 * The CLI a stage spawns: a canon checkout's own, since several verbs write
 * through the install's root, and this install's anywhere else.
 */
export function cliEntry(root: string): string {
  const own = join(root, 'src', 'cli.ts')
  return isOwnCheckout(root) && existsSync(own)
    ? own
    : join(PROJECT_ROOT, 'src', 'cli.ts')
}

/** Spawns the CLI `cliEntry` names, with the checked project as its cwd. */
export function cliRunner(root: string): RunCommand {
  const cli = cliEntry(root)
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
