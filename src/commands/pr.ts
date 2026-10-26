import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  listChangedFiles,
  listIgnoreAdditions,
  listRenames,
  listRepositoryFiles,
  parseIgnoreAdditions,
  type RenamePair,
  resolveBaseRef,
} from '@/git/files'
import {
  type Bijection,
  type BijectionRefusal,
  compareKeyChanges,
  treeRoots,
} from '@/pr/bijection'
import {
  type CheckRunListing,
  collapseChecks,
  withMergeState,
} from '@/pr/checks'
import {
  findEvidenceCaseCount,
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidenceHead,
  findEvidenceLocal,
  findEvidencePreview,
  findEvidenceReel,
  type EvidenceItem,
  type EvidenceReading,
  groupEvidence,
  hasMarkedEvidenceComment,
  isEvidencePath,
  PNG_HEADER_BYTES,
  readChecklistBoxes,
  readOwed,
  readPngWidth,
  readUncaptured,
  nextEvidenceReel,
  renderEvidenceBody,
  settleChecklist,
} from '@/pr/evidence'
import { isWithinTolerance } from '@/pr/pixels'
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
  REEL_MAX_BYTES,
  readFrame,
  readReel,
  isDesignReference,
  referenceSlug,
  type TreeEntry,
} from '@/pr/frames'
import { type HeadRefusal, resolveHead, resolveTip } from '@/pr/head'
import {
  type ChecksGate,
  DEFAULT_WAIT_SECONDS,
  type EvidenceGate,
  type GitRunner,
  lift,
  type LiftApi,
  type LiftRefusal,
  type PullState,
  readBaseStanding,
  readChangedPaths,
} from '@/pr/lift'
import { close, type CloseApi, type CloseRefusal } from '@/pr/close'
import {
  merge,
  type MergeApi,
  type MergeOutcome,
  type MergeRefusal,
  type MergeRequest,
} from '@/pr/merge'
import { listWorktrees } from '@/git/worktree'
import { branchSlug, buildDriveCopy, loadPreviewConfig } from '@/pr/drive-copy'
import {
  changedSince,
  readWorktreeStatus,
  type StatusEntry,
} from '@/git/status'
import { machineListenerReader } from '@/listeners/machine'
import { loadPaintedPatterns } from '@/pr/painted'
import { LOCAL_CONFIG_REL, readHealthPaths } from '@/pr/health'
import {
  dropAddressLine,
  maskLocalAddress,
  findLocalServer,
  type LocalRefusal,
  type LocalRunner,
} from '@/pr/local'
import { KEY_CHANGES } from '@/pr/paths'
import {
  findDeployWorkflow,
  mintPreview,
  type PreviewHeadReason,
  readPreviewHead,
  type PreviewRefusal,
  type PreviewRunner,
  type RunRow,
  servesChange,
  type WorkflowFile,
} from '@/pr/preview'
import { coversHead, resolveUiScope } from '@/pr/review-scope'
import {
  countTicksAtHead,
  readUiPassHead,
  type TickRefusal,
  tickBoxes,
  type UiPassSummary,
  writeUiPassLine,
} from '@/pr/tick'
import {
  commentRowOf,
  identityOf,
  mergeStateOf,
  type PullIdentity,
  parseJsonLines,
  type RestComment,
  type RestPull,
  type RestReview,
  reviewRowOf,
  selectBranchPull,
} from '@/pr/rest'
import {
  readReviewState,
  type ReviewStateApi,
  type ReviewStateRecord,
  waitForReviews,
} from '@/pr/review-state'
import { PROJECT_ROOT } from '@/roots/project'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'

const GH_TIMEOUT_MS = 30_000

/** How many unnamed files the frame prints before it names a count instead. */
const UNNAMED_PRINT_LIMIT = 10

interface KeyChangesOptions {
  readonly body?: string
  readonly base?: string
  readonly root?: string
  readonly json?: boolean
}

interface ReadOptions {
  readonly root?: string
  readonly json?: boolean
}

interface EvidenceOptions extends ReadOptions {
  readonly preview?: string
  readonly checklist?: string
  readonly local?: string
  readonly reel?: string
  readonly check?: boolean
}

interface LiftCommandOptions extends ReadOptions {
  readonly check?: boolean
  readonly wait?: string
}

interface MergeCommandOptions extends ReadOptions {
  readonly dryRun?: boolean
}

interface CloseCommandOptions extends ReadOptions {
  readonly reasonFile?: string
  readonly head?: string
  readonly keepBranch?: boolean
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

interface DriveCopyOptions extends ReadOptions {
  readonly baseline?: boolean
  readonly check?: boolean
}

type DriveCopyRefusal =
  | 'no-worktree'
  | 'no-branch'
  | 'no-baseline'
  | 'unreadable-tree'
  | 'bad-flags'

const DRIVE_COPY_REFUSALS: Record<DriveCopyRefusal, string> = {
  'no-worktree':
    'No local worktree holds the pull request branch, so there is no tree to copy from or check.',
  'no-branch':
    'The checkout holds no branch, so no copy root could be named. Pass the pull request number.',
  'no-baseline':
    'No baseline was recorded for this pull request. Run --baseline before --check.',
  'unreadable-tree': 'git could not read the worktree status.',
  'bad-flags': '--baseline and --check cannot be combined.',
}

type TickReason =
  | TickRefusal
  | 'count-mismatch'
  | 'stale-head'
  | 'bad-boxes'
  | 'no-comment'
  | 'body-refused'

const TICK_REFUSALS: Record<TickReason | 'gh-failed', string> = {
  'body-refused':
    'The boxes are ticked on the evidence comment, but gh could not edit the pull request body, so its UI pass line still shows the earlier result. Re-run the tick to retry the body.',
  'stale-head':
    'The head named is not the branch tip on the remote, so a tick would claim a pass on a commit that is no longer the pull request. Re-drive the checklist at the tip.',
  'bad-boxes':
    '--boxes takes box numbers as a comma-separated list of positive whole numbers, such as 1,3, and --head takes the commit that was driven.',
  'count-mismatch':
    'The newest UI verdict at this head passed a different number of boxes than the ticks this call would leave at the head. Nothing was written. With fewer ticks than passed, re-run once with every box that passed. With more, a box ticked earlier at this head has since failed, which only the operator can untick.',
  'no-comment': 'No comment on this pull request carries the evidence marker.',
  'no-checklist': 'The evidence comment carries no checklist to tick.',
  'no-box':
    'A named box is past the end of the checklist. Number boxes off `canon pr evidence --json`.',
  'taste-box':
    'A named box ends in (taste), which no driver passes. Nothing was written.',
  'gh-failed':
    'gh could not read or edit the marked comment on this pull request.',
}

/** Shared by every verb that resolves a pull request from the checkout's branch. */
const AMBIGUOUS_PULL =
  'More than one pull request is open on this branch, each against another base. Name the pull request number.'

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
  'invalid-config': `${LOCAL_CONFIG_REL} cannot be read, so no health path was checked and no link is given. Fix or delete it and re-run.`,
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

interface PreviewOptions extends ReadOptions {
  readonly timeout?: string
  readonly check?: boolean
}

/** How long `canon pr preview` waits on the deploy run by default, in minutes. */
const PREVIEW_TIMEOUT_MINUTES = 15

/** How often the deploy run is re-read while waiting on it. */
const PREVIEW_POLL_MS = 15_000

const PREVIEW_REFUSALS: Record<
  PreviewRefusal | 'bad-timeout' | 'check-timeout' | 'unreadable-changes',
  string
> = {
  'bad-timeout': '--timeout takes a positive number of minutes.',
  'check-timeout':
    '--check only reads the deploy runs and waits on nothing, so it takes no --timeout.',
  'no-deploy':
    'No workflow under .github/workflows/ runs pages deploy and carries a workflow_dispatch trigger, so there is nothing to dispatch.',
  unserved:
    "The deploy workflow's push path filter matches no path this pull request changed, so the site it publishes would not show the change. Nothing was dispatched.",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  unfenced:
    'The deploy workflow passes no --branch=${{ github.ref_name }}, so a dispatch from this branch would publish it to production. Add the flag before asking for a preview.',
  'no-alias':
    'The deploy never printed a canon-preview-alias line, so no address could be read. Add the alias step from the cloudflare stack reference to the workflow.',
  'gh-failed':
    'gh could not list or dispatch the deploy workflow for this branch.',
  'unreadable-changes':
    'GitHub could not list what this pull request changed, so whether the deploy serves it is unknown. Nothing was dispatched.',
  'run-failed':
    'The deploy run finished without succeeding, so no preview was published. Read the run log.',
  timeout:
    'The deploy run did not finish inside the bound. The preview may still land. Re-run with a longer --timeout or read the run.',
}

/** What a reader does about each way `canon pr preview --check` answers. */
const PREVIEW_HEAD_NOTES: Record<PreviewHeadReason, string> = {
  fresh: 'The newest successful deploy built the branch tip.',
  stale:
    'The newest successful deploy built an earlier head than the branch tip. Mint again with canon pr preview before driving the preview.',
  building:
    'A deploy of the branch tip is still running. Wait for it rather than minting again.',
  'no-build':
    'No successful deploy exists for this branch. Mint one with canon pr preview.',
}

/** Why a head-sensitive read produced no answer about a commit. */
type PullRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'ambiguous-pull'
  | 'no-branch'
  | 'runs-unreadable'
  | 'reviews-unreadable'

/** What a reader does about each way the two sha-keyed verbs produced nothing. */
const PULL_REFUSALS: Record<PullRefusal | HeadRefusal, string> = {
  'gh-missing':
    'gh is not on the path, so no pull request could be resolved. Name the branch through a checkout that carries one.',
  'gh-failed':
    'gh could not answer for this branch. Name the pull request number instead.',
  'ambiguous-pull': AMBIGUOUS_PULL,
  'no-branch':
    'The pull request carries no head branch name, so no ref could be read for it.',
  'unresolvable-ref':
    'git could not read the remote, so the branch tip is unknown. That is a failed read rather than an absent branch, so nothing is reported about the head.',
  'no-remote-branch':
    'The remote carries no branch by that name. It was deleted or never pushed, so there is no tip to compare against.',
  'no-object-head':
    'The pull request object reported no head commit, so there is nothing to compare the tip against.',
  'runs-unreadable':
    'The check runs for this commit could not be read. An empty answer here would report a commit as having no check rather than as unread, so nothing is reported.',
  'reviews-unreadable':
    'The reviews on this pull request could not be read. An empty answer here would report a reviewed pull request as never reviewed, which routes the next pass to the whole change, so nothing is reported.',
}

/**
 * Why `canon pr evidence` produced no comment body, past the ones
 * `readIdentity` already owns (`gh-missing`, `gh-failed`, `no-branch`) and the
 * one `identity.head` owns (`no-object-head`).
 */
type EvidenceRefusal =
  | 'check-writes'
  | 'gh-failed'
  | 'no-base'
  | 'unreadable-changes'
  | 'unreadable-checklist'
  | 'would-empty'

const EVIDENCE_REFUSALS: Record<EvidenceRefusal, string> = {
  'check-writes':
    '--check is a read and renders no body, so it takes none of --preview, --local, --checklist, or --reel. Run the check and the render as two calls.',
  'gh-failed':
    'gh could not answer for this repository. Name the pull request number.',
  'unreadable-checklist':
    'The file named by --checklist could not be read, or holds nothing. Rendering without it would drop the only copy, since the caller deletes the handoff once a post reports success.',
  'no-base':
    'GitHub reported no merge base for this pull request, so no path could be judged added or changed.',
  'unreadable-changes':
    'GitHub could not list what this pull request changed, so the set is unknown.',
  'would-empty':
    'This render holds no cases and the marked comment holds some, so posting it would replace a comparison with an empty one. Edit the comment by hand if every case was removed on purpose.',
}

/** Why the read produced no comparison, ahead of the ones the compare owns. */
type SourceRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'ambiguous-pull'
  | 'unreadable-body'
  | 'unreadable-tree'
  | 'no-base'
  | 'bad-base'
  | 'unreadable-changes'

type Refusal = SourceRefusal | BijectionRefusal

/** What a reader does about each way this produced no reading. */
const REFUSALS: Record<Refusal, string> = {
  'gh-missing':
    'gh is not on the path, so no pull request body could be read. Pass --body <path> to read one off disk instead.',
  'gh-failed':
    'gh could not answer for this branch. Name the pull request number, or pass --body <path>.',
  'ambiguous-pull': AMBIGUOUS_PULL,
  'unreadable-body': 'The file named by --body could not be read.',
  'unreadable-tree':
    'git could not list this repository, so no path could be judged whole rather than partial.',
  'no-base': 'No base resolves against the trunk. Fetch origin or pass --base.',
  'bad-base':
    'The ref passed to --base shares no history with HEAD here, either because it resolves to no commit or because it sits on an unrelated root. Pass a ref this branch was taken from.',
  'unreadable-changes':
    'git could not list what this branch changed, so the set is unknown.',
  'no-section': `This body carries no ## ${KEY_CHANGES} section, so it claims nothing to compare.`,
  'no-claims': `The ## ${KEY_CHANGES} section carried no path this reader could resolve. That is the extractor failing over prose rather than the body being wrong, so nothing is raised.`,
  'no-changes':
    'The pull request changed no files, so there is nothing for a claim to answer.',
}

export function register(program: Command): void {
  const pr = program
    .command('pr')
    .description('Read a pull request body against the change it describes')
    .helpOption('-h, --help', 'Show this help message')

  pr.command('key-changes')
    .description(
      `Compare the files a body's ## ${KEY_CHANGES} names against its own diff`,
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option(
      '--body <path>',
      'Read the body from a file rather than the API, ignoring any number',
    )
    .option(
      '--base <ref>',
      'Far side of the range when --body supplies the body',
    )
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'This repository squash-merges, so a pull request body becomes the commit',
        'message and the record on the trunk once the branch is gone. A bullet',
        'claiming a change nobody made corrupts that record, and a changed file no',
        'bullet names leaves it incomplete.',
        '',
        'The two directions carry different weight:',
        "  unmet      a whole path the body claims ahead of its bullet's first",
        '             comma and the diff does not carry, the graded direction',
        '  unnamed    a changed file no bullet reached that a reader might have',
        '             wanted one for, reported without a grade',
        '  incidental a changed file no bullet reached that owes none: a test, a',
        '             fixture, or a lockfile, held apart so the count above reads',
        '  unresolved a path written partially, or one past its first comma,',
        '             which can credit a changed file and never accuse one',
        '',
        `Only ## ${KEY_CHANGES} is read. ## Technical context legitimately names`,
        'files a branch never touched, so widening the read manufactures findings.',
        '',
        'One class survives the reader: a bullet citing where something is defined',
        'while claiming an edit elsewhere puts a real path in the claim region and',
        'points the change at a locative the path does not name. Read the bullet on',
        "the record's preview before filing an unmet path as a stale claim.",
        '',
        'Refusals, read off `reason`:',
        '  no-section          the body carries no `## Key changes` heading, so it',
        '                      claims nothing',
        '  no-claims           the heading is there and no span resolved, which is',
        '                      the extractor failing over prose and raises nothing',
        '  no-changes          the pull request changed no files, so no claim has',
        '                      anything to answer',
        '  unreadable-body     the pull request body could not be read',
        '  unreadable-tree     the file tree of the head could not be read',
        '  no-base             GitHub reported no merge base for the pull request',
        '  bad-base            `--base` names a ref sharing no history with HEAD',
        '  unreadable-changes  the changed files could not be listed',
        '  ambiguous-pull      two open pull requests share the branch against',
        '                      different bases, so name a number',
        '  gh-missing          `gh` is not on the path, so no pull request could be',
        '                      resolved',
        '  gh-failed           `gh` could not answer for this repository or branch',
        '',
        'Exit codes:',
        '  0  every claimed path is in the diff',
        '  1  refused, with the reason on stderr or in the JSON record',
        '  2  at least one claimed path is absent from the diff',
        '',
        'Examples:',
        '  canon pr key-changes',
        '  canon pr key-changes 1265 --json',
        '  canon pr key-changes --body .canon/tmp/body.md --base origin/main',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: KeyChangesOptions) => {
      process.exitCode = await runKeyChanges(number, opts)
    })

  pr.command('head')
    .description(
      "Compare a pull request's reported head against the branch tip",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The pull request object lags the branch ref by up to a minute after a',
        'push and reports nothing about the lag, so a session reading',
        '`headRefOid` alone calls a pushed commit unpushed. This resolves the',
        'tip from the remote with `git ls-remote` and reports which commit each',
        'source names.',
        '',
        'Refusals, read off `reason`:',
        '  ambiguous-pull    two open pull requests share the branch against',
        '                    different bases, so name a number',
        '  no-branch         the pull request carries no head branch name',
        '  unresolvable-ref  the remote read failed, which is not an absent branch',
        '  no-remote-branch  the remote carries no branch by that name, so there',
        '                    is no tip to compare against',
        '  gh-missing        `gh` is not on the path, so no pull request resolved',
        '  gh-failed         `gh` could not answer for this branch, so name a number',
        '  no-object-head    the pull request object reported no head commit',
        '',
        'Read the verdict off the record rather than off the exit. A stale head',
        'exits 0, because an operator shell profile can wrap this binary in a',
        'function whose status comes from a trailing command.',
        '',
        'Exit codes:',
        '  0  the tip resolved, whether the object agreed with it or not',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr head',
        '  canon pr head 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReadOptions) => {
      process.exitCode = await runHead(number, opts)
    })

  pr.command('checks')
    .description('Report the check runs belonging to the branch tip')
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        '`gh pr checks` cannot be made sha-aware at all: its field set carries no',
        'sha, so a caller cannot learn which commit its answer describes. This',
        'resolves the tip from the remote and reads the check runs keyed on it.',
        '',
        'Pending is reported for a tip carrying no run yet as well as for one',
        'still going, since the endpoint has answered with a non-zero count and',
        'an empty row list, and reading that as passing is the false green the',
        'sha key alone does not close.',
        '',
        'Refusals, read off `reason`:',
        '  ambiguous-pull    two open pull requests share the branch against',
        '                    different bases, so name a number',
        '  no-branch         the pull request carries no head branch name',
        '  unresolvable-ref  the remote read failed, which is not an absent branch',
        '  no-remote-branch  the remote carries no branch by that name, so there',
        '                    is no tip to compare against',
        '  runs-unreadable   the check runs for the tip could not be read, which is',
        '                    unread rather than none',
        '  gh-missing        `gh` is not on the path, so no pull request resolved',
        '  gh-failed         `gh` could not answer for this branch, so name a number',
        '  no-object-head    the pull request object reported no head commit',
        '',
        'A branch conflicting with its base gets no merge ref, so no run ever',
        'starts for it and the state stays pending. The record carries',
        '`conflicted: true` beside it when `mergeStateStatus` reads DIRTY and no',
        'run belongs to the tip, and a caller stops waiting and rebases.',
        '',
        'Exit codes:',
        '  0  the runs for the tip were read, whatever they say',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr checks',
        '  canon pr checks 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReadOptions) => {
      process.exitCode = await runChecks(number, opts)
    })

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
        'carries a checklist, and `carriedFrom` or `paintedPaths` when the lift',
        'carried a close forward or refused to. An unbound family reads covered.',
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

  pr.command('evidence')
    .description(
      "Render a before/after comparison for the pull request's changed evidence images",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--preview <url>',
      'Put this preview address on the line under the heading, from canon pr preview',
    )
    .option(
      '--checklist <path>',
      'Close the body with this visual checklist file, from canon:ui-checklist',
    )
    .option(
      '--local <url>',
      "Add this worktree's running server to the address line, from canon pr local",
    )
    .option(
      '--reel <link>',
      'Embed this reel under the address line, filmed at the head, from canon pr frames --reel',
    )
    .option(
      '--check',
      'Report which post-pull-request steps the thread is still owed, rendering nothing',
    )
    .addHelpText(
      'after',
      [
        '',
        "Compares the pull request's merge base against its head, both read over",
        'the API for the number named, so the record is the same from any',
        'checkout. It never compares the previous push against the new one, so',
        'the comment never claims more than the pull request currently shows.',
        'A path counts as evidence when one of its segments is literally',
        '`evidence` and the filename carries an image extension (png, jpg,',
        'jpeg, gif, webp, avif, svg). A README, a capture',
        'script, or a raw data file kept beside the images is left out rather',
        'than rendered as a broken embed.',
        '',
        'Read `reason` on the JSON record before posting anything:',
        '  ok           a body was rendered, with `commentId` set when a marked',
        '               comment already exists and should be edited in place',
        '  no-evidence  nothing in the diff carries an evidence/ segment, which',
        '               is an ordinary, silent no-op rather than a refusal',
        '  would-empty  the render holds no cases and the marked comment holds',
        '               some, so no body is printed and a person edits the comment',
        '',
        'Every body opens with `## Evidence`, then one address line joining',
        'the hosted and local previews with " · ", carrying whichever apply,',
        'then the Base and Head line when there are screenshots.',
        '',
        'Each case shows its head image at the comment width under a bold',
        'label, with its base folded beneath in a <details> block, and an',
        'added case shows its head alone. Every state opens while the comment',
        'carries at most six head images and closes past that.',
        '',
        'Each modified PNG is compared with its base pixel by pixel. A case',
        'whose densest 16px square holds 6 or fewer differing pixels moves to',
        'one closed "Within tolerance" block after the states, still named and',
        'embedded, and stops counting toward the six. Its item on the record',
        'carries `withinTolerance`, which is absent for an added case, a',
        'format other than PNG, or a pair with a failed read. None of those',
        'folds, and neither does a pair that differs in size or will not decode.',
        '',
        '--preview puts the hosted address on that line. With no evidence in',
        'the diff, the body is the heading, that line, and the marker alone,',
        'reported as ok, so the preview still lands in one comment a later',
        'call can edit. Without --preview, an address the marked comment',
        'already carries is carried into the new body, so a re-render after a',
        'push keeps it, unless a deploy workflow resolves and its push path',
        'filter matches no path the pull request changed, in which case the',
        'carried hosted address is dropped. An explicit --preview is always',
        'kept. The address region above the comparison is read for each',
        'prefix wherever it sits, so a comment that opens on the addresses',
        'still carries them forward.',
        '',
        '--checklist closes the body with a visual checklist, below the',
        'comparison it annotates. A checklist the marked comment already',
        'carries is read back and carried forward the same way the preview',
        'address is. A tick survives only a render at the head it names: one',
        'stamped `passed at <sha>` for another head is cleared and unstamped,',
        'and so is one carrying no stamp when the comment described another',
        'head. A checklist, supplied or carried, turns no-evidence into ok: a',
        'branch with a checklist and no evidence image renders a marked body',
        'holding the checklist, so a later call finds and edits that comment.',
        '',
        '--local adds a **Local preview:** segment after any hosted one on the',
        'address line, or carries the line alone, and is carried forward the',
        'same way. It does not by itself turn no-evidence into ok, so a',
        'branch with a server running and nothing to show posts no link-only',
        'comment. Together with --checklist the link and the checklist land in',
        'one comment.',
        '',
        '--reel embeds an animated reel on its own line under the addresses,',
        'labeled with the head this render describes as the one it was filmed',
        'at. Without --reel, a reel the marked comment already embeds is carried',
        'forward under the head it names, so a stale reel never reads as',
        'current, and a passed one replaces it. Like --local it rides on a',
        'checklist or a comparison and never opens a comment alone.',
        '',
        "A render at a new head also resets the pull request body's UI pass",
        'line, the one `canon pr tick` writes under ## Testing, to unchecked',
        'naming that head. It touches no other body text, leaves a line already',
        'naming this head alone, and reports `uiPass` as reset or reset-refused.',
        '',
        'Both reasons carry what the marked comment already posted, each field',
        'present only when that comment holds it:',
        '  preview    the hosted **Preview:** address the comment carries',
        '  local      the **Local preview:** address beside it',
        '  reel       the embedded reel, as `link` and the `head` it was filmed at',
        '  checklist  the checklist between its delimiters, ticks included',
        '  boxes      each checklist box with its number, tick, stamp, and taste',
        '             mark, the numbering `canon pr tick` takes',
        'These come from the comment already posted, never from the flags this',
        'call passed. A checklist the caller posted raw after a refused render',
        'carries no marker, so the record reports none of the three for it. An',
        'unread thread refuses as gh-failed on both reasons rather than',
        'reporting the fields absent.',
        '',
        'The ok, no-evidence, and --check records carry `uncaptured`, the',
        'painted paths the pull request changed while no evidence image did, in',
        "a project whose base branch's tree holds one. Painted is the set",
        '`canon/config/painted.json` tunes, minus any path under an evidence/',
        'segment or canon/design/, and any changed evidence image empties the',
        'list. The field is absent when the base tree holds no capture or could',
        'not be read, a cut-short listing showing none included, so absent means',
        'unchecked rather than clean. It never adds to `owed`, since no step of',
        'the ship chain can take a capture.',
        '',
        '--check reads the same changed set and thread, renders no body, and',
        'reports what the ship chain still owes the pull request:',
        '  settled  nothing is owed',
        '  owed     `owed` lists evidence, preview, or both, in that order',
        'evidence is owed when an evidence image changed and no comment carries',
        'the marker. preview is owed when either holds, a deploy workflow in',
        'this checkout resolves, its push path filter matches a path the pull',
        'request changed, and the marked comment carries no **Preview:**',
        'address. A failed deploy reads the same as a skipped one.',
        'The record carries `owed` and the same marked fields. --check refuses',
        'with --preview, --local, --checklist, or --reel as check-writes.',
        '',
        'Refusals, read off `reason`:',
        '  unreadable-checklist  --checklist named a path that could not be read,',
        '                        or one holding nothing',
        '  no-branch             the pull request carries no head branch name',
        '  no-base               GitHub reported no merge base for the pull request',
        '  unreadable-changes    GitHub could not list what the pull request changed',
        '  gh-missing            `gh` is not on the path',
        '  gh-failed             `gh` could not read or edit the pull request or its',
        '                        comments',
        '  no-object-head        the pull request object reported no head commit',
        '',
        'Exit codes:',
        '  0  read, whether it produced a body, reported no-evidence, or checked',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr evidence --json',
        '  canon pr evidence 1341 --json',
        '  canon pr evidence 1341 --preview https://feat-x.site.pages.dev --json',
        '  canon pr evidence 1341 --checklist .canon/tmp/handoff/ui-checklist/x.md --json',
        '  canon pr evidence 1341 --local http://localhost:5173 --json',
        '  canon pr evidence 1341 --reel <link from canon pr frames --reel> --json',
        '  canon pr evidence 1341 --check --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: EvidenceOptions) => {
      process.exitCode = await runEvidence(number, opts)
    })

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
        '            where `canon pr evidence --check` carries a checklist. A close',
        '            on an earlier commit still holds when it is an ancestor of the',
        '            head and no painted path changed since, and the record names',
        '            it as `carriedFrom`. A painted change refuses `ui-behind` and',
        '            lists the paths as `paintedPaths`. A close whose count line',
        '            shows boxes not driven and none passed, failed, or needing',
        '            eyes refuses `ui-undriven`, carried or not',
        '  evidence  the evidence check reads settled',
        '  standing  the head is fresh against the base, not stale or conflicted',
        '  ci        every check run on the tip passed, waited on up to --wait',
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
        'A pull request that is already ready has the review, ui, and evidence',
        'gates read too. One that reads not clear returns to draft with reason',
        '`redrafted` and the failing reason as `failed`, exit 1. Standing and CI',
        'are reported and never cause a re-draft. A ready pull request that',
        'clears reports `already-ready`, exit 0. Under --check nothing is',
        'written and the first failing reason is reported.',
        '',
        'Reasons:',
        '  lifted, already-ready, redrafted, clear (--check)',
        '  pull-closed, review-missing, review-open, review-unmarked,',
        '  review-behind, ui-missing, ui-open, ui-unmarked, ui-behind,',
        '  ui-undriven, evidence-owed, standing-stale, standing-conflict, standing-unknown,',
        '  ci-pending (--check), ci-failing, ci-conflicted, ci-timeout,',
        '  head-moved, gh-failed',
        '',
        'Every read is REST. The mutation is the one GraphQL call.',
        '',
        'Exit codes:',
        '  0  lifted, already-ready, or every gate clear under --check',
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

  pr.command('close')
    .description(
      'Close a pull request unmerged, posting the reason first and deleting its head branch',
    )
    .argument('<number>', 'Pull request to close')
    .helpOption('-h, --help', 'Show this help message')
    .option('--reason-file <path>', 'Closing comment to post, required')
    .option(
      '--head <branch>',
      'Head branch the pull request must carry, defaulting to the current branch',
    )
    .option('--keep-branch', 'Leave the head branch in place')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .addHelpText(
      'after',
      [
        '',
        'The reason is required, so a pull request this verb closes always says',
        'why. It is checked before anything is read: banned characters, phase',
        'labels, board references, session links, and density measured on the',
        'reason itself. A finding refuses reason-unpublishable with the findings',
        'in the record.',
        '',
        'Then the pull request is read and must be open with the head --head',
        'names. The comment posts first, then the close, then the branch',
        'delete, so a failure part way leaves a comment on an open pull request',
        'rather than a close with no reason. A failed delete never fails the',
        'close, and a head in another repository is never deleted.',
        '',
        'Record: number, commentUrl, branch (deleted, kept, fork, delete-failed),',
        'findings on a reason-unpublishable refusal',
        '',
        'Reasons:',
        '  closed',
        '  no-reason, reason-unreadable, reason-unpublishable, no-head,',
        '  gh-failed, pull-closed, head-mismatch, comment-failed, close-failed',
        '',
        'Every call is REST, never `gh pr close`, which runs on GraphQL.',
        '',
        'Exit codes:',
        '  0  closed',
        '  1  refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr close 1341 --reason-file reason.md --json',
        '  canon pr close 1341 --reason-file reason.md --head feat/old --keep-branch',
        '',
      ].join('\n'),
    )
    .action(async (number: string, opts: CloseCommandOptions) => {
      process.exitCode = await runClose(number, opts)
    })

  pr.command('preview')
    .description(
      "Deploy the pull request's branch to a Cloudflare Pages preview and report its address",
    )
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--timeout <minutes>',
      `How long to wait on the deploy run (default ${PREVIEW_TIMEOUT_MINUTES})`,
    )
    .option(
      '--check',
      'Read whether the newest successful deploy built the branch tip, dispatching nothing',
    )
    .addHelpText(
      'after',
      [
        '',
        'Finds the workflow under .github/workflows/ that runs pages deploy with',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
        '--branch=${{ github.ref_name }} and a workflow_dispatch trigger,',
        "dispatches it on the pull request's head branch, waits on that run,",
        'and reads the address from the canon-preview-alias line the workflow',
        'prints. The address is read rather than computed from the branch name,',
        'since Cloudflare flattens and may truncate a branch into its alias.',
        '',
        'A deploy without the --branch flag is refused before anything runs,',
        'because Pages publishes an unfenced deploy to production.',
        '',
        "The pull request's changed paths are then matched against the",
        "workflow's own on.push.paths or paths-ignore filter, since a dispatch",
        'ignores that filter and would publish a site showing none of the',
        'change. A workflow with neither filter serves every change.',
        '',
        'Read `reason` on the JSON record:',
        '  ok          the preview was published, with its address in `url`',
        '  no-deploy   no dispatchable workflow runs pages deploy',
        '  unserved    the push filter matches no changed path, so nothing was',
        '              dispatched, and --check answers the same',
        '  unfenced    the deploy passes no --branch, so nothing was dispatched',
        '  no-alias    the workflow prints no canon-preview-alias line',
        '  run-failed  the deploy run finished without succeeding',
        '  timeout     the run did not finish inside --timeout minutes',
        '',
        'With --check nothing is dispatched or waited on. The newest successful',
        'workflow_dispatch run is compared with the branch tip read from the remote.',
        'Read `reason` on the JSON record, with `built`, `tip`, and `runId`:',
        '  fresh       the newest successful deploy built the tip',
        '  stale       the newest successful deploy built an earlier head',
        '  building    a deploy of the tip is still running, so wait',
        '  no-build    no deploy of this branch has succeeded',
        '',
        'Refusals before either read, read off `reason`:',
        '  bad-timeout         --timeout was not a positive number',
        '  check-timeout       --check was combined with --timeout',
        '  no-branch           the pull request carries no head branch name',
        '  unreadable-changes  the changed paths of the pull request could not be read',
        '  gh-missing          `gh` is not on the path',
        '  gh-failed           `gh` could not read the pull request, or list or',
        '                      dispatch the workflow',
        '',
        'Exit codes:',
        '  0  a preview was published, or --check read fresh',
        '  1  refused, or --check read anything but fresh',
        '',
        'Examples:',
        '  canon pr preview --json',
        '  canon pr preview 1341 --json --timeout 20',
        '  canon pr preview 1341 --check --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: PreviewOptions) => {
      process.exitCode = await runPreview(number, opts)
    })

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
        '  invalid-config      canon/config/local.toml is not valid TOML, or',
        '                      health is not a list of paths starting with /',
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
        'Before writing it reads the newest UI verdict. One that covers the tip',
        'and carries a count line must match the ticks this call leaves at the',
        'tip, so a re-drive passes every box that passed, since a new head',
        'clears the older ticks. Any other verdict leaves the check unrun.',
        '',
        'Read `reason` on the JSON record:',
        '  ticked       the boxes were ticked and the body line written, with the',
        '               tip in `head` and `countCheck` as matched or unchecked',
        '  count-mismatch the verdict passed a different number of boxes than',
        '               this call leaves ticked at the tip, nothing written,',
        '               `passed` and `ticked` carry the two counts. Fewer ticks',
        '               owe a re-run with every passed box, more ticks owe the',
        '               operator an untick of a box that has since failed',
        '  body-refused the comment is ticked but gh could not edit the body,',
        '               exit 1 with `commentTicked`. Re-run to retry the body.',
        '  stale-head   --head is not the remote branch tip, nothing written',
        '  taste-box    a named box ends in (taste), nothing written',
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

  pr.command('drive-copy')
    .description(
      "Copy the folders a running preview saves into, so a UI pass drives a throwaway copy, and check the worker's worktree gained no change",
    )
    .argument(
      '[number]',
      'Pull request whose worktree to read, defaulting to the checkout at --root',
    )
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
    .option(
      '--baseline',
      "Rebuild the copy, then record the worktree's git status",
    )
    .option(
      '--check',
      'Report each path changed since the baseline, copying nothing',
    )
    .addHelpText(
      'after',
      [
        '',
        'A project names what its preview writes in',
        '`canon/config/preview.json` as',
        '`{ "writes": [path], "keep": [path], "env": "<NAME>" }`.',
        'Each `writes` path is relative to the worktree, and `env`, defaulting',
        'to `CANON_PREVIEW_ROOT`, is the variable the server reads for the copy',
        'root. The server resolves each declared path under that root.',
        '',
        'Each `keep` path sits below a `writes` path, never equal to one, and',
        'names state the running server owns there, such as a run file. A',
        "rebuild leaves it in the copy and never copies the worktree's own, so",
        'list it for a server that writes under a declared path. The key is',
        'optional.',
        '',
        'The copy lives at `.canon/tmp/pr/review-ui/<slug>/board/` at the main',
        'worktree root, where `<slug>` is the branch with a leading type',
        'segment dropped and each `/` made `-`. With a number the branch is the',
        "pull request's head, and without one it is the checkout's, so the",
        'worker starting its server before a pull request exists and the',
        'reviewer naming the number land on one copy. Every run but --check',
        "resets each declared path from the worktree, dropping the last pass's",
        'drives, and leaves the rest of the copy root and each `keep` path as',
        'they are. A page added only to the copy, inside a declared path, is',
        'wiped.',
        '',
        '--baseline records `git status` for the worktree under',
        '`.canon/tmp/pr/review-ui/<number>/`, and --check reports each path',
        'whose status or content changed since, an untracked file included.',
        'Both run with no config, since a project that saves drives and never',
        'declared it is the case the check exists for. An edit the worker makes',
        'during the pass reads as changed too.',
        '',
        'Read `reason` on the JSON record:',
        '  copied     the copy was rebuilt, with `copyRoot`, `env`, `copied`, and',
        '             `missing` for a declared path the worktree does not hold',
        '  no-config  the project declares no preview, so nothing was copied',
        '  clean      --check found no change since the baseline',
        '  changed    --check found changes, listed in `paths`, exit 1',
        '',
        'Refusals, read off `reason`:',
        '  no-worktree      no local worktree holds the branch, as for a cloud',
        "                   worker's, so there is no tree to check",
        '  no-branch        the checkout holds no branch',
        '  no-baseline      --check ran before any --baseline for this number',
        '  bad-config       preview.json does not parse or lacks a writes list',
        '  unsafe-path      a writes path is absolute or climbs with `..`',
        '  unreadable-tree  git could not read the worktree status',
        '  bad-flags        --baseline and --check were combined',
        '  gh-failed, ambiguous-pull, gh-missing',
        '',
        'Exit codes:',
        '  0  copied, no-config, or clean',
        '  1  changed, or refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr drive-copy --json',
        '  canon pr drive-copy 1341 --baseline --json',
        '  canon pr drive-copy 1341 --check --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: DriveCopyOptions) => {
      process.exitCode = await runDriveCopy(number, opts)
    })

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

interface PullRequestRead {
  readonly body: string
  readonly changed: readonly string[]
  readonly head: string | undefined
  readonly number: number | undefined
  readonly renames: readonly RenamePair[]
  readonly ignoreAdditions: readonly string[]
  readonly evidenceUnread: boolean
}

type SourceRead =
  | { readonly kind: 'read'; readonly source: PullRequestRead }
  | { readonly kind: 'refused'; readonly reason: SourceRefusal }

/**
 * Reads the body and the changed set from the pull request the caller named,
 * or from the one open on this branch.
 *
 * The body comes off the pull read and the files off the paginated files
 * endpoint, since GraphQL is the only route that returns both in one call and
 * a cloud session's proxy refuses it. A push between the two reads can compare
 * a body against the next commit's files, which the paginated read already
 * risked for any pull request past the old view's cap of 100 files.
 */
async function readFromApi(
  cwd: string,
  number: string | undefined,
): Promise<SourceRead> {
  if (Bun.which('gh') === null) {
    return { kind: 'refused', reason: 'gh-missing' }
  }

  const pull = await readPull(cwd, number)
  if (pull.kind === 'refused') return pull

  const { row } = pull
  if (row.number === undefined) return { kind: 'refused', reason: 'gh-failed' }

  const changed = await listFilesByPage(cwd, row.number)
  if (changed === undefined) return { kind: 'refused', reason: 'gh-failed' }

  const body = row.body ?? ''
  const head = row.head?.sha
  const sorted = [...changed].sort()
  const evidence = await resolveApiEvidence(cwd, body, sorted, head, row.number)

  return {
    kind: 'read',
    source: {
      body,
      changed: sorted,
      head,
      number: row.number,
      renames: evidence.renames,
      ignoreAdditions: evidence.ignoreAdditions,
      evidenceUnread: evidence.unread,
    },
  }
}

/**
 * A rename's source path and a `.gitignore` addition, fetched only when a
 * first pass with neither already reports an unmet claim.
 *
 * The probe pays for a repository listing this read takes again a moment
 * later in `runKeyChanges`, and the full-row `gh api …/files` call besides it
 * only on the pass that already has something to double-check.
 *
 * `unread` separates a read that failed from one that succeeded and found
 * neither, which an empty `renames`/`ignoreAdditions` cannot do on its own.
 * `listFilesByPage` above refuses the whole comparison on exactly this
 * ground: a set known to be short would let a correct bullet accuse a file
 * nobody changed. This carries the same refusal as a flag rather than a
 * refused `Bijection`, since the base comparison can still run and most
 * claims never touch a rename or a `.gitignore` line at all.
 */
async function resolveApiEvidence(
  cwd: string,
  body: string,
  changed: readonly string[],
  head: string | undefined,
  number: number | undefined,
): Promise<{
  readonly renames: readonly RenamePair[]
  readonly ignoreAdditions: readonly string[]
  readonly unread: boolean
}> {
  const clean = { renames: [], ignoreAdditions: [], unread: false }
  const unread = { renames: [], ignoreAdditions: [], unread: true }

  const tracked = await listRepositoryFiles(cwd)
  if (tracked === undefined) return unread

  const probe = compareKeyChanges({
    body,
    changed,
    roots: treeRoots(tracked, changed),
    ...(head !== undefined && { head }),
  })
  // A refusal here means there is no claim to credit at all, and a clean
  // pass means every claim already resolved without the extra evidence, so
  // neither case leaves anything for unread evidence to have mattered to.
  if (probe.kind !== 'measured' || probe.unmet.length === 0) return clean

  // Only past this point does a missing pull request number become a real
  // gap: there is a claim the probe could not credit, and no number to fetch
  // the evidence that might explain it.
  if (number === undefined) return unread

  // No `--jq` filter here, unlike `listFilesByPage` above. Shaping each row to
  // {filename, previous_filename, status, patch} would make `--paginate`
  // concatenate one filtered value per page rather than one combined array,
  // and gh's own pretty-printing of an object result (unlike the scalar
  // strings `--jq '.[].filename'` yields) is not guaranteed to stay
  // line-parseable. Parsing the raw paginated array is safe under both.
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/pulls/${number}/files`,
  ])
  if (stdout === null) return unread

  let rows: readonly {
    readonly filename: string
    readonly previous_filename?: string
    readonly status: string
    readonly patch?: string
  }[]
  try {
    rows = JSON.parse(stdout)
  } catch {
    return unread
  }

  const renames = rows
    .filter(
      (row): row is typeof row & { previous_filename: string } =>
        row.status === 'renamed' && row.previous_filename !== undefined,
    )
    .map((row) => ({ from: row.previous_filename, to: row.filename }))

  const ignoreRow = rows.find((row) => row.filename === '.gitignore')
  const ignoreAdditions =
    ignoreRow?.patch !== undefined ? parseIgnoreAdditions(ignoreRow.patch) : []

  return { renames, ignoreAdditions, unread: false }
}

/**
 * Every file a pull request changed, read through the paginated endpoint.
 *
 * Returns undefined when any page fails, which refuses rather than comparing
 * the pages that arrived: a comparison run against a set known to be short
 * would accuse a correct bullet of naming a file nobody changed.
 */
async function listFilesByPage(
  cwd: string,
  number: number,
): Promise<string[] | undefined> {
  try {
    // See src/worktrees/reclaim.ts for why gh needs the stripped environment.
    const result = await execa(
      'gh',
      [
        'api',
        '--paginate',
        `repos/{owner}/{repo}/pulls/${number}/files`,
        '--jq',
        '.[].filename',
      ],
      { cwd, timeout: GH_TIMEOUT_MS, env: gitEnv(), extendEnv: false },
    )
    return result.stdout.split('\n').filter(Boolean)
  } catch {
    return undefined
  }
}

/**
 * Reads the body off disk and the changed set from git, which is the shape a
 * fixture and a body still being drafted both need.
 *
 * `cwd` and `root` diverge when a caller passes `--root` to read a pull
 * request against a worktree other than the one they are standing in. The
 * body path is resolved against `cwd`, since it is correct from where the
 * caller stands regardless of which tree `--root` names.
 */
async function readFromFile(
  root: string,
  cwd: string,
  path: string,
  base: string | undefined,
): Promise<SourceRead> {
  let body: string
  try {
    body = await readFile(resolve(cwd, path), 'utf8')
  } catch {
    return { kind: 'refused', reason: 'unreadable-body' }
  }

  const resolved = await resolveBaseRef(root, base)
  if (resolved === undefined) {
    return {
      kind: 'refused',
      reason: base === undefined ? 'no-base' : 'bad-base',
    }
  }

  const changed = await listChangedFiles(root, resolved)
  if (changed === undefined) {
    return { kind: 'refused', reason: 'unreadable-changes' }
  }

  const [head, renames, ignoreAdditions] = await Promise.all([
    $`git -C ${root} rev-parse HEAD`.env(gitEnv()).quiet().nothrow(),
    listRenames(root, resolved),
    listIgnoreAdditions(root, resolved),
  ])

  return {
    kind: 'read',
    source: {
      body,
      changed,
      head: head.exitCode === 0 ? head.text().trim() : undefined,
      number: undefined,
      renames: renames ?? [],
      ignoreAdditions: ignoreAdditions ?? [],
      evidenceUnread: renames === undefined || ignoreAdditions === undefined,
    },
  }
}

async function runKeyChanges(
  number: string | undefined,
  opts: KeyChangesOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr key-changes')

  const source =
    opts.body === undefined
      ? await readFromApi(root, number)
      : await readFromFile(root, process.cwd(), opts.body, opts.base)

  if (source.kind === 'refused') return refuse(source.reason, emitJson, root)

  const tracked = await listRepositoryFiles(root)
  if (tracked === undefined) return refuse('unreadable-tree', emitJson, root)

  const report: Bijection = compareKeyChanges({
    body: source.source.body,
    changed: source.source.changed,
    roots: treeRoots(tracked, source.source.changed),
    renames: source.source.renames,
    ignoreAdditions: source.source.ignoreAdditions,
    evidenceUnread: source.source.evidenceUnread,
    ...(source.source.head !== undefined && { head: source.source.head }),
  })

  if (report.kind === 'refused') return refuse(report.reason, emitJson, root)

  logStep('Scope')
  logInfo(
    `${plural(report.claims.length, 'claim')} against ${plural(report.changed.length, 'changed file')}${
      report.head === undefined ? '' : ` at ${report.head.slice(0, 8)}`
    }`,
  )
  if (report.evidenceUnread) {
    logWarn(
      'Rename or .gitignore-addition evidence could not be read, so a claim it might have credited or accused landed in unresolved rather than unmet.',
    )
  }

  logStep(report.unmet.length === 0 ? 'Claimed' : 'Unmet')
  if (report.unmet.length === 0) {
    logInfo('every claimed path is in the diff')
  } else {
    logWarn(
      `${plural(report.unmet.length, 'claimed path')} the diff does not carry. Correct the bullet, or make the change it describes.`,
    )
    for (const claim of report.unmet) {
      logWarn(`${claim.path} — ${claim.preview}`)
    }
  }

  // Named rather than counted into the verdict. A generated asset, a lockfile,
  // and a regenerated index all change without earning a bullet, so grading
  // this direction would fire on nearly every branch.
  logStep('Unnamed')
  if (report.unnamed.length === 0) {
    logInfo('every changed file is reached by a bullet')
  } else {
    logInfo(
      `${plural(report.unnamed.length, 'changed file')} no bullet reached. Add one where the change is worth a reader knowing about.`,
    )
    // Capped in the frame and whole in the record. A rename branch measured
    // here left 71 of its 100 files unnamed, correctly, and printing all of
    // them buries the graded direction above under a list nobody reads.
    for (const path of report.unnamed.slice(0, UNNAMED_PRINT_LIMIT)) {
      logInfo(path)
    }
    if (report.unnamed.length > UNNAMED_PRINT_LIMIT) {
      logInfo(
        `…and ${report.unnamed.length - UNNAMED_PRINT_LIMIT} more, whole in the --json record.`,
      )
    }
  }
  if (report.incidental.length > 0) {
    logInfo(
      `${plural(report.incidental.length, 'further changed file')} set aside as owing no bullet, whole in the --json record.`,
    )
  }

  if (report.unresolved.length > 0) {
    logStep('Unresolved')
    logInfo(
      `${plural(report.unresolved.length, 'path')} written partially or trailing its bullet's first comma, so neither direction judged it.`,
    )
    for (const claim of report.unresolved) logInfo(claim.path)
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(source.source.number !== undefined && {
          number: source.source.number,
        }),
        ...(report.head !== undefined && { head: report.head }),
        changed: report.changed,
        claims: report.claims,
        unmet: report.unmet,
        unnamed: report.unnamed,
        incidental: report.incidental,
        unresolved: report.unresolved,
        evidenceUnread: report.evidenceUnread,
      })}\n`,
    )
  }

  return report.unmet.length === 0 ? 0 : 2
}

type IdentityRead =
  | { readonly kind: 'read'; readonly identity: PullIdentity }
  | { readonly kind: 'refused'; readonly reason: PullRefusal }

/**
 * Runs one `gh` invocation and hands back its stdout, or null when it failed.
 *
 * See src/worktrees/reclaim.ts for why gh needs the stripped environment: it
 * resolves its repository through the same variables git does and they beat
 * `cwd`, so a run from inside a hook would answer for another repository.
 */
async function gh(
  cwd: string,
  args: readonly string[],
): Promise<string | null> {
  try {
    const result = await execa('gh', [...args], {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.stdout
  } catch {
    return null
  }
}

type PullNumber =
  | { readonly kind: 'found'; readonly number: string }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed' | 'ambiguous-pull'
    }

/**
 * The number the caller named, or the one open pull request on the branch the
 * checkout at `cwd` holds.
 *
 * `{owner}` in the head filter is the base repository's owner, which is the
 * head owner for every pull request opened from a branch of this repository.
 */
async function resolvePullNumber(
  cwd: string,
  number: string | undefined,
): Promise<PullNumber> {
  if (number !== undefined) return { kind: 'found', number }

  const branch = await $`git -C ${cwd} symbolic-ref --short -q HEAD`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const name = branch.exitCode === 0 ? branch.text().trim() : ''
  if (name === '') return { kind: 'refused', reason: 'gh-failed' }

  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/pulls?head={owner}:${encodeURIComponent(name)}&state=open&per_page=100`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }

  let rows: readonly RestPull[]
  try {
    rows = JSON.parse(stdout)
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }
  const selected = selectBranchPull(rows)
  return selected.kind === 'found'
    ? { kind: 'found', number: String(selected.number) }
    : selected
}

type PullRead =
  | { readonly kind: 'read'; readonly row: RestPull }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed' | 'ambiguous-pull'
    }

/**
 * The pull request object off the REST pull endpoint, which a cloud session's
 * proxy serves where it refuses the GraphQL every `gh pr view` runs on.
 */
async function readPull(
  cwd: string,
  number: string | undefined,
): Promise<PullRead> {
  const resolved = await resolvePullNumber(cwd, number)
  if (resolved.kind === 'refused') return resolved

  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/pulls/${resolved.number}`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }
  try {
    return { kind: 'read', row: JSON.parse(stdout) as RestPull }
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }
}

type PagesRead<T> =
  | { readonly kind: 'read'; readonly rows: readonly T[] }
  | { readonly kind: 'refused'; readonly reason: 'gh-failed' | 'unparsed' }

/**
 * Every row of a paginated listing, or a refusal when any page failed.
 *
 * A refusal rather than an empty list, since a refused read that reads as no
 * reviews routes the next pass to the whole change.
 */
async function listPages<T>(
  cwd: string,
  path: string,
  fields: string,
): Promise<PagesRead<T>> {
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `${path}?per_page=100`,
    '--jq',
    `.[] | {${fields}} | @json`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }
  const rows = parseJsonLines<T>(stdout)
  return rows === undefined
    ? { kind: 'refused', reason: 'unparsed' }
    : { kind: 'read', rows }
}

async function listReviews(cwd: string, number: string) {
  return listPages<RestReview>(
    cwd,
    `repos/{owner}/{repo}/pulls/${number}/reviews`,
    'id, body, commit_id, submitted_at',
  )
}

/** The issue comments on a pull request, or undefined when the thread is unread. */
async function listComments(
  cwd: string,
  number: string,
): Promise<readonly { url?: string; body: string }[] | undefined> {
  const read = await listPages<RestComment>(
    cwd,
    `repos/{owner}/{repo}/issues/${number}/comments`,
    'html_url, body',
  )
  return read.kind === 'read' ? read.rows.map(commentRowOf) : undefined
}

/**
 * Reads the head branch and the head the pull request object reports.
 *
 * Both come from one call, so the branch a ref is read for and the head that
 * ref is compared against describe the same object.
 */
async function readIdentity(
  cwd: string,
  number: string | undefined,
): Promise<IdentityRead> {
  if (Bun.which('gh') === null) {
    return { kind: 'refused', reason: 'gh-missing' }
  }

  const pull = await readPull(cwd, number)
  if (pull.kind === 'refused') return pull

  const identity: PullIdentity = identityOf(pull.row)
  if (identity.branch === '') return { kind: 'refused', reason: 'no-branch' }

  return { kind: 'read', identity }
}

/**
 * Reads the branch tip from the remote rather than from a tracking ref.
 *
 * A tracking ref is only as current as the last fetch, and the push this is
 * meant to catch is one this process never saw.
 */
function refReader(root: string) {
  return async (branch: string): Promise<string | null> => {
    const result = await $`git -C ${root} ls-remote --heads origin ${branch}`
      .env(gitEnv())
      .quiet()
      .nothrow()
    return result.exitCode === 0 ? result.text() : null
  }
}

async function runHead(
  number: string | undefined,
  opts: ReadOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr head')

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  const { identity } = read
  const reading = await resolveHead(
    identity.branch,
    identity.head,
    refReader(root),
  )

  if (reading.kind === 'refused') {
    return refuseWith(
      reading.reason,
      PULL_REFUSALS[reading.reason],
      emitJson,
      root,
    )
  }

  logStep('Scope')
  logInfo(
    `${identity.number === undefined ? 'the pull request on' : `#${identity.number} on`} ${reading.branch}`,
  )

  logStep(reading.state === 'fresh' ? 'Fresh' : 'Stale')
  if (reading.state === 'fresh') {
    logInfo(
      `the object and the remote both name ${reading.tip.slice(0, 8)}, so a read keyed on either describes the same commit`,
    )
  } else {
    logWarn(
      `the remote carries ${reading.tip.slice(0, 8)} and the pull request object still reports ${reading.object.slice(0, 8)}. Key every head-sensitive read on the tip.`,
    )
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        branch: reading.branch,
        state: reading.state,
        tip: reading.tip,
        object: reading.object,
      })}\n`,
    )
  }

  return 0
}

async function runChecks(
  number: string | undefined,
  opts: ReadOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr checks')

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  const { identity } = read
  const resolved = await resolveTip(identity.branch, refReader(root))
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  // The page size is raised rather than paged through. `collapseChecks` reads
  // a count above the rows it was handed as pending, so a commit past the
  // ceiling reports unread rather than clean, and 100 is the endpoint's own
  // maximum against a default of 30.
  const listed = await gh(root, [
    'api',
    `repos/{owner}/{repo}/commits/${resolved.tip}/check-runs?per_page=100`,
  ])
  if (listed === null) {
    return refuseWith(
      'runs-unreadable',
      PULL_REFUSALS['runs-unreadable'],
      emitJson,
      root,
    )
  }

  let listing: CheckRunListing
  try {
    listing = JSON.parse(listed)
  } catch {
    return refuseWith(
      'runs-unreadable',
      PULL_REFUSALS['runs-unreadable'],
      emitJson,
      root,
    )
  }

  const reading = withMergeState(
    identity.mergeState,
    collapseChecks(resolved.tip, listing),
  )

  logStep('Scope')
  logInfo(
    `${identity.branch} at ${reading.tip.slice(0, 8)}, ${plural(reading.matched, 'run')} belonging to it`,
  )
  // Named rather than folded into the count above, since a listing carrying a
  // run for another commit is what makes the verdict pending on its own.
  if (reading.foreign > 0) {
    logWarn(
      `${plural(reading.foreign, 'further run')} belonging to another commit, so this listing does not describe the tip alone.`,
    )
  }
  if (reading.collapsed > 0) {
    logInfo(
      `${plural(reading.collapsed, 'run')} folded into a newer run of the same check, so the count above includes a superseded run the state did not use.`,
    )
  }

  logStep(
    reading.state === 'passing'
      ? 'Passing'
      : reading.state === 'failing'
        ? 'Failing'
        : 'Pending',
  )
  if (reading.state === 'passing') {
    logInfo('every run on the tip completed and none failed')
  } else if (reading.state === 'failing') {
    logWarn('a run on the tip failed, which no run still going can clear')
  } else if (reading.conflicted) {
    logWarn(
      'the branch conflicts with its base, so no run will start for the tip. Rebase onto the base rather than waiting.',
    )
  } else if (reading.matched === 0) {
    logInfo(
      `no run belongs to the tip yet${reading.reported > 0 ? `, against a reported count of ${reading.reported}` : ''}. That is unread rather than clean.`,
    )
  } else {
    logInfo('a run on the tip has yet to conclude')
  }

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        branch: identity.branch,
        ...reading,
      })}\n`,
    )
  }

  return 0
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
    logInfo('ui: the evidence carries no checklist, so the family is unbound')
  }
}

interface PullFiles {
  /** Each path that still exists at the head, tagged with whether the pull request added it. */
  readonly present: ReadonlyMap<string, boolean>
  /** Each path the pull request removed, which a deploy's push filter still counts. */
  readonly removed: readonly string[]
}

/**
 * The paths a pull request changed, read through the paginated files endpoint
 * so the set is the same from any checkout and never capped at the first
 * view. `renamed` and `copied` count as added, since the new path has no
 * counterpart at the merge base. Returns undefined when the read fails, which
 * refuses rather than rendering a short set.
 */
async function listPullFiles(
  cwd: string,
  number: number,
): Promise<PullFiles | undefined> {
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/pulls/${number}/files`,
    '--jq',
    '.[] | [.status, .filename] | @tsv',
  ])
  if (stdout === null) return undefined
  const present = new Map<string, boolean>()
  const removed: string[] = []
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [status, path] = line.split('\t')
    if (status === undefined || path === undefined) continue
    if (status === 'removed') removed.push(path)
    else present.set(path, status !== 'modified' && status !== 'changed')
  }
  return { present, removed }
}

function everyChangedPath(files: PullFiles): string[] {
  return [...files.present.keys(), ...files.removed]
}

/**
 * Whether the base branch's tree holds an evidence image, read recursively
 * over the API so the answer is the same from any checkout. GitHub cuts a
 * large listing short, and a cut listing proves captures only when one
 * arrived before the cut, so it reads as unread otherwise. Undefined on any
 * failed read.
 */
async function readBaseKeepsCaptures(
  cwd: string,
  baseRef: string | undefined,
): Promise<boolean | undefined> {
  if (baseRef === undefined || baseRef === '') return undefined
  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/git/trees/${baseRef}?recursive=1`,
    '--jq',
    '.truncated, (.tree[] | select(.type == "blob") | .path)',
  ])
  if (stdout === null) return undefined
  const [truncated, ...paths] = stdout.split('\n').filter(Boolean)
  if (truncated !== 'true' && truncated !== 'false') return undefined
  if (paths.some(isEvidencePath)) return true
  return truncated === 'true' ? undefined : false
}

/**
 * The commit the pull request diverged from its base at, from the compare
 * endpoint, since a checkout on another branch resolves its own trunk tip
 * instead and the base image links would then describe the wrong commit.
 */
async function readPullMergeBase(
  cwd: string,
  baseRef: string | undefined,
  head: string,
): Promise<string | undefined> {
  if (baseRef === undefined || baseRef === '') return undefined
  const sha = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/compare/${baseRef}...${head}`,
    '--jq',
    '.merge_base_commit.sha',
  ])
  return sha === null || sha.trim() === '' ? undefined : sha.trim()
}

/** How many cases are read at once. Each reads its images one after another, so this bounds both the downloads in flight and the pairs held for comparison. */
const IMAGE_READ_CONCURRENCY = 4

type ImageRead =
  | {
      readonly kind: 'read'
      readonly width?: number
      readonly bytes?: Uint8Array
    }
  | { readonly kind: 'failed' }

/**
 * A PNG at `sha`, read over the contents API like every other evidence read,
 * with its pixel width from the header. The endpoint ignores a `Range` header,
 * so the whole file arrives, and its bytes are kept for the pixel comparison.
 * A format other than PNG reads with neither, and a refused or timed-out call
 * reads as failed, so the caller can keep the ceiling width and still report
 * the cause.
 */
async function readImage(
  cwd: string,
  path: string,
  sha: string,
): Promise<ImageRead> {
  if (!/\.png$/i.test(path)) return { kind: 'read' }
  try {
    const result = await execa(
      'gh',
      [
        'api',
        '-H',
        'Accept: application/vnd.github.raw',
        `repos/{owner}/{repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`,
      ],
      {
        cwd,
        timeout: GH_TIMEOUT_MS,
        env: gitEnv(),
        extendEnv: false,
        encoding: 'buffer',
      },
    )
    const bytes = result.stdout
    const width = readPngWidth(bytes.subarray(0, PNG_HEADER_BYTES))
    return width === undefined
      ? { kind: 'read', bytes }
      : { kind: 'read', width, bytes }
  } catch {
    return { kind: 'failed' }
  }
}

/** Runs `task` over `inputs` with at most `limit` in flight, keeping input order. */
async function mapPool<T, R>(
  inputs: readonly T[],
  limit: number,
  task: (input: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: inputs.length })
  let next = 0
  const lane = async (): Promise<void> => {
    while (next < inputs.length) {
      const index = next++
      results[index] = await task(inputs[index] as T)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, lane),
  )
  return results
}

interface SizedEvidence {
  readonly reading: EvidenceReading
  /** Each image whose read failed, as `head:<path>` or `base:<path>`, which rendered at the ceiling and left its case uncompared. */
  readonly unread: readonly string[]
}

interface MeasuredItem {
  readonly item: EvidenceItem
  readonly unread: readonly string[]
}

/**
 * One case with the pixel width of its head image and, when it has one, its
 * base image, and whether the two match within tolerance. The pair is compared
 * as soon as both reads land, so its bytes are dropped before the pool takes
 * the next case. A case missing either PNG carries no verdict.
 */
async function measureItem(
  cwd: string,
  item: EvidenceItem,
  base: string | undefined,
  head: string,
): Promise<MeasuredItem> {
  const headRead = await readImage(cwd, item.path, head)
  const baseRead =
    item.added || base === undefined
      ? undefined
      : await readImage(cwd, item.path, base)
  const unread = [
    ...(headRead.kind === 'failed' ? [`head:${item.path}`] : []),
    ...(baseRead?.kind === 'failed' ? [`base:${item.path}`] : []),
  ]
  const headBytes = headRead.kind === 'read' ? headRead.bytes : undefined
  const baseBytes = baseRead?.kind === 'read' ? baseRead.bytes : undefined
  return {
    item: {
      ...item,
      ...(headRead.kind === 'read' &&
        headRead.width !== undefined && { width: headRead.width }),
      ...(baseRead?.kind === 'read' &&
        baseRead.width !== undefined && { baseWidth: baseRead.width }),
      ...(headBytes !== undefined &&
        baseBytes !== undefined && {
          withinTolerance: isWithinTolerance(baseBytes, headBytes),
        }),
    },
    unread,
  }
}

/** Each item measured by `measureItem`, in the reading's order. */
async function withImageReads(
  cwd: string,
  reading: EvidenceReading,
  base: string | undefined,
  head: string,
): Promise<SizedEvidence> {
  if (reading.kind === 'refused') return { reading, unread: [] }
  const measured = await mapPool(
    reading.states.flatMap((entry) => entry.items),
    IMAGE_READ_CONCURRENCY,
    (item) => measureItem(cwd, item, base, head),
  )
  let offset = 0
  const states = reading.states.map((entry) => {
    const items = measured
      .slice(offset, offset + entry.items.length)
      .map((read) => read.item)
    offset += entry.items.length
    return { ...entry, items }
  })
  return {
    reading: { kind: 'read', states },
    unread: measured.flatMap((entry) => entry.unread),
  }
}

async function runEvidence(
  number: string | undefined,
  opts: EvidenceOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false
  const isCheck = opts.check ?? false

  intro('canon pr evidence')

  if (
    isCheck &&
    (opts.preview !== undefined ||
      opts.local !== undefined ||
      opts.checklist !== undefined ||
      opts.reel !== undefined)
  ) {
    return refuseWith(
      'check-writes',
      EVIDENCE_REFUSALS['check-writes'],
      emitJson,
      root,
    )
  }

  // Read ahead of anything else, so a bad path refuses before a `gh` round
  // trip rather than after one.
  let suppliedChecklist: string | undefined
  if (opts.checklist !== undefined) {
    suppliedChecklist = await readFile(resolve(root, opts.checklist), 'utf8')
      .then((text) => text.trim() || undefined)
      .catch(() => undefined)
    if (suppliedChecklist === undefined) {
      return refuseWith(
        'unreadable-checklist',
        EVIDENCE_REFUSALS['unreadable-checklist'],
        emitJson,
        root,
      )
    }
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }

  const { identity } = read
  if (identity.head === undefined) {
    return refuseWith(
      'no-object-head',
      PULL_REFUSALS['no-object-head'],
      emitJson,
      root,
    )
  }

  if (identity.number === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  // The check never reads the merge base, so it skips the compare call and
  // a failed one cannot hold a draft lift for a reason the check never had.
  const [pullFiles, base, keepsCaptures] = await Promise.all([
    listPullFiles(root, identity.number),
    isCheck ? undefined : readPullMergeBase(root, identity.base, identity.head),
    readBaseKeepsCaptures(root, identity.base),
  ])
  if (pullFiles === undefined) {
    return refuseWith(
      'unreadable-changes',
      EVIDENCE_REFUSALS['unreadable-changes'],
      emitJson,
      root,
    )
  }

  const grouped = await groupEvidence(
    [...pullFiles.present.keys()],
    async (path) => pullFiles.present.get(path) === false,
  )
  const uncaptured = readUncaptured(
    everyChangedPath(pullFiles),
    loadPaintedPatterns(root),
    keepsCaptures,
  )

  let existingCases = 0
  let commentId: number | undefined
  let carriedPreview: string | undefined
  let carriedChecklist: string | undefined
  let carriedLocal: string | undefined
  // An unread thread refuses rather than rendering, since a body built
  // without it knows neither the comment to edit nor the preview address
  // to carry, and posting it would duplicate the comment and drop the link.
  // It refuses ahead of no-evidence too, so that record never reports an
  // absent field it did not read.
  const comments = await listComments(root, String(identity.number))
  if (comments === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }
  commentId = findEvidenceCommentId(comments)
  existingCases = findEvidenceCaseCount(comments)
  carriedPreview = findEvidencePreview(comments)
  carriedChecklist = findEvidenceChecklist(comments)
  carriedLocal = findEvidenceLocal(comments)
  const carriedReel = findEvidenceReel(comments)

  // What the marked comment already shows a reviewer, kept apart from the
  // flags this call passed so a reader learns what is posted.
  const carried = {
    ...(carriedPreview !== undefined && { preview: carriedPreview }),
    ...(carriedLocal !== undefined && { local: carriedLocal }),
    ...(carriedReel !== undefined && { reel: carriedReel }),
    ...(carriedChecklist !== undefined && {
      checklist: carriedChecklist,
      boxes: readChecklistBoxes(carriedChecklist),
    }),
  }

  // A deploy that resolves and does not build from any changed path makes a
  // carried hosted link point at a site that shows none of this change.
  const deploy = findDeployWorkflow(await readWorkflows(root))
  const deployServesChange =
    deploy.kind === 'found' &&
    servesChange(deploy.filter, everyChangedPath(pullFiles))
  const isUnserved = deploy.kind === 'found' && !deployServesChange

  // Reported on every record that read the changed set, and never owed,
  // since no step of the ship chain can take the capture a skip left out.
  const uncapturedField = uncaptured !== undefined && { uncaptured }
  const warnUncaptured = (): void => {
    if (uncaptured === undefined || uncaptured.length === 0) return
    logWarn(
      `${plural(uncaptured.length, 'painted path')} changed with no evidence capture: ${uncaptured.join(', ')}`,
    )
  }

  if (isCheck) {
    const owed = readOwed({
      hasEvidenceChange: grouped.kind === 'read',
      hasMarkedComment: hasMarkedEvidenceComment(comments),
      carriedPreview: carriedPreview !== undefined,
      deployServesChange,
    })
    logStep(owed.length === 0 ? 'Settled' : 'Owed')
    logInfo(
      owed.length === 0
        ? 'Nothing the ship chain posts after the pull request is missing.'
        : `missing ${owed.join(', ')}`,
    )
    warnUncaptured()
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: owed.length === 0 ? 'settled' : 'owed',
          owed,
          ...uncapturedField,
          ...(commentId !== undefined && { commentId }),
          ...carried,
        })}\n`,
      )
    }
    return 0
  }

  if (base === undefined) {
    return refuseWith('no-base', EVIDENCE_REFUSALS['no-base'], emitJson, root)
  }

  // A checklist opens a comment on its own, so it always lands in the marked
  // comment a later call edits. A local address rides on a checklist or a
  // hosted preview and never opens one alone, so a docs-only branch with a
  // server up posts nothing.
  const hasChecklist =
    suppliedChecklist !== undefined || carriedChecklist !== undefined
  if (
    grouped.kind === 'refused' &&
    opts.preview === undefined &&
    !hasChecklist
  ) {
    logStep('Skipped')
    logInfo(
      'No changed path carries an evidence/ segment, so there is nothing to post.',
    )
    warnUncaptured()
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          ...(identity.number !== undefined && { number: identity.number }),
          reason: 'no-evidence',
          ...uncapturedField,
          ...carried,
        })}\n`,
      )
    }
    return 0
  }

  const repo = await readRepoName(root)
  if (repo === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  const preview = opts.preview ?? (isUnserved ? undefined : carriedPreview)
  const local = opts.local ?? carriedLocal
  const reel = nextEvidenceReel(opts.reel, identity.head, comments)
  const unsettled = suppliedChecklist ?? carriedChecklist
  const checklist =
    unsettled === undefined
      ? undefined
      : settleChecklist(unsettled, identity.head, findEvidenceHead(comments))
  const sized = await withImageReads(root, grouped, base, identity.head)
  const states = sized.reading.kind === 'read' ? sized.reading.states : []
  const body = renderEvidenceBody(
    states,
    repo,
    base,
    identity.head,
    preview,
    checklist,
    local,
    reel,
  )

  const caseCount = states.reduce((n, s) => n + s.items.length, 0)

  // A render with no cases cannot tell a removal from a short read, so it
  // never replaces a comment that carries some. The record keeps the comment
  // id and the carried fields so the caller can still edit by hand.
  if (caseCount === 0 && existingCases > 0) {
    logStep('Refused')
    logWarn(EVIDENCE_REFUSALS['would-empty'])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          number: identity.number,
          reason: 'would-empty',
          message: EVIDENCE_REFUSALS['would-empty'],
          ...(commentId !== undefined && { commentId }),
          ...carried,
        })}\n`,
      )
    }
    return 1
  }

  // A UI pass line stamped at an earlier head describes a tree that is gone,
  // so a render at a new head puts it back to unchecked. A line already
  // naming this head is left alone, since each body edit reruns the label gate.
  const priorBody = identity.body ?? ''
  const stampedHead = readUiPassHead(priorBody)
  let uiPass: 'reset' | 'reset-refused' | undefined
  if (stampedHead !== undefined && !identity.head.startsWith(stampedHead)) {
    const reset = writeUiPassLine(priorBody, {
      kind: 'reset',
      head: identity.head,
    })
    uiPass = (await patchPullBody(root, identity.number, reset))
      ? 'reset'
      : 'reset-refused'
  }

  logStep('Scope')
  logInfo(
    `${plural(caseCount, 'case')} across ${plural(states.length, 'state')}`,
  )
  if (uiPass === 'reset') logInfo('UI pass line reset to the new head')
  if (uiPass === 'reset-refused') {
    logWarn('gh could not edit the body, so its UI pass line names an old head')
  }
  if (sized.unread.length > 0) {
    logWarn(
      `width unread for ${plural(sized.unread.length, 'image')}, rendered at 1000: ${sized.unread.join(', ')}`,
    )
  }
  if (preview !== undefined) logInfo(`preview ${preview}`)
  if (local !== undefined) logInfo(`local preview ${local}`)
  if (reel !== undefined) {
    logInfo(
      opts.reel === undefined
        ? `reel carried forward, filmed at ${reel.head.slice(0, 7)}`
        : 'reel embedded under the addresses',
    )
  }
  if (checklist !== undefined) {
    logInfo(
      suppliedChecklist === undefined
        ? 'checklist carried forward from the marked comment'
        : 'checklist folded in below the comparison',
    )
  }
  warnUncaptured()

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: 'ok',
        base,
        head: identity.head,
        body,
        states,
        ...(sized.unread.length > 0 && { widthUnread: sized.unread }),
        ...(uiPass !== undefined && { uiPass }),
        ...uncapturedField,
        ...(commentId !== undefined && { commentId }),
        ...carried,
      })}\n`,
    )
  }

  return 0
}

async function readWorkflows(root: string): Promise<WorkflowFile[]> {
  const dir = join(root, '.github', 'workflows')
  if (!existsSync(dir)) return []
  const paths = [
    ...new Bun.Glob('*.{yml,yaml}').scanSync({ cwd: dir, onlyFiles: true }),
  ]
  return Promise.all(
    paths.map(async (name) => ({
      path: `.github/workflows/${name}`,
      text: await readFile(join(dir, name), 'utf8'),
    })),
  )
}

function parseRun(stdout: string | null): RunRow | undefined {
  if (stdout === null) return undefined
  try {
    return JSON.parse(stdout) as RunRow
  } catch {
    return undefined
  }
}

/**
 * The `gh` half of a preview. `--workflow` and `gh workflow run` both take the
 * workflow's file name rather than its repository path.
 */
function ghPreviewRunner(root: string): PreviewRunner {
  return {
    async dispatch(workflow, ref) {
      const out = await gh(root, [
        'workflow',
        'run',
        basename(workflow),
        '--ref',
        ref,
      ])
      return out !== null
    },
    async listRuns(workflow, ref) {
      const out = await gh(root, [
        'run',
        'list',
        '--workflow',
        basename(workflow),
        '--branch',
        ref,
        '--event',
        'workflow_dispatch',
        '--limit',
        '20',
        '--json',
        'databaseId,status,conclusion,headSha,createdAt',
      ])
      if (out === null) return undefined
      try {
        return JSON.parse(out) as RunRow[]
      } catch {
        return undefined
      }
    },
    async viewRun(id) {
      return parseRun(
        await gh(root, [
          'run',
          'view',
          String(id),
          '--json',
          'databaseId,status,conclusion,headSha,createdAt',
        ]),
      )
    },
    async readLog(id) {
      return (await gh(root, ['run', 'view', String(id), '--log'])) ?? undefined
    },
    now: () => Date.now(),
    sleep: (ms) => Bun.sleep(ms),
  }
}

async function runPreview(
  number: string | undefined,
  opts: PreviewOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr preview')

  if (opts.check === true && opts.timeout !== undefined) {
    return refuseWith(
      'check-timeout',
      PREVIEW_REFUSALS['check-timeout'],
      emitJson,
      root,
    )
  }

  const minutes = Number(opts.timeout ?? PREVIEW_TIMEOUT_MINUTES)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return refuseWith(
      'bad-timeout',
      PREVIEW_REFUSALS['bad-timeout'],
      emitJson,
      root,
    )
  }

  // Read ahead of the pull request, so a project with no fenced deploy is
  // refused without a network call and never reaches a dispatch.
  const pick = findDeployWorkflow(await readWorkflows(root))
  if (pick.kind === 'refused') {
    return refuseWith(
      pick.reason,
      PREVIEW_REFUSALS[pick.reason],
      emitJson,
      root,
    )
  }

  const read = await readIdentity(root, number)
  if (read.kind === 'refused') {
    return refuseWith(read.reason, PULL_REFUSALS[read.reason], emitJson, root)
  }
  const { identity } = read

  // A dispatch ignores the workflow's own push filter, so the filter is read
  // here, ahead of both the mint and the check, rather than left to GitHub.
  const changed =
    identity.number === undefined
      ? undefined
      : await listPullFiles(root, identity.number)
  if (changed === undefined) {
    return refuseWith(
      'unreadable-changes',
      PREVIEW_REFUSALS['unreadable-changes'],
      emitJson,
      root,
    )
  }
  if (!servesChange(pick.filter, everyChangedPath(changed))) {
    return refuseWith('unserved', PREVIEW_REFUSALS.unserved, emitJson, root)
  }

  if (opts.check === true) {
    return runPreviewCheck(root, emitJson, pick.path, identity)
  }

  logStep('Deploy')
  logInfo(`${pick.path} on ${identity.branch}`)

  const result = await mintPreview(ghPreviewRunner(root), {
    workflow: pick.path,
    branch: identity.branch,
    timeoutMs: minutes * 60_000,
    pollMs: PREVIEW_POLL_MS,
  })

  if (result.kind === 'refused') {
    logStep('Refused')
    logWarn(PREVIEW_REFUSALS[result.reason])
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          ...(identity.number !== undefined && { number: identity.number }),
          reason: result.reason,
          message: PREVIEW_REFUSALS[result.reason],
          workflow: pick.path,
          ...(result.runId !== undefined && { runId: result.runId }),
        })}\n`,
      )
    }
    return 1
  }

  logStep('Preview')
  logInfo(result.url)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: 'ok',
        url: result.url,
        workflow: pick.path,
        runId: result.runId,
      })}\n`,
    )
  }

  return 0
}

/**
 * Reads the built head against the tip. The tip comes from the remote rather
 * than `headRefOid`, which lags a push, so a build of the last head reads stale
 * the moment a newer commit lands.
 */
async function runPreviewCheck(
  root: string,
  emitJson: boolean,
  workflow: string,
  identity: { readonly branch: string; readonly number?: number },
): Promise<number> {
  const resolved = await resolveTip(identity.branch, refReader(root))
  if (resolved.kind === 'refused') {
    return refuseWith(
      resolved.reason,
      PULL_REFUSALS[resolved.reason],
      emitJson,
      root,
    )
  }

  const reading = await readPreviewHead(ghPreviewRunner(root), {
    workflow,
    branch: identity.branch,
    tip: resolved.tip,
  })
  if (reading.reason === 'gh-failed') {
    return refuseWith(
      'gh-failed',
      PREVIEW_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  logStep('Preview head')
  logInfo(PREVIEW_HEAD_NOTES[reading.reason])
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(identity.number !== undefined && { number: identity.number }),
        reason: reading.reason,
        message: PREVIEW_HEAD_NOTES[reading.reason],
        workflow,
        tip: reading.tip,
        ...(reading.built !== undefined && { built: reading.built }),
        ...(reading.runId !== undefined && { runId: reading.runId }),
      })}\n`,
    )
  }
  return reading.reason === 'fresh' ? 0 : 1
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

/** The worktree's toplevel with symlinks resolved, since a process cwd is read back resolved. */
async function resolveWorktreeRoot(root: string): Promise<string> {
  const result = await $`git -C ${root} rev-parse --show-toplevel`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const toplevel = result.exitCode === 0 ? result.text().trim() : root
  return realpath(toplevel).catch(() => toplevel)
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

const POSITIVE_WHOLE = /^[1-9]\d*$/

const MIN_TICK_HEAD_LENGTH = 7

/**
 * Ticks the named boxes on the marked comment. It refuses a head that is not
 * the remote tip and a taste box before writing, so both rules hold as checks
 * rather than as prose a driver can talk itself out of.
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
  if (!reading.tip.startsWith(head)) return refuseTick('stale-head')

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
  // comment half ticked. A verdict that does not cover the tip, carries no
  // count line, or cannot be read leaves the check unrun and says so.
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
    coversHead(verdict.commit, reading.tip)
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
        boxes: numbers.map(Number),
        commentId,
      })}\n`,
    )
  }
  return 0
}

/** Replaces a pull request's body, which `gh` takes through the REST pulls endpoint a cloud proxy serves. */
async function patchPullBody(
  root: string,
  number: number,
  body: string,
): Promise<boolean> {
  const patched = await gh(root, [
    'api',
    '-X',
    'PATCH',
    `repos/{owner}/{repo}/pulls/${number}`,
    '-f',
    `body=${body}`,
  ])
  return patched !== null
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

/** `owner/repo` off the REST repository read, since `gh repo view` runs on GraphQL. */
async function readRepoName(root: string): Promise<string | undefined> {
  const row = await gh(root, ['api', 'repos/{owner}/{repo}'])
  if (row === null) return undefined
  try {
    const name = (JSON.parse(row) as { full_name?: unknown }).full_name
    return typeof name === 'string' ? name : undefined
  } catch {
    return undefined
  }
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
    'The evidence comment carries a checklist and no UI review has been posted.',
  'ui-open': 'The newest UI review is open, so a box still owes a fix.',
  'ui-unmarked':
    'The newest UI review carries no head marker, so the commit it covers is a GitHub stamp this gate does not trust.',
  'ui-behind':
    'The newest UI review closed on an earlier commit than the head.',
  'ui-undriven':
    'The newest UI review closed having driven no box, so it looked at nothing. Re-drive the checklist on an address that answers.',
  'evidence-owed':
    'The evidence check reads owed, so the ship chain left a step undone.',
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

function gitRunner(root: string): GitRunner {
  return async (args) => {
    const result = await execa('git', ['-C', root, ...args], {
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.exitCode === 0 ? String(result.stdout) : undefined
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

  let record: { reason?: unknown; owed?: unknown; checklist?: unknown }
  try {
    record = JSON.parse(last)
  } catch {
    return undefined
  }
  if (record.reason !== 'settled' && record.reason !== 'owed') return undefined

  return {
    isSettled: record.reason === 'settled',
    owed: Array.isArray(record.owed) ? record.owed.map(String) : [],
    hasChecklist:
      typeof record.checklist === 'string' && record.checklist !== '',
  }
}

async function readChecksGate(
  root: string,
  number: string,
  tip: string,
): Promise<ChecksGate | undefined> {
  const [listed, pulled] = await Promise.all([
    gh(root, [
      'api',
      `repos/{owner}/{repo}/commits/${tip}/check-runs?per_page=100`,
    ]),
    gh(root, ['api', `repos/{owner}/{repo}/pulls/${number}`]),
  ])
  if (listed === null) return undefined
  try {
    const mergeState =
      pulled === null
        ? undefined
        : mergeStateOf((JSON.parse(pulled) as RestPull).mergeable_state)
    const reading = withMergeState(
      mergeState,
      collapseChecks(tip, JSON.parse(listed) as CheckRunListing),
    )
    return { state: reading.state, isConflicted: reading.conflicted }
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
        ? `#${resolved.number} is already ready for review`
        : record.reason === 'redrafted'
          ? `#${resolved.number} is back to draft, since ${record.failed === undefined ? 'a gate' : LIFT_REFUSALS[record.failed]}`
          : record.reason === 'clear'
            ? `every gate reads clear for #${resolved.number}`
            : LIFT_REFUSALS[record.reason],
  )
  for (const gate of record.gates) {
    if (!gate.isOk) logWarn(`${gate.gate}: ${gate.reason ?? 'not clear'}`)
  }
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, number: Number(resolved.number), ...record })}\n`,
    )
  }

  return record.isOk ? 0 : 1
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
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...record })}\n`)
  } else if (record.reason === 'dry-run') {
    process.stdout.write(`${record.title}\n\n${record.description}\n`)
  }

  return record.isOk ? 0 : 1
}

/**
 * Frames a refusal on stderr in both modes and puts the record on stdout alone,
 * so an operator reading the terminal sees the reason rather than a command
 * that appeared to do nothing.
 */
function refuse(reason: Refusal, emitJson: boolean, root: string): number {
  return refuseWith(reason, REFUSALS[reason], emitJson, root)
}

/** The scratch folder `review-ui` writes under, at the main worktree root. */
const REVIEW_UI_SCRATCH = join('.canon', 'tmp', 'pr', 'review-ui')

type DriveTarget =
  | {
      readonly kind: 'found'
      readonly main: string
      readonly worktree: string
      readonly branch: string
      readonly number: string | undefined
    }
  | {
      readonly kind: 'refused'
      readonly reason: DriveCopyRefusal | PullRefusal
    }

/**
 * The worker's worktree and its branch. A named pull request resolves through
 * its head ref, since a reviewer runs at the main root on the trunk. With no
 * number the checkout at `root` answers, and a number is looked up only when
 * the mode needs one, so a worker can build the copy before its pull request
 * exists.
 */
async function resolveDriveTarget(
  root: string,
  number: string | undefined,
  needsNumber: boolean,
): Promise<DriveTarget> {
  const worktrees = await listWorktrees(root)
  const main = worktrees[0]?.path ?? root

  if (number === undefined) {
    const toplevel = await resolveWorktreeRoot(root)
    const realPaths = await Promise.all(
      worktrees.map((candidate) =>
        realpath(candidate.path).catch(() => candidate.path),
      ),
    )
    const entry = worktrees[realPaths.indexOf(toplevel)]
    const branch = entry?.branch ?? null
    if (branch === null) return { kind: 'refused', reason: 'no-branch' }
    if (!needsNumber) {
      return { kind: 'found', main, worktree: toplevel, branch, number }
    }
    if (Bun.which('gh') === null) {
      return { kind: 'refused', reason: 'gh-missing' }
    }
    const resolved = await resolvePullNumber(root, undefined)
    if (resolved.kind === 'refused') return resolved
    return {
      kind: 'found',
      main,
      worktree: toplevel,
      branch,
      number: resolved.number,
    }
  }

  if (Bun.which('gh') === null) return { kind: 'refused', reason: 'gh-missing' }
  const read = await readPull(root, number)
  if (read.kind === 'refused') return read
  const headRef = read.row.head?.ref
  if (headRef === undefined || headRef === '') {
    return { kind: 'refused', reason: 'no-worktree' }
  }
  const entry = worktrees.find((candidate) => candidate.branch === headRef)
  if (entry === undefined) return { kind: 'refused', reason: 'no-worktree' }
  return {
    kind: 'found',
    main,
    worktree: entry.path,
    branch: headRef,
    number,
  }
}

async function runDriveCopy(
  number: string | undefined,
  opts: DriveCopyOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false
  const baseline = opts.baseline ?? false
  const check = opts.check ?? false

  intro('canon pr drive-copy')

  const refuse = (
    reason: DriveCopyRefusal | PullRefusal | string,
    message: string,
  ) => refuseWith(reason, message, emitJson, root)

  if (baseline && check) {
    return refuse('bad-flags', DRIVE_COPY_REFUSALS['bad-flags'])
  }

  const target = await resolveDriveTarget(root, number, baseline || check)
  if (target.kind === 'refused') {
    const reason = target.reason
    return refuse(
      reason,
      reason in DRIVE_COPY_REFUSALS
        ? DRIVE_COPY_REFUSALS[reason as DriveCopyRefusal]
        : PULL_REFUSALS[reason as PullRefusal],
    )
  }

  const scratch = join(target.main, REVIEW_UI_SCRATCH)
  const baselinePath =
    target.number === undefined
      ? undefined
      : join(scratch, target.number, 'drive-baseline.json')
  const emit = (record: Record<string, unknown>) => {
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({ root, worktree: target.worktree, branch: target.branch, ...record })}\n`,
      )
    }
  }

  if (check && baselinePath !== undefined) {
    let prior: readonly StatusEntry[]
    try {
      prior = JSON.parse(await readFile(baselinePath, 'utf8'))
    } catch {
      return refuse('no-baseline', DRIVE_COPY_REFUSALS['no-baseline'])
    }
    const current = await readWorktreeStatus(target.worktree)
    if (current === undefined) {
      return refuse('unreadable-tree', DRIVE_COPY_REFUSALS['unreadable-tree'])
    }
    const paths = changedSince(prior, current)
    if (paths.length === 0) {
      logStep('Clean')
      logInfo(`No change in ${target.worktree} since the baseline.`)
      outro()
      emit({ reason: 'clean', paths })
      return 0
    }
    logStep('Changed')
    for (const path of paths) logWarn(path)
    outro()
    emit({ reason: 'changed', paths })
    return 1
  }

  const config = loadPreviewConfig(target.worktree)
  if (config.kind === 'refused') return refuse(config.reason, config.detail)

  let copy: Record<string, unknown>
  if (config.kind === 'absent') {
    logStep('No config')
    logInfo('The project declares no preview writes, so nothing was copied.')
    copy = { reason: 'no-config' }
  } else {
    const copyRoot = join(scratch, branchSlug(target.branch), 'board')
    const { copied, missing } = buildDriveCopy(
      target.worktree,
      copyRoot,
      config.config.writes,
      config.config.keep,
    )
    logStep('Copied')
    logInfo(`${config.config.env}=${copyRoot}`)
    for (const path of missing) logWarn(`${path} is not in the worktree`)
    copy = {
      reason: 'copied',
      copyRoot,
      env: config.config.env,
      copied,
      missing,
    }
  }

  if (baseline && baselinePath !== undefined) {
    const status = await readWorktreeStatus(target.worktree)
    if (status === undefined) {
      return refuse('unreadable-tree', DRIVE_COPY_REFUSALS['unreadable-tree'])
    }
    await mkdir(join(baselinePath, '..'), { recursive: true })
    await writeFile(baselinePath, `${JSON.stringify(status)}\n`)
    logStep('Baseline')
    logInfo(`Recorded ${plural(status.length, 'status line')}.`)
    copy = { ...copy, baseline: baselinePath }
  }

  outro()
  emit(copy)
  return 0
}

type CloseCommandRefusal = 'reason-unreadable' | 'no-head'

const CLOSE_REFUSALS: Record<CloseRefusal | CloseCommandRefusal, string> = {
  'no-reason':
    'No closing reason was given. Write it to a file and pass --reason-file.',
  'reason-unreadable': 'The --reason-file could not be read.',
  'reason-unpublishable':
    'The reason carries text a reader on the remote cannot use or that breaks the density limits. The findings are in the record.',
  'no-head':
    'This checkout is on no branch, so pass --head with the branch the pull request carries.',
  'gh-failed': 'gh could not read the pull request, so nothing was written.',
  'pull-closed': 'The pull request is already closed.',
  'head-mismatch':
    'The pull request carries another head branch than the one expected. Nothing was written to it.',
  'comment-failed':
    'The closing comment did not post, so the pull request was left open.',
  'close-failed':
    'The comment posted but the close was refused, so the pull request is still open. Close it by hand or re-run.',
}

function closeApi(root: string, number: string): CloseApi {
  return {
    readPull: async () => {
      const stdout = await gh(root, [
        'api',
        `repos/{owner}/{repo}/pulls/${number}`,
      ])
      if (stdout === null) return undefined
      try {
        const row = JSON.parse(stdout) as RestPull
        if (typeof row.head?.ref !== 'string') return undefined
        const headRepo = row.head.repo?.full_name
        return {
          isOpen: row.state === 'open',
          branch: row.head.ref,
          isFork:
            headRepo === undefined || headRepo !== row.base?.repo?.full_name,
        }
      } catch {
        return undefined
      }
    },
    postComment: async (body) => {
      const url = await gh(root, [
        'api',
        '-X',
        'POST',
        `repos/{owner}/{repo}/issues/${number}/comments`,
        '-f',
        `body=${body}`,
        '--jq',
        '.html_url',
      ])
      return url === null || url.trim() === '' ? undefined : url.trim()
    },
    patchClosed: async () =>
      (await gh(root, [
        'api',
        '-X',
        'PATCH',
        `repos/{owner}/{repo}/pulls/${number}`,
        '-f',
        'state=closed',
        '--silent',
      ])) !== null,
    deleteBranch: async (branch) =>
      (await gh(root, [
        'api',
        '-X',
        'DELETE',
        `repos/{owner}/{repo}/git/refs/heads/${encodeURIComponent(branch)}`,
        '--silent',
      ])) !== null,
  }
}

async function runClose(
  number: string,
  opts: CloseCommandOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr close')

  const refuseClose = (
    reason: CloseRefusal | CloseCommandRefusal,
    extra: Record<string, unknown> = {},
  ): number =>
    refuseWith(reason, CLOSE_REFUSALS[reason], emitJson, root, {
      number: Number(number),
      ...extra,
    })

  if (opts.reasonFile === undefined) return refuseClose('no-reason')
  let reason: string
  try {
    reason = await readFile(resolve(root, opts.reasonFile), 'utf8')
  } catch {
    logWarn(`Could not read ${opts.reasonFile}`)
    return refuseClose('reason-unreadable')
  }

  let head = opts.head
  if (head === undefined) {
    const branch = await $`git -C ${root} symbolic-ref --short -q HEAD`
      .env(gitEnv())
      .quiet()
      .nothrow()
    head = branch.exitCode === 0 ? branch.text().trim() : ''
    if (head === '') return refuseClose('no-head')
  }

  const record = await close(closeApi(root, number), {
    number: Number(number),
    reason,
    head,
    isKeepBranch: opts.keepBranch ?? false,
  })

  if (!record.isOk) {
    return refuseClose(record.reason as CloseRefusal, {
      ...(record.commentUrl !== undefined && { commentUrl: record.commentUrl }),
      ...(record.findings !== undefined && { findings: record.findings }),
    })
  }

  logStep('Closed')
  logInfo(`#${record.number} closed, branch ${record.branch}`)
  if (record.branch === 'delete-failed') {
    logWarn(`The branch ${head} could not be deleted. Delete it by hand.`)
  }
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, ...record })}\n`)
  }
  return 0
}

function refuseWith(
  reason: string,
  message: string,
  emitJson: boolean,
  root: string,
  extra: Record<string, unknown> = {},
): number {
  logStep('Refused')
  logWarn(message)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason, message, ...extra })}\n`,
    )
  }
  return 1
}
