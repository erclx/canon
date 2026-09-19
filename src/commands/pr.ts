import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { $ } from 'bun'
import type { Command } from 'commander'
import { execa } from 'execa'
import { gitEnv } from '@/git-env'
import {
  listChangedFiles,
  listIgnoreAdditions,
  listRenames,
  listRepositoryFiles,
  parseIgnoreAdditions,
  type RenamePair,
  resolveBaseRef,
} from '@/git-files'
import {
  type Bijection,
  type BijectionRefusal,
  compareKeyChanges,
  treeRoots,
} from '@/pr/bijection'
import { type CheckRunListing, collapseChecks } from '@/pr/checks'
import {
  findEvidenceCommentId,
  findEvidencePreview,
  groupEvidence,
  renderEvidenceBody,
} from '@/pr/evidence'
import { type HeadRefusal, resolveHead, resolveTip } from '@/pr/head'
import { KEY_CHANGES } from '@/pr/paths'
import {
  findDeployWorkflow,
  mintPreview,
  type PreviewRefusal,
  type PreviewRunner,
  type RunRow,
  type WorkflowFile,
} from '@/pr/preview'
import { type ReviewListing, resolveReviewScope } from '@/pr/review-scope'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/ui'

const GH_TIMEOUT_MS = 30_000

/** How many unnamed files the frame prints before it names a count instead. */
const UNNAMED_PRINT_LIMIT = 10

/**
 * Where `gh pr view --json files` stops.
 *
 * It pages the underlying query once and returns at most this many rows with
 * nothing on the record saying so, which was measured against `#1250`: the
 * pull request carries 101 files and the view reports 100. A set silently one
 * short is the worst input this comparison can take, since the missing file is
 * exactly what a claim would then be accused of inventing.
 */
const GH_VIEW_FILE_CAP = 100

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
}

interface PreviewOptions extends ReadOptions {
  readonly timeout?: string
}

/** How long `canon pr preview` waits on the deploy run by default, in minutes. */
const PREVIEW_TIMEOUT_MINUTES = 15

/** How often the deploy run is re-read while waiting on it. */
const PREVIEW_POLL_MS = 15_000

const PREVIEW_REFUSALS: Record<PreviewRefusal | 'bad-timeout', string> = {
  'bad-timeout': '--timeout takes a positive number of minutes.',
  'no-deploy':
    'No workflow under .github/workflows/ runs pages deploy and carries a workflow_dispatch trigger, so there is nothing to dispatch.',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: a workflow expression, not a template
  unfenced:
    'The deploy workflow passes no --branch=${{ github.ref_name }}, so a dispatch from this branch would publish it to production. Add the flag before asking for a preview.',
  'no-alias':
    'The deploy never printed a canon-preview-alias line, so no address could be read. Add the alias step from the cloudflare stack reference to the workflow.',
  'gh-failed':
    'gh could not list or dispatch the deploy workflow for this branch.',
  'run-failed':
    'The deploy run finished without succeeding, so no preview was published. Read the run log.',
  timeout:
    'The deploy run did not finish inside the bound. The preview may still land. Re-run with a longer --timeout or read the run.',
}

/** Why a head-sensitive read produced no answer about a commit. */
type PullRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'no-branch'
  | 'runs-unreadable'
  | 'reviews-unreadable'

/** What a reader does about each way the two sha-keyed verbs produced nothing. */
const PULL_REFUSALS: Record<PullRefusal | HeadRefusal, string> = {
  'gh-missing':
    'gh is not on the path, so no pull request could be resolved. Name the branch through a checkout that carries one.',
  'gh-failed':
    'gh could not answer for this branch. Name the pull request number instead.',
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
  | 'gh-failed'
  | 'no-base'
  | 'unreadable-tree'
  | 'unreadable-changes'

const EVIDENCE_REFUSALS: Record<EvidenceRefusal, string> = {
  'gh-failed':
    'gh could not answer for this repository. Name the pull request number.',
  'no-base': 'No base resolves against the trunk. Fetch origin and re-run.',
  'unreadable-tree':
    'git could not read the tree at the base commit, so no path could be judged added or changed.',
  'unreadable-changes':
    'git could not list what this branch changed, so the set is unknown.',
}

/** Why the read produced no comparison, ahead of the ones the compare owns. */
type SourceRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'gh-truncated'
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
  'gh-truncated': `gh returned the first ${GH_VIEW_FILE_CAP} changed files and the paginated read that would complete the set failed, so a claim could be accused of naming a file this read never saw.`,
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
        `Only ## ${KEY_CHANGES} is read. ## Technical Context legitimately names`,
        'files a branch never touched, so widening the read manufactures findings.',
        '',
        'One class survives the reader: a bullet citing where something is defined',
        'while claiming an edit elsewhere puts a real path in the claim region and',
        'points the change at a locative the path does not name. Read the bullet on',
        "the record's preview before filing an unmet path as a stale claim.",
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
    .description('Report the commit and instant the last review pass covered')
    .argument('[number]', 'Pull request to read, defaulting to this branch')
    .helpOption('-h, --help', 'Show this help message')
    .option('--root <path>', 'Repository to read, defaulting to the cwd')
    .option('--json', 'Add a machine-readable record on stdout')
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
        'Exit codes:',
        '  0  the thread was read, whether it carries a pass or not',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr review-state',
        '  canon pr review-state 1341 --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: ReadOptions) => {
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
      'Open the body with this preview address, from canon pr preview',
    )
    .addHelpText(
      'after',
      [
        '',
        'Compares the merge base with the trunk against the current head, never',
        'the previous push against the new one, so the comment never claims more',
        'than the branch currently shows. A path counts as evidence when one of',
        'its segments is literally `evidence` and the filename carries an image',
        'extension (png, jpg, jpeg, gif, webp, avif, svg). A README, a capture',
        'script, or a raw data file kept beside the images is left out rather',
        'than rendered as a broken embed.',
        '',
        'Read `reason` on the JSON record before posting anything:',
        '  ok           a body was rendered, with `commentId` set when a marked',
        '               comment already exists and should be edited in place',
        '  no-evidence  nothing in the diff carries an evidence/ segment, which',
        '               is an ordinary, silent no-op rather than a refusal',
        '',
        "--preview puts the address on the body's first line. With no evidence",
        'in the diff, the body is that line and the marker alone, reported as',
        'ok, so the preview still lands in one comment a later call can edit.',
        'Without --preview, an address the marked comment already opens with',
        'is carried into the new body, so a re-render after a push keeps it.',
        '',
        'Exit codes:',
        '  0  read, whether it produced a body or reported no-evidence',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr evidence --json',
        '  canon pr evidence 1341 --json',
        '  canon pr evidence 1341 --preview https://feat-x.site.pages.dev --json',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: EvidenceOptions) => {
      process.exitCode = await runEvidence(number, opts)
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
      'How long to wait on the deploy run',
      String(PREVIEW_TIMEOUT_MINUTES),
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
        'Read `reason` on the JSON record:',
        '  ok          the preview was published, with its address in `url`',
        '  no-deploy   no dispatchable workflow runs pages deploy',
        '  unfenced    the deploy passes no --branch, so nothing was dispatched',
        '  no-alias    the workflow prints no canon-preview-alias line',
        '  run-failed  the deploy run finished without succeeding',
        '  timeout     the run did not finish inside --timeout minutes',
        '',
        'Exit codes:',
        '  0  a preview was published',
        '  1  refused, with the reason on stderr or in the JSON record',
        '',
        'Examples:',
        '  canon pr preview --json',
        '  canon pr preview 1341 --json --timeout 20',
        '',
      ].join('\n'),
    )
    .action(async (number: string | undefined, opts: PreviewOptions) => {
      process.exitCode = await runPreview(number, opts)
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
 * One call wherever the file list fits inside it. The body and the file list
 * have to describe the same head, and reading them separately leaves a window
 * where a push between them compares a body against another commit's files. A
 * pull request at the view's cap takes the second read anyway, because a set
 * short by an unknown number is worse than a set read a moment later.
 */
async function readFromApi(
  cwd: string,
  number: string | undefined,
): Promise<SourceRead> {
  if (Bun.which('gh') === null) {
    return { kind: 'refused', reason: 'gh-missing' }
  }

  const args = ['pr', 'view']
  if (number !== undefined) args.push(number)
  args.push('--json', 'body,files,headRefOid,number')

  try {
    // See src/worktrees/reclaim.ts for why gh needs the stripped environment:
    // it resolves its repository through the same variables git does and they
    // beat `cwd`, so a run from inside a hook would answer for another
    // repository and compare this branch's claims against its files.
    const result = await execa('gh', args, {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })

    const row = JSON.parse(result.stdout) as {
      body?: string
      files?: readonly { path: string }[]
      headRefOid?: string
      number?: number
    }

    const viewed = (row.files ?? []).map((file) => file.path)
    const changed =
      viewed.length < GH_VIEW_FILE_CAP || row.number === undefined
        ? viewed
        : await listFilesByPage(cwd, row.number)

    if (changed === undefined) {
      return { kind: 'refused', reason: 'gh-truncated' }
    }

    const body = row.body ?? ''
    const sorted = [...changed].sort()
    const evidence = await resolveApiEvidence(
      cwd,
      body,
      sorted,
      row.headRefOid,
      row.number,
    )

    return {
      kind: 'read',
      source: {
        body,
        changed: sorted,
        head: row.headRefOid,
        number: row.number,
        renames: evidence.renames,
        ignoreAdditions: evidence.ignoreAdditions,
        evidenceUnread: evidence.unread,
      },
    }
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }
}

/**
 * A rename's source path and a `.gitignore` addition, fetched only when a
 * first pass with neither already reports an unmet claim.
 *
 * The probe pays for a repository listing this read takes again a moment
 * later in `runKeyChanges`, and the `gh api …/files` call besides it only on
 * the pass that already has something to double-check, the same trade the
 * `gh-truncated` pagination fallback makes.
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
 * Only reached when the view came back at the cap, since it costs a request per
 * page and nearly every pull request here fits in one view. Returns undefined
 * when the follow-up fails, which refuses rather than falling back to the
 * capped set: a comparison run against a set known to be short would accuse a
 * correct bullet of naming a file nobody changed.
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

/** The head branch and reported head of the pull request a caller named. */
interface PullIdentity {
  readonly number: number | undefined
  readonly branch: string
  readonly head?: string
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

  const args = ['pr', 'view']
  if (number !== undefined) args.push(number)
  args.push('--json', 'number,headRefName,headRefOid')

  const stdout = await gh(cwd, args)
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }

  let row: { number?: number; headRefName?: string; headRefOid?: string }
  try {
    row = JSON.parse(stdout)
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }

  if (row.headRefName === undefined || row.headRefName === '') {
    return { kind: 'refused', reason: 'no-branch' }
  }

  return {
    kind: 'read',
    identity: {
      number: row.number,
      branch: row.headRefName,
      ...(row.headRefOid !== undefined && { head: row.headRefOid }),
    },
  }
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

  const reading = collapseChecks(resolved.tip, listing)

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
  opts: ReadOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr review-state')

  if (Bun.which('gh') === null) {
    return refuseWith('gh-missing', PULL_REFUSALS['gh-missing'], emitJson, root)
  }

  const args = ['pr', 'view']
  if (number !== undefined) args.push(number)
  // `number` rides along so the record names the pull request a caller that
  // passed no argument was answered about. The comment families the poll reads
  // stay out of the query, since nothing here parses one and a listing the
  // caller discards is a payload paid for twice.
  args.push('--json', 'number,reviews')

  const stdout = await gh(root, args)
  if (stdout === null) {
    return refuseWith('gh-failed', PULL_REFUSALS['gh-failed'], emitJson, root)
  }

  let listing: ReviewListing & { number?: number }
  try {
    listing = JSON.parse(stdout)
  } catch {
    return refuseWith(
      'reviews-unreadable',
      PULL_REFUSALS['reviews-unreadable'],
      emitJson,
      root,
    )
  }

  const scope = resolveReviewScope(listing)

  logStep('Scope')
  logInfo(
    listing.number === undefined
      ? 'the pull request on this branch'
      : `#${listing.number}`,
  )

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

  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({
        root,
        ...(listing.number !== undefined && { number: listing.number }),
        ...scope,
      })}\n`,
    )
  }

  return 0
}

/**
 * Every path `git ls-tree` reports for `ref`, or undefined when the read
 * failed. One call for the whole tree rather than one `cat-file -e` per
 * evidence path, since existence at base is checked once per changed path and
 * a batch read is one round trip instead of many.
 */
async function listTreePaths(
  root: string,
  ref: string,
): Promise<Set<string> | undefined> {
  const result = await $`git -C ${root} ls-tree -r --name-only ${ref}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0) return undefined
  return new Set(result.text().split('\n').filter(Boolean))
}

async function runEvidence(
  number: string | undefined,
  opts: EvidenceOptions,
): Promise<number> {
  const root = resolve(opts.root ?? process.cwd())
  const emitJson = opts.json ?? false

  intro('canon pr evidence')

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

  const base = await resolveBaseRef(root)
  if (base === undefined) {
    return refuseWith('no-base', EVIDENCE_REFUSALS['no-base'], emitJson, root)
  }

  const [changed, baseTree] = await Promise.all([
    listChangedFiles(root, base),
    listTreePaths(root, base),
  ])
  if (changed === undefined) {
    return refuseWith(
      'unreadable-changes',
      EVIDENCE_REFUSALS['unreadable-changes'],
      emitJson,
      root,
    )
  }
  if (baseTree === undefined) {
    return refuseWith(
      'unreadable-tree',
      EVIDENCE_REFUSALS['unreadable-tree'],
      emitJson,
      root,
    )
  }

  const grouped = await groupEvidence(changed, async (path) =>
    baseTree.has(path),
  )

  if (grouped.kind === 'refused' && opts.preview === undefined) {
    logStep('Skipped')
    logInfo(
      'No changed path carries an evidence/ segment, so there is nothing to post.',
    )
    outro()
    if (emitJson) {
      process.stdout.write(
        `${JSON.stringify({
          root,
          ...(identity.number !== undefined && { number: identity.number }),
          reason: 'no-evidence',
        })}\n`,
      )
    }
    return 0
  }

  const repoRow = await gh(root, ['repo', 'view', '--json', 'nameWithOwner'])
  const repo =
    repoRow === null
      ? undefined
      : (JSON.parse(repoRow) as { nameWithOwner?: string }).nameWithOwner

  if (repo === undefined) {
    return refuseWith(
      'gh-failed',
      EVIDENCE_REFUSALS['gh-failed'],
      emitJson,
      root,
    )
  }

  let commentId: number | undefined
  let carriedPreview: string | undefined
  if (identity.number !== undefined) {
    const commentsRow = await gh(root, [
      'pr',
      'view',
      String(identity.number),
      '--json',
      'comments',
    ])
    // An unread thread refuses rather than rendering, since a body built
    // without it knows neither the comment to edit nor the preview address
    // to carry, and posting it would duplicate the comment and drop the link.
    let comments: readonly { url?: string; body: string }[] | undefined
    if (commentsRow !== null) {
      try {
        comments = (
          JSON.parse(commentsRow) as {
            comments?: readonly { url?: string; body: string }[]
          }
        ).comments
      } catch {
        comments = undefined
      }
    }
    if (comments === undefined) {
      return refuseWith(
        'gh-failed',
        EVIDENCE_REFUSALS['gh-failed'],
        emitJson,
        root,
      )
    }
    commentId = findEvidenceCommentId(comments)
    carriedPreview = findEvidencePreview(comments)
  }

  const preview = opts.preview ?? carriedPreview
  const states = grouped.kind === 'read' ? grouped.states : []
  const body = renderEvidenceBody(states, repo, base, identity.head, preview)

  const caseCount = states.reduce((n, s) => n + s.items.length, 0)

  logStep('Scope')
  logInfo(
    `${plural(caseCount, 'case')} across ${plural(states.length, 'state')}`,
  )
  if (preview !== undefined) logInfo(`preview ${preview}`)

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
        ...(commentId !== undefined && { commentId }),
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
        'databaseId,status,conclusion',
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
          'databaseId,status,conclusion',
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
 * Frames a refusal on stderr in both modes and puts the record on stdout alone,
 * so an operator reading the terminal sees the reason rather than a command
 * that appeared to do nothing.
 */
function refuse(reason: Refusal, emitJson: boolean, root: string): number {
  return refuseWith(reason, REFUSALS[reason], emitJson, root)
}

function refuseWith(
  reason: string,
  message: string,
  emitJson: boolean,
  root: string,
): number {
  logStep('Refused')
  logWarn(message)
  outro()

  if (emitJson) {
    process.stdout.write(`${JSON.stringify({ root, reason, message })}\n`)
  }
  return 1
}
