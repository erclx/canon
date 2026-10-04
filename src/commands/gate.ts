import type { Command } from 'commander'
import {
  cliRunner,
  collectChangedFiles,
  commandRunner,
  exitCodeFor,
  type GateContext,
  type StageResult,
  type Summary,
  runStages,
  summarize,
} from '@/gate/sequencer'
import { STAGES } from '@/gate/stages'
import { checkoutMismatchWarning, PROJECT_ROOT } from '@/roots/project'
import {
  intro,
  logError,
  logInfo,
  logStep,
  logWarn,
  outro,
  palette,
  pipeOutput,
  plural,
} from '@/cli/ui'
import { repairBareFlag } from '@/worktrees/bare-flag'

interface RunCommandOptions {
  readonly all?: boolean
  readonly write?: boolean
  readonly nested?: boolean
  readonly json?: boolean
}

export function register(program: Command): void {
  const gate = program
    .command('gate')
    .description('Run the merge gate this repository verifies a branch with')
    .helpOption('-h, --help', 'Show this help message')

  gate
    .command('run')
    .description(
      'Run every gating stage in order, scoping shell, types, and tests to the changed set',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--all',
      'Run every stage instead of scoping shell, types, and tests to changed files',
    )
    .option(
      '--no-write',
      'Check formatting instead of applying it, which is what a merge gate wants',
    )
    .option(
      '--nested',
      'Suppress the outer frame when another script opened one',
    )
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every stage that ran reported, and none found a fact',
        '  1  a stage found a fact, or could not measure its input under CI',
        '',
        'A stage halts the run, so clearing a regenerate-then-assert stage',
        'reveals the next one behind it rather than the whole set at once.',
        '',
        'A stage that cannot read its input reports rather than passing. On a',
        "contributor's machine that is a warning and the run still exits 0,",
        'because an absent tool there is somebody mid-setup. Under CI it',
        'refuses, because the same absence is a broken workflow step and a',
        'green run over a stage that measured nothing is the pass the gate',
        'exists to withhold.',
        '',
        'Examples:',
        '  canon gate run',
        '  canon gate run --all --no-write',
        '  canon gate run --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RunCommandOptions) => {
      process.exitCode = await runGate(opts)
    })
}

async function runGate(opts: RunCommandOptions): Promise<number> {
  const root = PROJECT_ROOT
  const mismatch = checkoutMismatchWarning(process.cwd())
  const emitJson = opts.json ?? false
  const nested = opts.nested ?? false
  const write = opts.write ?? true
  const run = commandRunner(root)

  if (!emitJson && !nested) intro('canon gate run')

  const repair = await repairBareFlag(root)
  if (repair.message !== null) logWarn(repair.message)

  const changed = opts.all
    ? { scoped: false, files: [] }
    : await collectChangedFiles(run)
  if (!emitJson && changed.notice !== undefined) logWarn(changed.notice)
  if (mismatch !== undefined) logWarn(mismatch)

  const ctx: GateContext = {
    root,
    ci: process.env.CI === 'true',
    run,
    cli: cliRunner(root),
    write,
    changed: changed.scoped ? changed.files : undefined,
    onQueue: (label, holder) => {
      const text = `${label} is waiting for the suite pid ${holder.pid} runs at ${holder.root}`
      // stderr in both modes, so a JSON caller's stdout stays one record.
      if (emitJson) process.stderr.write(`${text}\n`)
      else logWarn(text)
    },
  }

  const results = await runStages(
    STAGES,
    ctx,
    emitJson ? undefined : (result) => report(result),
  )
  const summary = summarize(results)
  const code = exitCodeFor(results)

  if (emitJson) {
    const failed = results.find((result) => result.status === 'failed')
    // Diagnostics reach stderr in every mode, so a caller reading the record
    // alone is not the only one told what went wrong.
    if (failed?.failure !== undefined) {
      process.stderr.write(`${failed.label}: ${failed.failure}\n`)
    }
    process.stdout.write(
      `${JSON.stringify({
        ok: code === 0,
        root,
        scoped: changed.scoped,
        changed: changed.files.length,
        summary,
        ms: results.reduce((total, result) => total + result.ms, 0),
        stages: results.map(({ id, label, status, failure, ms, queuedMs }) => ({
          id,
          label,
          status,
          failure,
          ms,
          queuedMs,
        })),
      })}\n`,
    )
    return code
  }

  if (!nested) close(summary, code)
  return code
}

function report(result: StageResult): void {
  logStep(result.label)
  for (const emission of result.emissions) {
    if (emission.kind === 'info') logInfo(emission.text)
    else if (emission.kind === 'warn') logWarn(emission.text)
    else pipeOutput(emission.text)
  }
  if (result.failure !== undefined) logError(result.failure)
}

/**
 * The closing verdict, which names what the run did not measure rather than
 * reporting a bare pass over it.
 *
 * A run where every stage read its input still closes on the line the script
 * this replaces closed on, so nothing about the ordinary case moved. A run
 * carrying an unmeasured stage says so, because a green line over a stage that
 * looked at nothing is exactly the silence the reporting outcome exists
 * against.
 */
function close(summary: Summary, code: number): void {
  const { GREEN, NC, RED, YELLOW } = palette(process.stderr)
  outro()

  if (code !== 0) {
    process.stderr.write(`${RED}✗ Verification failed${NC}\n\n`)
    return
  }

  if (summary.unmeasured > 0) {
    process.stderr.write(
      `${YELLOW}! Verification passed, ${plural(summary.unmeasured, 'stage')} measured nothing${NC}\n\n`,
    )
    return
  }

  process.stderr.write(`${GREEN}✓ Verification passed${NC}\n\n`)
}
