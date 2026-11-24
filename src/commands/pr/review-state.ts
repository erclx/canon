import type { Command } from 'commander'
import { resolve } from 'node:path'
import { type HeadRefusal, resolveTip } from '@/pr/head'
import {
  DEFAULT_WAIT_SECONDS,
  readBaseReading,
  readChangedPaths,
  readRebasedPaths,
  readUnmergedCommits,
} from '@/pr/lift'
import { loadPaintedPatterns } from '@/pr/painted'
import { reviewRowOf } from '@/pr/rest'
import {
  readReviewState,
  type ReviewStateApi,
  type ReviewStateRecord,
  type StandingWait,
  waitForReviews,
  waitForStanding,
} from '@/pr/review-state'
import { intro, logInfo, logStep, logWarn, outro } from '@/cli/ui'
import {
  PULL_REFUSALS,
  PullRefusal,
  ReadOptions,
  gitRunner,
  listReviews,
  readIdentity,
  readPull,
  refReader,
  refuseWith,
  refusePull,
  resolvePullNumber,
} from '@/commands/pr/pull'
import { LIFT_REFUSALS, readEvidenceGate } from '@/commands/pr/gates'

interface ReviewStateOptions extends ReadOptions {
  readonly wait?: string
  readonly waitStanding?: string
}

const WAIT_STANDING_REFUSALS = {
  shape: '--wait-standing takes a whole number of seconds, zero or more.',
  both: '--wait and --wait-standing are two waits with different endings, so name one.',
} as const

/** A whole number of seconds, undefined when the flag was not given, null when it is malformed. */
function parseSeconds(value: string | undefined): number | undefined | null {
  if (value === undefined) return undefined
  return /^\d+$/.test(value) ? Number(value) : null
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
    .option(
      '--wait-standing <seconds>',
      'Hold until the base moves a path the branch writes, the two conflict, or the pull request closes',
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
        '  carriedFrom    the commit a close was read at when the lift carried',
        '                 it to the tip, with `carriedAcross` naming how:',
        '                 push    a UI close across commits no box can observe',
        '                 rebase  a close across a rebase that left the',
        '                         branch diff equal per path, each side read',
        '                         against its own merge base with the base',
        '                 merge   a code review close across merges of the',
        '                         base that left the branch diff equal per',
        '                         path, read the same way',
        '  differingPaths  the paths whose branch diff differs across a rebase',
        '                  or a merge, which kept a code review close from',
        '                  carrying',
        '',
        'A code review close carries across a rebase only when every path is',
        'equal, and across commits on top of it only when each is a merge or',
        'already on the base and every path is equal, so a commit of the',
        "branch's own pushed beside a merge still needs a pass. A carried close",
        'vouches for the branch diff and not for what the base moved under it,',
        'so CI at the new head is still required. Hunk positions are not',
        'compared, so an edit moved into an identical block of the same file',
        'by a hand-resolved conflict reads equal too.',
        '',
        '`ui` also carries the newest `## UI review` pass (`heading`, `state`,',
        '`commit`, `source`), `isBound`, which is whether the evidence comment',
        'carries a checklist holding a box a driver can run or the newest UI',
        'pass is open, so a checklist of taste boxes alone binds nothing until',
        'a pass opens, or `drivenPaths` and the painted subset `paintedPaths`',
        'when the lift refused to carry. An unbound family reads covered.',
        '',
        'Both families post as pull request reviews, so this reads',
        '`pulls/<n>/reviews` alone, as the lift does. Issue comments are not',
        'read: neither review skill posts there, and a heading found only in a',
        'comment would let a worker move on a pass the lift then refuses.',
        '',
        '`--wait <seconds>` holds until `isCovered` reads true in both families',
        'or the deadline passes, re-reading the tip so a push moves what a pass',
        'must cover. The gap starts at 30 seconds and grows by half each read',
        'up to 120. The evidence is read once at the start.',
        'The record then adds `reason`, `covered` or `timeout`, and',
        '`waitedSeconds`. A wait past 600 seconds outlasts a foreground shell',
        'call, so run it in the background.',
        '',
        '`--wait-standing <seconds>` is the wait a worker holds once both',
        'families are covered, until its branch merges. It reads the base',
        'through a local `git fetch` and `git merge-tree`, the standing',
        '`canon pr lift` gates on, at the same growing gap, and reads no',
        'review. The pull request state is read only before an ending, since',
        'a squash merge reads as stale against the base it landed on. It',
        'refuses beside `--wait`. The record carries `head`, `reason`, and',
        '`waitedSeconds` in place of the review fields:',
        '  stale     the base changed a path the branch writes, named in `moved`',
        '  conflict  the branch no longer merges cleanly onto the base',
        '  closed    the pull request merged or closed, so nothing is owed',
        '  timeout   the deadline passed with the base `standing` still',
        '            `fresh` or `unknown`, so wait again',
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
        '  rate-limited      GitHub refused a read for a spent quota, named with',
        '                    `bucket` and `resetAt`, so wait for the reset',
        '  bad-input         the number named is not a positive whole number,',
        '                    refused before any call to GitHub',
        '  no-pull           no pull request carries the number named',
        '  no-object-head    the pull request object reported no head commit',
        '  bad-wait          --wait and --wait-standing each take a whole',
        '                    number of seconds, and only one is named',
        '',
        'Exit codes:',
        '  0  the thread was read, whether it carries a pass or not, the',
        '     wait ended covered, or the standing wait ended on an event',
        '  1  refused, with the reason on stderr or in the JSON record, or the',
        '     wait reached its deadline as `timeout`',
        '',
        'Examples:',
        '  canon pr review-state',
        '  canon pr review-state 1341 --json',
        '  canon pr review-state 1341 --wait 1200 --json',
        '  canon pr review-state 1341 --wait-standing 1200 --json',
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

  const waitSeconds = parseSeconds(opts.wait)
  if (waitSeconds === null) {
    return refuseWith('bad-wait', LIFT_REFUSALS['bad-wait'], emitJson, root)
  }
  const standingSeconds = parseSeconds(opts.waitStanding)
  if (standingSeconds === null) {
    return refuseWith('bad-wait', WAIT_STANDING_REFUSALS.shape, emitJson, root)
  }
  if (waitSeconds !== undefined && standingSeconds !== undefined) {
    return refuseWith('bad-wait', WAIT_STANDING_REFUSALS.both, emitJson, root)
  }

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', PULL_REFUSALS['gh-missing'], emitJson, root)
  }

  // Resolved up front, so a record answering a bare call still names its pull request.
  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    return refusePull(resolved, emitJson, root)
  }

  const read = await readIdentity(root, resolved.number)
  if (read.kind === 'refused') {
    return refusePull(read, emitJson, root)
  }

  // The api keeps each read's own reason, so a caller tells a thread from a remote.
  let failure: PullRefusal | HeadRefusal = 'gh-failed'
  const git = gitRunner(root)
  const { base } = read.identity
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
    readRebased: async (from, to) =>
      base === undefined
        ? undefined
        : readRebasedPaths(git, `origin/${base}`, from, to),
    readUnmerged: async (from, to) =>
      base === undefined
        ? undefined
        : readUnmergedCommits(git, `origin/${base}`, from, to),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
  }

  if (standingSeconds !== undefined) {
    const standing = await waitForStanding(
      {
        readTip: api.readTip,
        readStanding: async (head) =>
          base === undefined
            ? { standing: 'unknown' }
            : readBaseReading(
                git,
                Number(resolved.number),
                head,
                `origin/${base}`,
              ),
        readOpen: async () => {
          const pull = await readPull(root, resolved.number)
          return pull.kind === 'read' ? pull.row.state === 'open' : undefined
        },
        sleep: api.sleep,
        now: api.now,
      },
      { waitSeconds: standingSeconds },
    )
    if (standing.kind === 'refused') {
      return refuseWith(failure, PULL_REFUSALS[failure], emitJson, root)
    }
    return reportStanding(Number(resolved.number), standing, emitJson, root)
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

type StandingEnding = Exclude<StandingWait, { readonly kind: 'refused' }>

const STANDING_STEPS: Record<StandingEnding['reason'], string> = {
  stale: 'Stale',
  conflict: 'Conflict',
  closed: 'Closed',
  timeout: 'Timeout',
}

function standingLine(ending: StandingEnding): string {
  const after = `after ${ending.waitedSeconds}s`
  switch (ending.reason) {
    case 'stale':
      return `the base moved ${ending.moved.join(', ')} under ${ending.head.slice(0, 8)} ${after}, so rebase`
    case 'conflict':
      return `${ending.head.slice(0, 8)} no longer merges cleanly onto the base ${after}, so rebase`
    case 'closed':
      return `the pull request closed ${after}, so there is nothing to keep current`
    case 'timeout':
      return `the base standing read ${ending.standing} at ${ending.head.slice(0, 8)} for ${ending.waitedSeconds}s, so wait again`
  }
}

/** Exits 1 on `timeout` alone, as `--wait` does, since every other ending is the event waited on. */
function reportStanding(
  number: number,
  ending: StandingEnding,
  emitJson: boolean,
  root: string,
): number {
  logStep(STANDING_STEPS[ending.reason])
  if (ending.reason === 'timeout') logWarn(standingLine(ending))
  else logInfo(standingLine(ending))
  outro()

  if (emitJson) {
    const { kind: _kind, ...fields } = ending
    process.stdout.write(`${JSON.stringify({ root, number, ...fields })}\n`)
  }
  return ending.reason === 'timeout' ? 1 : 0
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
    // Named apart, since these values then describe the submission, not the read.
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
    if (family.carriedFrom !== undefined) {
      logInfo(
        `${name}: carried from ${family.carriedFrom.slice(0, 8)} across a ${family.carriedAcross ?? 'push'}`,
      )
    }
  }
  if (!record.ui.isBound) {
    logInfo(
      'ui: the evidence carries no box a driver can run, so the family is unbound',
    )
  }
}
