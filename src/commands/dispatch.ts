import type { Command } from 'commander'
import {
  type AddOutcome,
  addPrompt,
  type ListOutcome,
  listPrompts,
  type PromptRefused,
  PROMPT_ROLES,
  type RemoveOutcome,
  removePrompts,
} from '@/dispatch/prompts'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

interface RootOptions {
  readonly json?: boolean
  readonly root?: string
}

interface AddOptions extends RootOptions {
  readonly role: string
  readonly model: string
  readonly effort: string
  readonly controller: string
  readonly pr?: string
  readonly planFirst?: boolean
  readonly anySize?: boolean
  readonly line?: readonly string[]
  readonly mergeOrder?: string
}

interface RemoveOptions extends RootOptions {
  readonly role?: string
}

const REFUSALS_HELP = [
  'Refusals:',
  '  bad-input  a flag carries a value the queue cannot hold, --plan-first or',
  '             --any-size off a worker row, --any-size without --plan-first,',
  '             or --plan-first on a task that already links a plan',
  '  no-task    no live task under .canon/tasks/ matches the argument',
  '  no-plan    a plain worker row whose task links no single plan file',
  '  claimed    a worker row whose branch a session, worktree, or ref holds',
  '  malformed  a hand edit broke the prompts file, which is left as it is',
]

const EXIT_HELP = [
  'Exit codes:',
  '  0  the queue was read or written',
  '  1  refused, with the reason on stderr or in the JSON record',
]

function collect(value: string, previous: readonly string[] = []): string[] {
  return [...previous, value]
}

function report(
  command: string,
  outcome: AddOutcome | ListOutcome | RemoveOutcome,
  emitJson: boolean,
  describe: () => void,
): number {
  if (emitJson) {
    process.stdout.write(`${JSON.stringify(outcome)}\n`)
    if (!outcome.ok) console.error(outcome.message)
    return outcome.ok ? 0 : 1
  }

  intro(command)
  if (!outcome.ok) {
    reportRefusal(outcome)
    outro()
    return 1
  }

  describe()
  outro()

  return 0
}

function reportRefusal(outcome: PromptRefused): void {
  logStep(`Refused (${outcome.reason})`)
  logError(outcome.message)
}

function mergeLine(order: string | null, dropped: boolean): void {
  if (dropped) {
    logWarn(
      'No two queued worker plans share a file, so the merge order was dropped.',
    )
  } else if (order !== null) {
    logInfo(`Merge order: ${order}`)
  }
}

async function runAdd(task: string, opts: AddOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await addPrompt(root, {
    task,
    role: opts.role,
    model: opts.model,
    effort: opts.effort,
    controller: opts.controller,
    pr: opts.pr,
    planFirst: opts.planFirst,
    anySize: opts.anySize,
    lines: opts.line,
    mergeOrder: opts.mergeOrder,
  })

  return report(
    'canon dispatch prompts add',
    outcome,
    opts.json ?? false,
    () => {
      if (!outcome.ok) return
      logStep(outcome.path)
      logInfo(
        `${outcome.action === 'added' ? 'Queued' : 'Replaced'} the ${outcome.prompt.role} prompt for ${outcome.prompt.label}.`,
      )
      mergeLine(outcome.mergeOrder, outcome.mergeOrderDropped)
      for (const entry of outcome.dropped) {
        logWarn(
          `Dropped the ${entry.role} prompt for ${entry.label}, since ${entry.branch} is claimed.`,
        )
      }
      for (const entry of outcome.claimUnread) {
        // A branch always carries its type segment, and a label never does.
        logWarn(
          entry.includes('/')
            ? `The claim on ${entry} could not be read, so its row stays queued.`
            : `${entry} has no branch until its plan links, so its row stays queued.`,
        )
      }
    },
  )
}

async function runRemove(task: string, opts: RemoveOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await removePrompts(root, task, opts.role)

  return report(
    'canon dispatch prompts rm',
    outcome,
    opts.json ?? false,
    () => {
      if (!outcome.ok) return
      logStep(outcome.path)
      if (outcome.removed.length === 0) {
        logInfo(`Nothing queued for ${task}, so nothing was removed.`)
      }
      for (const entry of outcome.removed) {
        logInfo(`Removed the ${entry.role} prompt for ${entry.label}.`)
      }
      mergeLine(outcome.mergeOrder, outcome.mergeOrderDropped)
    },
  )
}

async function runList(opts: RootOptions): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await listPrompts(root)

  return report(
    'canon dispatch prompts list',
    outcome,
    opts.json ?? false,
    () => {
      if (!outcome.ok) return
      logStep(outcome.path)
      if (outcome.prompts.length === 0) logInfo('No prompts waiting.')
      for (const prompt of outcome.prompts) {
        const branch = prompt.branch === undefined ? '' : ` on ${prompt.branch}`
        logInfo(`${prompt.label} ${prompt.role}${branch}: ${prompt.title}`)
      }
      mergeLine(outcome.mergeOrder, false)
    },
  )
}

export function register(program: Command): void {
  const dispatch = program
    .command('dispatch')
    .description('Manage the hand-launch queue in .canon/dispatch/')
    .helpOption('-h, --help', 'Show this help message')

  const prompts = dispatch
    .command('prompts')
    .description('Queue, drop, and list the prompts an operator pastes by hand')
    .helpOption('-h, --help', 'Show this help message')

  prompts
    .command('add')
    .description('Queue one session prompt for a task, replacing a queued one')
    .argument(
      '<task>',
      'Task stem or label, as in v199.6-dispatch-prompts-verb or v199.6',
    )
    .helpOption('-h, --help', 'Show this help message')
    .requiredOption('--role <role>', `One of ${PROMPT_ROLES.join(', ')}`)
    .requiredOption(
      '--model <model>',
      'Model the operator launches the session on',
    )
    .requiredOption(
      '--effort <effort>',
      'Effort the operator launches the session at',
    )
    .requiredOption(
      '--controller <sessionId>',
      'Full sessionId of the controlling session',
    )
    .option(
      '--pr <number>',
      'Pull request a reviewer row reviews, required for that role',
    )
    .option(
      '--plan-first',
      'Worker row that writes the task plan, then builds it, for a task with no plan',
    )
    .option(
      '--any-size',
      'Pass --any-size to a plan-first build, past its file bound and weight stop',
    )
    .option(
      '--line <text>',
      'One context line the plan does not carry, repeatable',
      collect,
    )
    .option(
      '--merge-order <text>',
      'Order the queued rows merge in, kept only while two worker plans share a file',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Repository root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'A worker row runs /canon:auto-ship on the plan the task links, a planner',
        'row runs plan-change on the task, and a reviewer row runs review-pr on',
        '--pr. A worker row with --plan-first runs /canon:auto-ship --plan-first',
        'on the task instead, and takes its branch from the plan the task links',
        'once that session writes one, naming the row by label under claimUnread',
        'until then. Each fence carries the command, then Controller:, then each',
        '--line. A task and role already queued is replaced, so a retried call',
        'lands once.',
        'Every add reads the claim on each worker branch, refusing a new row whose',
        'branch is held and dropping a queued one, named under dropped. A claim it',
        'cannot read keeps the row and names the branch under claimUnread.',
        '',
        ...REFUSALS_HELP,
        '',
        ...EXIT_HELP,
        '',
        'Examples:',
        '  canon dispatch prompts add v199.6 --role worker --model opus \\',
        '    --effort high --controller <sessionId> --json',
        '  canon dispatch prompts add v199.7 --role worker --plan-first \\',
        '    --model opus --effort high --controller <sessionId> --json',
        '  canon dispatch prompts add v199.6 --role reviewer --pr 3230 \\',
        '    --model opus --effort high --controller <sessionId>',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: AddOptions) => {
      process.exitCode = await runAdd(task, opts)
    })

  prompts
    .command('rm')
    .description("Drop a task's queued prompts once their sessions launched")
    .argument(
      '<task>',
      'Task stem or label, as in v199.6-dispatch-prompts-verb or v199.6',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--role <role>',
      `Drop one role alone, one of ${PROMPT_ROLES.join(', ')}`,
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Repository root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'A task with nothing queued answers ok with an empty removed list. An',
        'emptied queue reads "No prompts waiting." with no lead line.',
        '',
        'Refusals:',
        '  bad-input  --role names no role',
        '  malformed  a hand edit broke the prompts file, which is left as it is',
        '',
        ...EXIT_HELP,
        '',
        'Examples:',
        '  canon dispatch prompts rm v199.6 --role worker',
        '  canon dispatch prompts rm v199.6 --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: RemoveOptions) => {
      process.exitCode = await runRemove(task, opts)
    })

  prompts
    .command('list')
    .description('Read the queued prompts, each worker row with its branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Repository root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'It reads and never writes. A missing file reads as an empty queue. Each',
        'worker row carries the plan and the branch its command derives, which',
        'the orchestrator watch matches against the session roster.',
        '',
        'Refusals:',
        '  malformed  a hand edit broke the prompts file',
        '',
        ...EXIT_HELP,
        '',
        'Examples:',
        '  canon dispatch prompts list',
        '  canon dispatch prompts list --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RootOptions) => {
      process.exitCode = await runList(opts)
    })
}
