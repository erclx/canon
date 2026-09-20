import { relative } from 'node:path'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git-env'
import { type AnswersOutcome, planAnswers } from '@/tasks/answers'
import { type BranchOutcome, planBranch } from '@/tasks/branch'
import {
  type ArchiveOutcome,
  archiveTask,
  type CitationOutcome,
  type DeclineOutcome,
  declineTask,
  type PlanCitations,
  planCitations,
} from '@/tasks/archive'
import { type LabelOutcome, nextLabel } from '@/tasks/label'
import { listTasks } from '@/tasks/list'
import {
  type Claim,
  type Holder,
  planReach,
  type ReachOutcome,
} from '@/tasks/reach'
import {
  type CloseOutcome,
  closeOutcomes,
  type PlanOutcome,
  type PullRequestOutcome,
  recordPlan,
  type RecordRefused,
  type RecordSelector,
  recordPullRequest,
} from '@/tasks/record'
import {
  type Finding,
  type FolderClaim,
  type Unplaced,
  type Untested,
  type ValidateOutcome,
  validateBoard,
} from '@/tasks/validate'
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
} from '@/ui'
import { mainWorktreeRoot } from '@/worktree'

/** Returned when the board carries a finding, which is the gating result. */
const EXIT_FINDINGS = 2

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

interface ValidateCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface CitationsCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface AnswersCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface BranchCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface ReachCommandOptions {
  readonly base?: string
  readonly json?: boolean
  readonly root?: string
}

interface PullRequestCommandOptions {
  readonly json?: boolean
  readonly plan?: string
  readonly root?: string
}

interface PlanLinkCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface OutcomeCommandOptions {
  readonly close?: readonly string[]
  readonly json?: boolean
  readonly plan?: string
  readonly root?: string
}

interface ListCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface NextLabelCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

export function register(program: Command): void {
  const tasks = program
    .command('tasks')
    .description('Manage the task board in .canon/tasks/')
    .helpOption('-h, --help', 'Show this help message')

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
        'The task carries its plan with it when no other live task cites that',
        'plan, and the archived task keeps a working Plan: pointer at the new',
        'path. A plan several tasks share stays where it is.',
        '',
        'The ready folder the task names moves to .canon/ready/archive/ with its',
        'plan, and the Ready: line and the plan path to it are retargeted. A',
        'folder that does not resolve, or a destination already taken, moves',
        'nothing and refuses nothing.',
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

  tasks
    .command('validate')
    .description(
      'Report what each board row claims against what the tree holds',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Checks:',
        '  every Run now row points at a plan file that resolves',
        '  no Needs a plan row has a live plan, and every Up next row has one',
        '  every task file carries a board row or a backlog line, never both',
        '  no task carries more than one row',
        '  no two Run now rows touch the same file',
        '',
        'Exit codes:',
        '  0  every check passed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the board carries at least one finding',
        '',
        'It reports and never writes. A row is a claim about readiness, so a',
        'session fixes the row the report names.',
        '',
        'Examples:',
        '  canon tasks validate',
        '  canon tasks validate --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ValidateCommandOptions) => {
      process.exitCode = await runValidate(opts)
    })

  tasks
    .command('plan-citations')
    .description('Report where a task plan sits and which live tasks hold it')
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Locations:',
        '  unstated  the task carries no Plan: line',
        '  live      the target resolves inside .canon/plans/',
        '  archived  the target resolves inside .canon/plans/archive/',
        '  outside   the target resolves somewhere else',
        '',
        'Exit codes:',
        '  0  the citations were read',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It reports and never writes. A live plan whose citedBy list is empty',
        'is the sweep to run, and one a sibling still holds is left alone.',
        'The archive gate reads the same answer, so neither can drift.',
        '',
        'Examples:',
        '  canon tasks plan-citations v28.1-trigger-escalation',
        '  canon tasks plan-citations v28.1-trigger-escalation --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: CitationsCommandOptions) => {
      process.exitCode = await runCitations(task, opts)
    })

  tasks
    .command('plan-answers')
    .description('Report whether a plan still waits on the operator to answer')
    .argument('<plan>', 'Plan path or its slug, as in dispatch-answer-gate')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the plan is launchable',
        '  1  refused as no-plan, archived, or bad-input',
        '  2  the plan waits on the operator, and open names every slot',
        '',
        'A blank Answer accepts the Suggested line above it, so only',
        '`- Suggested: needs your call, <why>` and its two demonstrated',
        "paraphrases, needs operator's call and needs the operator's call,",
        'over an empty slot are a stop. It reports and never writes.',
        'Branch on launchable rather than on the exit code, which a shell',
        'function wrapping canon can flatten to zero.',
        '',
        'A relative path resolves against the project root first and against',
        '.canon/tasks/ second, so the ../plans/ link a board row writes works.',
        '',
        'Examples:',
        '  canon tasks plan-answers dispatch-answer-gate',
        '  canon tasks plan-answers .canon/plans/feature-dispatch-answer-gate.md',
        '  canon tasks plan-answers ../plans/feature-dispatch-answer-gate.md',
        '  canon tasks plan-answers dispatch-answer-gate --json',
        '',
      ].join('\n'),
    )
    .action(async (plan: string, opts: AnswersCommandOptions) => {
      process.exitCode = await runAnswers(plan, opts)
    })

  tasks
    .command('plan-branch')
    .description('Derive the branch name a dispatch and a worker both take')
    .argument('<plan>', 'Plan path or its slug, as in dispatch-answer-gate')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the branch is derived and conforms to standards/branch.md',
        '  1  refused as no-plan, archived, or bad-input',
        '  2  derived, and conforms is false because the slug breaks a cap',
        '',
        'It reports type, slug, branch, words, and conforms. The type is fixed',
        'at feat, since a derivation two sides grade differently is the defect',
        'this closes, and git-branch renames a wrong type later in the chain.',
        'Branch on conforms rather than on the exit code, which a shell',
        'function wrapping canon can flatten to zero.',
        '',
        'The dispatch collision check and the worker worktree entry both call',
        'it, so the branch a gate clears is the branch a session takes.',
        '',
        'Examples:',
        '  canon tasks plan-branch dispatch-answer-gate',
        '  canon tasks plan-branch .canon/plans/feature-dispatch-answer-gate.md',
        '  canon tasks plan-branch dispatch-answer-gate --json',
        '',
      ].join('\n'),
    )
    .action(async (plan: string, opts: BranchCommandOptions) => {
      process.exitCode = await runBranch(plan, opts)
    })

  tasks
    .command('plan-reach')
    .description('Read a branch back against what was declared about it')
    .argument('<plan>', 'Plan path or its slug, as in dispatch-answer-gate')
    .helpOption('-h, --help', 'Show this help message')
    .option('--base <ref>', 'Far side of the range, defaulting to the trunk')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the reach was read and no other track claims a changed path',
        '  1  refused as no-plan, archived, bad-input, no-base, or no-diff',
        '  2  read, and another live plan or Run now row claims a path',
        '',
        'It reports claimed first and undeclared second. A claimed path is one',
        'another track holds and is the half worth acting on; an undeclared one',
        'is a path this plan never named, which the ship chain writes on nearly',
        'every branch. It reports and never gates, so branch on the record',
        'rather than on the exit code, which a shell function wrapping canon',
        'can flatten to zero.',
        '',
        'The range is read at the current directory and the plans and board at',
        'the board root, so a linked worktree reads its own branch against the',
        'shared records. It reads only what is written down, so the plan and',
        'row counts say how much was there to compare against.',
        '',
        'Examples:',
        '  canon tasks plan-reach dispatch-answer-gate',
        '  canon tasks plan-reach dispatch-answer-gate --base origin/main --json',
        '',
      ].join('\n'),
    )
    .action(async (plan: string, opts: ReachCommandOptions) => {
      process.exitCode = await runReach(plan, opts)
    })

  tasks
    .command('pull-request')
    .description('Record a pull request number on the task a branch closes')
    .argument('<number>', 'Pull request number, without the #')
    .argument('[task]', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--plan <slug>', 'Select the task whose Plan line names this plan')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the line was added, corrected, or already correct',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It adds Pull request: #NNN under the origin lines the task carries,',
        'and corrects the number in place when the line exists. The board is',
        'shared scratch, so a linked worktree records against the same board.',
        '',
        'Examples:',
        '  canon tasks pull-request 673 v28.1-trigger-escalation',
        '  canon tasks pull-request 673 --plan worktree-scratch-routing --json',
        '',
      ].join('\n'),
    )
    .action(
      async (
        number: string,
        task: string | undefined,
        opts: PullRequestCommandOptions,
      ) => {
        process.exitCode = await runPullRequest(number, task, opts)
      },
    )

  tasks
    .command('plan-link')
    .description("Write or correct a task's Plan: line to point at a plan")
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .argument('<plan>', 'Plan path or its slug, as in dispatch-answer-gate')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  the line was added, corrected, or already correct',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It writes Plan: [<label>](<target>) right after the H1, the same',
        'add/correct/unchanged shape canon tasks pull-request writes with, and',
        'resolves both a bare slug and a board-relative path the way',
        'canon tasks plan-answers does. Safe from a linked worktree, since it',
        'resolves the board root in-process.',
        '',
        'Examples:',
        '  canon tasks plan-link v28.1-trigger-escalation dispatch-answer-gate',
        '  canon tasks plan-link v28.1-trigger-escalation .canon/plans/feature-dispatch-answer-gate.md --json',
        '',
      ].join('\n'),
    )
    .action(
      async (task: string, plan: string, opts: PlanLinkCommandOptions) => {
        process.exitCode = await runPlanLink(task, plan, opts)
      },
    )

  tasks
    .command('outcome')
    .description('Mark outcomes closed on a task by their position')
    .argument('[task]', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--close <position>',
      'Outcome to mark [x], 1-based, repeatable',
      collectPosition,
      [] as string[],
    )
    .option('--plan <slug>', 'Select the task whose Plan line names this plan')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every named outcome is closed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Positions count every outcome checkbox in file order, starting at 1.',
        'An outcome already closed is reported rather than refused, so a rerun',
        'against the same positions is safe.',
        '',
        'Examples:',
        '  canon tasks outcome v28.1-trigger-escalation --close 1 --close 3',
        '  canon tasks outcome --plan worktree-scratch-routing --close 2 --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string | undefined, opts: OutcomeCommandOptions) => {
      process.exitCode = await runOutcome(task, opts)
    })

  tasks
    .command('next-label')
    .description(
      'Report the next unused phase label across the board and its archive',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Reads .canon/tasks/ and its archive/ sibling together, since the',
        'archive holds labels the live board no longer shows and a scan',
        'confined to the board hands out one already spent.',
        '',
        'Exit codes:',
        '  0  the label is derived',
        '  1  refused with no-board',
        '',
        'It reports and never writes. Two sessions calling it in the same',
        'second can still take the same answer, since the board is',
        'gitignored files rather than a store with a lock.',
        '',
        'Examples:',
        '  canon tasks next-label',
        '  canon tasks next-label --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: NextLabelCommandOptions) => {
      process.exitCode = await runNextLabel(opts)
    })

  tasks
    .command('list')
    .description('Report each live task file with its readiness')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Readiness is one of Run now, Up next, Needs a plan, backlog, unplaced,',
        'or both, read from priority.md and backlog.md through the parsers',
        'validate uses. It lists the live root only, never archive/ or declined/.',
        '',
        'Exit codes:',
        '  0  the list is derived',
        '  1  refused with no-board',
        '',
        'It reports and never writes, and judges nothing: a file named on both',
        'surfaces reads as both, and validate owns the finding.',
        '',
        'Examples:',
        '  canon tasks list',
        '  canon tasks list --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ListCommandOptions) => {
      process.exitCode = await runList(opts)
    })
}

function collectPosition(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/**
 * Both record verbs name a task the same two ways, and naming it neither way or
 * both ways is the same refusal in each. Both are `bad-input` rather than
 * `ambiguous` or `no-match`, since those two describe the board and these
 * describe the command line that reached it.
 */
function selectorFor(
  task: string | undefined,
  plan: string | undefined,
): RecordSelector | RecordRefused {
  if (task && plan) {
    return {
      ok: false,
      reason: 'bad-input',
      message: 'Name a task or a plan, not both.',
      detail: [],
    }
  }

  if (task) return { kind: 'stem', stem: task }
  if (plan) return { kind: 'plan', plan }

  return {
    ok: false,
    reason: 'bad-input',
    message: 'No task named. Pass a filename stem or --plan <slug>.',
    detail: [],
  }
}

async function runPullRequest(
  number: string,
  task: string | undefined,
  opts: PullRequestCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const selector = selectorFor(task, opts.plan)

  if ('ok' in selector) {
    return reportRecord(
      'canon tasks pull-request',
      selector,
      emitJson,
      process.cwd(),
    )
  }

  if (!/^\d+$/.test(number)) {
    return reportRecord(
      'canon tasks pull-request',
      {
        ok: false,
        reason: 'bad-input',
        message: `Not a pull request number: ${number}`,
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await recordPullRequest(root, selector, Number(number))

  return reportPullRequest(outcome, emitJson, root)
}

async function runPlanLink(
  task: string,
  plan: string,
  opts: PlanLinkCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await recordPlan(root, task, plan)

  return reportPlanLink(outcome, emitJson, root)
}

async function runOutcome(
  task: string | undefined,
  opts: OutcomeCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const selector = selectorFor(task, opts.plan)

  if ('ok' in selector) {
    return reportRecord(
      'canon tasks outcome',
      selector,
      emitJson,
      process.cwd(),
    )
  }

  const raw = opts.close ?? []

  if (raw.length === 0) {
    return reportRecord(
      'canon tasks outcome',
      {
        ok: false,
        reason: 'bad-input',
        message: 'No outcome named. Pass --close <position>.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const invalid = raw.filter((value) => !/^\d+$/.test(value))

  if (invalid.length > 0) {
    return reportRecord(
      'canon tasks outcome',
      {
        ok: false,
        reason: 'bad-input',
        message: `Not an outcome position: ${invalid.join(', ')}`,
        detail: invalid,
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await closeOutcomes(root, selector, raw.map(Number))

  return reportOutcome(outcome, emitJson, root)
}

function reportRecord(
  title: string,
  refused: RecordRefused,
  emitJson: boolean,
  root: string,
): number {
  // The framed branch below already reaches stderr through logError, so the
  // bare write is what keeps the JSON mode from reporting the reason on stdout
  // alone.
  if (emitJson) {
    process.stderr.write(`${refused.message}\n`)
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        root,
        reason: refused.reason,
        message: refused.message,
        detail: refused.detail,
      })}\n`,
    )
    return 1
  }

  intro(title)
  logStep('Refused')
  logError(refused.message)
  if (refused.detail.length > 0) pipeOutput(refused.detail.join('\n'))
  outro()

  return 1
}

function reportPullRequest(
  outcome: PullRequestOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRecord('canon tasks pull-request', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        pullRequest: outcome.number,
        action: outcome.action,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks pull-request')
  logStep(outcome.action === 'unchanged' ? 'Already recorded' : 'Recorded')
  logInfo(`${outcome.stem} names pull request #${outcome.number}`)
  if (outcome.action !== 'unchanged') logAdd(relative(root, outcome.path))
  outro()

  return 0
}

function reportPlanLink(
  outcome: PlanOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRecord('canon tasks plan-link', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        plan: outcome.plan,
        action: outcome.action,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks plan-link')
  logStep(outcome.action === 'unchanged' ? 'Already recorded' : 'Recorded')
  logInfo(`${outcome.stem} names plan ${outcome.plan}`)
  if (outcome.action !== 'unchanged') logAdd(relative(root, outcome.path))
  outro()

  return 0
}

function reportOutcome(
  outcome: CloseOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRecord('canon tasks outcome', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        closed: outcome.closed,
        alreadyClosed: outcome.alreadyClosed,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks outcome')
  logStep(outcome.closed.length > 0 ? 'Closed' : 'Nothing to close')

  for (const closed of outcome.closed) logAdd(closed)
  for (const already of outcome.alreadyClosed) logInfo(`${already} (already)`)

  if (outcome.closed.length > 0) logInfo(relative(root, outcome.path))
  outro()

  return 0
}

async function runList(opts: ListCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await listTasks(root)

  if (!outcome.ok) {
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks list')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return 0
  }

  intro('canon tasks list')
  logStep(`${outcome.tasks.length} task files`)
  for (const task of outcome.tasks) logInfo(`${task.readiness}: ${task.stem}`)
  outro()

  return 0
}

async function runNextLabel(opts: NextLabelCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await nextLabel(root)

  return reportNextLabel(outcome, opts.json ?? false, root)
}

function reportNextLabel(
  outcome: LabelOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks next-label')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return 0
  }

  intro('canon tasks next-label')
  logStep(outcome.label)
  logInfo(
    outcome.highest
      ? `next after ${outcome.highest}.`
      : 'the board and its archive hold no label yet.',
  )
  outro()

  return 0
}

async function runValidate(opts: ValidateCommandOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await validateBoard(root)

  return reportValidation(outcome, opts.json ?? false, root)
}

async function runCitations(
  task: string,
  opts: CitationsCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await planCitations(root, task)

  return reportCitations(outcome, opts.json ?? false, root)
}

function reportCitations(
  outcome: CitationOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks plan-citations')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return 0
  }

  intro('canon tasks plan-citations')
  logStep(outcome.stem)
  logInfo(describeCitations(outcome))
  outro()

  return 0
}

function describeCitations(outcome: PlanCitations): string {
  if (outcome.location === 'unstated') return 'carries no Plan: line.'

  if (outcome.location === 'archived') {
    return `points at ${outcome.target}, which an earlier sweep already archived.`
  }

  if (outcome.location === 'outside') {
    return `points at ${outcome.target}, which resolves outside both plans folders.`
  }

  if (outcome.citedBy.length === 0) {
    return `is the last live task citing ${outcome.target}, so the sweep may archive it.`
  }

  return `shares ${outcome.target} with ${outcome.citedBy.join(', ')}, so the sweep leaves it.`
}

async function runAnswers(
  plan: string,
  opts: AnswersCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await planAnswers(root, plan)

  return reportAnswers(outcome, opts.json ?? false, root)
}

function reportAnswers(
  outcome: AnswersOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks plan-answers')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return outcome.launchable ? 0 : EXIT_FINDINGS
  }

  intro('canon tasks plan-answers')
  logStep(outcome.plan)

  if (outcome.launchable) {
    logInfo('waits on nobody, so the dispatch may launch it.')
    outro()
    return 0
  }

  for (const question of outcome.open) {
    logWarn(`${question.label} ${question.why}`)
  }

  const one = outcome.open.length === 1

  logError(
    `${outcome.open.length} question${one ? '' : 's'} ${one ? 'waits' : 'wait'} on you, so the dispatch holds this row.`,
  )
  outro()

  return EXIT_FINDINGS
}

async function runBranch(
  plan: string,
  opts: BranchCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = planBranch(root, plan)

  return reportBranch(outcome, opts.json ?? false, root)
}

function reportBranch(
  outcome: BranchOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks plan-branch')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return outcome.conforms ? 0 : EXIT_FINDINGS
  }

  intro('canon tasks plan-branch')
  logStep(outcome.branch)

  if (outcome.conforms) {
    logInfo(`derived from ${outcome.plan}, ${outcome.words} words.`)
    outro()
    return 0
  }

  logWarn(
    `derived from ${outcome.plan}, ${outcome.words} words and ${outcome.branch.length} characters.`,
  )
  logError(
    'The slug breaks a cap in standards/branch.md, so hand the row to a person rather than renaming it.',
  )
  outro()

  return EXIT_FINDINGS
}

async function runReach(
  plan: string,
  opts: ReachCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  // The range belongs to the checkout the caller stands in, which is the linked
  // worktree holding the branch on every dispatched run. The board root is the
  // main worktree, where reading a range measures the trunk against itself.
  const outcome = await planReach(root, plan, {
    repo: process.cwd(),
    ref: opts.base,
  })

  return reportReach(outcome, opts.json ?? false, root)
}

/**
 * Names a holder, the declaration it matched on when that is wider than the
 * path, and whether a holding plan carries a dispatch row. A plan with no row
 * is the shape a plan nobody archived takes, which is what sends a reader to
 * check the holder rather than treating the claim as a live collision.
 */
function describeHolder(claim: Claim, holder: Holder): string {
  const under =
    holder.declaration === claim.path ? '' : `, under ${holder.declaration}`
  const rowed = holder.source === 'plan' && !holder.rowed ? ', no row' : ''

  return `${holder.name} (${holder.source}${under}${rowed})`
}

function describeReachClaim(claim: Claim): string {
  const holders = claim.holders
    .map((holder) => describeHolder(claim, holder))
    .join(' and ')

  return `${claim.path} is held by ${holders}`
}

/**
 * Leads with the claimed list because it is the short one. Over the wave this
 * verb was filed against, undeclared paths ran 22 of 26 on one branch and 18 of
 * 25 on another, so a report opening on that list is noise a reader skips past
 * and the crossing underneath it goes with them.
 */
function reportReach(
  outcome: ReachOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks plan-reach')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return outcome.claimed.length === 0 ? 0 : EXIT_FINDINGS
  }

  intro('canon tasks plan-reach')

  logStep(outcome.claimed.length === 0 ? 'Uncontested' : 'Claimed')
  if (outcome.claimed.length === 0) {
    logInfo('no other live plan or Run now row holds a path this branch wrote')
  } else {
    for (const claim of outcome.claimed) logWarn(describeReachClaim(claim))
  }

  logStep('Undeclared')
  if (outcome.undeclared.length === 0) {
    logInfo(
      `${outcome.plan} declared every one of the ${outcome.changed} paths`,
    )
  } else {
    for (const path of outcome.undeclared) logInfo(path)
    logInfo(
      `${outcome.undeclared.length} of ${outcome.changed} path(s) this plan did not name, which the ship chain's own steps account for on most branches`,
    )
  }

  // The counts are the report's own bound. A verb reading what is written down
  // sees no hand-launched track and no track without a plan, so a clear reading
  // over nothing compared against would otherwise read as a proof.
  logStep('Compared against')
  logInfo(
    `${outcome.plans} other live plan(s) and ${outcome.rows} Run now row(s)${outcome.board ? '' : ', with no board on disk to read'}`,
  )

  outro()

  return outcome.claimed.length === 0 ? 0 : EXIT_FINDINGS
}

function reportValidation(
  outcome: ValidateOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, reason: outcome.reason, message: outcome.message })}\n`,
      )
      return 1
    }

    intro('canon tasks validate')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return 1
  }

  if (!emitJson) {
    intro('canon tasks validate')
    logStep('Board')
    logInfo(
      `${outcome.rows} row(s) across the readiness groups, ${outcome.backlog} backlog line(s), ${outcome.tasks} task file(s), ${outcome.declined} declined`,
    )

    logStep(outcome.findings.length === 0 ? 'Clean' : 'Findings')
    if (outcome.findings.length === 0) {
      logInfo(
        'every row resolves, every task sits on one surface, and each touches its own files',
      )
    } else {
      for (const finding of outcome.findings) logWarn(describe(finding))
    }

    // The untested rows carry the warn glyph rather than the pass glyph. They
    // move no exit code, and a green tick on a row nothing re-took is the
    // misread this section exists to prevent.
    logStep('Parked rows')
    if (outcome.untested.length === 0) {
      logInfo('every parked row carried a citation or a file set to re-test')
    } else {
      logWarn(
        `${outcome.untested.length} row(s) carry a blocker no check can settle`,
      )
      for (const row of outcome.untested) logWarn(describeUntested(row))
    }

    // A folder claim is often the correct way to say a row rewrites a whole
    // directory, so it reports beside the findings and moves no exit code. A
    // measure that fails on a legitimate cell trains a reader to skip it.
    logStep('Folder claims')
    if (outcome.claims.length === 0) {
      logInfo('every run now row names files rather than folders')
    } else {
      for (const claim of outcome.claims) logWarn(describeClaim(claim))
    }

    // Unplaced is the normal state between a session filing a task and an
    // orchestrator placing its row, so it moves no exit code. It still reports,
    // since it is the only local detector for a row a hand-edit dropped or a
    // handoff that never arrived.
    logStep('Unplaced')
    if (outcome.unplaced.length === 0) {
      logInfo('every task file sits on the board or the backlog')
    } else {
      for (const task of outcome.unplaced) logWarn(describeUnplaced(task))
    }
    outro()
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        rows: outcome.rows,
        backlog: outcome.backlog,
        tasks: outcome.tasks,
        declined: outcome.declined,
        findings: outcome.findings,
        untested: outcome.untested,
        claims: outcome.claims,
        unplaced: outcome.unplaced,
      })}\n`,
    )
  }

  return outcome.findings.length > 0 ? EXIT_FINDINGS : 0
}

function describe(finding: Finding): string {
  const scope = finding.group ? `${finding.group}: ` : ''
  return `${scope}${finding.subject} ${finding.message}`
}

function describeUntested(row: Untested): string {
  return `${row.group}: ${row.subject} ${row.message}`
}

function describeClaim(claim: FolderClaim): string {
  return `${claim.group}: ${claim.subject} ${claim.message}`
}

function describeUnplaced(task: Unplaced): string {
  return `${task.subject} ${task.message}`
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
    outro()
    return 1
  }

  logStep('Archived')
  logRemove(relative(root, outcome.from))
  logAdd(relative(root, outcome.to))
  if (outcome.plan) {
    logRemove(relative(root, outcome.plan.from))
    logAdd(relative(root, outcome.plan.to))
    logInfo('retargeted the Plan: line')
  }
  if (outcome.ready) {
    logRemove(relative(root, outcome.ready.from))
    logAdd(relative(root, outcome.ready.to))
    logInfo('retargeted the Ready: line')
  }
  if (outcome.priorityRowRemoved) logInfo('cleared the ordering row')
  if (outcome.indexRegenerated) logInfo('regenerated index.md')
  if (outcome.cut > 0) logInfo(`${outcome.cut} outcome(s) cut`)
  outro()

  return 0
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
    }
  }

  return {
    ok: true,
    task: outcome.stem,
    from: relative(root, outcome.from),
    to: relative(root, outcome.to),
    priorityRowRemoved: outcome.priorityRowRemoved,
    indexRegenerated: outcome.indexRegenerated,
    plan: outcome.plan
      ? {
          from: relative(root, outcome.plan.from),
          to: relative(root, outcome.plan.to),
        }
      : null,
    ready: outcome.ready
      ? {
          from: relative(root, outcome.ready.from),
          to: relative(root, outcome.ready.to),
        }
      : null,
    closed: outcome.closed,
    cut: outcome.cut,
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
  if (outcome.plan) {
    logRemove(relative(root, outcome.plan.from))
    logAdd(relative(root, outcome.plan.to))
    logInfo('retargeted the Plan: line')
  }
  if (outcome.priorityRowRemoved) logInfo('cleared the ordering row')
  if (outcome.backlogRowRemoved) logInfo('cleared the backlog row')
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
    plan: outcome.plan
      ? {
          from: relative(root, outcome.plan.from),
          to: relative(root, outcome.plan.to),
        }
      : null,
  }
}
