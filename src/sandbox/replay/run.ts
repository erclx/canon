import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { gitEnv } from '@/git/env'
import { EXPECTED_FILE } from '@/sandbox/replay/expected'
import {
  findingsOf,
  judgeFormat,
  judgeStep,
  type ReplayVerdict,
  type StepOutput,
} from '@/sandbox/replay/verdict'
import { FIXTURE_SUFFIX, listFixtureFiles } from '@/sandbox/scenario'

export interface ReplaySource {
  readonly name: string
  readonly path: string
  /**
   * A snapshot is a folder of `.fixture` files with no history, committed
   * fresh in the copy. A checkout is a consumer's real repository, copied
   * whole with its history so its gitignored records come along.
   */
  readonly kind: 'snapshot' | 'checkout'
}

export interface ReplayContext {
  /** The canon checkout whose CLI, formatter, and golden config the replay runs. */
  readonly checkoutRoot: string
  /** The folder each replay's temp tree is made under, outside every repository. */
  readonly tempRoot: string
}

export interface StepResult {
  readonly step: string
  readonly argv: readonly string[]
  readonly exit: number | null
  readonly verdict: ReplayVerdict
  readonly detail?: string
  /** The `!` lines the step printed, reported whatever the verdict. */
  readonly findings: readonly string[]
}

export interface ReplayResult {
  readonly name: string
  readonly kind: ReplaySource['kind']
  readonly steps: readonly StepResult[]
  /** Paths sync added or changed, relative to the tree, sorted. */
  readonly written: readonly string[]
}

/**
 * The sync, then the reads a consumer runs after one, each `--json` read a
 * contract on its own stdout. The reads run on the unstaged result, which is
 * the state a consumer's session meets before anyone commits the sync.
 */
const CLI_STEPS: readonly { step: string; args: readonly string[] }[] = [
  { step: 'sync', args: ['sync', '.'] },
  { step: 'sync --check', args: ['sync', '--check', '.', '--json'] },
  { step: 'context audit', args: ['context', 'audit', '--json'] },
  { step: 'markdown audit', args: ['markdown', 'audit', '--json'] },
  { step: 'migrate status', args: ['migrate', 'status', '--json'] },
]

/** Each step took seconds on both consumers in the spike, so five minutes is a hang. */
const STEP_TIMEOUT_MS = 300_000

/**
 * A checkout copy skips installs at any depth and the linked worktrees other
 * sessions hold, neither of which a sync or a health read touches.
 */
function isCopied(rel: string): boolean {
  return rel.split('/').at(-1) !== 'node_modules' && rel !== '.claude/worktrees'
}

/**
 * Git's background maintenance creates and removes files such as
 * `.git/objects/maintenance.lock` while a copy walks the checkout, and a file
 * listed then gone throws ENOENT. A short bound covers every transient name
 * git uses, where a filter on `*.lock` would cover one.
 */
const COPY_ATTEMPTS = 3

export function copyCheckout(
  source: ReplaySource,
  tree: string,
  copy: typeof cpSync = cpSync,
): void {
  for (let attempt = 1; ; attempt++) {
    try {
      copy(source.path, tree, {
        recursive: true,
        verbatimSymlinks: true,
        filter: (from) => isCopied(relative(source.path, from)),
      })
      return
    } catch (error) {
      const vanished = (error as NodeJS.ErrnoException).code === 'ENOENT'
      if (!vanished || attempt === COPY_ATTEMPTS) throw error
      rmSync(tree, { recursive: true, force: true })
    }
  }
}

/**
 * Copies a source into `tree`. A snapshot's files lose their `.fixture`
 * suffix and its recorded expectation stays behind, and a checkout copies whole rather than cloning, since a clone
 * drops the gitignored `.canon/` records a consumer's health verbs read.
 */
export function copySource(source: ReplaySource, tree: string): void {
  if (source.kind === 'checkout') {
    copyCheckout(source, tree)
    return
  }

  for (const file of listFixtureFiles(source.path)) {
    if (relative(source.path, file) === EXPECTED_FILE) continue
    if (!file.endsWith(FIXTURE_SUFFIX))
      throw new Error(
        `Snapshot file missing the ${FIXTURE_SUFFIX} suffix: ${file}`,
      )
    const target = join(
      tree,
      relative(source.path, file).slice(0, -FIXTURE_SUFFIX.length),
    )
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
  }
}

/**
 * Every child gets git's resolution variables stripped, since a pre-push hook
 * exports `GIT_DIR` and a commit in the temp tree would otherwise land in the
 * canon repository running the gate.
 */
function childEnv(): NodeJS.ProcessEnv {
  return { ...gitEnv(), CANON_NON_INTERACTIVE: '1', NO_COLOR: '1' }
}

function spawn(
  command: string,
  argv: readonly string[],
  cwd: string,
  json: boolean,
): StepOutput {
  const result = spawnSync(command, argv, {
    cwd,
    env: childEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: STEP_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  })

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
    json,
  }
}

function git(tree: string, ...args: string[]): void {
  const result = spawnSync(
    'git',
    [
      '-c',
      'user.name=canon-replay',
      '-c',
      'user.email=replay@localhost',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: tree, env: childEnv(), encoding: 'utf8' },
  )
  if (result.status !== 0)
    throw new Error(
      `git ${args.join(' ')} failed in the replay tree: ${result.stderr.trim()}`,
    )
}

/** Every folder under the snapshot root, each one consumer's frozen managed paths. */
export function listSnapshots(dir: string): ReplaySource[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({ name, path: join(dir, name), kind: 'snapshot' }))
}

export interface SourceRefusal {
  readonly reason: 'not-found' | 'not-a-repo' | 'dirty'
  readonly message: string
}

/**
 * Why a named checkout cannot be replayed, or undefined when it can. A dirty
 * tree is refused rather than copied, since sync refuses one and the replay
 * would then read a tree nobody synced, reporting the refusal as a clean run.
 */
export function checkoutRefusal(path: string): SourceRefusal | undefined {
  if (!existsSync(path))
    return { reason: 'not-found', message: `No folder at ${path}` }

  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: path,
    env: childEnv(),
    encoding: 'utf8',
  })
  if (top.status !== 0 || top.stdout.trim() !== realpathSync(path))
    return {
      reason: 'not-a-repo',
      message: `${path} is not the root of a git repository`,
    }

  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: path,
    env: childEnv(),
    encoding: 'utf8',
  })
  if (status.stdout.trim() !== '')
    return {
      reason: 'dirty',
      message: `${path} has uncommitted changes. Commit or stash them, then replay it.`,
    }

  return undefined
}

/** Added, modified, and untracked paths after the sync. A deletion has nothing to format. */
function writtenPaths(tree: string): string[] {
  const result = spawnSync(
    'git',
    ['status', '--porcelain', '-z', '--untracked-files=all'],
    {
      cwd: tree,
      env: childEnv(),
      encoding: 'utf8',
    },
  )

  return result.stdout
    .split('\0')
    .filter((entry) => entry.length > 3 && !entry.slice(0, 2).includes('D'))
    .map((entry) => entry.slice(3))
    .sort()
}

/**
 * Copies one source into a fresh temp tree, syncs it with the checkout's own
 * CLI, and runs the health reads and the format check on the unstaged
 * result. The tree is removed whatever the steps conclude.
 */
export function replaySource(
  source: ReplaySource,
  context: ReplayContext,
): ReplayResult {
  mkdirSync(context.tempRoot, { recursive: true })
  const tree = mkdtempSync(join(context.tempRoot, `${source.name}-`))
  const cli = join(context.checkoutRoot, 'src', 'cli.ts')
  const steps: StepResult[] = []

  try {
    copySource(source, tree)
    if (source.kind === 'snapshot') {
      git(tree, 'init', '-q', '-b', 'main')
      git(tree, 'add', '-A')
      git(tree, 'commit', '-q', '-m', 'snapshot')
    }

    for (const { step, args } of CLI_STEPS) {
      const output = spawn('bun', [cli, ...args], tree, args.includes('--json'))
      steps.push({
        step,
        argv: ['canon', ...args],
        exit: output.status,
        ...judgeStep(output),
        findings: findingsOf(output.stderr),
      })
    }

    const written = writtenPaths(tree)
    steps.push(formatStep(context.checkoutRoot, tree, written))

    return { name: source.name, kind: source.kind, steps, written }
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
}

/**
 * Runs the checkout's oxfmt over what sync wrote, under the golden config canon
 * ships to every target rather than oxfmt's defaults, which quote YAML
 * frontmatter differently from every consumer and would fail clean files.
 */
function formatStep(
  checkoutRoot: string,
  tree: string,
  written: readonly string[],
): StepResult {
  const config = join(
    checkoutRoot,
    'tooling',
    'base',
    'configs',
    '.oxfmtrc.json',
  )
  const args = [
    '-c',
    config,
    '--check',
    '--no-error-on-unmatched-pattern',
    ...written,
  ]
  const argv = ['oxfmt', '--check', '<written>']
  if (written.length === 0)
    return { step: 'format', argv, exit: 0, verdict: 'ok', findings: [] }

  const output = spawn(oxfmtBinary(checkoutRoot), args, tree, false)

  return {
    step: 'format',
    argv,
    exit: output.status,
    ...judgeFormat(output),
    findings: [],
  }
}

function oxfmtBinary(checkoutRoot: string): string {
  return join(checkoutRoot, 'node_modules', '.bin', 'oxfmt')
}

export function hasFormatter(checkoutRoot: string): boolean {
  return existsSync(oxfmtBinary(checkoutRoot))
}
