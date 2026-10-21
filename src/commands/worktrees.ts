import type { Command } from 'commander'
import {
  intro,
  logInfo,
  logRemove,
  logStep,
  logWarn,
  outro,
  pipeOutput,
  plural,
} from '@/cli/ui'
import {
  type Refusal,
  type ReclaimReport,
  reclaimReport,
  type Unreadable,
  type WorktreeVerdict,
} from '@/worktrees/reclaim'
import { mainWorktreeRoot } from '@/git/worktree'
import {
  type Half,
  type MemberOutcome,
  type MemberRefusal,
  type MembersRefusal,
  type MembersReport,
  retireMembers,
} from '@/worktrees/members'
import { machineListenerReader } from '@/listeners/machine'
import { repairBareFlag } from '@/worktrees/bare-flag'
import { type StopReport, stopListeners } from '@/worktrees/stop'
import {
  removeReclaimable,
  type RemovalOutcome,
  type RemovalReport,
} from '@/worktrees/remove'

interface ListCommandOptions {
  readonly json?: boolean
}

interface RepairBareFlagOptions {
  readonly root?: string
  readonly json?: boolean
}

interface ReclaimCommandOptions {
  readonly dryRun?: boolean
  readonly json?: boolean
}

interface RetireMembersCommandOptions {
  readonly pullRequest: string
  readonly dryRun?: boolean
  readonly json?: boolean
}

/**
 * What the post-merge hook reads after an integrator merges. Every field it
 * branches on is a number or a fixed word, and `members` sits last, for the
 * reason `ReclaimRecord` states.
 */
export interface RetireMembersRecord {
  readonly pullRequest: number
  readonly reason: MembersRefusal | null
  readonly detail: string | null
  readonly dryRun: boolean
  /** Members with a half deleted, or that a dry run would delete, and none kept or failed. */
  readonly retired: number
  /** Members with a half kept and none failed. */
  readonly kept: number
  /** Members with a half whose deletion failed. */
  readonly failed: number
  readonly members: readonly MemberOutcome[]
}

/**
 * What a caller reads instead of the frame.
 *
 * The post-merge hooks are the callers that are not a person, and they branch
 * on a parsed field rather than on the exit code, since a shell profile
 * wrapping `canon` in a function flattens every status to zero. The base
 * stack's hook, and any hook installed before `canon hooks post-merge`, reads
 * the record with a pattern rather than a parser, so every field it branches on is
 * a number or a fixed word, and `outcomes` sits last so a greedy pattern
 * anchored on a scalar never reaches into it.
 */
export interface ReclaimRecord {
  readonly reason: Unreadable | null
  readonly detail: string | null
  readonly dryRun: boolean
  readonly reclaimable: number
  readonly removed: number
  readonly failed: number
  readonly pruned: boolean
  /**
   * Processes signaled, or that a dry run would signal, for listening inside a
   * reclaimed worktree. Null when the machine offered no way to read
   * listeners, which says nothing about what is still running.
   */
  readonly stopped: number | null
  readonly outcomes: readonly RemovalOutcome[]
}

/** Every value the record carries, in the two shapes a run can end in. */
export type ReclaimSource =
  | {
      readonly kind: 'unreadable'
      readonly reason: Unreadable
      readonly detail: string
      readonly dryRun: boolean
    }
  | {
      readonly kind: 'read'
      readonly dryRun: boolean
      readonly reclaimable: number
      /**
       * Null when no removal ran at all, which covers a reading that found
       * nothing reclaimable and a dry run alike. The two differ on
       * `reclaimable` rather than here, so a caller can tell a quiet repository
       * from a run that was asked not to act.
       */
      readonly removal: RemovalReport | null
      /** Null when no stop ran, which is a reading with nothing reclaimable. */
      readonly stop?: StopReport | null
    }

const REFUSALS: Record<Refusal, string> = {
  'main-worktree': 'the main worktree, which is never reclaimable',
  'current-worktree':
    'the worktree this command is running in, so removing it would take the run with it',
  'detached-head': 'detached HEAD, so no branch names a pull request',
  'no-merged-pull-request': 'no merged pull request for its branch',
  'uncommitted-changes': 'uncommitted work no history stands behind',
  'unreadable-worktree': 'the working tree could not be read',
  'held-by-session': 'a live session still holds it',
}

const UNREADABLE: Record<Unreadable, string> = {
  'gh-missing':
    'gh is not on the path, so the merge state could not be read. Install it and run this again.',
  'gh-failed':
    'The pull request read failed, so every worktree would report as unmerged whatever its real state. Authenticate gh and run this again.',
  'sessions-unreadable':
    'The session roster could not be read, so nothing was read about which worktrees are still held.',
  'sessions-unchecked':
    'Some session records come from another pid namespace and no socket answers for them, so a live holder may be missing from the roster. Run this from the namespace the sessions run in.',
}

const CONDITIONS = [
  'A worktree is reclaimable when all three hold: its branch has a merged',
  'pull request, its working tree is clean, and no live session holds it.',
  'Each alone has a case where removal loses something, so "refusals"',
  'carries every failing condition rather than the first.',
  '',
  'The merged state comes from gh rather than from git ancestry. A',
  'repository that squash merges never makes a merged branch an ancestor',
  'of its trunk, so ancestry calls shipped work unmerged and calls an',
  'abandoned branch sitting at a release commit merged.',
  '',
  'A directory already deleted by hand reads as clean rather than as',
  'unreadable, so the merged and session checks decide it like any other.',
  '',
  'The main worktree is never reclaimable, and neither is the one this',
  'command is running in, since git removes the directory a caller stands',
  'in and every later call scoped to it then fails.',
  '',
  'A "refusals" entry is one of these reasons:',
  ...Object.entries(REFUSALS).map(
    ([reason, meaning]) => `  ${reason.padEnd(24)}${meaning}`,
  ),
  '',
  'An unreadable input refuses the whole reading rather than reporting',
  'every worktree as not reclaimable, since an absent merge state and a',
  'branch with no merged pull request produce the same empty answer.',
  '',
  'The merge read covers the most recent 200 merged pull requests. A',
  'worktree older than that reads as having none and is refused, which',
  'keeps a directory rather than removing one.',
]

const MEMBERS_REFUSALS: Record<MembersRefusal, string> = {
  'gh-missing': 'gh is not on the path, so the pull request could not be read',
  'gh-failed': 'the pull request read failed',
  'sessions-unreadable': 'the session roster could not be read',
  'sessions-unchecked':
    'some session records come from another pid namespace and no socket answers for them',
  'not-merged': 'the pull request has not merged',
  'no-members': 'the body carries no "Fan-in members:" line',
  'trunk-named': 'the line names the branch the pull request merged into',
  'head-named': "the line names the integrator's own branch",
  'open-pull-request': 'a named branch has an open pull request of its own',
  'head-unreadable':
    'refs/pull/<n>/head could not be fetched, or names another commit than the merged head',
}

const MEMBER_REFUSALS: Record<MemberRefusal, string> = {
  'not-in-merged-head':
    "its tip is not an ancestor of the integrator's merged head, so it holds work the merge did not carry",
  'remote-unreadable': 'origin could not be read for this branch',
  'worktree-kept':
    'its worktree was kept, and git refuses to delete a branch a worktree holds',
  'main-worktree': 'it is checked out in the main worktree',
  'current-worktree': 'its worktree is the one this command runs in',
  'detached-head': 'its worktree has a detached HEAD',
  'uncommitted-changes': 'its worktree holds uncommitted work',
  'unreadable-worktree': 'its worktree could not be read',
  'held-by-session': 'a live session holds its worktree',
}

const RETIRE_CONDITIONS = [
  'Reads the "Fan-in members:" line of a merged integrator pull request,',
  "whose backticked branches are the members, and deletes each one's",
  'origin branch, worktree, and local branch. Nothing outside that line',
  'is read.',
  '',
  "A member half is merged when its tip is an ancestor of the integrator's",
  'merged head, fetched from refs/pull/<n>/head, rather than of the trunk,',
  'which a squash merge never makes it. Origin and local are judged apart,',
  'so an unpushed commit keeps the local branch and a commit pushed after',
  'the merge keeps the origin branch. The worktree takes the same reading',
  '`canon worktrees list` gives, with the members counted as merged.',
  '',
  'These refuse the whole run, and nothing is deleted:',
  ...Object.entries(MEMBERS_REFUSALS).map(
    ([reason, meaning]) => `  ${reason.padEnd(22)}${meaning}`,
  ),
  '',
  'These keep one half of one member, named in its "reasons":',
  ...Object.entries(MEMBER_REFUSALS).map(
    ([reason, meaning]) => `  ${reason.padEnd(22)}${meaning}`,
  ),
]

export function register(program: Command): void {
  const worktrees = program
    .command('worktrees')
    .description('Report which worktrees are reclaimable, and reclaim them')
    .helpOption('-h, --help', 'Show this help message')

  worktrees
    .command('list')
    .description(
      'Report every worktree with a reclaim verdict and the reason behind it',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every worktree was read',
        '  1  refused, with the reason on stderr',
        '',
        ...CONDITIONS,
        '',
        'This reports and removes nothing. "route" names which removal shape',
        'applies: "session" when a live session holds the directory,',
        'where `claude rm <id>` is meant to remove it and its worktree',
        'together, but its own report is not reliable, so run this command',
        'again afterward to see what happened. "worktree" is the shape once',
        'the session has ended, where `canon worktrees reclaim` is the pair',
        'of a remove and a branch delete.',
        '',
        'Examples:',
        '  canon worktrees list',
        '  canon worktrees list --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ListCommandOptions) => {
      process.exitCode = await runList(opts)
    })

  worktrees
    .command('reclaim')
    .description(
      'Remove every reclaimable worktree and the branch behind it, unless --dry-run',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--dry-run', 'Report what would be removed without removing it')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every reclaimable worktree was removed, or there were none',
        '  1  refused, or a removal failed, with the reason on stderr',
        '',
        ...CONDITIONS,
        '',
        'Removal runs on the default path rather than behind an apply flag,',
        'because report-only is what produced the hand cleanup this verb was',
        'filed against. Each removal unlocks the worktree, removes it, then',
        'deletes its branch, and a run carrying a directory that is already',
        'gone sweeps stale registrations once before the branch deletes.',
        '',
        'Ahead of each removal it sends SIGTERM to every process listening from',
        'inside a reclaimable worktree, so no dev server outlives the tree it',
        'serves. A listener in the main checkout, in a refused worktree, or in',
        'a worktree nested under another is left alone. A dry run signals',
        'nothing and still reports what it would stop. "stopped" in the record',
        'counts those processes, and reads null on a machine with neither lsof',
        'nor /proc, where no listener could be read.',
        '',
        'It deletes only what a reading called reclaimable. A worktree a live',
        'session holds is refused rather than removed here. `claude rm <id>`',
        'is meant to remove the session and its worktree together, but its',
        'own report is not reliable, so run `canon worktrees list` again',
        'afterward to see what happened.',
        '',
        'The stale-registration sweep is the one step that reaches wider, since',
        'git takes no path to scope it. It clears the bookkeeping for every',
        'directory already gone, refused entries included, and deletes no branch',
        'and no directory of its own.',
        '',
        'Examples:',
        '  canon worktrees reclaim --dry-run',
        '  canon worktrees reclaim',
        '  canon worktrees reclaim --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: ReclaimCommandOptions) => {
      process.exitCode = await runReclaim(opts)
    })

  worktrees
    .command('retire-members')
    .description(
      'Delete the fan-in members a merged integrator pull request names, unless --dry-run',
    )
    .helpOption('-h, --help', 'Show this help message')
    .requiredOption(
      '--pull-request <number>',
      'The merged integrator pull request',
    )
    .option('--dry-run', 'Report what would be deleted without deleting it')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  every member was retired or kept, or the body names none',
        '  1  refused, or a deletion failed, with the reason on stderr',
        '',
        ...RETIRE_CONDITIONS,
        '',
        'The post-merge hook runs this once per merged pull request number,',
        'and CANON_SKIP_RECLAIM turns it off there. Run it by hand for a',
        'merge the hook missed.',
        '',
        'Examples:',
        '  canon worktrees retire-members --pull-request 2570 --dry-run',
        '  canon worktrees retire-members --pull-request 2570 --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RetireMembersCommandOptions) => {
      process.exitCode = await runRetireMembers(opts)
    })

  worktrees
    .command('repair-bare-flag', { hidden: true })
    .description('Clear a core.bare flag that worktree entry left set')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to repair', '.')
    .option('--json', 'Print the record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'Exit codes:',
        '  0  always, since the caller is a hook that must never fail a tool call',
        '',
        'Called by .claude/hooks/bare-flag-repair.sh, the one caller that is not',
        'a person, so no help listing shows it. A repository whose common dir is',
        'not named .git keeps its flag, since that is a genuinely bare one.',
        '',
        'Examples:',
        '  canon worktrees repair-bare-flag --root . --json',
        '',
      ].join('\n'),
    )
    .action(async (opts: RepairBareFlagOptions) => {
      const record = await repairBareFlag(opts.root ?? '.')
      if (opts.json === true) {
        process.stdout.write(`${JSON.stringify(record)}\n`)
      } else if (record.message !== null) {
        logWarn(record.message)
      }
    })
}

/**
 * Frames an unreadable reading the same way for both verbs.
 *
 * The merge state is the one input that decides whether a branch is safe to
 * delete, so a reading that could not reach it refuses every entry rather than
 * falling back to a default. Sharing the frame keeps the removal from growing a
 * second answer to the question the report already answers.
 */
function reportUnreadable(
  report: Extract<ReclaimReport, { kind: 'unreadable' }>,
): void {
  logStep('Refused')
  logWarn(UNREADABLE[report.reason])
  logInfo(report.detail)
}

async function runList(opts: ListCommandOptions): Promise<number> {
  const report = await reclaimReport({ cwd: process.cwd() })

  intro('canon worktrees list')

  if (report.kind === 'unreadable') {
    reportUnreadable(report)
    outro()

    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({
          reason: report.reason,
          detail: report.detail,
          worktrees: [],
        })}\n`,
      )
    }

    return 1
  }

  reportWorktrees(report.worktrees)
  outro()

  if (opts.json) {
    process.stdout.write(
      `${JSON.stringify({
        reason: null,
        detail: null,
        worktrees: report.worktrees,
      })}\n`,
    )
  }

  return 0
}

/**
 * Builds the record from the values a run already holds.
 *
 * Separate from the run so the record is testable without a repository, a `gh`
 * credential, or a directory the test would then have to remove. The counts are
 * derived from `outcomes` rather than passed in, since two numbers a caller
 * computes are two numbers a caller can get wrong.
 */
export function reclaimRecord(source: ReclaimSource): ReclaimRecord {
  if (source.kind === 'unreadable') {
    return {
      reason: source.reason,
      detail: source.detail,
      dryRun: source.dryRun,
      reclaimable: 0,
      removed: 0,
      failed: 0,
      pruned: false,
      stopped: 0,
      outcomes: [],
    }
  }

  const outcomes = source.removal?.outcomes ?? []
  const stop = source.stop ?? null

  return {
    reason: null,
    detail: null,
    dryRun: source.dryRun,
    reclaimable: source.reclaimable,
    removed: outcomes.filter((outcome) => outcome.removed).length,
    failed: outcomes.filter((outcome) => !outcome.removed).length,
    pruned: source.removal?.pruned ?? false,
    stopped: stop === null ? 0 : countStopped(stop),
    outcomes,
  }
}

function countStopped(stop: StopReport): number | null {
  if (stop.kind === 'unread') return null
  return stop.stopped.reduce((sum, server) => sum + server.pids.length, 0)
}

/** Names each server a stop took, or would take on a dry run, and says when none could be read. */
function reportStop(stop: StopReport, dryRun: boolean): void {
  if (stop.kind === 'unread') {
    logWarn(
      'This machine offers neither lsof nor /proc, so listening servers were not read and none was stopped.',
    )
    return
  }
  const verb = dryRun ? 'Would stop' : 'Stopped'
  for (const { path, ports } of stop.stopped) {
    logInfo(`${verb} the server on ${ports.join(', ')} in ${path}`)
  }
}

function emitReclaim(opts: ReclaimCommandOptions, source: ReclaimSource): void {
  if (opts.json !== true) return
  process.stdout.write(`${JSON.stringify(reclaimRecord(source))}\n`)
}

async function runReclaim(opts: ReclaimCommandOptions): Promise<number> {
  const dryRun = opts.dryRun ?? false
  const cwd = process.cwd()
  const report = await reclaimReport({ cwd })

  intro(
    dryRun ? 'canon worktrees reclaim (dry-run)' : 'canon worktrees reclaim',
  )

  if (report.kind === 'unreadable') {
    reportUnreadable(report)
    outro()
    emitReclaim(opts, {
      kind: 'unreadable',
      reason: report.reason,
      detail: report.detail,
      dryRun,
    })
    return 1
  }

  const reclaimable = report.worktrees.filter((entry) => entry.reclaimable)

  logStep('Reclaimable')
  if (reclaimable.length === 0) {
    logInfo('None. Every worktree fails at least one condition.')
    outro()
    emitReclaim(opts, { kind: 'read', dryRun, reclaimable: 0, removal: null })
    return 0
  }

  logInfo(plural(reclaimable.length, 'worktree'))
  pipeOutput(reclaimable.map(describe).join('\n'))

  const stop = await stopListeners(
    reclaimable.map((entry) => entry.path),
    { reader: machineListenerReader(), dryRun },
  )

  if (dryRun) {
    logStep('Dry run')
    reportStop(stop, dryRun)
    logWarn('Nothing was removed. Run this again without --dry-run to remove.')
    outro()
    emitReclaim(opts, {
      kind: 'read',
      dryRun,
      reclaimable: reclaimable.length,
      removal: null,
      stop,
    })
    return 0
  }

  // Every git call in the removal is scoped to the main root rather than to the
  // caller's directory, which a removal earlier in the same run can delete out
  // from under the ones after it. The reading above stays on the caller's
  // directory, since that is what tells it which worktree it is standing in.
  const removal = await removeReclaimable(reclaimable, {
    cwd: await mainWorktreeRoot(),
  })

  logStep('Removed')
  reportStop(stop, dryRun)
  for (const outcome of removal.outcomes) reportOutcome(outcome)
  if (removal.pruned) {
    logInfo(
      'Swept the stale worktree registrations left by a deleted directory.',
    )
  }

  const failed = removal.outcomes.filter((outcome) => !outcome.removed)
  if (failed.length > 0) {
    logWarn(
      `${plural(failed.length, 'worktree')} could not be removed. Read the reason above and clear it by hand.`,
    )
  }

  outro()
  emitReclaim(opts, {
    kind: 'read',
    dryRun,
    reclaimable: reclaimable.length,
    removal,
    stop,
  })
  return failed.length > 0 ? 1 : 0
}

/** Names what happened to one entry, with the failing step where it did not close. */
function reportOutcome(outcome: RemovalOutcome): void {
  const branch = outcome.branch ?? 'detached'

  if (outcome.removed) {
    logRemove(`${outcome.path}  ${branch}`)
    return
  }

  const step =
    outcome.failedAt === 'branch'
      ? 'the worktree went but its branch stayed'
      : 'the worktree could not be removed'
  logWarn(`${outcome.path}  ${branch}: ${step}.`)
  if (outcome.detail) pipeOutput(outcome.detail)
}

function reportWorktrees(worktrees: readonly WorktreeVerdict[]): void {
  logStep('Worktrees')

  if (worktrees.length === 0) {
    logInfo('No worktree resolved here. Run this inside a repository.')
    return
  }

  logInfo(plural(worktrees.length, 'worktree'))
  pipeOutput(worktrees.map(describe).join('\n'))

  const reclaimable = worktrees.filter((entry) => entry.reclaimable)

  logStep('Reclaimable')
  if (reclaimable.length === 0) {
    logInfo('None. Every worktree fails at least one condition.')
    return
  }

  logWarn(
    `${plural(reclaimable.length, 'worktree')} can be reclaimed. This reports and removes nothing, so run \`canon worktrees reclaim\` to clear them.`,
  )
}

/**
 * Names the evidence beside the conclusion on every row.
 *
 * The reading has two consumers and they act on different halves. The sweep
 * reads the verdict to decide what to offer, and a person reads it to decide
 * what to remove, so a row phrased for the first alone leaves the second
 * removing a directory on a conclusion it cannot check.
 */
export function describe(verdict: WorktreeVerdict): string {
  const held = verdict.branch ?? 'detached'
  const head = `${verdict.path}  ${held}`

  if (!verdict.reclaimable) {
    const reasons = verdict.refusals.map((refusal) => REFUSALS[refusal])
    // Three cases rather than one line, since only a resolved background
    // holder has a real command to print. An interactive holder has no id to
    // look up at all, and an unresolved background one has an id somewhere in
    // `claude agents --json` that this reading could not cross-reference.
    const routes =
      verdict.route === 'session'
        ? verdict.sessions.map((session) => {
            if (session.kind === 'interactive') {
              return `\n  ${session.name}: interactive, so nothing removes it until its terminal closes.`
            }
            if (session.id === null) {
              return `\n  ${session.name}: match it against claude agents --json for its id, then claude rm '<id>'.`
            }
            return `\n  Removal there goes through: claude rm '${session.id}'`
          })
        : []
    return `${head}\n  Refused: ${reasons.join('; ')}.${routes.join('')}`
  }

  // The directory being gone already is the state that used to refuse, so the
  // row says so rather than leaving a reader to wonder what it is acting on.
  const tree = verdict.missing
    ? 'its directory is already gone'
    : 'the tree is clean'

  return [
    head,
    `  Reclaimable. Pull request #${verdict.pullRequest} merged it, ${tree}, and no session holds it.`,
  ].join('\n')
}

function halves(member: MemberOutcome): readonly Half[] {
  return member.worktree === null
    ? [member.origin, member.local]
    : [member.origin, member.worktree, member.local]
}

/**
 * Builds the record from the report, separate from the run so the counts are
 * testable without a repository. A member already gone everywhere counts
 * nowhere, so a run repeated by hand does not report a retirement it did not
 * make.
 */
export function retireMembersRecord(
  pullRequest: number,
  dryRun: boolean,
  report: MembersReport,
): RetireMembersRecord {
  if (report.kind === 'refused') {
    return {
      pullRequest,
      reason: report.reason,
      detail: report.detail,
      dryRun,
      retired: 0,
      kept: 0,
      failed: 0,
      members: [],
    }
  }

  const states = report.members.map((member) =>
    halves(member).map((half) => half.state),
  )
  const failed = states.filter((each) => each.includes('failed')).length
  const kept = states.filter(
    (each) => !each.includes('failed') && each.includes('kept'),
  ).length
  const retired = states.filter(
    (each) =>
      !each.includes('failed') &&
      !each.includes('kept') &&
      each.some((state) => state === 'deleted' || state === 'would-delete'),
  ).length

  return {
    pullRequest,
    reason: null,
    detail: null,
    dryRun,
    retired,
    kept,
    failed,
    members: report.members,
  }
}

/**
 * A kept half is a refusal doing its job and a body naming no members is the
 * ordinary merge, so neither fails the run.
 */
export function retireMembersExit(record: RetireMembersRecord): number {
  if (record.reason !== null && record.reason !== 'no-members') return 1
  return record.failed > 0 ? 1 : 0
}

function describeHalf(name: string, half: Half): string {
  if (half.state === 'kept') {
    const reasons = half.reasons.map((reason) => MEMBER_REFUSALS[reason])
    return `  ${name}: kept, since ${reasons.join('; ')}.`
  }
  const state = half.state.replace('-', ' ')
  return half.detail === null
    ? `  ${name}: ${state}.`
    : `  ${name}: ${state}. ${half.detail}`
}

async function runRetireMembers(
  opts: RetireMembersCommandOptions,
): Promise<number> {
  const dryRun = opts.dryRun ?? false
  const pullRequest = Number(opts.pullRequest)

  intro(
    dryRun
      ? 'canon worktrees retire-members (dry-run)'
      : 'canon worktrees retire-members',
  )

  if (!Number.isInteger(pullRequest) || pullRequest <= 0) {
    logStep('Refused')
    logWarn(
      `--pull-request takes a pull request number, and "${opts.pullRequest}" is not one.`,
    )
    outro()
    return 1
  }

  // The reading stays on the caller's directory, which is what refuses the
  // worktree it stands in, and every write runs from the main root.
  const report = await retireMembers(pullRequest, {
    cwd: process.cwd(),
    root: await mainWorktreeRoot(),
    dryRun,
  })
  const record = retireMembersRecord(pullRequest, dryRun, report)

  if (report.kind === 'refused') {
    logStep(report.reason === 'no-members' ? 'Members' : 'Refused')
    if (report.reason === 'no-members') logInfo(report.detail)
    else {
      logWarn(`Nothing was deleted: ${MEMBERS_REFUSALS[report.reason]}.`)
      logInfo(report.detail)
    }
  } else {
    logStep('Members')
    pipeOutput(
      report.members
        .map((member) =>
          [
            member.branch,
            describeHalf('origin', member.origin),
            ...(member.worktree === null
              ? []
              : [
                  describeHalf(
                    `worktree ${member.worktree.path}`,
                    member.worktree,
                  ),
                ]),
            describeHalf('local', member.local),
          ].join('\n'),
        )
        .join('\n'),
    )
    if (record.failed > 0) {
      logWarn(
        `${plural(record.failed, 'member')} could not be fully deleted. Read the reason above and clear it by hand.`,
      )
    }
    if (dryRun) {
      logWarn(
        'Nothing was deleted. Run this again without --dry-run to delete.',
      )
    }
  }

  outro()
  if (opts.json === true) process.stdout.write(`${JSON.stringify(record)}\n`)
  return retireMembersExit(record)
}
