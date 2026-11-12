import { relative } from 'node:path'
import { type Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  type ArchiveOutcome,
  archiveTask,
  type DeclineOutcome,
  declineTask,
  type InboundRelink,
  type PlanMove,
  type RelinkFailure,
} from '@/tasks/archive'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
  pipeOutput,
} from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

/** Matches `trunk.ts`'s bound on a git subprocess this verb also shells out to. */
const GIT_TIMEOUT_MS = 10_000

interface ArchiveCommandOptions {
  readonly json?: boolean
  readonly pullRequest?: string
  readonly root?: string
}

interface DeclineCommandOptions {
  readonly by?: string
  readonly json?: boolean
  readonly reason?: string
  readonly root?: string
}

async function runArchive(
  task: string | undefined,
  opts: ArchiveCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (task && opts.pullRequest) {
    return report(
      {
        ok: false,
        reason: 'bad-input',
        message: 'Name a task or a pull request, not both.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  if (!task && !opts.pullRequest) {
    return report(
      {
        ok: false,
        reason: 'bad-input',
        message:
          'No task named. Pass a filename stem or --pull-request <number>.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())

  if (opts.pullRequest && !/^\d+$/.test(opts.pullRequest)) {
    return report(
      {
        ok: false,
        reason: 'bad-input',
        message: `Not a pull request number: ${opts.pullRequest}`,
        detail: [],
      },
      emitJson,
      root,
    )
  }

  const outcome = await archiveTask(
    root,
    task
      ? { kind: 'stem', stem: task }
      : { kind: 'pull-request', number: Number(opts.pullRequest) },
  )

  return report(outcome, emitJson, root)
}

function report(
  outcome: ArchiveOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (emitJson) {
    process.stdout.write(`${JSON.stringify(recordFor(outcome, root))}\n`)
    return outcome.ok ? 0 : 1
  }

  intro('canon tasks archive')

  if (!outcome.ok) {
    logStep('Refused')
    logError(outcome.message)
    if (outcome.detail.length > 0) pipeOutput(outcome.detail.join('\n'))
    if (outcome.slice) {
      logStep('Slice plan archived')
      logPlanMoves([outcome.slice], root)
    }
    outro()
    return 1
  }

  logStep('Archived')
  logRemove(relative(root, outcome.from))
  logAdd(relative(root, outcome.to))
  logPlanMoves(outcome.plans, root)
  if (outcome.ready) {
    logRemove(relative(root, outcome.ready.from))
    logAdd(relative(root, outcome.ready.to))
    logInfo('retargeted the Ready: line')
  }
  if (outcome.priorityRowRemoved) logInfo('cleared the ordering row')
  if (outcome.backlogRowRemoved) logInfo('cleared the backlog row')
  logRelinked(outcome.relinked, outcome.relinkFailed, root)
  if (outcome.indexRegenerated) logInfo('regenerated index.md')
  if (outcome.cut > 0) logInfo(`${outcome.cut} outcome(s) cut`)
  for (const check of outcome.operatorChecks) logInfo(check)
  outro()

  return 0
}

function logPlanMoves(plans: readonly PlanMove[], root: string): void {
  for (const plan of plans) {
    logRemove(relative(root, plan.from))
    logAdd(relative(root, plan.to))
  }
  if (plans.length > 0) logInfo('retargeted the Plan: line')
}

function logRelinked(
  relinked: readonly InboundRelink[],
  failed: readonly RelinkFailure[],
  root: string,
): void {
  if (relinked.length > 0) {
    const links = relinked.reduce((sum, entry) => sum + entry.links, 0)
    logInfo(`repointed ${links} link(s) in ${relinked.length} file(s)`)
  }

  for (const failure of failed) {
    logWarn(
      `could not repoint ${relative(root, failure.file)}: ${failure.message}`,
    )
  }
}

function relinkFailedFor(
  failed: readonly RelinkFailure[],
  root: string,
): readonly { readonly file: string; readonly message: string }[] {
  return failed.map((failure) => ({
    file: relative(root, failure.file),
    message: failure.message,
  }))
}

function relinkedFor(
  relinked: readonly InboundRelink[],
  root: string,
): readonly { readonly file: string; readonly links: number }[] {
  return relinked.map((entry) => ({
    file: relative(root, entry.file),
    links: entry.links,
  }))
}

function planMovesFor(
  plans: readonly PlanMove[],
  root: string,
): readonly { readonly from: string; readonly to: string }[] {
  return plans.map((plan) => ({
    from: relative(root, plan.from),
    to: relative(root, plan.to),
  }))
}

function recordFor(
  outcome: ArchiveOutcome,
  root: string,
): Record<string, unknown> {
  if (!outcome.ok) {
    return {
      ok: false,
      reason: outcome.reason,
      message: outcome.message,
      detail: outcome.detail,
      ...(outcome.slice
        ? { slice: planMovesFor([outcome.slice], root)[0] }
        : {}),
    }
  }

  return {
    ok: true,
    task: outcome.stem,
    from: relative(root, outcome.from),
    to: relative(root, outcome.to),
    priorityRowRemoved: outcome.priorityRowRemoved,
    backlogRowRemoved: outcome.backlogRowRemoved,
    indexRegenerated: outcome.indexRegenerated,
    plans: planMovesFor(outcome.plans, root),
    ready: outcome.ready
      ? {
          from: relative(root, outcome.ready.from),
          to: relative(root, outcome.ready.to),
        }
      : null,
    closed: outcome.closed,
    cut: outcome.cut,
    operatorChecks: outcome.operatorChecks,
    relinked: relinkedFor(outcome.relinked, root),
    relinkFailed: relinkFailedFor(outcome.relinkFailed, root),
  }
}

/**
 * Reads the local `git config user.name` when `--by` names nobody. `--root`
 * scopes the read so it answers for the board's own repository rather than
 * whatever the ambient environment points at, mirroring `trunk.ts`'s guard.
 */
async function resolveBy(
  root: string,
  by: string | undefined,
): Promise<string | undefined> {
  if (by) return by

  const result = await execa('git', ['-C', root, 'config', 'user.name'], {
    reject: false,
    timeout: GIT_TIMEOUT_MS,
    env: gitEnv(),
    extendEnv: false,
  })

  const name = result.exitCode === 0 ? result.stdout.trim() : ''
  return name.length > 0 ? name : undefined
}

async function runDecline(
  task: string,
  opts: DeclineCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false

  if (!opts.reason) {
    return reportDecline(
      {
        ok: false,
        reason: 'bad-input',
        message: 'No reason named. Pass --reason <text>.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const by = await resolveBy(root, opts.by)

  if (!by) {
    return reportDecline(
      {
        ok: false,
        reason: 'bad-input',
        message:
          'No decider named. Pass --by <name> or set git config user.name.',
        detail: [],
      },
      emitJson,
      root,
    )
  }

  const outcome = await declineTask(root, task, opts.reason, by)

  return reportDecline(outcome, emitJson, root)
}

function reportDecline(
  outcome: DeclineOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (emitJson) {
    process.stdout.write(`${JSON.stringify(declineRecordFor(outcome, root))}\n`)
    return outcome.ok ? 0 : 1
  }

  intro('canon tasks decline')

  if (!outcome.ok) {
    logStep('Refused')
    logError(outcome.message)
    if (outcome.detail.length > 0) pipeOutput(outcome.detail.join('\n'))
    outro()
    return 1
  }

  logStep('Declined')
  logRemove(relative(root, outcome.from))
  logAdd(relative(root, outcome.to))
  logPlanMoves(outcome.plans, root)
  if (outcome.priorityRowRemoved) logInfo('cleared the ordering row')
  if (outcome.backlogRowRemoved) logInfo('cleared the backlog row')
  logRelinked(outcome.relinked, outcome.relinkFailed, root)
  if (outcome.indexRegenerated) logInfo('regenerated index.md')
  outro()

  return 0
}

function declineRecordFor(
  outcome: DeclineOutcome,
  root: string,
): Record<string, unknown> {
  if (!outcome.ok) {
    return {
      ok: false,
      reason: outcome.reason,
      message: outcome.message,
      detail: outcome.detail,
    }
  }

  return {
    ok: true,
    task: outcome.stem,
    from: relative(root, outcome.from),
    to: relative(root, outcome.to),
    priorityRowRemoved: outcome.priorityRowRemoved,
    backlogRowRemoved: outcome.backlogRowRemoved,
    indexRegenerated: outcome.indexRegenerated,
    plans: planMovesFor(outcome.plans, root),
    relinked: relinkedFor(outcome.relinked, root),
    relinkFailed: relinkFailedFor(outcome.relinkFailed, root),
  }
}

export function registerArchive(tasks: Command): void {
  tasks
    .command('archive')
    .description(
      'Move a shipped task and its plan out of the board and clear its ordering',
    )
    .argument('[task]', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--pull-request <number>',
      'Select the task naming this pull request',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'The task carries each plan its Plan: line links when no other live',
        'task cites that plan, and the archived task keeps a working pointer',
        'at each new path. A plan several tasks share stays where it is.',
        '',
        'The ready folder the task names moves to .canon/ready/archive/ with its',
        'plan, and the Ready: line and the plan path to it are retargeted. A',
        'folder that does not resolve, or a destination already taken, moves',
        'nothing and refuses nothing.',
        '',
        'With --pull-request, it refuses earlier-slice when a later number is',
        'listed, and pending-branch while a Pending branch: line names a branch',
        'whose own pull request is not recorded yet. A stem skips both.',
        '',
        'On an earlier-slice or open-outcomes refusal from --pull-request, the',
        'slice plan whose derived branch is the pull request head, read through',
        'gh, moves to the plans archive and the task stays open. The record',
        'names it under `slice`.',
        '',
        'Refusals, read off `reason`:',
        '  no-board        the repository holds no `.canon/tasks/` board',
        '  no-match        no task matches the selector',
        '  ambiguous       more than one task matches the selector',
        '  no-outcomes     the task carries no outcomes to check',
        '  open-outcomes   an outcome is still unchecked',
        '  earlier-slice   `--pull-request` names a number that is not the last on',
        '                  the task',
        '  pending-branch  a `Pending branch:` line names a branch whose pull',
        '                  request is not recorded yet',
        '  bad-input       a malformed selector',
        '',
        'Exit codes:',
        '  0  the task was archived',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon tasks archive v28.1-trigger-escalation',
        '  canon tasks archive --pull-request 673 --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string | undefined, opts: ArchiveCommandOptions) => {
      process.exitCode = await runArchive(task, opts)
    })

  tasks
    .command('decline')
    .description(
      'Move a task decided against into .canon/tasks/declined/, recording why',
    )
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--reason <text>', 'Why the task was decided against')
    .option('--by <name>', 'Who decided, defaulting to git config user.name')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Unlike archive, decline carries no outcome-state gate: a task can be',
        'decided against at any outcome state, and the two never share a',
        'refusal set since they answer different questions.',
        '',
        'Refusals, read off `reason`:',
        '  no-board   the repository holds no `.canon/tasks/` board',
        '  no-match   no task matches the selector',
        '  ambiguous  more than one task matches the selector',
        '  bad-input  a missing `--reason`, or a `--by` that resolves to nobody',
        '',
        'Exit codes:',
        '  0  the task was declined',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon tasks decline v28.1-trigger-escalation --reason "superseded by v30.2" # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task',
        '  canon tasks decline v28.1-trigger-escalation --reason "no longer needed" --by Alex --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: DeclineCommandOptions) => {
      process.exitCode = await runDecline(task, opts)
    })
}
