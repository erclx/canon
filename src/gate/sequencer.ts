import { join } from 'node:path'
import { execa } from 'execa'
import type {
  CommandResult,
  Emission,
  MeasureContext,
  RunCommand,
} from '@/gate/measures'
import type { Check, Stage } from '@/gate/stages'
import { gitEnv } from '@/git/env'
import { PROJECT_ROOT } from '@/project-root'

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
  /** Wall time the stage's checks took, including every process spawn. */
  readonly ms: number
}

export interface GateContext extends MeasureContext {
  /** Whether the format stage writes or checks. */
  readonly write: boolean
  /**
   * The changed set a scoped stage is read against, or `undefined` where
   * scoping is off and every stage runs.
   */
  readonly changed?: readonly string[]
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

  const emissions: Emission[] = []

  for (const check of stage.checks) {
    const outcome = await runCheck(check, ctx)
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

async function runCheck(check: Check, ctx: GateContext): Promise<CheckOutcome> {
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
  const result = await run(check.argv)
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
    if (stage.when !== undefined && !stage.when({ write: ctx.write })) continue

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
  return async (argv) => spawn(argv[0], argv.slice(1), root)
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
  return async (argv) => spawn(process.execPath, [cli, ...argv], root)
}

async function spawn(
  file: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> {
  const result = await execa(file, [...args], {
    cwd,
    reject: false,
    all: true,
    env: { ...gitEnv(), CANON_NON_INTERACTIVE: '1' },
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
