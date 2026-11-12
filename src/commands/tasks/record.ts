import { relative } from 'node:path'
import { type Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { type BoardRefused, PLANNED_WAITING } from '@/tasks/board'
import { type ClosureOutcome, readClosure } from '@/tasks/closes'
import {
  type CloseOutcome,
  closeOutcomes,
  type PlanOutcome,
  type PullRequestOutcome,
  recordPlan,
  type RecordRefused,
  type RecordSelector,
  recordPullRequest,
  recordSession,
  type SessionOutcome,
} from '@/tasks/record'
import { resolveSessions } from '@/sessions/resolve'
import {
  intro,
  logAdd,
  logError,
  logInfo,
  logStep,
  outro,
  pipeOutput,
} from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

/** Matches `trunk.ts`'s bound on a git subprocess this verb also shells out to. */
const GIT_TIMEOUT_MS = 10_000
const GH_TIMEOUT_MS = 10_000

const TRUNK_BRANCHES: readonly string[] = ['main', 'master']

interface PullRequestCommandOptions {
  readonly json?: boolean
  readonly plan?: string
  readonly root?: string
}

interface SessionCommandOptions {
  readonly json?: boolean
  readonly plan?: string
  readonly name?: string
  readonly root?: string
}

interface PlanLinkCommandOptions {
  readonly add?: boolean
  readonly waiting?: string
  readonly json?: boolean
  readonly root?: string
}

interface OutcomeCommandOptions {
  readonly close?: readonly string[]
  readonly json?: boolean
  readonly plan?: string
  readonly root?: string
}

interface ClosesCommandOptions {
  readonly branch?: string
  readonly json?: boolean
  readonly plan?: string
  readonly root?: string
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
  const branch = await workingBranch()
  const outcome = await recordPullRequest(
    root,
    selector,
    Number(number),
    branch ? [branch, ...(await formerNames(branch))] : [],
  )

  return reportPullRequest(outcome, emitJson, root)
}

async function runSession(
  sessionId: string,
  task: string | undefined,
  opts: SessionCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const selector = selectorFor(task, opts.plan)

  if ('ok' in selector) {
    return reportRecord(
      'canon tasks session',
      selector,
      emitJson,
      process.cwd(),
    )
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const name = opts.name ?? (await rosterName(sessionId))
  const outcome = await recordSession(root, selector, sessionId, name)

  return reportSession(outcome, emitJson, root)
}

/** The live roster's name for an id, or undefined once the session has exited. */
async function rosterName(sessionId: string): Promise<string | undefined> {
  const report = await resolveSessions()
  if (report.kind === 'absent') return undefined

  return report.sessions.find((session) => session.sessionId === sessionId)
    ?.name
}

function reportSession(
  outcome: SessionOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRecord('canon tasks session', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        sessionId: outcome.sessionId,
        name: outcome.name,
        action: outcome.action,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks session')
  logStep(outcome.action === 'unchanged' ? 'Already recorded' : 'Recorded')
  logInfo(`${outcome.stem} names ${outcome.name} (${outcome.sessionId})`)
  if (outcome.action !== 'unchanged') logAdd(relative(root, outcome.path))
  outro()

  return 0
}

const RENAME_PATTERN = /^Branch: renamed refs\/heads\/(.+) to refs\/heads\//

/**
 * Names the branch carried before each `git branch -m`, read off its reflog,
 * which moves with a rename and records every earlier one. A marker written
 * under an old name is otherwise one nothing ever clears.
 */
async function formerNames(branch: string): Promise<readonly string[]> {
  const result = await execa(
    'git',
    [
      '-C',
      process.cwd(),
      'reflog',
      'show',
      '--format=%gs',
      `refs/heads/${branch}`,
    ],
    { reject: false, timeout: GIT_TIMEOUT_MS, env: gitEnv(), extendEnv: false },
  )
  if (result.exitCode !== 0) return []

  return result.stdout
    .split('\n')
    .map((line) => RENAME_PATTERN.exec(line)?.[1])
    .filter((name): name is string => name !== undefined)
}

/**
 * The branch checked out where the command runs, which is where the work is,
 * rather than the board root's. Undefined on trunk, a detached HEAD, or a
 * failed read, where no slice is in flight to hold the task open.
 */
async function workingBranch(): Promise<string | undefined> {
  const result = await execa(
    'git',
    ['-C', process.cwd(), 'branch', '--show-current'],
    { reject: false, timeout: GIT_TIMEOUT_MS, env: gitEnv(), extendEnv: false },
  )

  const branch = result.exitCode === 0 ? result.stdout.trim() : ''
  if (branch.length === 0 || TRUNK_BRANCHES.includes(branch)) return undefined

  return branch
}

/**
 * The pull request numbers whose head is `branch`, open or not. A failed run,
 * an unreadable answer, or no `gh` at all returns an empty list, which writes
 * the marker, the direction that holds a task open rather than archiving it.
 */
async function branchPullNumbers(
  branch: string | undefined,
): Promise<readonly number[]> {
  if (branch === undefined) return []

  const result = await execa(
    'gh',
    ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number'],
    {
      cwd: process.cwd(),
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) return []

  try {
    const rows: unknown = JSON.parse(result.stdout)
    if (!Array.isArray(rows)) return []

    return rows
      .map((row: unknown) =>
        typeof row === 'object' && row !== null && 'number' in row
          ? row.number
          : undefined,
      )
      .filter((number): number is number => Number.isInteger(number))
  } catch {
    return []
  }
}

/**
 * The pull request numbers whose head is `branch`, read over REST because a
 * cloud session's GitHub proxy refuses the GraphQL `gh pr list` runs on.
 * Unlike `branchPullNumbers`, a failed or unreadable answer is null rather
 * than an empty list, since the closing decision must not read a failure as
 * a branch with no pull request.
 */
async function branchPullNumbersRest(
  branch: string | undefined,
): Promise<readonly number[] | null> {
  if (branch === undefined) return []

  const owner = await execa(
    'gh',
    ['api', 'repos/{owner}/{repo}', '--jq', '.owner.login'],
    {
      cwd: process.cwd(),
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (owner.exitCode !== 0 || owner.stdout.trim() === '') return null

  const result = await execa(
    'gh',
    [
      'api',
      '-X',
      'GET',
      'repos/{owner}/{repo}/pulls',
      '-f',
      `head=${owner.stdout.trim()}:${branch}`,
      '-f',
      'state=all',
      '--jq',
      '[.[].number]',
    ],
    {
      cwd: process.cwd(),
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) return null

  try {
    const numbers: unknown = JSON.parse(result.stdout)
    if (!Array.isArray(numbers)) return null

    return numbers.every((number) => Number.isInteger(number))
      ? (numbers as number[])
      : null
  } catch {
    return null
  }
}

async function runPlanLink(
  task: string,
  plan: string,
  opts: PlanLinkCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await recordPlan(
    root,
    task,
    plan,
    opts.add ?? false,
    opts.waiting,
  )

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
  const branch = await workingBranch()
  const outcome = await closeOutcomes(
    root,
    selector,
    raw.map(Number),
    branch,
    await branchPullNumbers(branch),
  )

  return reportOutcome(outcome, emitJson, root)
}

export function reportRecord(
  title: string,
  refused: RecordRefused | BoardRefused,
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
        pending: outcome.pending,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks pull-request')
  logStep(outcome.action === 'unchanged' ? 'Already recorded' : 'Recorded')
  logInfo(`${outcome.stem} names pull request #${outcome.number}`)
  if (outcome.pending.length > 0) {
    logInfo(`still pending on ${outcome.pending.join(', ')}`)
  }
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
        replaced: outcome.replaced,
        board: { ...outcome.board, from: outcome.board.from ?? null },
      })}\n`,
    )
    return 0
  }

  intro('canon tasks plan-link')
  logStep(outcome.action === 'unchanged' ? 'Already recorded' : 'Recorded')
  logInfo(`${outcome.stem} names plan ${outcome.plan}`)
  if (outcome.replaced) logInfo(`replaced ${outcome.replaced}`)
  if (outcome.action !== 'unchanged') logAdd(relative(root, outcome.path))
  logInfo(
    `board row ${outcome.board.moved ? '' : 'not moved, '}${outcome.board.note}`,
  )
  outro()

  return 0
}

async function runCloses(
  task: string | undefined,
  opts: ClosesCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const branch = opts.branch ?? (await workingBranch())
  const branches = branch ? [branch, ...(await formerNames(branch))] : []
  const selector =
    !task && !opts.plan
      ? ({ kind: 'branch', branches } as const)
      : selectorFor(task, opts.plan)

  if ('ok' in selector) {
    return reportRecord('canon tasks closes', selector, emitJson, process.cwd())
  }

  const root = opts.root ?? (await mainWorktreeRoot())
  const outcome = await readClosure(
    root,
    selector,
    branches,
    await branchPullNumbersRest(branch),
  )

  return reportCloses(outcome, emitJson, root)
}

function reportCloses(
  outcome: ClosureOutcome,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    return reportRecord('canon tasks closes', outcome, emitJson, root)
  }

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        root,
        task: outcome.stem,
        path: relative(root, outcome.path),
        issues: outcome.issues,
        closing: outcome.closing,
        reason: outcome.reason,
        operatorChecks: outcome.operatorChecks ?? [],
      })}\n`,
    )
    return 0
  }

  intro('canon tasks closes')
  logStep(outcome.closing ? 'Closes' : 'Closes nothing')
  logInfo(
    outcome.issues.length > 0
      ? `${outcome.stem} names ${outcome.issues.map((n) => `#${n}`).join(', ')}, ${outcome.reason}`
      : `${outcome.stem} names no issue`,
  )
  for (const check of outcome.operatorChecks ?? []) {
    logInfo(`operator check: ${check}`)
  }
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
        pending: outcome.pending,
      })}\n`,
    )
    return 0
  }

  intro('canon tasks outcome')
  logStep(outcome.closed.length > 0 ? 'Closed' : 'Nothing to close')

  for (const closed of outcome.closed) logAdd(closed)
  for (const already of outcome.alreadyClosed) logInfo(`${already} (already)`)
  if (outcome.pending.length > 0) {
    logInfo(`pending on ${outcome.pending.join(', ')}`)
  }

  if (outcome.closed.length > 0) logInfo(relative(root, outcome.path))
  outro()

  return 0
}

export function registerRecord(tasks: Command): void {
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
        'Refusals, read off `reason`:',
        '  no-board   the repository holds no `.canon/tasks/` board',
        '  no-match   no task matches the selector',
        '  ambiguous  more than one task matches the selector',
        '  bad-input  a number that is not a pull request number',
        '',
        'Exit codes:',
        '  0  the line was added, appended to, corrected, or already correct',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It adds Pull request: #NNN under the origin lines the task carries,',
        'and appends the number to the line when one exists, so a task shipped',
        'in slices lists every pull request. A line that does not read as a',
        'list is replaced. The board is shared scratch, so a linked worktree',
        'records against the same board.',
        '',
        'It also drops the current branch, and each name it was renamed from,',
        'from the Pending branch: line, even when the number was already',
        'listed, and removes the line once empty.',
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
    .command('session')
    .description('Record a session that worked a task on its Sessions: line')
    .argument(
      '<sessionId>',
      'Full sessionId, as canon sessions list --json carries it',
    )
    .argument('[task]', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--plan <slug>', 'Select the task whose Plan line names this plan')
    .option(
      '--name <name>',
      'Name to record, read off the live roster when omitted',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Refusals, read off `reason`:',
        '  no-board   the repository holds no `.canon/tasks/` board',
        '  no-match   no task matches the selector',
        '  ambiguous  more than one task matches the selector',
        '  bad-input  an id that is not a full sessionId, or an empty name',
        '  no-name    the roster lists no live session with the id, and no',
        '             --name was passed',
        '',
        'Exit codes:',
        '  0  the session was added, appended, or already listed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'It writes Sessions: <name> (<sessionId>) below the origin, Pull',
        'request:, and Pending branch: lines, and appends to the line when one',
        'exists. The id is the key, so a session already listed is reported',
        'unchanged under the name it was first recorded with. A cloud',
        'session_ id is accepted, and takes --name since the roster never',
        'lists it. Safe from a linked worktree, since it resolves the board',
        'root in-process.',
        '',
        'Examples:',
        '  canon tasks session 0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0 v28.1-trigger-escalation',
        '  canon tasks session 0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0 --plan task-sessions-line --json',
        '  canon tasks session session_01AbC v28.1-trigger-escalation --name cloud-canon-a',
        '',
      ].join('\n'),
    )
    .action(
      async (
        sessionId: string,
        task: string | undefined,
        opts: SessionCommandOptions,
      ) => {
        process.exitCode = await runSession(sessionId, task, opts)
      },
    )

  tasks
    .command('plan-link')
    .description("Write or correct a task's Plan: line to point at a plan")
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .argument('<plan>', 'Plan path or its slug, as in dispatch-answer-gate')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--add',
      'Append the plan to the line, for a task sliced over plans',
    )
    .option(
      '--waiting <text>',
      `The Waiting on cell a promoted row carries, "${PLANNED_WAITING}" when omitted`,
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Refusals, read off `reason`:',
        '  no-board       the repository holds no `.canon/tasks/` board',
        '  no-match       no task matches the selector',
        '  no-plan        the plan named does not exist',
        '  several-plans  the task line links more than one plan',
        '  bad-input      a malformed argument',
        '',
        'Exit codes:',
        '  0  the line was added, appended to, corrected, or already correct',
        '  1  refused, including several-plans for a line linking more than one',
        '     plan, with the reason on stderr or in the JSON record',
        '',
        'It writes Plan: [<label>](<target>) right after the H1, corrects the',
        'target in place when the line exists and names the one it replaced,',
        'and resolves both a bare slug and a board-relative path the way canon',
        'tasks plan-answers does. Safe from a linked worktree, since it',
        'resolves the board root in-process.',
        '',
        'With --add it keeps every link in order and appends the plan, so a',
        'sliced task links one plan per slice. It reports unchanged when the',
        'plan is already listed and is allowed on a line holding several.',
        '',
        'A row under Needs a plan moves to the bottom of Up next through the',
        'board verbs, and `board` in the record says whether it moved and why',
        'not. A row elsewhere, or a task with no row, stays where it is.',
        '',
        'Examples:',
        '  canon tasks plan-link v28.1-trigger-escalation dispatch-answer-gate',
        '  canon tasks plan-link v28.1-trigger-escalation second-slice --add',
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
        'Refusals, read off `reason`:',
        '  no-board      the repository holds no `.canon/tasks/` board',
        '  no-match      no task matches the selector',
        '  ambiguous     more than one task matches the selector',
        '  no-outcomes   the task carries no outcomes',
        '  out-of-range  a `--close` position past the end of the outcome list',
        '  bad-input     a malformed position',
        '',
        'Exit codes:',
        '  0  every named outcome is closed',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Positions count every outcome checkbox in file order, starting at 1.',
        'An outcome already closed is reported rather than refused, so a rerun',
        'against the same positions is safe.',
        '',
        'Run from a branch other than main or master, a close that ticks a new',
        'box names that branch on a Pending branch: line, which holds the task',
        'against a merge-time archive until canon tasks pull-request records',
        "the branch's own number. The marker is skipped once gh lists a pull",
        "request for the branch whose number is already on the task's Pull",
        'request: line, and a failed gh lookup writes it.',
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
    .command('closes')
    .description('Name the issues the branch pull request closes')
    .argument('[task]', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--plan <slug>', 'Select the task whose Plan line names this plan')
    .option(
      '--branch <name>',
      'Branch to treat as this pull request, defaulting to the checked-out one',
    )
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .addHelpText(
      'after',
      [
        '',
        'Refusals, read off `reason`:',
        '  no-board   the repository holds no `.canon/tasks/` board',
        '  no-match   no task matches the selector',
        '  ambiguous  more than one task matches the selector',
        '  bad-input  a task and a plan both named',
        '',
        'Exit codes:',
        '  0  the task is read, whether or not it closes',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'With no task or plan named, the task whose plan derives the branch is read,',
        'and a branch nothing owns is no-match.',
        '',
        'Reads the `Issue:` lines, each `#NNN` or a comma list, and reports',
        '`issues` and `closing`. The pull request closes them only when it is',
        "the task's last slice, the condition the merge-time archive applies:",
        'no open outcome and no other branch on `Pending branch:`. The branch',
        'and the names it carried before a rename count as this one. Read off',
        '`reason` when `closing` is false:',
        '  no-issues       the task carries no `Issue:` number',
        '  earlier-slice   this branch has a pull request on the task that is not',
        '                  the last listed, so a later number closes the issue',
        '  lookup-failed   the pull request lookup failed while the task already',
        '                  lists a pull request, so an earlier slice cannot be ruled out',
        '  open-outcomes   an outcome is still open, so a later slice closes it.',
        '                  A `- [ ] Operator check: <outcome>` line holds nothing open and',
        '                  is listed under `operatorChecks`',
        '  pending-branch  another branch is on `Pending branch:`',
        '  no-outcomes     the task carries no outcomes',
        '',
        'Examples:',
        '  canon tasks closes --plan closing-issue-references --json',
        '  canon tasks closes v28.1-trigger-escalation --branch feat/x',
        '',
      ].join('\n'),
    )
    .action(async (task: string | undefined, opts: ClosesCommandOptions) => {
      process.exitCode = await runCloses(task, opts)
    })
}
