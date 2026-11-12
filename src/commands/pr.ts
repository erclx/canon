import { statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  type CheckRunListing,
  collapseChecks,
  type RawStatus,
  requiredChecks,
  withMergeState,
} from '@/pr/checks'
import {
  findEvidenceChecklist,
  findEvidenceCommentId,
  readChecklistBoxes,
} from '@/pr/evidence'
import { REEL_MAX_BYTES } from '@/take/reel'
import {
  dropFramesWithLegacy,
  FRAMES_BRANCH,
  type FramesApi,
  type FramesRefusal,
  type FrameTheme,
  frameLink,
  isFrameHead,
  isFramePass,
  isFrameTheme,
  LEGACY_FRAMES_BRANCH,
  pruneFramesWithLegacy,
  pushFrame,
  readFrame,
  readReel,
  isDesignReference,
  referenceSlug,
  type TreeEntry,
} from '@/pr/frames'
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
import { machineListenerReader } from '@/listeners/machine'
import { loadPaintedPatterns } from '@/pr/painted'
import { readCarry } from '@/pr/carry'
import { LOCAL_CONFIG_REL, readHealthPaths } from '@/pr/health'
import {
  dropAddressLine,
  maskLocalAddress,
  findLocalServer,
  type LocalRefusal,
  type LocalRunner,
} from '@/pr/local'
import { coversHead, resolveUiScope } from '@/pr/review-scope'
import {
  countTicksAtHead,
  type TickRefusal,
  tickBoxes,
  type UiPassSummary,
  writeUiPassLine,
} from '@/pr/tick'
import {
  mergeStateOf,
  type RestPull,
  type RestReview,
  reviewRowOf,
} from '@/pr/rest'
import {
  readReviewState,
  type ReviewStateApi,
  type ReviewStateRecord,
  waitForReviews,
} from '@/pr/review-state'
import { PROJECT_ROOT } from '@/roots/project'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  POSITIVE_WHOLE,
  PULL_REFUSALS,
  PullRefusal,
  ReadOptions,
  gh,
  gitRunner,
  listComments,
  listReviews,
  patchPullBody,
  readIdentity,
  readPull,
  readRepoName,
  refReader,
  refuseWith,
  resolvePullNumber,
  resolveWorktreeRoot,
} from '@/commands/pr/pull'
import { registerKeyChanges } from '@/commands/pr/key-changes'
import { registerHead } from '@/commands/pr/head'
import { registerChecks } from '@/commands/pr/checks'
import { registerClose } from '@/commands/pr/close'
import { registerDriveCopy } from '@/commands/pr/drive-copy'
import { registerEvidence } from '@/commands/pr/evidence'
import { registerPreview } from '@/commands/pr/preview'

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

interface LocalOptions extends ReadOptions {
  readonly remove?: boolean
}

interface TickOptions extends ReadOptions {
  readonly boxes?: string
  readonly head?: string
}

type TickReason =
  | TickRefusal
  | 'count-mismatch'
  | 'stale-head'
  | 'redrive-owed'
  | 'bad-boxes'
  | 'no-comment'
  | 'body-refused'

const TICK_REFUSALS: Record<TickReason | 'gh-failed', string> = {
  'body-refused':
    'The boxes are ticked on the evidence comment, but gh could not edit the pull request body, so its UI pass line still shows the earlier result. Re-run the tick to retry the body.',
  'stale-head':
    'The head named is not the branch tip on the remote, and the tip does not descend from it or the gap could not be read, so a tick would claim a pass on a commit that is no longer the pull request. Re-drive the checklist at the tip.',
  'redrive-owed':
    'A push since the driven head changed a path a box can observe, so the pass does not carry to the tip. Nothing was written. Re-drive the checklist at the tip rather than retrying the tick there.',
  'bad-boxes':
    '--boxes takes box numbers as a comma-separated list of positive whole numbers, such as 1,3, and --head takes the commit that was driven.',
  'count-mismatch':
    'The newest UI verdict at this head passed a different number of boxes than the ticks this call would leave at the head. Nothing was written. With fewer ticks than passed, re-run once with every box that passed. With more, a box ticked earlier at this head has since failed, which only the operator can untick.',
  'no-comment': 'No comment on this pull request carries the evidence marker.',
  'no-checklist': 'The evidence comment carries no checklist to tick.',
  'no-box':
    'A named box is past the end of the checklist. Number boxes off `canon pr evidence --json`.',
  'taste-box':
    'A named box carries (taste) among its trailing markers, which no driver passes. Nothing was written.',
  'gh-failed':
    'gh could not read or edit the marked comment on this pull request.',
}

/** How long the probe waits on a listener before reading it as not a server. */
const LOCAL_PROBE_TIMEOUT_MS = 2_000

const LOCAL_REFUSALS: Record<
  LocalRefusal | 'invalid-config' | 'gh-failed',
  string
> = {
  'no-server':
    'Nothing listening inside this worktree served an HTML page. Start the dev server here and re-run to get a link.',
  unhealthy:
    'A page answered inside this worktree, but a health path it declares failed. Start what the page reaches and re-run to get a link.',
  'invalid-config': `${LOCAL_CONFIG_REL} cannot be read, so no health path was checked and no link is given. Fix or delete it and re-run. health takes paths starting with /, and page-only takes folders relative to the repository.`,
  'no-listener-reader':
    'This machine offers neither lsof nor /proc, so no listening socket could be read. Nothing is posted.',
  'gh-failed':
    'gh could not read or edit the marked comment on this pull request.',
}

interface FramesOptions extends ReadOptions {
  readonly add?: string
  readonly box?: string
  readonly reference?: string
  readonly head?: string
  readonly pass?: string
  readonly theme?: string
  readonly reel?: string
  readonly drop?: boolean
  readonly prune?: string
}

type FramesCommandRefusal =
  | FramesRefusal
  | 'bad-mode'
  | 'no-number'
  | 'bad-box'
  | 'bad-reference'
  | 'bad-head'
  | 'bad-pass'
  | 'bad-theme'
  | 'bad-days'
  | 'unreadable-frame'
  | 'unreadable-reel'
  | 'reel-too-large'
  | 'read-only'
  | 'gh-missing'
  | 'gh-failed'
  | 'no-object-head'

const FRAMES_REFUSALS: Record<FramesCommandRefusal, string> = {
  'bad-mode':
    'Pass exactly one of --add, --reel, --drop, or --prune. --prune reads every pull request on the branch, so it takes no number.',
  'no-number':
    '--add, --reel, and --drop write for one pull request, so name its number.',
  'bad-box':
    '--add takes --box <n>, a positive whole number naming the checklist box, or --reference, as <page>/<frame> or a tracked canon/design/<surface>/<name> path, never both. --reel takes neither, since a pass has one reel.',
  'bad-reference':
    '--reference takes <page>/<frame> or a tracked canon/design/<surface>/<name> path, each half opening on a letter or digit and holding only letters, digits, dots, underscores, and dashes, with no `--` in either, so the capture files under a name that reads back as the frame.',
  'bad-head':
    '--head takes a commit sha, 7 to 40 lowercase hex characters. A branch name or a path would file the frame under a folder that names no commit.',
  'bad-pass':
    '--add and --reel take --pass <stamp>, the instant the pass started in compact UTC such as 20261002T154450Z, so a second pass never replaces an earlier one.',
  'bad-theme':
    '--theme takes dark or light and goes with --add --box, so a second shot of one box never replaces the first.',
  'bad-days': '--prune takes a positive whole number of days.',
  'unreadable-frame':
    'The file named by --add is missing, empty, or not a PNG, so it would embed as a broken image. Nothing is pushed.',
  'unreadable-reel':
    'The file named by --reel is missing, empty, or not a WebP, so it would not play in the comment. Nothing is pushed.',
  'reel-too-large': `The file named by --reel is past ${REEL_MAX_BYTES / 1_000_000} MB, the most GitHub renders as an image in a comment. Film fewer or shorter beats. Nothing is pushed.`,
  'read-only': `GitHub refused the write to ${FRAMES_BRANCH}. The token cannot write this repository, which is what a fork pull request's workflow token gets, so describe the frame in words instead.`,
  'gh-missing':
    'gh is not on the path, so the branch could not be read or written.',
  'gh-failed':
    'gh could not answer for this repository or pull request, so no link could be built.',
  'no-object-head':
    'The pull request object reported no head commit and no --head was passed, so the frame has no head to file under.',
  'unreadable-tip': `The ${FRAMES_BRANCH} branch could not be read, so nothing was written. A missing branch is not this, since an add creates it.`,
  'push-failed': `A write to ${FRAMES_BRANCH} failed partway. The ref did not move, so the branch is as it was.`,
  'ref-conflict': `Another writer kept moving ${FRAMES_BRANCH} through every attempt, so the add gave up. Re-run it.`,
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
        '  ci-pending (--check), ci-failing, ci-conflicted, ci-timeout,',
        '  head-moved, ready-withdrawn, gh-failed',
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
        '  ci-failing, ci-conflicted, ci-pending, head-moved, not-mergeable,',
        '  gh-failed',
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

  pr.command('local')
    .description(
      "Find the server this worktree is running and report its localhost address, or remove it from the pull request's evidence comment",
    )
    .argument('[number]', 'Pull request to edit on --remove')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Worktree to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--remove',
      "Drop the evidence comment's preview address line and mask local addresses in UI reviews",
    )
    .addHelpText(
      'after',
      [
        '',
        'Reads every TCP socket in LISTEN, keeps those whose owning process runs',
        "inside this worktree's toplevel, and requests / on each. The lowest",
        'port serving an HTML page is reported, which skips a test runner or a',
        'reload socket answering in the same tree.',
        '',
        'A project can declare paths the page must also serve, in',
        'canon/config/local.toml as health = ["/api/health"]. Each is requested',
        "on the page's own port, redirects followed, and only a final 2xx",
        'passes. A page failing one is skipped for the next page port, and the',
        "refusal names the lowest page port's first failing path. An absent",
        'file or an empty list checks the page alone.',
        '',
        'A page served by a static server answers none of those paths, so',
        'page-only = ["web"] lists repository-relative folders whose',
        'listeners skip them and are found on the page probe alone. The match',
        "reads the listener's working directory on whole path segments, so web",
        'does not cover webapp, and a server started from the root with a',
        'working-directory flag still takes the health check. Keep health',
        'beside page-only until the binary a project runs carries this key,',
        'since an older one refuses a file holding page-only alone.',
        '',
        'A process in a sibling worktree, in the main checkout seen from a',
        'linked worktree, or in a linked worktree seen from the main checkout',
        'is never reported, since its server shows another branch. Sockets are',
        'read through /proc where it exists, or through lsof on a machine',
        'without it.',
        '',
        '--remove reads the pull request comment carrying the pr-evidence',
        'marker and drops its address line, the **Preview:** and **Local',
        'preview:** segments together, leaving no note in its place. It edits',
        'the comment itself so a close workflow with no session can call it,',
        'and drops the hosted link too because the same close deletes the',
        "branch's preview deployments.",
        '',
        'It also rewrites the loopback address on the Driven at line of every',
        'review carrying the review-ui marker to "a local preview", keeping',
        'the head and the renderer. A hosted address and a code review are',
        'left alone, and `reviews` on the JSON record counts the rewrites.',
        '',
        'Read `reason` on the JSON record:',
        '  ok                  a page answered, with its address in `url`',
        '  no-server           nothing inside this worktree served a page',
        '  no-listener-reader  neither lsof nor /proc is available',
        '  unhealthy           a page answered but a declared health path did',
        '                      not, with `port`, `path`, and `status`, which',
        '                      is null on a timeout',
        '  invalid-config      canon/config/local.toml is not valid TOML,',
        '                      health is not a list of paths starting with /,',
        '                      or page-only is not a list of relative folders',
        '  removed             --remove dropped the line',
        '  no-comment          --remove found no marked comment, a no-op',
        '  no-line             --remove found no address line, a no-op',
        '',
        'Refusals, read off `reason`:',
        '  gh-missing  `--remove` needs `gh` and it is not on the path',
        '  gh-failed   `--remove` could not read the thread, or edit the',
        '              comment or a review, after trying every edit',
        '',
        'Exit codes:',
        '  0  a server was found, or --remove finished, including a no-op',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr local --json',
        '  canon pr local 1341 --remove --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: LocalOptions) => {
      process.exitCode =
        opts.remove === true
          ? await runLocalRemove(number, opts)
          : await runLocal(opts)
    })

  pr.command('tick')
    .description(
      "Tick the checklist boxes a UI pass drove, stamping each with the commit it passed at, on the pull request's evidence comment",
    )
    .argument('[number]', 'Pull request to edit, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .requiredOption(
      '--boxes <list>',
      'Box numbers to tick, comma-separated, as `canon pr evidence --json` numbers them',
    )
    .requiredOption('--head <sha>', 'The commit the boxes were driven at')
    .addHelpText(
      'after',
      [
        '',
        'Edits the marked evidence comment in place, so a skill never',
        'hand-edits a comment body. Each named box becomes',
        '`- [x] <box> · passed at <short sha>`. Ticking a box again restamps',
        'it. A later render at another head clears a tick whose stamp names',
        'a different commit.',
        '',
        "It also keeps one marked line in the pull request body's ## Testing,",
        'such as `- [x] UI pass, 17 of 17 boxes passed at <short sha>, 1 taste',
        'box left to the operator`. The line is ticked only when every box a',
        'driver can run is ticked, counts taste boxes apart, and is the only',
        'body text this verb writes, so hand edits elsewhere survive.',
        '',
        'A --head behind the remote tip carries to the tip when every path',
        'changed since is one no box can observe, being tests, stories,',
        'snapshots, markdown in the root and in `canon/`, `.claude/`,',
        '`.github/`, and `docs/`, evidence captures, and `canon/design/`. The',
        'boxes are then stamped at the tip and the record names `carriedFrom`.',
        'Any other changed path, markdown elsewhere included, owes a re-drive.',
        '',
        'Before writing it reads the newest UI verdict. One that covers the tip,',
        'or the driven head on a carry, and carries a count line must match the',
        'ticks this call leaves at the tip, so a re-drive passes every box that',
        'passed, since a new head clears the older ticks. Any other verdict',
        'leaves the check unrun.',
        '',
        'Read `reason` on the JSON record:',
        '  ticked       the boxes were ticked and the body line written, with the',
        '               tip in `head`, `countCheck` as matched or unchecked, and',
        '               `carriedFrom` when --head was carried to the tip',
        '  count-mismatch the verdict passed a different number of boxes than',
        '               this call leaves ticked at the tip, nothing written,',
        '               `passed` and `ticked` carry the two counts. Fewer ticks',
        '               owe a re-run with every passed box, more ticks owe the',
        '               operator an untick of a box that has since failed',
        '  body-refused the comment is ticked but gh could not edit the body,',
        '               exit 1 with `commentTicked`. Re-run to retry the body.',
        '  redrive-owed a push since --head changed a path a box can observe,',
        '               nothing written, with `driven`, `head`, and `drivenPaths`',
        '  stale-head   --head is behind the tip with no readable linear gap,',
        '               as a force-push or a rebase leaves, nothing written',
        '  taste-box    a named box carries (taste), nothing written',
        '  no-box       a named number is past the checklist, nothing written',
        '  no-checklist the evidence comment carries no checklist',
        '  no-comment   no comment carries the evidence marker',
        '  bad-boxes    --boxes or --head is malformed',
        '',
        'Exit codes:',
        '  0  the boxes were ticked',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr tick 1341 --boxes 1,2,4 --head 1a2b3c4 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: TickOptions) => {
      process.exitCode = await runTick(number, opts)
    })

  registerDriveCopy(pr)

  pr.command('frames')
    .description(
      `Push a UI review frame to the never-merged ${FRAMES_BRANCH} branch and return its embed link, or drop frames from it`,
    )
    .argument(
      '[number]',
      'Pull request the frame belongs to, for --add and --drop',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to answer for, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option('--add <file>', 'Push this PNG as a frame')
    .option('--box <n>', 'The checklist box the frame shows, with --add')
    .option(
      '--reference <address>',
      'The design reference the capture shows, as <page>/<frame> or a tracked canon/design/<surface>/<name> path, with --add in place of --box',
    )
    .option(
      '--head <sha>',
      "The head the frame was driven at, with --add, defaulting to the pull request's",
    )
    .option(
      '--pass <stamp>',
      'The instant the pass started, in compact UTC such as 20261002T154450Z, with --add',
    )
    .option(
      '--theme <theme>',
      'The theme the frame was shot at, dark or light, with --add, keeping two shots of one box apart',
    )
    .option(
      '--reel <file>',
      "Push this animated WebP as the pass's reel, in place of --add",
    )
    .option('--drop', "Rewrite the branch without this pull request's frames")
    .option(
      '--prune <days>',
      'Drop the frames of every pull request closed more than this many days ago',
    )
    .addHelpText(
      'after',
      [
        '',
        `An add writes only refs/heads/${FRAMES_BRANCH}, through the GitHub git data API,`,
        'so nothing is checked out and no other branch is touched. A frame lands',
        'at pr-<number>/<short-head>/<pass>/box-<n>.png, or box-<n>-<theme>.png',
        'with --theme, or ref-<page>--<frame>.png for a design reference capture',
        'passed as --reference <page>/<frame> in place of --box, or',
        'ref-design--<surface>--<name>.png for a tracked canon/design/<surface>/<name>',
        'reference, whose --add must name that same file, and `link` names that',
        `path on ${FRAMES_BRANCH}, so it survives a rewrite that drops other pull`,
        'requests and resolves until its own pull request is dropped. The pass',
        'segment keeps a second pass at one head and box from replacing an image',
        'an earlier comment shows. The first --add creates the branch.',
        '',
        `--reel <file> pushes one animated WebP of at most ${REEL_MAX_BYTES / 1_000_000} MB to`,
        'pr-<number>/<short-head>/<pass>/reel.webp beside the box frames, taking',
        '--pass and --head the way --add does, and carries `reel: true` in place of',
        'a box. A drop or a prune clears it with the rest of the folder.',
        '',
        '--drop and --prune write one root commit and force-move the ref,',
        'since a delete commit would keep every image reachable through history.',
        'A rewrite that empties the branch deletes it. --prune keeps a pull',
        'request still open, reopened, closed exactly the given days ago, or one',
        'whose state could not be read, listing that last kind under `unread`.',
        '',
        `Both also drain the ${LEGACY_FRAMES_BRANCH} branch a rename left behind,`,
        'removing only, and carry `legacy: true` when it changed. --prune empties',
        'it as its pull requests expire, and --drop clears one pull request at',
        'once. An add never writes it.',
        '',
        'Read `reason` on the JSON record:',
        '  ok                an add pushed, or a drop or prune finished',
        '  bad-mode          not exactly one of --add, --reel, --drop, --prune',
        '  no-number         --add, --reel, or --drop named no pull request',
        '  bad-box           --add with both --box and --reference, or neither, or --reel with either',
        '  bad-reference     --reference is not <page>/<frame> or canon/design/<surface>/<name> in the safe name form, or the tracked path is no file',
        '  bad-head          --head is not 7 to 40 lowercase hex characters',
        '  bad-pass          --add or --reel without a compact UTC --pass stamp',
        '  bad-theme         --theme is not dark or light, or no --add, or rides a --reference',
        '  bad-days          --prune without a positive number of days',
        '  unreadable-frame  the --add file is missing, empty, or not a PNG',
        '  unreadable-reel   the --reel file is missing, empty, or not a WebP',
        `  reel-too-large    the --reel file is past ${REEL_MAX_BYTES / 1_000_000} MB`,
        '  read-only         GitHub refused the write, as on a fork token',
        '  unreadable-tip    the branch could not be read',
        '  push-failed       a write failed and the ref did not move',
        '  ref-conflict      another writer kept moving the ref',
        '  no-object-head    no head to file the frame under',
        '  gh-missing        gh is not on the path',
        '  gh-failed         gh could not answer for the repository',
        '',
        'Exit codes:',
        '  0  pushed, or a drop or prune finished, including one removing nothing',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr frames 1341 --add frames/3.png --box 3 --pass 20261002T154450Z --json',
        '  canon pr frames 1341 --reel reel.webp --pass 20261002T154450Z --json',
        '  canon pr frames 1341 --drop --json',
        '  canon pr frames --prune 30 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: FramesOptions) => {
      process.exitCode = await runFrames(number, opts)
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

/** The listener reads come from the machine, and the HTML probe from here. */
function machineLocalRunner(): LocalRunner {
  return {
    ...machineListenerReader(),
    // An HTML page rather than any answer, since a test runner's server or a
    // reload socket in the same tree answers too, and a reviewer opening one
    // gets a bare 404 instead of the branch.
    async probe(port) {
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          signal: AbortSignal.timeout(LOCAL_PROBE_TIMEOUT_MS),
        })
        await response.body?.cancel()
        return (response.headers.get('content-type') ?? '').includes(
          'text/html',
        )
      } catch {
        return false
      }
    },
    // The final status after redirects, so a login bounce ending on a 3xx or
    // a 4xx fails rather than reading as the backend answering.
    async check(port, path) {
      try {
        const response = await fetch(`http://localhost:${port}${path}`, {
          signal: AbortSignal.timeout(LOCAL_PROBE_TIMEOUT_MS),
        })
        await response.body?.cancel()
        return response.status
      } catch {
        return null
      }
    },
  }
}

async function runLocal(opts: LocalOptions): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr local')

  const worktree = await resolveWorktreeRoot(root)
  const declaration = readHealthPaths(worktree)
  if (declaration.kind === 'invalid') {
    return refuseWith(
      'invalid-config',
      `${declaration.reason}. ${LOCAL_REFUSALS['invalid-config']}`,
      emitJson,
      root,
    )
  }

  const result = await findLocalServer(
    worktree,
    machineLocalRunner(),
    declaration.kind === 'paths' ? declaration.paths : [],
    declaration.pageOnly,
  )
  if (result.kind === 'refused' && result.reason === 'unhealthy') {
    const { port, path, status } = result
    const answer =
      status === null
        ? `gave no answer within ${LOCAL_PROBE_TIMEOUT_MS / 1000} seconds`
        : `answered ${status}`
    return refuseWith(
      'unhealthy',
      `${LOCAL_REFUSALS.unhealthy} ${path} on http://localhost:${port} ${answer}.`,
      emitJson,
      root,
      { port, path, status },
    )
  }
  if (result.kind === 'refused') {
    return refuseWith(
      result.reason,
      LOCAL_REFUSALS[result.reason],
      emitJson,
      root,
    )
  }

  logStep('Local preview')
  logInfo(result.url)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason: 'ok', url: result.url, port: result.port })}\n`,
    )
  }
  return 0
}

/**
 * Drops the address line on the marked comment and masks the loopback address
 * on every UI review. The verb writes here rather than handing a body back,
 * because its caller is a close workflow with no session to post one.
 */
async function runLocalRemove(
  number: string | undefined,
  opts: LocalOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr local --remove')

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', PULL_REFUSALS['gh-missing'], emitJson, root)
  }

  const resolved = await resolvePullNumber(root, number)
  if (resolved.kind === 'refused') {
    const reason = resolved.reason
    return refuseWith(
      reason,
      reason === 'ambiguous-pull'
        ? PULL_REFUSALS[reason]
        : LOCAL_REFUSALS[reason],
      emitJson,
      root,
    )
  }
  const [comments, reviews] = await Promise.all([
    listComments(root, resolved.number),
    listReviews(root, resolved.number),
  ])
  if (comments === undefined && reviews.kind === 'refused') {
    return refuseWith('gh-failed', LOCAL_REFUSALS['gh-failed'], emitJson, root)
  }

  // A refused read on one side still lets the other side's edits land, and
  // counts as a failure beside them, so one unread listing never strands both.
  const [evidence, masked] = await Promise.all([
    comments === undefined
      ? Promise.resolve<EvidenceRemoval>({ kind: 'failed' })
      : removeEvidenceAddress(root, comments),
    reviews.kind === 'refused'
      ? Promise.resolve({ rewritten: 0, failed: true })
      : maskUiReviews(root, resolved.number, reviews.rows),
  ])
  if (evidence.kind === 'failed' || masked.failed) {
    return refuseWith(
      'gh-failed',
      LOCAL_REFUSALS['gh-failed'],
      emitJson,
      root,
      {
        reviews: masked.rewritten,
      },
    )
  }

  logStep(evidence.reason === 'removed' ? 'Removed' : 'Skipped')
  logInfo(evidence.message)
  logInfo(`${masked.rewritten} UI review addresses masked`)
  outro()
  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason: evidence.reason, reviews: masked.rewritten })}\n`,
    )
  }
  return 0
}

type EvidenceRemoval =
  | {
      readonly kind: 'done'
      readonly reason: 'removed' | 'no-comment' | 'no-line'
      readonly message: string
    }
  | { readonly kind: 'failed' }

async function removeEvidenceAddress(
  root: string,
  comments: readonly { url?: string; body: string }[],
): Promise<EvidenceRemoval> {
  const commentId = findEvidenceCommentId(comments)
  const marked = comments.find((comment) =>
    comment.url?.endsWith(`#issuecomment-${commentId}`),
  )
  if (commentId === undefined || marked === undefined) {
    return {
      kind: 'done',
      reason: 'no-comment',
      message: 'No comment carries the evidence marker.',
    }
  }

  const dropped = dropAddressLine(marked.body)
  if (dropped === undefined) {
    return {
      kind: 'done',
      reason: 'no-line',
      message: 'The evidence comment carries no address line.',
    }
  }

  const patched = await gh(root, [
    'api',
    '-X',
    'PATCH',
    `repos/{owner}/{repo}/issues/comments/${commentId}`,
    '-f',
    `body=${dropped}`,
  ])
  return patched === null
    ? { kind: 'failed' }
    : { kind: 'done', reason: 'removed', message: `comment ${commentId}` }
}

const UI_REVIEW_MARKER = '<!-- review-ui: head='

/**
 * Masks the loopback address on each review `review-ui` posted, selected by
 * its marker so a code review quoting a local URL is never edited. Every
 * update is tried before a refusal is reported, so one refused review leaves
 * the rest masked.
 */
async function maskUiReviews(
  root: string,
  number: string,
  reviews: readonly RestReview[],
): Promise<{ readonly rewritten: number; readonly failed: boolean }> {
  const updates = reviews.flatMap((review) => {
    const body = review.body ?? ''
    if (review.id === undefined || !body.includes(UI_REVIEW_MARKER)) return []
    const masked = maskLocalAddress(body)
    if (masked === undefined) return []
    return [
      gh(root, [
        'api',
        '-X',
        'PUT',
        `repos/{owner}/{repo}/pulls/${number}/reviews/${review.id}`,
        '-f',
        `body=${masked}`,
      ]),
    ]
  })
  const results = await Promise.all(updates)
  const rewritten = results.filter((stdout) => stdout !== null).length
  return { rewritten, failed: rewritten < results.length }
}

const MIN_TICK_HEAD_LENGTH = 7

/**
 * Ticks the named boxes on the marked comment. It refuses a head the tip moved
 * past in a way a box can observe, and a taste box, before writing, so both
 * rules hold as checks rather than as prose a driver can talk itself out of.
 */
async function runTick(
  number: string | undefined,
  opts: TickOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr tick')

  const refuseTick = (reason: TickReason | 'gh-failed'): number =>
    refuseWith(reason, TICK_REFUSALS[reason], emitJson, root)

  const numbers = (opts.boxes ?? '').split(',').map((part) => part.trim())
  const head = (opts.head ?? '').trim()
  if (
    numbers.length === 0 ||
    !numbers.every((part) => POSITIVE_WHOLE.test(part)) ||
    !/^[0-9a-f]+$/.test(head) ||
    head.length < MIN_TICK_HEAD_LENGTH
  ) {
    return refuseTick('bad-boxes')
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }
  const { identity } = read
  if (identity.number === undefined) return refuseTick('gh-failed')

  const reading = await resolveTip(identity.branch, refReader(root))
  if (reading.kind === 'refused') {
    return refuseWith(
      reading.reason,
      PULL_REFUSALS[reading.reason],
      emitJson,
      root,
    )
  }
  const carry = await readCarry(
    (from, to) => readChangedPaths(gitRunner(root), from, to),
    head,
    reading.tip,
  )
  if (carry.kind === 'moved') {
    return refuseWith(
      'redrive-owed',
      TICK_REFUSALS['redrive-owed'],
      emitJson,
      root,
      { driven: head, head: reading.tip, drivenPaths: carry.drivenPaths },
    )
  }
  // A gap that could not be read refuses as a rewrite does, which is what the
  // verb answered for every moved tip before the carry.
  if (carry.kind === 'not-ancestor' || carry.kind === 'failed') {
    return refuseTick('stale-head')
  }
  const carriedFrom = carry.kind === 'carried' ? carry.carriedFrom : undefined

  const comments = await listComments(root, String(identity.number))
  if (comments === undefined) return refuseTick('gh-failed')
  const commentId = findEvidenceCommentId(comments)
  const marked = comments.find((comment) =>
    comment.url?.endsWith(`#issuecomment-${commentId}`),
  )
  if (commentId === undefined || marked === undefined) {
    return refuseTick('no-comment')
  }

  const result = tickBoxes(marked.body, numbers.map(Number), reading.tip)
  if (result.kind === 'refused') return refuseTick(result.reason)

  // Read ahead of the write so a short list refuses before it leaves the
  // comment half ticked. A verdict that covers neither the tip nor the head a
  // carry came from, carries no count line, or cannot be read leaves the check
  // unrun and says so.
  const ticked = countTicksAtHead(
    readChecklistBoxes(findEvidenceChecklist([{ body: result.body }]) ?? ''),
    reading.tip,
  )
  const reviews = await listReviews(root, String(identity.number))
  const verdict = resolveUiScope({
    reviews: reviews.kind === 'read' ? reviews.rows.map(reviewRowOf) : [],
  })
  const isCounted =
    verdict.counts !== undefined &&
    verdict.commit !== undefined &&
    (coversHead(verdict.commit, reading.tip) ||
      (carriedFrom !== undefined &&
        (coversHead(verdict.commit, carriedFrom) ||
          coversHead(carriedFrom, verdict.commit))))
  if (isCounted && verdict.counts.passed !== ticked) {
    return refuseWith(
      'count-mismatch',
      TICK_REFUSALS['count-mismatch'],
      emitJson,
      root,
      { passed: verdict.counts.passed, ticked },
    )
  }
  const countCheck = isCounted ? 'matched' : 'unchecked'

  if (result.body !== marked.body) {
    const patched = await gh(root, [
      'api',
      '-X',
      'PATCH',
      `repos/{owner}/{repo}/issues/comments/${commentId}`,
      '-f',
      `body=${result.body}`,
    ])
    if (patched === null) return refuseTick('gh-failed')
  }

  const boxes = readChecklistBoxes(
    findEvidenceChecklist([{ body: result.body }]) ?? '',
  )
  const driven = boxes.filter((box) => !box.isTaste)
  const summary: UiPassSummary = {
    kind: 'passed',
    passed: countTicksAtHead(boxes, reading.tip),
    total: driven.length,
    taste: boxes.length - driven.length,
    head: reading.tip,
  }
  const priorBody = identity.body ?? ''
  const nextBody = writeUiPassLine(priorBody, summary)
  if (
    nextBody !== priorBody &&
    !(await patchPullBody(root, identity.number, nextBody))
  ) {
    logStep('Partly ticked')
    logWarn(TICK_REFUSALS['body-refused'])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: 'body-refused',
          message: TICK_REFUSALS['body-refused'],
          commentTicked: true,
          countCheck,
          head: reading.tip,
          boxes: numbers.map(Number),
          commentId,
        })}\n`,
      )
    }
    return 1
  }

  logStep('Ticked')
  logInfo(
    `${plural(numbers.length, 'box')} at ${reading.tip.slice(0, 7)} on comment ${commentId}, UI pass line on the body`,
  )
  outro()
  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        number: identity.number,
        reason: 'ticked',
        countCheck,
        head: reading.tip,
        ...(carriedFrom !== undefined && { carriedFrom }),
        boxes: numbers.map(Number),
        commentId,
      })}\n`,
    )
  }
  return 0
}

/** One `gh api` call, keeping the HTTP status of a failure so a refused write can be told from a missing ref. */
type ApiCall =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly status: number | undefined }

type ApiCaller = (
  method: string,
  path: string,
  body?: unknown,
) => Promise<ApiCall>

/**
 * Runs `gh api` against the repository's own path, recording every write
 * GitHub answered 403 or 404, which is how a token without write access
 * reads, so a failed push can be reported as read-only rather than broken.
 */
function ghApiRunner(root: string): {
  readonly call: ApiCaller
  readonly refusedWrites: number[]
} {
  const refusedWrites: number[] = []
  const call: ApiCaller = async (method, path, body) => {
    const args = ['api', '-X', method, `repos/{owner}/{repo}/${path}`]
    if (body !== undefined) args.push('--input', '-')
    const result = await execa('gh', args, {
      cwd: root,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
      reject: false,
      ...(body !== undefined && { input: JSON.stringify(body) }),
    })
    if (result.exitCode !== 0) {
      const status = /HTTP (\d{3})/.exec(String(result.stderr))?.[1]
      const code = status === undefined ? undefined : Number(status)
      if (method !== 'GET' && (code === 403 || code === 404)) {
        refusedWrites.push(code)
      }
      return { ok: false, status: code }
    }
    const text = String(result.stdout).trim()
    try {
      return { ok: true, data: text === '' ? null : JSON.parse(text) }
    } catch {
      return { ok: false, status: undefined }
    }
  }
  return { call, refusedWrites }
}

function shaOf(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('sha' in data)) {
    return undefined
  }
  return typeof data.sha === 'string' ? data.sha : undefined
}

function isTreeEntry(value: unknown): value is TreeEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.path === 'string' &&
    typeof entry.mode === 'string' &&
    (entry.type === 'blob' || entry.type === 'tree') &&
    typeof entry.sha === 'string'
  )
}

/**
 * The git data API behind `canon pr frames`. A 422 on a ref write is GitHub
 * refusing a move that is not a fast-forward, or a create or update on a ref
 * that already exists or no longer does, which is another writer's doing and
 * worth a re-read rather than a failure.
 */
function ghFramesApi(call: ApiCaller, branch: string): FramesApi {
  const ref = `git/refs/heads/${branch}`
  const refWrite = (result: ApiCall) =>
    result.ok ? 'ok' : result.status === 422 ? 'conflict' : 'failed'
  return {
    async readTip() {
      const head = await call('GET', `git/ref/heads/${branch}`)
      if (!head.ok) {
        return head.status === 404
          ? { kind: 'missing' }
          : { kind: 'unreadable' }
      }
      const commit = (head.data as { object?: { sha?: unknown } } | null)
        ?.object?.sha
      if (typeof commit !== 'string') return { kind: 'unreadable' }
      const read = await call('GET', `git/commits/${commit}`)
      const tree = read.ok
        ? (read.data as { tree?: { sha?: unknown } } | null)?.tree?.sha
        : undefined
      return typeof tree === 'string'
        ? { kind: 'found', commit, tree }
        : { kind: 'unreadable' }
    },
    async listTree(tree) {
      const read = await call('GET', `git/trees/${tree}`)
      if (!read.ok) return undefined
      const entries = (read.data as { tree?: unknown } | null)?.tree
      return Array.isArray(entries) && entries.every(isTreeEntry)
        ? entries
        : undefined
    },
    async createBlob(base64) {
      const made = await call('POST', 'git/blobs', {
        content: base64,
        encoding: 'base64',
      })
      return made.ok ? shaOf(made.data) : undefined
    },
    async createTree(entries, base) {
      const made = await call('POST', 'git/trees', {
        tree: entries.map(({ path, mode, type, sha }) => ({
          path,
          mode,
          type,
          sha,
        })),
        ...(base !== undefined && { base_tree: base }),
      })
      return made.ok ? shaOf(made.data) : undefined
    },
    async createCommit(message, tree, parents) {
      const made = await call('POST', 'git/commits', {
        message,
        tree,
        parents,
      })
      return made.ok ? shaOf(made.data) : undefined
    },
    async createRef(commit) {
      return refWrite(
        await call('POST', 'git/refs', {
          ref: `refs/heads/${branch}`,
          sha: commit,
        }),
      )
    },
    async moveRef(commit, force) {
      return refWrite(await call('PATCH', ref, { sha: commit, force }))
    },
    async deleteRef() {
      const gone = await call('DELETE', ref)
      return gone.ok || gone.status === 422
    },
    async readPull(number) {
      const read = await call('GET', `pulls/${number}`)
      if (!read.ok) return undefined
      const row = read.data as { state?: unknown; closed_at?: unknown } | null
      if (row?.state !== 'open' && row?.state !== 'closed') return undefined
      return {
        state: row.state,
        ...(typeof row.closed_at === 'string' && { closedAt: row.closed_at }),
      }
    },
  }
}

/** Validates the mode and its arguments before anything reads the network. */
function framesArgumentRefusal(
  number: string | undefined,
  opts: FramesOptions,
): FramesCommandRefusal | undefined {
  const modes = [
    opts.add !== undefined,
    opts.reel !== undefined,
    opts.drop === true,
    opts.prune !== undefined,
  ]
  if (modes.filter(Boolean).length !== 1) return 'bad-mode'
  if (opts.prune !== undefined) {
    if (number !== undefined) return 'bad-mode'
    return POSITIVE_WHOLE.test(opts.prune) ? undefined : 'bad-days'
  }
  if (number === undefined || !POSITIVE_WHOLE.test(number)) return 'no-number'
  if (
    opts.reel !== undefined &&
    (opts.box !== undefined || opts.reference !== undefined)
  ) {
    return 'bad-box'
  }
  if (
    opts.add !== undefined &&
    (opts.box === undefined) === (opts.reference === undefined)
  ) {
    return 'bad-box'
  }
  if (opts.add !== undefined && opts.box !== undefined) {
    if (!POSITIVE_WHOLE.test(opts.box)) return 'bad-box'
  }
  if (opts.reference !== undefined) {
    if (opts.add === undefined || referenceSlug(opts.reference) === undefined) {
      return 'bad-reference'
    }
  }
  if (opts.head !== undefined && !isFrameHead(opts.head)) return 'bad-head'
  if (
    (opts.add !== undefined || opts.reel !== undefined) &&
    (opts.pass === undefined || !isFramePass(opts.pass))
  ) {
    return 'bad-pass'
  }
  if (
    opts.theme !== undefined &&
    (opts.add === undefined ||
      opts.reference !== undefined ||
      !isFrameTheme(opts.theme))
  ) {
    return 'bad-theme'
  }
  return undefined
}

async function runFrames(
  number: string | undefined,
  opts: FramesOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false
  const refuseFrames = (reason: FramesCommandRefusal) =>
    refuseWith(reason, FRAMES_REFUSALS[reason], emitJson, root)

  intro('canon pr frames')

  const invalid = framesArgumentRefusal(number, opts)
  if (invalid !== undefined) return refuseFrames(invalid)

  if (opts.reference !== undefined && isDesignReference(opts.reference)) {
    const tracked = resolve(
      root,
      opts.reference.endsWith('.png')
        ? opts.reference
        : `${opts.reference}.png`,
    )
    const refuseTracked = (message: string) =>
      refuseWith('bad-reference', message, emitJson, root)
    if (!statSync(tracked, { throwIfNoEntry: false })?.isFile()) {
      return refuseTracked(
        `${opts.reference} is not a file under the repository, so no tracked reference can be filed from it.`,
      )
    }
    if (opts.add === undefined || resolve(opts.add) !== tracked) {
      return refuseTracked(
        `--add must name ${tracked}, since a tracked reference files its own image and a different one would disagree with its label.`,
      )
    }
  }

  const bytes =
    opts.add === undefined ? undefined : await readFrame(resolve(opts.add))
  if (opts.add !== undefined && bytes === undefined) {
    return refuseFrames('unreadable-frame')
  }
  const reel =
    opts.reel === undefined ? undefined : await readReel(resolve(opts.reel))
  if (reel?.kind === 'unreadable') return refuseFrames('unreadable-reel')
  if (reel?.kind === 'too-large') return refuseFrames('reel-too-large')

  if (Bun.which('gh') === null) return refuseFrames('gh-missing')
  const runner = ghApiRunner(root)
  const api = ghFramesApi(runner.call, FRAMES_BRANCH)
  const legacyApi = ghFramesApi(runner.call, LEGACY_FRAMES_BRANCH)
  const refuseWrite = (reason: FramesRefusal) =>
    refuseFrames(
      reason === 'push-failed' && runner.refusedWrites.length > 0
        ? 'read-only'
        : reason,
    )

  const finish = (
    record: Record<string, unknown>,
    lines: readonly string[],
  ): number => {
    logStep('Frames')
    for (const line of lines) logInfo(line)
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ root, reason: 'ok', ...record })}\n`,
      )
    }
    return 0
  }

  if (opts.prune !== undefined) {
    const days = Number(opts.prune)
    const result = await pruneFramesWithLegacy(api, legacyApi, days, new Date())
    if (result.kind === 'refused') return refuseWrite(result.reason)
    const { kind: _kind, ...rest } = result
    return finish({ days, ...rest }, [
      `removed ${plural(result.removed.length, 'pull request')}`,
      ...(result.unread.length > 0
        ? [`kept ${result.unread.map((n) => `#${n}`).join(', ')} unread`]
        : []),
    ])
  }

  const pull = Number(number)
  if (opts.drop === true) {
    const result = await dropFramesWithLegacy(api, legacyApi, [pull])
    if (result.kind === 'refused') return refuseWrite(result.reason)
    const { kind: _kind, ...rest } = result
    return finish({ number: pull, ...rest }, [
      result.removed.length === 0
        ? `#${pull} holds no frames on ${FRAMES_BRANCH}`
        : `dropped the frames of #${pull}`,
    ])
  }

  const repo = await readRepoName(root)
  if (repo === undefined) return refuseFrames('gh-failed')

  let head = opts.head
  if (head === undefined) {
    const identity = await readIdentity(root, String(pull))
    if (identity.kind === 'refused') return refuseFrames('gh-failed')
    head = identity.identity.head
  }
  if (head === undefined || head === '') return refuseFrames('no-object-head')
  if (!isFrameHead(head)) return refuseFrames('bad-head')

  const box = opts.box === undefined ? undefined : Number(opts.box)
  const reference = opts.reference
  const pass = opts.pass ?? ''
  const theme = opts.theme as FrameTheme | undefined
  const result = await pushFrame(api, {
    number: pull,
    head,
    pass,
    box,
    reference,
    theme,
    reel: reel !== undefined,
    bytes: reel?.bytes ?? bytes ?? new Uint8Array(),
  })
  if (result.kind === 'refused') return refuseWrite(result.reason)
  const link = frameLink(repo, result.path)
  return finish(
    {
      number: pull,
      ...(reel !== undefined
        ? { reel: true }
        : box === undefined
          ? { reference }
          : { box }),
      ...(theme === undefined ? {} : { theme }),
      head,
      pass,
      path: result.path,
      commit: result.commit,
      link,
      created: result.created,
    },
    [link],
  )
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
    const reading = withMergeState(
      mergeStateOf(row?.mergeable_state),
      collapseChecks(
        tip,
        JSON.parse(listed) as CheckRunListing,
        required,
        statuses,
      ),
    )
    return {
      state: reading.state,
      isConflicted: reading.conflicted,
      ...(reading.advisory !== undefined && { advisory: reading.advisory }),
    }
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
