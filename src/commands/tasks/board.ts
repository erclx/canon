import { reportRecord } from '@/commands/tasks/record'
import { relative } from 'node:path'
import { type Command } from 'commander'
import {
  type BoardOutcome,
  type BoardRefused,
  blockTask,
  moveTask,
  PLANNED_WAITING,
  type Position,
  placeTask,
  promoteTask,
  WAITING_LIMIT,
} from '@/tasks/board'
import { type BoardGroup } from '@/tasks/validate'
import { intro, logAdd, logInfo, logRemove, logStep, outro } from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

interface BoardCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface PositionCommandOptions {
  readonly top?: boolean
  readonly bottom?: boolean
  readonly before?: string
  readonly after?: string
}

interface PlaceCommandOptions
  extends BoardCommandOptions, PositionCommandOptions {
  readonly group: string
  readonly waiting?: string
}

interface PromoteCommandOptions extends BoardCommandOptions {
  readonly waiting?: string
}

interface MoveCommandOptions
  extends BoardCommandOptions, PositionCommandOptions {}

const BOARD_WRITE_REFUSALS = [
  'Refusals, read off `reason`:',
  '  no-board        the repository holds no `.canon/tasks/` board',
  '  no-ordering     the board has no priority.md',
  '  no-match        no task file carries the stem',
  '  no-row          the task has no row on the board',
  '  unreadable-row  a row names no task, or its header cannot place its blocker',
  '  board-busy      another board verb held the lock past the wait, so run it again',
  '  board-changed   a hand edit landed while this one rendered, so run it again',
  '  group-rule      the target group forbids the row, naming the validate kind',
  '  no-column       the row sits under Run now, which has no Waiting on cell',
  '  top-group       the row already sits under Run now',
  `  cell-long       the Waiting on cell renders past ${WAITING_LIMIT} characters`,
  '  bad-input       a malformed group, position, or Waiting on text',
  '',
  'Exit codes:',
  '  0  the board was written',
  '  1  refused, with the reason on stderr or in the JSON record',
  '',
  'Every write reads priority.md once, renders every table from the task',
  'files and their plans, and writes it once. Task, Touches, and Plan are',
  'derived, so only Waiting on is typed. Safe from a linked worktree, since',
  'it resolves the board root in-process.',
]

const GROUP_FLAGS: Readonly<Record<string, BoardGroup>> = {
  'run-now': 'Run now',
  'up-next': 'Up next',
  'needs-a-plan': 'Needs a plan',
}

function withPosition(command: Command): Command {
  return command
    .option('--top', 'Put the row first in its group')
    .option('--bottom', 'Put the row last in its group, the default')
    .option('--before <task>', 'Put the row right above this sibling')
    .option('--after <task>', 'Put the row right below this sibling')
}

export function registerBoard(tasks: Command): void {
  withPosition(
    tasks
      .command('place')
      .description(
        'Put a task under a board group, from another group, the backlog, or nowhere',
      )
      .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
      .requiredOption(
        '--group <group>',
        'Target group: run-now, up-next, or needs-a-plan',
      )
      .option('--waiting <text>', 'The Waiting on cell, kept when omitted'),
  )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        ...BOARD_WRITE_REFUSALS,
        '',
        'A backlog line for the task is removed in the same call. The row keeps',
        'its Waiting on cell when --waiting is omitted, and a row new to Up next',
        'or Needs a plan has none to keep, so it needs one.',
        '',
        'Examples:',
        '  canon tasks place v28.1-trigger-escalation --group needs-a-plan --bottom --waiting "Not planned yet"',
        '  canon tasks place v28.1-trigger-escalation --group up-next --before v28.2-other --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: PlaceCommandOptions) => {
      process.exitCode = await runPlace(task, opts)
    })

  tasks
    .command('promote')
    .description('Move a row one group closer to Run now, to its bottom')
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--waiting <text>',
      `The Waiting on cell a row entering Up next carries, "${PLANNED_WAITING}" when omitted`,
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        ...BOARD_WRITE_REFUSALS,
        '',
        'Up next moves to Run now, which reads as dispatched, so a dispatcher',
        'runs it once a launch succeeds. Needs a plan moves to Up next.',
        '',
        'Examples:',
        '  canon tasks promote v28.1-trigger-escalation',
        '  canon tasks promote v28.1-trigger-escalation --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: PromoteCommandOptions) => {
      process.exitCode = await runPromote(task, opts)
    })

  withPosition(
    tasks
      .command('move')
      .description('Reposition a row inside the group it sits in')
      .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation'),
  )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        ...BOARD_WRITE_REFUSALS,
        '',
        'Examples:',
        '  canon tasks move v28.1-trigger-escalation --top',
        '  canon tasks move v28.1-trigger-escalation --after v28.2-other --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: MoveCommandOptions) => {
      process.exitCode = await runMove(task, opts)
    })

  tasks
    .command('block')
    .description("Rewrite a row's Waiting on cell")
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .argument(
      '<waiting>',
      `What the row waits on, at most ${WAITING_LIMIT} rendered characters`,
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        ...BOARD_WRITE_REFUSALS,
        '',
        'A link counts as its label alone toward the cap, since only the label',
        'renders.',
        '',
        'Examples:',
        '  canon tasks block v28.1-trigger-escalation "[v28.2](v28.2-other.md) merging"',
        '  canon tasks block v28.1-trigger-escalation "The operator\'s call on the scope" --json',
        '',
      ].join('\n'),
    )
    .action(
      async (task: string, waiting: string, opts: BoardCommandOptions) => {
        process.exitCode = await runBlock(task, waiting, opts)
      },
    )
}

/**
 * Reads the one position flag a call may carry. Two flags at once is refused
 * rather than resolved by precedence, since either reading moves a row the
 * caller did not mean to.
 */
function positionFrom(
  opts: PositionCommandOptions,
): Position | undefined | BoardRefused {
  const given: Position[] = [
    ...(opts.top ? [{ at: 'top' } as const] : []),
    ...(opts.bottom ? [{ at: 'bottom' } as const] : []),
    ...(opts.before ? [{ before: opts.before }] : []),
    ...(opts.after ? [{ after: opts.after }] : []),
  ]

  if (given.length > 1) {
    return {
      ok: false,
      reason: 'bad-input',
      message: 'Pass one of --top, --bottom, --before, or --after.',
      detail: [],
    }
  }

  return given[0]
}

async function runPlace(
  task: string,
  opts: PlaceCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const group = GROUP_FLAGS[opts.group]
  if (!group) {
    return reportRecord(
      'canon tasks place',
      {
        ok: false,
        reason: 'bad-input',
        message: `Not a group: ${opts.group}. Pass run-now, up-next, or needs-a-plan.`,
        detail: [opts.group],
      },
      emitJson,
      process.cwd(),
    )
  }

  const position = positionFrom(opts)
  if (position && 'ok' in position) {
    return reportRecord('canon tasks place', position, emitJson, process.cwd())
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await placeTask(root, task, group, {
    waiting: opts.waiting,
    position,
  })

  return reportBoardWrite('canon tasks place', outcome, emitJson, root)
}

async function runPromote(
  task: string,
  opts: PromoteCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await promoteTask(root, task, { waiting: opts.waiting })

  return reportBoardWrite(
    'canon tasks promote',
    outcome,
    opts.json ?? false,
    root,
  )
}

async function runMove(
  task: string,
  opts: MoveCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const position = positionFrom(opts)
  if (position === undefined || 'ok' in position) {
    return reportRecord(
      'canon tasks move',
      position ?? {
        ok: false,
        reason: 'bad-input',
        message:
          'No position named. Pass --top, --bottom, --before, or --after.',
        detail: [],
      },
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await moveTask(root, task, position)

  return reportBoardWrite('canon tasks move', outcome, emitJson, root)
}

async function runBlock(
  task: string,
  waiting: string,
  opts: BoardCommandOptions,
): Promise<number> {
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await blockTask(root, task, waiting)

  return reportBoardWrite(
    'canon tasks block',
    outcome,
    opts.json ?? false,
    root,
  )
}

function reportBoardWrite(
  title: string,
  outcome: BoardOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) return reportRecord(title, outcome, emitJson, root)

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        group: outcome.group,
        from: outcome.from ?? null,
        position: outcome.position,
        backlog: outcome.backlog,
      })}\n`,
    )
    return 0
  }

  intro(title)
  logStep('Written')
  logInfo(
    `${outcome.stem} sits at ${outcome.position} under ${outcome.group}${outcome.from && outcome.from !== outcome.group ? `, from ${outcome.from}` : ''}`,
  )
  if (outcome.backlog) logRemove('its backlog line')
  logAdd(relative(root, outcome.path))
  outro()

  return 0
}
