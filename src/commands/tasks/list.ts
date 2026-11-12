import { type Command } from 'commander'
import {
  type LabelOutcome,
  type LabelRefused,
  claimLabel,
  nextLabel,
} from '@/tasks/label'
import { listTasks } from '@/tasks/list'
import { intro, logError, logInfo, logStep, outro } from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

interface ListCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface NextLabelCommandOptions {
  readonly json?: boolean
  readonly claim?: boolean
  readonly root?: string
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
  const outcome = opts.claim ? await claimLabel(root) : await nextLabel(root)

  return reportNextLabel(outcome, opts.json ?? false, root)
}

function refusalExit(outcome: LabelRefused): number {
  return outcome.reason === 'label-contended' ? 2 : 1
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
      return refusalExit(outcome)
    }

    intro('canon tasks next-label')
    logStep('Refused')
    logError(outcome.message)
    outro()
    return refusalExit(outcome)
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

export function registerList(tasks: Command): void {
  tasks
    .command('next-label')
    .description(
      'Report the next unused phase label across the board and its archive',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--claim', 'Reserve the label so a second claim gets another')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Reads .canon/tasks/ and its archive/ sibling together, since the',
        'archive holds labels the live board no longer shows and a scan',
        'confined to the board hands out one already spent.',
        '',
        'Refusals, read off `reason`:',
        '  no-board         the repository holds no `.canon/tasks/` board',
        '  label-contended  `--claim` lost five reservations, and the verb exits 2',
        '',
        'Exit codes:',
        '  0  the label is derived',
        '  1  refused with no-board',
        '  2  refused with label-contended, on --claim only',
        '',
        'Bare, it reports and never writes, so two sessions calling it in the',
        'same second can take the same answer. --claim reserves the label',
        'under .canon/ordinal-locks/ and counts every reservation in the',
        'scan, so two claims return different labels. A dead claim leaves a',
        'gap, which claude/skills/git-commit/references/versioning.md permits.',
        '',
        'Examples:',
        '  canon tasks next-label',
        '  canon tasks next-label --json',
        '  canon tasks next-label --claim --json',
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
        'Refusals, read off `reason`:',
        '  no-board  the repository holds no `.canon/tasks/` board',
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
