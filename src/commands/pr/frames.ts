import type { Command } from 'commander'
import { statSync } from 'node:fs'
import { resolve } from 'node:path'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
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
import { intro, logInfo, logStep, outro, plural } from '@/cli/ui'
import {
  GH_TIMEOUT_MS,
  POSITIVE_WHOLE,
  ReadOptions,
  readIdentity,
  readRepoName,
  refuseWith,
} from '@/commands/pr/pull'

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

export function registerFrames(pr: Command): void {
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
