import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  type CheckRunListing,
  collapseChecks,
  missesGatingCheck,
  type RawStatus,
  type RawWorkflowRun,
  requiredChecks,
  STALL_SECONDS,
  type StalledRun,
  stallCandidates,
  stalledRuns,
  withMergeState,
} from '@/pr/checks'
import { type HeadRefusal, resolveTip } from '@/pr/head'
import {
  type ChecksGate,
  DEFAULT_WAIT_SECONDS,
  SETTLING_REEL_SKIPS,
  type EvidenceGate,
  lift,
  type LiftApi,
  type LiftRefusal,
  type PullState,
  readBaseStanding,
  readChangedPaths,
  readsDrivableBox,
} from '@/pr/lift'
import {
  merge,
  type MergeApi,
  type MergeOutcome,
  type MergeRefusal,
  type MergeRequest,
} from '@/pr/merge'
import { loadPaintedPatterns } from '@/pr/painted'
import { mergeStateOf, type RestPull, reviewRowOf } from '@/pr/rest'
import {
  readReviewState,
  type ReviewStateApi,
  type ReviewStateRecord,
  waitForReviews,
} from '@/pr/review-state'
import { PROJECT_ROOT } from '@/roots/project'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  PULL_REFUSALS,
  PullRefusal,
  ReadOptions,
  gh,
  gitRunner,
  listReviews,
  readIdentity,
  readPull,
  refReader,
  refuseWith,
  resolvePullNumber,
} from '@/commands/pr/pull'
import { registerKeyChanges } from '@/commands/pr/key-changes'
import { registerHead } from '@/commands/pr/head'
import { registerChecks } from '@/commands/pr/checks'
import { registerClose } from '@/commands/pr/close'
import { registerEvidence } from '@/commands/pr/evidence'
import { registerPreview } from '@/commands/pr/preview'
import { registerDriveCopy } from '@/commands/pr/drive-copy'
import { registerLocal } from '@/commands/pr/local'
import { registerTick } from '@/commands/pr/tick'
import { registerFrames } from '@/commands/pr/frames'

interface LiftCommandOptions extends ReadOptions {
  readonly check?: boolean
  readonly wait?: string
}

interface MergeCommandOptions extends ReadOptions {
  readonly dryRun?: boolean
}

interface ReviewStateOptions extends ReadOptions {
  readonly wait?: string
}

export function register(program: Command): void {
  const pr = program
    .command('pr')
    .description('Read a pull request body against the change it describes')
    .helpOption('-h, --help', 'Show this help message')

  registerKeyChanges(pr)

  registerHead(pr)

  registerChecks(pr)

  pr.command('review-state')
    .description(
      'Report what the last code review and UI review passes covered at the tip',
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--wait <seconds>',
      `Hold until a pass covers the tip in every bound family, default ${DEFAULT_WAIT_SECONDS}`,
    )
    .addHelpText(
      'after',
      [
        '',
        'A review carries two stamps GitHub writes at submission: `commit.oid`',
        'names whatever the head was at that instant and `submittedAt` names the',
        'instant itself. Neither describes the commit the reviewing session read.',
        'A push landing inside the compose window moves `commit.oid` onto a commit',
        'nobody reviewed, and the next pass then scopes its delta past that work',
        'and reports it covered.',
        '',
        '`review-pr` writes the commit it read and the instant it read it as a',
        'marker on the last line of every body it posts. This is the one place',
        'that marker is parsed, so `review-pr` and the orchestrator poll read one',
        'answer rather than carrying a copy of the format each.',
        '',
        'Read `source` before trusting the rest:',
        '  marker    the pass wrote its own read-time record, which is authority',
        '  fallback  a pass posted before the marker shipped, off GitHub stamps',
        '  none      the thread carries no pass, so the next one is a first pass',
        '',
        'Those code review fields stay at the top level of the record. Beside',
        'them, `head` is the branch tip read from the remote, and `review` and',
        '`ui` carry each family at that tip:',
        '  reason     the refusal `canon pr lift` gives the family, absent when',
        '             its gate passes, read through the same gate function',
        '  isCovered  a pass covers the tip: the gate passes, or the newest pass,',
        '             open or unmarked, names the tip',
        '',
        '`ui` also carries the newest `## UI review` pass (`heading`, `state`,',
        '`commit`, `source`), `isBound`, which is whether the evidence comment',
        'carries a checklist holding a box a driver can run or the newest UI',
        'pass is open, so a checklist of taste boxes alone binds nothing until',
        'a pass opens, and `carriedFrom` when the lift carried a close',
        'forward, or `drivenPaths` and the painted subset `paintedPaths` when',
        'it refused to. An unbound family reads covered.',
        '',
        'Both families post as pull request reviews, so this reads',
        '`pulls/<n>/reviews` alone, as the lift does. Issue comments are not',
        'read: neither review skill posts there, and a heading found only in a',
        'comment would let a worker move on a pass the lift then refuses.',
        '',
        '`--wait <seconds>` holds until `isCovered` reads true in both families',
        'or the deadline passes, re-reading the tip every 30 seconds so a push',
        'moves what a pass must cover. The evidence is read once at the start.',
        'The record then adds `reason`, `covered` or `timeout`, and',
        '`waitedSeconds`. A wait past 600 seconds outlasts a foreground shell',
        'call, so run it in the background.',
        '',
        'Refusals, read off `reason`:',
        '  ambiguous-pull    two open pull requests share the branch against',
        '                    different bases, so name a number',
        '  no-branch         the pull request carries no head branch name',
        '  unresolvable-ref  the remote read failed, which is not an absent branch',
        '  no-remote-branch  the remote carries no branch by that name, so there',
        '                    is no tip to compare against',
        '  reviews-unreadable  the reviews could not be parsed, which is unread',
        '                      rather than none',
        '  gh-missing        `gh` is not on the path, so no pull request resolved',
        '  gh-failed         `gh` could not answer for this branch, so name a number',
        '  no-object-head    the pull request object reported no head commit',
        '  bad-wait          --wait takes a whole number of seconds',
        '',
        'Exit codes:',
        '  0  the thread was read, whether it carries a pass or not, or the',
        '     wait ended covered',
        '  1  refused, with the reason on stderr or in the JSON record, or the',
        '     wait reached its deadline as `timeout`',
        '',
        'Examples:',
        '  canon pr review-state',
        '  canon pr review-state 1341 --json',
        '  canon pr review-state 1341 --wait 1200 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReviewStateOptions) => {
      process.exitCode = await runReviewState(number, opts)
    })

  registerEvidence(pr)

  pr.command('lift')
    .description(
      "Lift a pull request's draft mark once its reviews, evidence, standing, and CI all read clear at the head",
    )
    .argument('[number]', 'Pull request to lift, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--check', 'Report every gate and write nothing')
    .option(
      '--wait <seconds>',
      `Hold for a pending CI run up to this long, default ${DEFAULT_WAIT_SECONDS}`,
    )
    .addHelpText(
      'after',
      [
        '',
        'The verb reads the gate itself, so any session that closes a review can',
        'run it and nobody has to vouch for who is asking. Gates, in the order',
        'they are read:',
        '  review    the newest `## Review` is closed at the head, off its marker',
        '  ui        the newest `## UI review` is closed at the head, bound only',
        '            where `canon pr evidence --check` carries a checklist whose',
        '            `drivable` count is not zero, a missing count binding. An',
        '            open UI review refuses `ui-open` whatever the count. A close',
        '            on an earlier commit still holds when it is an ancestor of the',
        '            head and every path changed since is one no box can observe,',
        '            being tests, stories, snapshots, markdown in the root and in',
        '            `canon/`, `.claude/`, `.github/`, and `docs/`, evidence captures,',
        '            and `canon/design/`, and the record names it as `carriedFrom`.',
        '            Any other change refuses `ui-behind`, listing the paths as',
        '            `drivenPaths` and the painted subset as `paintedPaths`, since',
        '            a box drives behavior a `.ts` file holds too. A close whose',
        '            count line shows boxes not driven and none passed, failed,',
        '            or needing eyes refuses `ui-undriven`, carried or not',
        '  evidence  the evidence check reads settled, and every painted path',
        '            it lists as `uncaptured` is covered. A reel the marked',
        '            comment embeds at the head covers every path, and a',
        '            `- **Waived capture:** `<path>`: <reason>` line outside a code',
        '            fence covers the path it names as the list spells it. Only',
        '            the newest `## Review` and the newest `## UI review` count,',
        '            each closed by its own marker and not dismissed, so a pass',
        '            must restate a waiver for it to hold on a later head. A',
        '            review with no pass heading waives nothing. Any other path',
        '            refuses `painted-uncaptured`,',
        '            the gate entry naming what is left as `uncaptured` and what',
        '            a review waived as `waived`, each sorted. An absent list,',
        '            in a project whose base keeps no captures, passes. Last, a',
        '            checklist holding a drivable box owes a reel at the head, or',
        '            one filmed earlier that carries to it under the rule a UI',
        '            close carries by, which the gate entry names as',
        '            `reelCarriedFrom`. Otherwise a',
        '            `reelSkip` on the evidence check whose code, the text before',
        '            its first colon, is one of',
        `            ${SETTLING_REEL_SKIPS.join(', ')}`,
        '            settles it, since no builder can change those. So does a',
        '            `- **Waived reel:** <reason>` line in a',
        '            standing pass, read the way a capture waiver is. Anything',
        '            else refuses `reel-unsettled`, the gate entry naming the skip',
        '            as `reelSkip`, and a waiver that settled it as `reelWaived`',
        '  standing  the head is fresh against the base, not stale or conflicted',
        '  ci        every required check run on the tip passed, waited on up to --wait',
        '',
        "The required checks are the ones the base branch's rules list. A",
        'check outside them is waited on by nobody, and one that failed is',
        'named in the record as `advisory` without blocking. Rules that do not',
        'read, or that list no check, gate by every check run on the tip.',
        '',
        'Review state, UI state, evidence, and standing are read before the CI',
        'wait, so a reviewer whose partner is still driving refuses at once. The',
        'head and the reviews are read again before the mutation.',
        '',
        'Painted paths are what a browser renders (`.tsx`, `.jsx`, `.vue`,',
        '`.svelte`, `.astro`, `.html`, `.css`, `.scss`, `.svg`, images, fonts)',
        'minus test, spec, and story files. A project adds to or trims the list',
        'in `canon/config/painted.json` as `{ "painted": [glob], "unpainted":',
        '[glob] }`.',
        '',
        'A pull request that is already ready has every gate read too, CI',
        'included. A review, ui, or evidence gate that reads not clear returns',
        'it to draft with reason `redrafted` and the failing reason as',
        '`failed`, exit 1. A stale standing refuses before the CI wait, and CI',
        'is waited on up to --wait as on a draft, with the head, the reviews,',
        'the standing, and the draft state read again after it. Either refuses',
        'with its own reason, exit 1, and never causes a re-draft. One drafted',
        'during the wait refuses `ready-withdrawn` and stays a draft. Every',
        'record whose pull request is still ready carries `isReady: true`.',
        'Only a ready pull request whose gates all clear, CI included,',
        'reports `already-ready`, exit 0. Under --check nothing is written, CI',
        'is read once, and the first failing reason is reported.',
        '',
        'Reasons:',
        '  lifted, already-ready, redrafted, clear (--check)',
        '  pull-closed, review-missing, review-open, review-unmarked,',
        '  review-behind, ui-missing, ui-open, ui-unmarked, ui-behind,',
        '  ui-undriven, evidence-owed, painted-uncaptured, reel-unsettled,',
        '  standing-stale, standing-conflict, standing-unknown,',
        '  ci-pending (--check), ci-failing, ci-conflicted, ci-stalled,',
        '  ci-timeout, head-moved, ready-withdrawn, gh-failed',
        '',
        'Every read is REST. The mutation is the one GraphQL call.',
        '',
        'Exit codes:',
        '  0  lifted, already-ready with CI passing, or every gate clear under',
        '     --check',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr lift 1341 --json',
        '  canon pr lift 1341 --check --json',
        '  canon pr lift --wait 600',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: LiftCommandOptions) => {
      process.exitCode = await runLift(number, opts)
    })

  pr.command('merge')
    .description(
      "Squash-merge a ready pull request with a message carrying only the change: its Summary, Key changes, and Technical context, or a bot pull request's own changelog or package table",
    )
    .argument('[number]', 'Pull request to merge, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--dry-run', 'Print the title and description and merge nothing')
    .addHelpText(
      'after',
      [
        '',
        'The operator runs this verb, and no skill calls it. A permissions deny',
        'rule on `canon pr merge` and `gh pr merge` keeps an agent off it.',
        '',
        'The title is the pull request title plus ` (#<number>)`. The',
        "description is the body's `## Summary`, `## Key changes`, and",
        '`## Technical context`, in that order under their headings, with the',
        'UI pass line dropped. Technical context is optional. Testing, the',
        'reviewer requests, and every other section stay out of the trunk.',
        '',
        'A release-please or Dependabot pull request is read off its head',
        'branch, plus the release body opening or a bot author, and needs no',
        'flag. A release composes to its changelog without the robot line, the',
        'dividers, and the footer. Dependabot composes to its lead and package',
        'table, cut at the first `Updates ` line or `<details>` block. A bot body with nothing left',
        'refuses missing-summary.',
        '',
        'Refusals are read before the one write, which sends the head it read',
        'as `sha`, so a push after the read refuses rather than merging. The',
        'verb reads the draft flag and not the reviews, since a ready pull',
        'request already passed `canon pr lift`. It does not wait on checks or',
        'delete the branch.',
        '',
        "The checks gate by the ones the base branch's rules require, the way",
        '`canon pr lift` reads them. A failing check outside that set is named',
        'in the record as `advisory` and does not refuse the merge.',
        '',
        'Reasons:',
        '  merged, dry-run (--dry-run)',
        '  pull-closed, pull-draft, missing-summary, missing-key-changes,',
        '  ci-failing, ci-conflicted, ci-stalled, ci-pending, head-moved,',
        '  not-mergeable, gh-failed',
        '',
        'The merge is the REST `PUT pulls/<number>/merge` with',
        '`merge_method=squash`, never `gh pr merge`, which runs on GraphQL.',
        '',
        'Exit codes:',
        '  0  merged, or every refusal clear under --dry-run',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr merge 1341 --dry-run',
        '  canon pr merge 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: MergeCommandOptions) => {
      process.exitCode = await runMerge(number, opts)
    })

  registerClose(pr)

  registerPreview(pr)

  registerLocal(pr)

  registerTick(pr)

  registerDriveCopy(pr)

  registerFrames(pr)
}

async function runReviewState(
  number: string | undefined,
  opts: ReviewStateOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr review-state')

  let waitSeconds: number | undefined
  if (opts.wait !== undefined) {
    if (!/^\d+$/.test(opts.wait)) {
      return refuseWith('bad-wait', LIFT_REFUSALS['bad-wait'], emitJson, root)
    }
    waitSeconds = Number(opts.wait)
  }

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', PULL_REFUSALS['gh-missing'], emitJson, root)
  }

  // The number is resolved up front so the record names the pull request a
  // caller that passed no argument was answered about.
  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  const read = await readIdentity(root, resolved.number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  // The module refuses every failed read as `gh-failed`. The api keeps each
  // read's own reason, so a caller still tells an unreadable thread from an
  // unreadable remote.
  let failure: PullRefusal | HeadRefusal = 'gh-failed'
  const git = gitRunner(root)
  const api: ReviewStateApi = {
    readTip: async () => {
      const tip = await resolveTip(read.identity.branch, refReader(root))
      if (tip.kind === 'read') return tip.tip
      failure = tip.reason
      return undefined
    },
    readReviews: async () => {
      const reviews = await listReviews(root, resolved.number)
      if (reviews.kind === 'read') return reviews.rows.map(reviewRowOf)
      failure =
        reviews.reason === 'gh-failed' ? 'gh-failed' : 'reviews-unreadable'
      return undefined
    },
    readEvidence: () => readEvidenceGate(root, resolved.number),
    readChanged: (from, to) => readChangedPaths(git, from, to),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  }

  const painted = loadPaintedPatterns(root)
  const wait =
    waitSeconds === undefined
      ? undefined
      : await waitForReviews(api, { waitSeconds, painted })
  const state = wait ?? (await readReviewState(api, painted))
  if (state.kind === 'refused') {
    return refuseWith(failure, PULL_REFUSALS[failure], emitJson, root)
  }

  const { record } = state
  const pull = Number(resolved.number)
  logReviewState(pull, record)
  const waited =
    wait?.kind === 'read'
      ? { reason: wait.reason, waitedSeconds: wait.waitedSeconds }
      : undefined
  if (waited !== undefined) {
    logStep(waited.reason === 'covered' ? 'Covered' : 'Timeout')
    logInfo(
      waited.reason === 'covered'
        ? `a pass covers ${record.head.slice(0, 8)} in every bound family after ${waited.waitedSeconds}s`
        : `no pass covered ${record.head.slice(0, 8)} in every bound family within ${waited.waitedSeconds}s`,
    )
  }

  outro()

  if (emitJson) {
    const { scope, ...families } = record
    process.stdout.write(
      `${JSON.stringify({
        root,
        number: pull,
        ...scope,
        ...families,
        ...waited,
      })}\n`,
    )
  }

  return waited?.reason === 'timeout' ? 1 : 0
}

function logReviewState(number: number, record: ReviewStateRecord): void {
  const { scope } = record
  logStep('Scope')
  logInfo(`#${number} at ${record.head.slice(0, 8)}`)

  if (scope.source === 'none') {
    logStep('First pass')
    logInfo('the thread carries no review, so nothing has been covered yet')
  } else if (scope.source === 'marker') {
    logStep(scope.state === 'open' ? 'Open' : 'Closed')
    logInfo(
      `the last pass read ${scope.commit?.slice(0, 8)} at ${scope.readAt}, which is what it covered`,
    )
  } else {
    logStep(scope.state === 'open' ? 'Open' : 'Closed')
    // Named rather than folded into the line above, since the whole point of
    // the marker is that these two fields describe the submission and not the
    // read, and a caller cannot tell the two apart from the values alone.
    logWarn(
      `the last pass carries no read-time marker, so ${scope.commit === undefined ? 'no commit' : scope.commit.slice(0, 8)} and ${scope.submittedAt ?? 'no instant'} come off GitHub's submission stamps. A push inside that pass's compose window is invisible here.`,
    )
  }

  for (const [name, family] of [
    ['review', record.review],
    ['ui', record.ui],
  ] as const) {
    const line = `${name}: ${family.reason ?? 'clear'}, ${family.isCovered ? 'a pass covers the tip' : 'no pass covers the tip'}`
    if (family.isCovered) logInfo(line)
    else logWarn(line)
  }
  if (!record.ui.isBound) {
    logInfo(
      'ui: the evidence carries no box a driver can run, so the family is unbound',
    )
  }
}

const LIFT_REFUSALS: Record<LiftRefusal | 'bad-wait' | 'gh-missing', string> = {
  'bad-wait': '--wait takes a whole number of seconds, zero or more.',
  'gh-missing': PULL_REFUSALS['gh-missing'],
  'pull-closed': 'The pull request is closed, so there is no mark to lift.',
  'review-missing': 'The thread carries no code review, so none has closed.',
  'review-open':
    'The newest code review is open, so a finding still owes a fix.',
  'review-unmarked':
    'The newest code review carries no read-time marker, so the commit it covers is a GitHub stamp this gate does not trust.',
  'review-behind':
    'The newest code review closed on an earlier commit than the head.',
  'ui-missing':
    'The evidence comment carries a checklist holding a box a driver can run, and no UI review has been posted.',
  'ui-open': 'The newest UI review is open, so a box still owes a fix.',
  'ui-unmarked':
    'The newest UI review carries no head marker, so the commit it covers is a GitHub stamp this gate does not trust.',
  'ui-behind':
    'The newest UI review closed on an earlier commit than the head.',
  'ui-undriven':
    'The newest UI review closed having driven no box, so it looked at nothing. Re-drive the checklist on an address that answers.',
  'evidence-owed':
    'The evidence check reads owed, so the ship chain left a step undone.',
  'painted-uncaptured':
    'A painted path changed with no capture, no reel at the head, and no waiver in a review. Capture it, or have a review waive it.',
  'reel-unsettled':
    'The checklist holds a box a driver can run, and no reel is filmed at the head. The posted skip, if any, is one a builder can fix. Film the reel, or have a review waive it.',
  'standing-stale':
    'The base moved under a path this branch writes since it branched, so CI measured a tree that is gone.',
  'standing-conflict': 'The head does not merge cleanly into the base.',
  'standing-unknown':
    'The head or the base did not resolve, which a fork or a deleted head leaves, so its standing is unread and waits on a person.',
  'ci-pending': 'A check run on the tip has yet to conclude.',
  'ci-failing': 'A check run on the tip failed.',
  'ci-conflicted':
    'The branch conflicts with its base, so no run will start for the tip.',
  'ci-stalled':
    'A workflow run on the tip has sat queued with no job past 10 minutes, and a cancel or rerun does not restart it. Close and reopen the pull request to start a fresh run.',
  'ci-timeout': 'A check run was still pending when --wait ran out.',
  'head-moved':
    'A push landed during the wait, so the gates cleared a commit that is no longer the head.',
  'ready-withdrawn':
    'The pull request went back to draft during the wait, so its mark is left as someone set it.',
  'gh-failed':
    'A read or the mutation was refused, so nothing is reported as lifted.',
}

const READY_MUTATION =
  'mutation($id: ID!) { markPullRequestReadyForReview(input: {pullRequestId: $id}) { pullRequest { isDraft } } }'

const CONVERT_DRAFT_MUTATION =
  'mutation($id: ID!) { convertPullRequestToDraft(input: {pullRequestId: $id}) { pullRequest { isDraft } } }'

/**
 * Runs one pull request mutation and answers whether the draft flag now reads
 * `isDraft`. The flag is read back rather than the exit trusted, since the
 * mutation can answer 200 with an errors array and no change.
 */
async function flipDraft(
  root: string,
  mutation: string,
  field: 'markPullRequestReadyForReview' | 'convertPullRequestToDraft',
  nodeId: string,
  isDraft: boolean,
): Promise<boolean> {
  const result = await execa(
    'gh',
    ['api', 'graphql', '-f', `query=${mutation}`, '-f', `id=${nodeId}`],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) return false
  try {
    const body = JSON.parse(String(result.stdout)) as {
      data?: Record<string, { pullRequest?: { isDraft?: boolean } } | undefined>
    }
    return body.data?.[field]?.pullRequest?.isDraft === isDraft
  } catch {
    return false
  }
}

/**
 * Reads the evidence check through this checkout's own CLI rather than a
 * second copy of its logic, so the lift and a caller running
 * `canon pr evidence --check` read one answer.
 */
async function readEvidenceGate(
  root: string,
  number: string,
): Promise<EvidenceGate | undefined> {
  const result = await execa(
    process.execPath,
    [
      join(PROJECT_ROOT, 'src', 'cli.ts'),
      'pr',
      'evidence',
      number,
      '--check',
      '--json',
      '--root',
      root,
    ],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS * 2,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  const last = String(result.stdout)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .at(-1)
  if (last === undefined) return undefined

  let record: {
    reason?: unknown
    owed?: unknown
    checklist?: unknown
    drivable?: unknown
    uncaptured?: unknown
    reel?: unknown
    reelSkip?: unknown
  }
  try {
    record = JSON.parse(last)
  } catch {
    return undefined
  }
  if (record.reason !== 'settled' && record.reason !== 'owed') return undefined

  const reelHead = readReelHead(record.reel)
  return {
    isSettled: record.reason === 'settled',
    owed: Array.isArray(record.owed) ? record.owed.map(String) : [],
    hasDrivableBox: readsDrivableBox(record),
    // Absent stays absent, since it means the base keeps no captures and
    // the gate passes as it did before the list existed.
    ...(Array.isArray(record.uncaptured) && {
      uncaptured: record.uncaptured.map(String),
    }),
    ...(reelHead !== undefined && { reelHead }),
    ...(typeof record.reelSkip === 'string' && { reelSkip: record.reelSkip }),
  }
}

function readReelHead(reel: unknown): string | undefined {
  if (typeof reel !== 'object' || reel === null || !('head' in reel)) {
    return undefined
  }
  return typeof reel.head === 'string' && reel.head !== ''
    ? reel.head
    : undefined
}

async function readChecksGate(
  root: string,
  number: string,
  tip: string,
): Promise<ChecksGate | undefined> {
  // A status read that fails leaves a required status context unseen, which
  // reads pending rather than passing, so it needs no refusal of its own.
  const [listed, pulled, combined] = await Promise.all([
    gh(root, [
      'api',
      `repos/{owner}/{repo}/commits/${tip}/check-runs?per_page=100`,
    ]),
    gh(root, ['api', `repos/{owner}/{repo}/pulls/${number}`]),
    gh(root, [
      'api',
      `repos/{owner}/{repo}/commits/${tip}/status?per_page=100`,
    ]),
  ])
  if (listed === null) return undefined
  try {
    const row = pulled === null ? undefined : (JSON.parse(pulled) as RestPull)
    const required = await readRequiredChecks(root, row?.base?.ref)
    const statuses =
      combined === null
        ? []
        : ((JSON.parse(combined) as { statuses?: readonly RawStatus[] })
            .statuses ?? [])
    const listing = JSON.parse(listed) as CheckRunListing
    const reading = withMergeState(
      mergeStateOf(row?.mergeable_state),
      collapseChecks(tip, listing, required, statuses),
    )
    // Only a reading that would refuse `ci-pending` pays for the runs read, so
    // a pass, a failure, or a conflict keeps its reason and its cost. A gating
    // check with a row is a run still going, which a stall elsewhere must not
    // cut short.
    const stalled =
      reading.state === 'pending' &&
      !reading.conflicted &&
      missesGatingCheck(tip, listing, required, statuses)
        ? await readStalledRuns(root, tip)
        : []
    return {
      state: reading.state,
      isConflicted: reading.conflicted,
      ...(reading.advisory !== undefined && { advisory: reading.advisory }),
      ...(stalled.length > 0 && { stalled }),
    }
  } catch {
    return undefined
  }
}

/**
 * The tip's workflow runs GitHub queued past the bound and never gave a job.
 * Any read that fails or does not parse finds no stall, so the reading stays
 * `ci-pending`, which still refuses the merge, rather than a pass or a
 * refusal of its own.
 */
async function readStalledRuns(
  root: string,
  tip: string,
): Promise<readonly StalledRun[]> {
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/actions/runs?head_sha=${tip}&per_page=100`,
  ])
  if (listed === null) return []
  let runs: readonly RawWorkflowRun[]
  try {
    const parsed = JSON.parse(listed) as { workflow_runs?: unknown }
    if (!Array.isArray(parsed.workflow_runs)) return []
    runs = parsed.workflow_runs as readonly RawWorkflowRun[]
  } catch {
    return []
  }

  const now = Date.now()
  const candidates = stallCandidates(tip, runs, now, STALL_SECONDS)
  const counts = await Promise.all(
    candidates.map(
      async (run) => [run.id, await readJobCount(root, run.id)] as const,
    ),
  )
  const jobCounts = new Map<number, number>()
  for (const [id, count] of counts) {
    if (count !== undefined) jobCounts.set(id, count)
  }
  return stalledRuns(tip, runs, jobCounts, now, STALL_SECONDS)
}

/** A run's job count, undefined when the read failed or carried none. */
async function readJobCount(
  root: string,
  id: number,
): Promise<number | undefined> {
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/actions/runs/${id}/jobs?per_page=1`,
  ])
  if (listed === null) return undefined
  try {
    const count = (JSON.parse(listed) as { total_count?: unknown }).total_count
    return typeof count === 'number' ? count : undefined
  } catch {
    return undefined
  }
}

/**
 * The checks the base branch's rules require, so a check they leave out runs
 * without holding the gate. Undefined on any read that fails, which gates by
 * every check as the verbs did before the rules were read.
 */
async function readRequiredChecks(
  root: string,
  base: string | undefined,
): Promise<ReadonlySet<string> | undefined> {
  if (base === undefined || base === '') return undefined
  const rules = await gh(root, [
    'api',
    `repos/{owner}/{repo}/rules/branches/${base}`,
  ])
  if (rules === null) return undefined
  try {
    return requiredChecks(JSON.parse(rules))
  } catch {
    return undefined
  }
}

function liftApi(root: string, number: string, baseRef: string): LiftApi {
  const git = gitRunner(root)

  return {
    readPull: async (): Promise<PullState | undefined> => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (row.node_id === undefined || row.head?.ref === undefined) {
          return undefined
        }
        return {
          isDraft: row.draft === true,
          isOpen: row.state === 'open',
          nodeId: row.node_id,
          branch: row.head.ref,
          head: row.head.sha ?? '',
        }
      } catch {
        return undefined
      }
    },
    readTip: async (branch) => {
      const resolved = await resolveTip(branch, refReader(root))
      return resolved.kind === 'read' ? resolved.tip : undefined
    },
    readReviews: async () => {
      const reviews = await listReviews(root, number)
      return reviews.kind === 'read' ? reviews.rows.map(reviewRowOf) : undefined
    },
    readEvidence: () => readEvidenceGate(root, number),
    readStanding: (head) =>
      readBaseStanding(git, Number(number), head, baseRef),
    readChecks: (tip) => readChecksGate(root, number, tip),
    markReady: (nodeId) =>
      flipDraft(
        root,
        READY_MUTATION,
        'markPullRequestReadyForReview',
        nodeId,
        false,
      ),
    markDraft: (nodeId) =>
      flipDraft(
        root,
        CONVERT_DRAFT_MUTATION,
        'convertPullRequestToDraft',
        nodeId,
        true,
      ),
    readChanged: (from, to) => readChangedPaths(git, from, to),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  }
}

async function runLift(
  number: string | undefined,
  opts: LiftCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr lift')

  let waitSeconds = DEFAULT_WAIT_SECONDS
  if (opts.wait !== undefined) {
    if (!/^\d+$/.test(opts.wait)) {
      return refuseWith('bad-wait', LIFT_REFUSALS['bad-wait'], emitJson, root)
    }
    waitSeconds = Number(opts.wait)
  }

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', LIFT_REFUSALS['gh-missing'], emitJson, root)
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  // Read once up front for the base the standing is measured against. The
  // injected `readPull` re-reads the object on every gate that needs it.
  const initial = await readPull(root, resolved.number)
  if (initial.kind === 'refused') {
    return refuseWith(
      initial.reason,
      PULL_REFUSALS[initial.reason],
      emitJson,
      root,
    )
  }
  const base = initial.row.base?.ref
  if (base === undefined || base === '') {
    return refuseWith('gh-failed', LIFT_REFUSALS['gh-failed'], emitJson, root)
  }

  const record = await lift(liftApi(root, resolved.number, `origin/${base}`), {
    isCheck: opts.check ?? false,
    waitSeconds,
    painted: loadPaintedPatterns(root),
  })

  logStep(record.reason)
  logInfo(
    record.reason === 'lifted'
      ? `#${resolved.number} is ready for review at ${record.head?.slice(0, 8)}`
      : record.reason === 'already-ready'
        ? `#${resolved.number} is ready and every gate reads clear, CI included`
        : record.reason === 'redrafted'
          ? `#${resolved.number} is back to draft, since ${record.failed === undefined ? 'a gate' : LIFT_REFUSALS[record.failed]}`
          : record.reason === 'clear'
            ? `every gate reads clear for #${resolved.number}`
            : LIFT_REFUSALS[record.reason],
  )
  for (const gate of record.gates) {
    if (!gate.isOk) logWarn(`${gate.gate}: ${gate.reason ?? 'not clear'}`)
  }
  warnAdvisory(record.advisory)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, number: Number(resolved.number), ...record })}\n`,
    )
  }

  return record.isOk ? 0 : 1
}

function warnAdvisory(advisory: readonly string[] | undefined): void {
  for (const name of advisory ?? []) {
    logWarn(
      `advisory: ${name} failed, which the base's rules do not require, so it did not block`,
    )
  }
}

const MERGE_REFUSALS: Record<MergeRefusal | 'gh-missing', string> = {
  'gh-missing': PULL_REFUSALS['gh-missing'],
  'pull-closed': 'The pull request is closed, so there is nothing to merge.',
  'pull-draft':
    'The pull request is a draft, so its reviews have not lifted the mark.',
  'missing-summary':
    'The body carries no `## Summary` with text under it, so the description has no change to state.',
  'missing-key-changes':
    'The body carries no `## Key changes` with text under it, so the description has no change to state.',
  'ci-failing': 'A check run on the head failed.',
  'ci-conflicted': 'The branch conflicts with its base.',
  'ci-stalled':
    'A workflow run on the head has sat queued with no job past 10 minutes. Close and reopen the pull request to start a fresh run.',
  'ci-pending':
    'A check run on the head has yet to conclude. Run the verb again once it does.',
  'head-moved':
    'The head moved after the read, so GitHub refused rather than merging unread commits.',
  'not-mergeable': 'GitHub answered that the pull request is not mergeable.',
  'gh-failed':
    'A read or the merge was refused, so nothing is reported as merged.',
}

/**
 * The REST merge, never `gh pr merge`, which runs on the GraphQL a cloud
 * session's proxy refuses. gh reports the status only as the `(HTTP <code>)`
 * tail of its stderr, so 409 and 405 are read off it.
 */
async function putSquashMerge(
  root: string,
  number: string,
  request: MergeRequest,
): Promise<MergeOutcome> {
  const result = await execa(
    'gh',
    [
      'api',
      '-X',
      'PUT',
      `repos/{owner}/{repo}/pulls/${number}/merge`,
      '-f',
      `commit_title=${request.title}`,
      '-f',
      `commit_message=${request.description}`,
      '-f',
      `sha=${request.sha}`,
      '-f',
      'merge_method=squash',
    ],
    {
      cwd: root,
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    },
  )
  if (result.exitCode !== 0) {
    const status = /\(HTTP (\d{3})\)/.exec(String(result.stderr))?.[1]
    if (status === '409') return { kind: 'head-moved' }
    if (status === '405') return { kind: 'not-mergeable' }
    return { kind: 'failed' }
  }
  try {
    const body = JSON.parse(String(result.stdout)) as {
      merged?: unknown
      sha?: unknown
    }
    return body.merged === true && typeof body.sha === 'string'
      ? { kind: 'merged', sha: body.sha }
      : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

function mergeApi(root: string, number: string): MergeApi {
  return {
    readPull: async () => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (row.head?.sha === undefined || typeof row.title !== 'string') {
          return undefined
        }
        return {
          isOpen: row.state === 'open',
          isDraft: row.draft === true,
          title: row.title,
          body: row.body ?? '',
          head: row.head.sha,
          branch: row.head.ref ?? '',
          isBotAuthor: row.user?.type === 'Bot',
        }
      } catch {
        return undefined
      }
    },
    readChecks: (head) => readChecksGate(root, number, head),
    putMerge: (request) => putSquashMerge(root, number, request),
  }
}

async function runMerge(
  number: string | undefined,
  opts: MergeCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr merge')

  if (Bun.which('gh') === null) {
    return refuseWith(
      'gh-missing',
      MERGE_REFUSALS['gh-missing'],
      emitJson,
      root,
    )
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  const record = await merge(mergeApi(root, resolved.number), {
    number: Number(resolved.number),
    isDryRun: opts.dryRun ?? false,
  })

  logStep(record.reason)
  logInfo(
    record.reason === 'merged'
      ? `#${record.number} squash-merged as ${record.sha?.slice(0, 8)}`
      : record.reason === 'dry-run'
        ? `#${record.number} would merge with the message below`
        : MERGE_REFUSALS[record.reason],
  )
  warnAdvisory(record.advisory)
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...record })}\n`)
  } else if (record.reason === 'dry-run') {
    process.stdout.write(`${record.title}\n\n${record.description}\n`)
  }

  return record.isOk ? 0 : 1
}
