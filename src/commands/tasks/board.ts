import { reportRecord } from '@/commands/tasks/record'
import { relative } from 'node:path'
import { type Command } from 'commander'
import {
  type BoardOutcome,
  type BoardRefused,
  blockTask,
  LAUNCH_EFFORTS,
  LAUNCH_MODELS,
  LAUNCH_ROLES,
  LAUNCH_ROUTES,
  type LaunchPick,
  moveTask,
  oneOf,
  PLANNED_WAITING,
  type Position,
  placeTask,
  promoteTask,
  WAITING_LIMIT,
} from '@/tasks/board'
import { writeLaunch } from '@/tasks/launch'
import { checkLift } from '@/commands/pr/lift'
import { type FlightReaders, readFlight } from '@/tasks/flight'
import { resolveSessions } from '@/sessions/resolve'
import { type BoardGroup, groupToken } from '@/tasks/validate'
import {
  intro,
  logAdd,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
} from '@/cli/ui'
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

interface LaunchCommandOptions extends BoardCommandOptions {
  readonly role?: string
  readonly model?: string
  readonly effort?: string
  readonly route?: string
  readonly override?: boolean
  readonly clear?: boolean
}

const BOARD_WRITE_REFUSALS = [
  'Refusals, read off `reason`:',
  '  no-board        the repository holds no `.canon/tasks/` board',
  '  no-ordering     the board has no priority.md',
  '  no-match        no task file carries the stem',
  '  no-row          the task has no row on the board',
  '  unreadable-row  a row names no task, or its header cannot place its blocker or launch',
  '  board-busy      another board verb held the lock past the wait, so run it again',
  '  board-changed   a hand edit landed while this one rendered, so run it again',
  '  group-rule      the target group forbids the row, naming the validate kind',
  '  no-column       the row sits under In flight, which has no Waiting on cell',
  '  top-group       the row already sits under In flight',
  '  group-doubled   the board opens one group twice, as Run now beside In flight',
  `  cell-long       the Waiting on cell renders past ${WAITING_LIMIT} characters`,
  '  bad-input       a malformed group, position, or Waiting on text',
  '',
  'Exit codes:',
  '  0  the board was written',
  '  1  refused, with the reason on stderr or in the JSON record',
  '',
  'Every write reads priority.md once, renders every table from the task',
  'files and their plans, and writes it once. Task, Touches, and Session',
  'are derived, Waiting on is typed here, and Launch through canon tasks',
  'launch. A board still headed ## Run now reads as In flight, and the write',
  'renames the heading. Safe from a linked worktree, since it resolves the',
  'board root in-process.',
]

const GROUP_FLAGS: Readonly<Record<string, BoardGroup>> = {
  'in-flight': 'In flight',
  'run-now': 'In flight',
  'up-next': 'Up next',
  'needs-a-plan': 'Needs a plan',
}

function withPosition(command: Command): Command {
  return command
    .option('--top', 'Put the row first in its group')
    .option('--bottom', 'Put the row last in its group, the default for a move between groups')
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
        'Target group: in-flight, up-next, or needs-a-plan, with run-now still read as in-flight',
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
    .description('Move a row one group closer to In flight, to its bottom')
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
        'Up next moves to In flight, which reads as dispatched, so a dispatcher',
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

  tasks
    .command('launch')
    .description("Write, replace, or clear an Up next row's Launch cell")
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--role <role>',
      `The session it launches: ${LAUNCH_ROLES.join(', ')}`,
    )
    .option('--model <model>', `The model: ${LAUNCH_MODELS.join(', ')}`)
    .option('--effort <effort>', `The effort: ${LAUNCH_EFFORTS.join(', ')}`)
    .option(
      '--route <route>',
      `How it launches: ${LAUNCH_ROUTES.join(', ')}, being claude --bg or a pasted prompt`,
    )
    .option('--override', "Mark the pick as the operator's, over the runbook's")
    .option('--clear', 'Empty the cell, taking no other pick flag')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        ...BOARD_WRITE_REFUSALS,
        '',
        'The cell stores a pick the dispatcher made from its runbook, and the',
        'verb computes none. A row promoted to In flight carries the model and',
        'effort into its Session cell and leaves the Launch cell behind.',
        'no-column here means the row sits outside Up next.',
        '',
        'Examples:',
        '  canon tasks launch v28.1-trigger-escalation --role worker --model opus --effort high --route background',
        '  canon tasks launch v28.1-trigger-escalation --role worker --model sonnet --effort medium --route hand --override --json',
        '  canon tasks launch v28.1-trigger-escalation --clear',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: LaunchCommandOptions) => {
      process.exitCode = await runLaunch(task, opts)
    })

  tasks
    .command('flight')
    .description('Read where each In flight row stands, storing nothing')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        "Each row reads its task's last Sessions: and Pull request: entries,",
        'the session roster once, and canon pr lift --check once per pull',
        'request. The stage is one of:',
        '  building    no pull request, and the session is on the roster',
        '  stopped     no pull request, and the session is gone',
        '  unrecorded  no pull request, and the task names no session',
        '  reviewing   a review, UI, or evidence gate is open',
        '  checks      CI is pending, failing, or stalled',
        '  rebase      the head is stale against its base or conflicts',
        '  mergeable   every gate the lift check reads is clear',
        '  closed      the pull request is merged or closed',
        '  unread      a read failed, so no stage is guessed',
        '',
        'A row read off its pull request carries the lift reason in `reason`.',
        '',
        'Refusals, read off `reason`:',
        '  no-board          the repository holds no `.canon/tasks/` board',
        '  no-ordering       the board has no priority.md',
        '  unreadable-row    a row no board verb can place',
        '  group-doubled     the board opens one group twice, as Run now beside In flight',
        '',
        'Exit codes:',
        '  0  read, unread rows included, so read each `stage`',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon tasks flight',
        '  canon tasks flight --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: BoardCommandOptions) => {
      process.exitCode = await runFlight(opts)
    })
}

function liveReaders(root: string): FlightReaders {
  return {
    roster: async () => {
      try {
        const report = await resolveSessions()
        if (report.kind !== 'resolved') return undefined
        return new Set(
          report.sessions.flatMap((session) =>
            session.sessionId ? [session.sessionId] : [],
          ),
        )
      } catch {
        return undefined
      }
    },
    pull: async (number) => {
      try {
        return await checkLift(root, number)
      } catch {
        return undefined
      }
    },
  }
}

async function runFlight(opts: BoardCommandOptions): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await readFlight(root, liveReaders(root))

  if (!outcome.ok) {
    return reportRecord(
      'canon tasks flight',
      { ...outcome, detail: [] },
      emitJson,
      root,
    )
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, root, rows: outcome.rows })}\n`,
    )
    return 0
  }

  intro('canon tasks flight')
  if (outcome.rows.length === 0) logInfo('nothing sits under In flight')
  for (const row of outcome.rows) {
    logStep(`${row.task}: ${row.stage}`)
    logInfo(
      [
        row.session ? `session ${row.session.name}` : 'no session recorded',
        row.pullRequest === null ? 'no pull request' : `#${row.pullRequest}`,
        ...(row.reason ? [row.reason] : []),
      ].join(', '),
    )
  }
  outro()

  return 0
}

/**
 * Reads the pick flags into a pick, or `undefined` for `--clear`. Every flag is
 * checked here, once, so the board verb trusts what it is handed.
 */
function launchFrom(
  opts: LaunchCommandOptions,
): LaunchPick | undefined | BoardRefused {
  const given = [opts.role, opts.model, opts.effort, opts.route]
  if (opts.clear) {
    return given.some((flag) => flag !== undefined) || opts.override
      ? badInput('--clear takes no pick flag.')
      : undefined
  }

  const role = oneOf(LAUNCH_ROLES, opts.role)
  const model = oneOf(LAUNCH_MODELS, opts.model)
  const effort = oneOf(LAUNCH_EFFORTS, opts.effort)
  const route = oneOf(LAUNCH_ROUTES, opts.route)
  if (!role || !model || !effort || !route) {
    return badInput(
      `Pass --role (${LAUNCH_ROLES.join(', ')}), --model (${LAUNCH_MODELS.join(', ')}), --effort (${LAUNCH_EFFORTS.join(', ')}), and --route (${LAUNCH_ROUTES.join(', ')}), or --clear.`,
    )
  }

  return { role, model, effort, route, override: opts.override ?? false }
}

function badInput(message: string): BoardRefused {
  return { ok: false, reason: 'bad-input', message, detail: [] }
}

async function runLaunch(
  task: string,
  opts: LaunchCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const pick = launchFrom(opts)
  if (pick && 'ok' in pick) {
    return reportRecord('canon tasks launch', pick, emitJson, process.cwd())
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await writeLaunch(root, task, pick)

  return reportBoardWrite('canon tasks launch', outcome, emitJson, root)
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
        message: `Not a group: ${opts.group}. Pass in-flight, up-next, or needs-a-plan.`,
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

function launchWarning(stem: string): string {
  return `${stem} entered Up next with no Launch cell. Write one with: canon tasks launch ${stem} --role <role> --model <model> --effort <effort> --route <route>`
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
        group: groupToken(outcome.group),
        from:
          outcome.from === undefined || outcome.from === 'backlog'
            ? (outcome.from ?? null)
            : groupToken(outcome.from),
        position: outcome.position,
        backlog: outcome.backlog,
        ...(outcome.kept ? { kept: true } : {}),
        ...(outcome.launch ? { launch: outcome.launch } : {}),
      })}\n`,
    )
    if (outcome.launch === 'none') {
      process.stderr.write(`${launchWarning(outcome.stem)}\n`)
    }
    return 0
  }

  intro(title)
  logStep('Written')
  logInfo(
    `${outcome.stem} ${outcome.kept ? 'kept at' : 'sits at'} ${outcome.position} under ${outcome.group}${outcome.from && outcome.from !== outcome.group ? `, from ${outcome.from}` : ''}`,
  )
  if (outcome.launch === 'none') logWarn(launchWarning(outcome.stem))
  if (outcome.backlog) logRemove('its backlog line')
  logAdd(relative(root, outcome.path))
  outro()

  return 0
}
