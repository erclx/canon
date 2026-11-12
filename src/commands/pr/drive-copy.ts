import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { listWorktrees } from '@/git/worktree'
import { branchSlug, buildDriveCopy, loadPreviewConfig } from '@/pr/drive-copy'
import {
  changedSince,
  readWorktreeStatus,
  type StatusEntry,
} from '@/git/status'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  PULL_REFUSALS,
  PullRefusal,
  ReadOptions,
  readPull,
  refuseWith,
  resolvePullNumber,
  resolveWorktreeRoot,
} from '@/commands/pr/pull'

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

export function registerDriveCopy(pr: Command): void {
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
