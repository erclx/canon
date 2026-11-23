import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Command } from 'commander'
import { listWorktrees } from '@/git/worktree'
import {
  branchSlug,
  buildDriveCopy,
  checkPassPage,
  loadPreviewConfig,
  type PreviewConfig,
  readWorktreeOffset,
  runSeed,
  SEED_TIMEOUT_MS,
  startPassPreview,
  stopPassPreview,
} from '@/pr/drive-copy'
import { readHealthPaths } from '@/pr/health'
import {
  changedSince,
  readWorktreeStatus,
  type StatusEntry,
} from '@/git/status'
import { intro, logInfo, logStep, logWarn, outro, plural } from '@/cli/ui'
import {
  PullRefusal,
  ReadOptions,
  readPull,
  refusePull,
  refuseWith,
  resolvePullNumber,
  resolveWorktreeRoot,
} from '@/commands/pr/pull'

interface DriveCopyOptions extends ReadOptions {
  readonly baseline?: boolean
  readonly check?: boolean
  readonly serve?: boolean
  readonly stop?: boolean
}

type DriveCopyRefusal =
  | 'no-worktree'
  | 'no-branch'
  | 'no-baseline'
  | 'unreadable-tree'
  | 'bad-flags'
  | 'seed-failed'
  | 'seed-wrote-worktree'
  | 'serve-failed'
  | 'preview-stale'
  | 'stop-failed'

const DRIVE_COPY_REFUSALS: Record<DriveCopyRefusal, string> = {
  'no-worktree':
    'No local worktree holds the pull request branch, so there is no tree to copy from or check.',
  'no-branch':
    'The checkout holds no branch, so no copy root could be named. Pass the pull request number.',
  'no-baseline':
    'No baseline was recorded for this pull request. Run --baseline before --check.',
  'unreadable-tree': 'git could not read the worktree status.',
  'bad-flags':
    '--check combines with no other mode, and --stop combines with nothing.',
  'serve-failed':
    "The pass's server did not come up on the copy, so the pass has no fresh preview to drive.",
  'preview-stale':
    "The pass's server answered, but its page failed, so it serves a stale copy. It was stopped, so re-run --serve to restart it.",
  'stop-failed':
    "The pass's server survived the stop, so it may still answer on its port.",
  'seed-failed':
    'The seed exited non-zero, so the copy holds no seeded state to drive against.',
  'seed-wrote-worktree':
    "The seed changed the worktree's git status, so it wrote outside the copy. Point it at the copy root variable.",
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
    .option(
      '--serve',
      "After the rebuild, start the project's serve command on the copy for this pass",
    )
    .option('--stop', "End the pass's server that --serve started")
    .addHelpText(
      'after',
      [
        '',
        'A project names what its preview writes in',
        '`canon/config/preview.json` as',
        '`{ "writes": [path], "keep": [path], "env": "<NAME>", "seed": [argv],',
        '"serve": [argv], "port": <number> }`.',
        'Each `writes` path is relative to the worktree, and `env`, defaulting',
        'to `CANON_PREVIEW_ROOT`, is the variable the server reads for the copy',
        'root. The server resolves each declared path under that root.',
        '',
        'Each `keep` path sits below a `writes` path, never equal to one, and',
        'names state the running server owns there, such as a run file. A',
        "rebuild leaves it in the copy and never copies the worktree's own, so",
        'list it for a server that writes under a declared path. The key is',
        'optional. It preserves a path and never an index file above it, so',
        'state a project lays into the copy belongs in `seed`.',
        '',
        '`seed` is an optional argv list, spawned with no shell from the',
        'worktree with `env` set to the copy root, after each rebuild and',
        'before --baseline records a status. It runs under a 120 second limit,',
        "and its stdout and stderr go to this verb's stderr. A seed that exits",
        'non-zero or runs past the limit refuses, and so does one that changes',
        "the worktree's git status, since it wrote outside the copy.",
        '',
        '`serve` and `port` are optional. `port` is the port the project serves',
        'on before the worktree offset, and `canon pr local` reads it plus the',
        'offset scripts/worktree-port.sh prints, or 0 with no helper. `serve`',
        'is an argv list spawned with no shell, detached, from the worktree,',
        'and it needs `port`. With --serve, after the rebuild, the seed, and',
        'any baseline, it runs with `env` set to the copy root and',
        '`WORKTREE_PORT_OFFSET` set to the worktree offset plus 25, so it binds',
        "the declared port plus that offset, never the worker's own. The verb",
        'waits 60 seconds for HTTP there, then requests / and each health path',
        'canon/config/local.toml declares: / must answer inside 10 seconds with',
        'no 5xx and each health path with a 2xx. The server writes its output',
        'to `server.log` and its pid to `server.json` beside the copy root, and',
        'a later --serve ends a server still recorded there before the rebuild.',
        "--stop ends the recorded server's whole process group. A project with",
        'no `serve` key drives as before under --serve, with no `url` on the',
        "record. The worker's own server is never started, stopped, or read.",
        '',
        'The copy lives at `.canon/tmp/pr/review-ui/<slug>/board/` at the main',
        'worktree root, where `<slug>` is the branch with a leading type',
        'segment dropped and each `/` made `-`. With a number the branch is the',
        "pull request's head, and without one it is the checkout's, so the",
        'worker starting its server before a pull request exists and the',
        'reviewer naming the number land on one copy. Every run but --check',
        "resets each declared path from the worktree, dropping the last pass's",
        'drives, leaves the rest of the copy root and each `keep` path as they',
        'are, and then runs the seed. A page added only to the copy, inside a',
        'declared path, is wiped unless the seed lays it again.',
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
        '             `missing` for a declared path the worktree does not hold,',
        '             and `seed` as `{ ran, exit }` when the project declares one.',
        '             Under --serve with a `serve` key, it adds `url`, `port`,',
        '             `pid`, and `log` for the started server',
        '  no-config  the project declares no preview, so nothing was copied',
        '  clean      --check found no change since the baseline',
        '  changed    --check found changes, listed in `paths`, exit 1',
        '  stopped    --stop ended the server, with its `pid` and `port`',
        '  not-running',
        '             --stop found no live server recorded for this copy',
        '',
        'Refusals, read off `reason`:',
        '  no-worktree      no local worktree holds the branch, so there is no',
        '                   tree to check',
        '  no-branch        the checkout holds no branch',
        '  no-baseline      --check ran before any --baseline for this number',
        '  bad-config       preview.json does not parse, lacks a writes list, or',
        '                   names a seed or serve that is not a list opening on a',
        '                   command, a port outside 1 to 65535, or a serve with',
        '                   no port',
        '  unsafe-path      a writes path is absolute or climbs with `..`',
        '  seed-failed      the seed exited non-zero, ran past its limit, or never',
        '                   started, with `seed` carrying `ran`, `exit`,',
        '                   `timedOut`, the last 20 lines of `stderr`, and',
        '                   `error` naming why a seed that never started failed',
        '  seed-wrote-worktree',
        "                   the seed changed the worktree's git status, with the",
        '                   paths in `paths`',
        '  serve-failed     the pass port already answered, the helper refused',
        '                   the offset, or the server never started, exited',
        '                   early, or gave no answer in 60 seconds, with `serve`',
        '                   carrying `cause`, `exit`, and the last 20 lines of',
        '                   `output`. Nothing it started is left running',
        '  preview-stale    the server answered, but / or a health path failed,',
        '                   with `path`, `status` (null on no answer), and',
        '                   `stopped` reading whether the server was ended',
        '  stop-failed      --stop signalled the group and it survived, with',
        '                   `pid` and `port`',
        '  unreadable-tree  git could not read the worktree status',
        '  bad-flags        --check was combined with another mode, or --stop',
        '                   with any',
        '  gh-failed, ambiguous-pull, gh-missing, bad-input (a number that is',
        '  not a positive whole number), no-pull (a number naming no pull request)',
        '',
        'Exit codes:',
        '  0  copied, no-config, clean, stopped, or not-running',
        '  1  changed, or refused, with the reason in the JSON record',
        '',
        'Examples:',
        '  canon pr drive-copy --json',
        '  canon pr drive-copy 1341 --baseline --json',
        '  canon pr drive-copy 1341 --check --json',
        '  canon pr drive-copy 1341 --baseline --serve --json',
        '  canon pr drive-copy 1341 --stop --json',
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
      readonly number?: string
    }

/**
 * The worker's worktree and its branch. A named pull request resolves through
 * its head ref, since a reviewer runs at the main root on the trunk. With no
 * number the checkout at `root` answers, so the copy builds before a PR exists.
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
  const serve = opts.serve ?? false
  const stop = opts.stop ?? false

  intro('canon pr drive-copy')

  const refuse = (
    reason: DriveCopyRefusal | PullRefusal | string,
    message: string,
  ) => refuseWith(reason, message, emitJson, root)

  if (
    (check && (baseline || serve)) ||
    (stop && (baseline || check || serve))
  ) {
    return refuse('bad-flags', DRIVE_COPY_REFUSALS['bad-flags'])
  }

  const target = await resolveDriveTarget(root, number, baseline || check)
  if (target.kind === 'refused') {
    const reason = target.reason
    return reason in DRIVE_COPY_REFUSALS
      ? refuse(reason, DRIVE_COPY_REFUSALS[reason as DriveCopyRefusal])
      : refusePull(
          { reason: reason as PullRefusal, number: target.number },
          emitJson,
          root,
        )
  }

  const scratch = join(target.main, REVIEW_UI_SCRATCH)
  const copyRoot = join(scratch, branchSlug(target.branch), 'board')
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

  // A server left by an earlier pass would keep serving files the rebuild replaces.
  if (stop || serve) {
    const ended = await stopPassPreview(copyRoot)
    if (ended.kind === 'failed') {
      logWarn(ended.detail)
      return refuseWith(
        'stop-failed',
        DRIVE_COPY_REFUSALS['stop-failed'],
        emitJson,
        root,
        { pid: ended.pid, port: ended.port },
      )
    }
    if (stop) {
      logStep(ended.kind === 'stopped' ? 'Stopped' : 'Not running')
      outro()
      emit(
        ended.kind === 'stopped'
          ? { reason: 'stopped', pid: ended.pid, port: ended.port }
          : { reason: 'not-running' },
      )
      return 0
    }
  }

  const config = loadPreviewConfig(target.worktree)
  if (config.kind === 'refused') return refuse(config.reason, config.detail)

  let copy: Record<string, unknown>
  if (config.kind === 'absent') {
    logStep('No config')
    logInfo('The project declares no preview writes, so nothing was copied.')
    copy = { reason: 'no-config' }
  } else {
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

    const seed = config.config.seed
    if (seed !== undefined) {
      const before = await readWorktreeStatus(target.worktree)
      if (before === undefined) {
        return refuse('unreadable-tree', DRIVE_COPY_REFUSALS['unreadable-tree'])
      }
      logStep('Seed')
      const run = await runSeed(
        target.worktree,
        copyRoot,
        seed,
        config.config.env,
      )
      const after = await readWorktreeStatus(target.worktree)
      if (after === undefined) {
        return refuse('unreadable-tree', DRIVE_COPY_REFUSALS['unreadable-tree'])
      }
      const wrote = changedSince(before, after)
      if (wrote.length > 0) {
        for (const path of wrote) logWarn(path)
        return refuseWith(
          'seed-wrote-worktree',
          DRIVE_COPY_REFUSALS['seed-wrote-worktree'],
          emitJson,
          root,
          { paths: wrote },
        )
      }
      if (run.kind === 'failed') {
        for (const line of run.stderr) logWarn(line)
        const message =
          run.error !== undefined
            ? `The seed command could not start: ${run.error}`
            : run.timedOut
              ? `The seed ran past ${SEED_TIMEOUT_MS / 1000} seconds and was stopped, so the copy holds no seeded state.`
              : DRIVE_COPY_REFUSALS['seed-failed']
        return refuseWith('seed-failed', message, emitJson, root, {
          seed: {
            ran: run.error === undefined,
            exit: run.exit,
            timedOut: run.timedOut,
            stderr: run.stderr,
            ...(run.error === undefined ? {} : { error: run.error }),
          },
        })
      }
      logInfo(`Seeded with ${seed.join(' ')}.`)
      copy = { ...copy, seed: { ran: true, exit: run.exit } }
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

  if (serve && config.kind === 'read' && config.config.serve !== undefined) {
    const served = await servePass(
      target.worktree,
      copyRoot,
      config.config,
      emitJson,
      root,
    )
    if (served.kind === 'refused') return served.exit
    copy = { ...copy, ...served.server }
  }

  outro()
  emit(copy)
  return 0
}

type ServeOutcome =
  | {
      readonly kind: 'served'
      readonly server: Record<string, unknown>
    }
  | { readonly kind: 'refused'; readonly exit: number }

/**
 * Starts the pass's server on the rebuilt copy and checks one page loads,
 * refusing as `serve-failed` or `preview-stale`. A stale page's server is
 * stopped before the refusal, so no refusal leaves a server running.
 */
async function servePass(
  worktree: string,
  copyRoot: string,
  config: PreviewConfig,
  emitJson: boolean,
  root: string,
): Promise<ServeOutcome> {
  const refused = (
    reason: DriveCopyRefusal,
    message: string,
    extra: Record<string, unknown>,
  ): ServeOutcome => ({
    kind: 'refused',
    exit: refuseWith(reason, message, emitJson, root, extra),
  })

  const offset = await readWorktreeOffset(worktree)
  if (offset.kind === 'refused') {
    logWarn(offset.detail)
    return refused('serve-failed', DRIVE_COPY_REFUSALS['serve-failed'], {
      serve: { cause: 'offset', exit: null, output: [offset.detail] },
    })
  }
  logStep('Serve')
  const started = await startPassPreview({
    worktree,
    copyRoot,
    serve: config.serve ?? [],
    env: config.env,
    basePort: config.port ?? 0,
    worktreeOffset: offset.value,
  })
  if (started.kind === 'failed') {
    logWarn(started.detail)
    for (const line of started.output) logWarn(line)
    return refused('serve-failed', DRIVE_COPY_REFUSALS['serve-failed'], {
      serve: {
        cause: started.cause,
        exit: started.exit,
        output: started.output,
      },
    })
  }

  const { url, port, pid, log } = started.server
  const health = readHealthPaths(worktree)
  const stale = await checkPassPage(
    url,
    health.kind === 'paths' ? health.paths : [],
  )
  if (stale !== undefined) {
    const ended = await stopPassPreview(copyRoot)
    logWarn(
      `${stale.path} on ${url} ${stale.status === null ? 'gave no answer' : `answered ${stale.status}`}.`,
    )
    return refused('preview-stale', DRIVE_COPY_REFUSALS['preview-stale'], {
      ...stale,
      url,
      stopped: ended.kind !== 'failed',
    })
  }
  logInfo(`Serving the copy on ${url}, pid ${pid}.`)
  return { kind: 'served', server: { url, port, pid, log } }
}
