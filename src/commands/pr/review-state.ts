import type { Command } from 'commander'
import { resolve } from 'node:path'
import { type HeadRefusal, resolveTip } from '@/pr/head'
import { DEFAULT_WAIT_SECONDS, readChangedPaths } from '@/pr/lift'
import { loadPaintedPatterns } from '@/pr/painted'
import { reviewRowOf } from '@/pr/rest'
import {
  readReviewState,
  type ReviewStateApi,
  type ReviewStateRecord,
  waitForReviews,
} from '@/pr/review-state'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  PULL_REFUSALS,
  PullRefusal,
  ReadOptions,
  gitRunner,
  listReviews,
  readIdentity,
  refReader,
  refuseWith,
  resolvePullNumber,
} from '@/commands/pr/pull'
import { LIFT_REFUSALS, readEvidenceGate } from '@/commands/pr/gates'

interface ReviewStateOptions extends ReadOptions {
  readonly wait?: string
}

export function registerReviewState(pr: Command): void {
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
