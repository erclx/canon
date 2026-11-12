import { EXIT_FINDINGS } from '@/commands/tasks/validate'
import { type Command } from 'commander'
import { type AnswersOutcome, planAnswers } from '@/tasks/answers'
import {
  DEFAULT_LAUNCH_WAIT_SECONDS,
  type LaunchOutcome,
  type LaunchWait,
  readLaunchable,
  waitForLaunchable,
} from '@/tasks/launch-wait'
import { type BranchOutcome, planBranch } from '@/tasks/branch'
import {
  type CitationOutcome,
  type PlanCitations,
  planCitations,
} from '@/tasks/archive'
import {
  type Claim,
  type Holder,
  planReach,
  type ReachOutcome,
} from '@/tasks/reach'
import { intro, logError, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import { mainWorktreeRoot } from '@/git/worktree'

interface CitationsCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface AnswersCommandOptions {
  readonly json?: boolean
  readonly root?: string
}

interface LaunchableCommandOptions {
  readonly json?: boolean
  readonly root?: string
  readonly wait?: string | true
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

  if (outcome.location === 'several') {
    return `links ${outcome.targets.length} plans (${outcome.targets.join(', ')}), so no single plan is the sweep's to settle.`
  }

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

const BAD_WAIT = '--wait takes a whole number of seconds above zero.'

interface BadWait {
  readonly ok: false
  readonly reason: 'bad-wait'
  readonly message: string
}

async function runLaunchable(
  task: string,
  opts: LaunchableCommandOptions,
): Promise<number> {
  const emitJson = opts.json ?? false
  const root = opts.root ?? (await mainWorktreeRoot())

  let waitSeconds: number | undefined
  if (opts.wait === true) {
    waitSeconds = DEFAULT_LAUNCH_WAIT_SECONDS
  } else if (opts.wait !== undefined) {
    if (!/^\d+$/.test(opts.wait) || Number(opts.wait) === 0) {
      const refused: BadWait = {
        ok: false,
        reason: 'bad-wait',
        message: BAD_WAIT,
      }
      return reportLaunchable(refused, emitJson, root)
    }
    waitSeconds = Number(opts.wait)
  }

  const outcome =
    waitSeconds === undefined
      ? await readLaunchable(root, task)
      : await waitForLaunchable(root, task, {
          waitSeconds,
          clock: {
            now: () => Date.now(),
            sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
          },
        })

  return reportLaunchable(outcome, emitJson, root)
}

function reportLaunchable(
  outcome: LaunchOutcome | LaunchWait | BadWait,
  emitJson: boolean,
  root: string,
): number {
  if (!outcome.ok) {
    intro('canon tasks launchable')
    logStep('Refused')
    logError(outcome.message)
    outro()

    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          reason: outcome.reason,
          message: outcome.message,
          ...('waitedSeconds' in outcome && {
            waitedSeconds: outcome.waitedSeconds,
          }),
          root,
        })}\n`,
      )
    }
    return 1
  }

  const code = outcome.launchable ? 0 : EXIT_FINDINGS

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ ...outcome, root })}\n`)
    return code
  }

  intro('canon tasks launchable')
  logStep(outcome.task)

  if (outcome.plan === undefined) {
    logWarn('carries no Plan: line yet, so no plan has landed.')
  } else if (outcome.launchable) {
    logInfo(`${outcome.plan} waits on nobody, so the dispatch may launch it.`)
  } else {
    for (const question of outcome.open) {
      logWarn(`${question.label} ${question.why}`)
    }
    logError(`${outcome.plan} still waits on the operator.`)
  }

  if ('waitedSeconds' in outcome) {
    logInfo(
      outcome.reason === 'timeout'
        ? `not launchable within ${outcome.waitedSeconds}s`
        : `launchable after ${outcome.waitedSeconds}s`,
    )
  }

  outro()
  return code
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
    'The slug breaks a cap in claude/skills/git-branch/references/branch.md, so hand the row to a person rather than renaming it.',
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

export function registerPlans(tasks: Command): void {
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
        '  several   the Plan: line links more than one plan, named in targets',
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
    .command('launchable')
    .description(
      'Report whether a row has a linked plan the dispatch may launch',
    )
    .argument('<task>', 'Task filename stem, as in v28.1-trigger-escalation')
    .helpOption('-h, --help', 'Show this help message')
    .option('--json', 'Emit a machine-readable record on stdout')
    .option('--root <path>', 'Board root, defaulting to the main worktree')
    .option(
      '--wait [seconds]',
      `Hold until the row is launchable, default ${DEFAULT_LAUNCH_WAIT_SECONDS}`,
    )
    .addHelpText(
      'after',
      [
        '',
        "Resolves the task's Plan: line and runs the plan-answers gate on the",
        'plan it names, in one read. It keys on the line rather than on the',
        'plan file, since a planner links a plan only after it validates, so a',
        'plan still being written never reads as landed. It answers planning',
        'alone: the branch and claim checks stay in the dispatch runbook.',
        '',
        'The record carries task, plan, launchable, and open, the last three',
        'named as plan-answers names them. Read `reason`:',
        '  unlinked    the task carries no Plan: line yet',
        '  open        the plan still holds a question for the operator',
        '  launchable  the plan waits on nobody',
        '',
        '`--wait [seconds]` re-reads every 30 seconds until the row is',
        'launchable or the deadline passes. `reason` then reads `launchable`',
        'or `timeout`, the record carries the last reading, and',
        '`waitedSeconds` is added. A refusal ends the wait at once. A wait',
        'past 600 seconds outlasts a foreground shell call, so run it in the',
        'background and act on the wake.',
        '',
        'Refusals, read off `reason`:',
        '  no-board       the project carries no .canon/tasks/',
        '  no-match       no task carries that stem exactly',
        '  ambiguous      several tasks start with the name, so pass one in full',
        '  several-plans  the Plan: line links more than one plan',
        '  no-plan        the Plan: line names no file',
        '  archived       the Plan: line points into the plans archive',
        '  bad-input      the Plan: line carries an empty target',
        '  bad-wait       --wait takes a whole number of seconds above zero',
        '',
        'Exit codes:',
        '  0  the row is launchable',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  the row is unlinked or open, or the wait reached its deadline',
        '',
        'It reports and never writes. Branch on `reason` rather than on the',
        'exit code, which a shell function wrapping canon can flatten to zero.',
        '',
        'Examples:',
        '  canon tasks launchable v28.1-trigger-escalation',
        '  canon tasks launchable v28.1-trigger-escalation --json',
        '  canon tasks launchable v28.1-trigger-escalation --wait --json',
        '  canon tasks launchable v28.1-trigger-escalation --wait 900 --json',
        '',
      ].join('\n'),
    )
    .action(async (task: string, opts: LaunchableCommandOptions) => {
      process.exitCode = await runLaunchable(task, opts)
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
        '  0  the branch is derived and conforms to claude/skills/git-branch/references/branch.md',
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
}
