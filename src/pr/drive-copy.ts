import { spawn } from 'node:child_process'
import {
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { execa } from 'execa'

/** Where a project names the folders its running preview saves into. */
export const PREVIEW_CONFIG_REL = join('canon', 'config', 'preview.json')

/** The variable a preview server reads for the copy root when the project names none. */
export const DEFAULT_PREVIEW_ENV = 'CANON_PREVIEW_ROOT'

/** How long a seed may run before the rebuild stops it and refuses. */
export const SEED_TIMEOUT_MS = 120_000

/** How many trailing stderr lines a failed seed carries on the record. */
const SEED_STDERR_LINES = 20

/** The type vocabulary of `git-branch`'s branch standard, which the slug transform drops. */
const BRANCH_TYPES = new Set([
  'feat',
  'fix',
  'refactor',
  'docs',
  'chore',
  'perf',
  'test',
  'style',
  'build',
  'ci',
  'revert',
])

export interface PreviewConfig {
  readonly writes: readonly string[]
  readonly env: string
  /** Paths inside a declared path that a rebuild leaves as the server wrote them. */
  readonly keep: readonly string[]
  /**
   * An argv list, spawned with no shell, that lays state into the copy after
   * each rebuild. Absent when the project declares none.
   */
  readonly seed?: readonly string[]
  /**
   * An argv list, spawned with no shell and detached, that starts a fresh
   * server on the copy for one UI pass. Absent when the project declares none.
   */
  readonly serve?: readonly string[]
  /** The port the project's server takes before the worktree offset is added. */
  readonly port?: number
}

export type PreviewConfigRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'read'; readonly config: PreviewConfig }
  | {
      readonly kind: 'refused'
      readonly reason: 'bad-config' | 'unsafe-path'
      readonly detail: string
    }

/**
 * The branch-to-slug transform every branch-derived name shares: a leading type
 * segment comes off when a further one follows, and each `/` becomes `-`. The
 * worker and the reviewer both land on the same folder through this one function.
 */
export function branchSlug(branch: string): string {
  const segments = branch.split('/')
  const rest =
    segments.length > 1 && BRANCH_TYPES.has(segments[0] ?? '')
      ? segments.slice(1)
      : segments
  return rest.join('-')
}

function isContained(path: string): boolean {
  return (
    path.length > 0 && !isAbsolute(path) && !path.split(/[\\/]/).includes('..')
  )
}

/** Whether `path` is `parent` or stands below it, both relative to one root. */
function isWithin(path: string, parent: string): boolean {
  const rel = relative(join('/', parent), join('/', path))
  return (
    rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  )
}

/** An argv list opening on a non-empty command. */
function isArgv(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string') &&
    (value[0] ?? '') !== ''
  )
}

/**
 * Reads `canon/config/preview.json`, refusing rather than reading as absent on a
 * bad parse, a path leaving the worktree, a `keep` outside or equal to a `writes`
 * path, or a `serve` with no `port` to wait on.
 */
export function loadPreviewConfig(worktree: string): PreviewConfigRead {
  const path = join(worktree, PREVIEW_CONFIG_REL)
  if (!existsSync(path)) return { kind: 'absent' }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} does not parse as JSON.`,
    }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} is not an object.`,
    }
  }

  const {
    writes,
    env,
    keep = [],
    seed,
    serve,
    port,
  } = parsed as Record<string, unknown>
  if (
    !Array.isArray(writes) ||
    !writes.every((item): item is string => typeof item === 'string')
  ) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} carries no "writes" list of paths.`,
    }
  }
  if (
    !Array.isArray(keep) ||
    !keep.every((item): item is string => typeof item === 'string')
  ) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "keep" that is not a list of paths.`,
    }
  }
  if (env !== undefined && (typeof env !== 'string' || env === '')) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names an "env" that is not a variable name.`,
    }
  }

  if (seed !== undefined && !isArgv(seed)) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "seed" that is not a list opening on a command.`,
    }
  }

  if (serve !== undefined && !isArgv(serve)) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "serve" that is not a list opening on a command.`,
    }
  }
  if (
    port !== undefined &&
    (typeof port !== 'number' ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65_535)
  ) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "port" that is not a whole number from 1 to 65535.`,
    }
  }
  if (serve !== undefined && port === undefined) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} names a "serve" with no "port", so a started server has no address to wait on.`,
    }
  }

  const unsafe = [...writes, ...keep].find((item) => !isContained(item))
  if (unsafe !== undefined) {
    return {
      kind: 'refused',
      reason: 'unsafe-path',
      detail: `${PREVIEW_CONFIG_REL} names "${unsafe}", which leaves the worktree.`,
    }
  }

  const stray = keep.find(
    (item) => !writes.some((path) => isWithin(item, path)),
  )
  if (stray !== undefined) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} keeps "${stray}", which no "writes" path holds.`,
    }
  }

  const clash = keep.find((item) =>
    writes.some((path) => isWithin(item, path) && isWithin(path, item)),
  )
  if (clash !== undefined) {
    return {
      kind: 'refused',
      reason: 'bad-config',
      detail: `${PREVIEW_CONFIG_REL} keeps "${clash}", which is also a "writes" path, so the rebuild would never reset it.`,
    }
  }

  return {
    kind: 'read',
    config: {
      writes,
      env: env ?? DEFAULT_PREVIEW_ENV,
      keep,
      ...(seed === undefined ? {} : { seed }),
      ...(serve === undefined ? {} : { serve }),
      ...(port === undefined ? {} : { port }),
    },
  }
}

/**
 * Removes `target` except the `keep` paths at or below it, where `rel` is
 * `target` relative to the root `keep` is read against. A folder holding a
 * kept path is emptied around it rather than removed.
 */
function clearAround(
  target: string,
  rel: string,
  keep: readonly string[],
): void {
  if (keep.includes(rel)) return
  const stat = lstatSync(target, { throwIfNoEntry: false })
  if (stat === undefined) return
  if (!stat.isDirectory() || !keep.some((path) => isWithin(path, rel))) {
    rmSync(target, { recursive: true, force: true })
    return
  }
  for (const entry of readdirSync(target)) {
    clearAround(join(target, entry), join(rel, entry), keep)
  }
}

/**
 * Resets each declared path in the copy from the worktree, so a pass's drives
 * never reach the next, and leaves everything else as it is. A `keep` path inside
 * a declared one is neither cleared nor copied, and a path the worktree lacks is named.
 */
export function buildDriveCopy(
  worktree: string,
  copyRoot: string,
  writes: readonly string[],
  keep: readonly string[] = [],
): { readonly copied: readonly string[]; readonly missing: readonly string[] } {
  const kept = keep.map((path) => relative(worktree, join(worktree, path)))
  const copied: string[] = []
  const missing: string[] = []
  for (const path of writes) {
    const source = join(worktree, path)
    clearAround(join(copyRoot, path), relative(worktree, source), kept)
    if (!existsSync(source)) {
      missing.push(path)
      continue
    }
    cpSync(source, join(copyRoot, path), {
      recursive: true,
      filter: (item) => !kept.includes(relative(worktree, item)),
    })
    copied.push(path)
  }
  return { copied, missing }
}

export type SeedRun =
  | { readonly kind: 'ran'; readonly exit: 0 }
  | {
      readonly kind: 'failed'
      readonly exit: number | null
      readonly timedOut: boolean
      readonly stderr: readonly string[]
      /** Why the seed never started, such as a command not on `PATH`. */
      readonly error?: string
    }

/**
 * Runs a project's seed against a rebuilt copy, from the worktree with the copy
 * root in `env`. The child's stdout goes to stderr, since stdout carries the
 * JSON record, and argv is spawned with no shell so metacharacters run as written.
 */
export async function runSeed(
  worktree: string,
  copyRoot: string,
  seed: readonly string[],
  env: string,
  timeoutMs: number = SEED_TIMEOUT_MS,
): Promise<SeedRun> {
  const [command = '', ...args] = seed
  // The seed leads its own process group, since a grandchild under `sh -c` escapes execa's `timeout`.
  const subprocess = execa(command, args, {
    cwd: worktree,
    env: { [env]: copyRoot },
    stdin: 'ignore',
    stdout: 2,
    stderr: ['pipe', 'inherit'],
    detached: true,
    reject: false,
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    if (subprocess.pid === undefined) return
    try {
      process.kill(-subprocess.pid, 'SIGKILL')
    } catch {
      // The group already exited between the limit and the signal.
    }
  }, timeoutMs)
  const result = await subprocess
  clearTimeout(timer)
  if (result.exitCode === 0 && !timedOut) return { kind: 'ran', exit: 0 }
  const stderr = (result.stderr ?? '').split('\n')
  while (stderr.length > 0 && stderr.at(-1)?.trim() === '') stderr.pop()
  return {
    kind: 'failed',
    exit: result.exitCode ?? null,
    timedOut,
    stderr: stderr.slice(-SEED_STDERR_LINES),
    ...(result.exitCode === undefined && result.signal === undefined
      ? { error: result.originalMessage ?? result.shortMessage }
      : {}),
  }
}

/** The helper a project installs to derive each worktree's port offset. */
export const WORKTREE_PORT_SCRIPT = join('scripts', 'worktree-port.sh')

export type WorktreeOffset =
  | { readonly kind: 'offset'; readonly value: number }
  | { readonly kind: 'refused'; readonly detail: string }

/**
 * The offset the project's port helper derives for `worktree`, run from that
 * tree with a base of 0 so the helper stays the one owner of the rule and its
 * `WORKTREE_PORT_OFFSET` override. A project with no helper serves at offset 0.
 */
export async function readWorktreeOffset(
  worktree: string,
  env: Readonly<Record<string, string>> = {},
): Promise<WorktreeOffset> {
  if (!existsSync(join(worktree, WORKTREE_PORT_SCRIPT))) {
    return { kind: 'offset', value: 0 }
  }
  const result = await execa('bash', [WORKTREE_PORT_SCRIPT, '0'], {
    cwd: worktree,
    env,
    stdin: 'ignore',
    reject: false,
  })
  const printed = result.stdout.trim()
  if (result.exitCode === 0 && /^\d+$/.test(printed)) {
    return { kind: 'offset', value: Number(printed) }
  }
  const detail = result.stderr.trim()
  return {
    kind: 'refused',
    detail:
      detail === ''
        ? `${WORKTREE_PORT_SCRIPT} printed "${printed}" and exited ${result.exitCode ?? 'on a signal'}.`
        : detail,
  }
}

/** How long a pass's server may take to answer HTTP, since a first dependency optimize runs long. */
export const SERVE_TIMEOUT_MS = 60_000

/** Added to the worktree's own offset: half the 50-port band the helper gives each worktree. */
export const PASS_OFFSET_SHIFT = 25

const STOP_GRACE_MS = 5_000
const PAGE_TIMEOUT_MS = 10_000
const SERVER_RECORD = 'server.json'
const SERVER_LOG = 'server.log'

export interface PassServer {
  readonly pid: number
  readonly port: number
  readonly url: string
  /** Where the server's stdout and stderr go, since a pipe would close when this process exits. */
  readonly log: string
}

interface ServerRecord extends PassServer {
  /** The leader's start time as `ps` prints it, so a recycled pid is never signalled. */
  readonly started?: string
}

export type PassStart =
  | { readonly kind: 'started'; readonly server: PassServer }
  | {
      readonly kind: 'failed'
      readonly cause: 'port-taken' | 'spawn' | 'exited' | 'timeout'
      readonly exit: number | null
      readonly output: readonly string[]
      readonly detail: string
    }

export type PassStop =
  | { readonly kind: 'stopped'; readonly pid: number; readonly port: number }
  | { readonly kind: 'not-running' }
  | {
      readonly kind: 'failed'
      readonly pid: number
      readonly port: number
      readonly detail: string
    }

export interface PassStartInput {
  readonly worktree: string
  readonly copyRoot: string
  readonly serve: readonly string[]
  /** The variable the server reads for the copy root. */
  readonly env: string
  readonly basePort: number
  readonly worktreeOffset: number
  readonly timeoutMs?: number
}

function recordPath(copyRoot: string): string {
  return join(dirname(copyRoot), SERVER_RECORD)
}

function isGroupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch {
    // The group exited between the read and the signal.
  }
}

async function leaderStart(pid: number): Promise<string | undefined> {
  const result = await execa('ps', ['-o', 'lstart=', '-p', String(pid)], {
    stdin: 'ignore',
    reject: false,
  })
  const text = result.stdout.trim()
  return result.exitCode === 0 && text !== '' ? text : undefined
}

/** Ends every process in the group, TERM first and KILL after the grace, and reports whether none is left. */
async function endGroup(pid: number): Promise<boolean> {
  for (const signal of ['SIGTERM', 'SIGKILL'] as const) {
    signalGroup(pid, signal)
    const deadline = Date.now() + STOP_GRACE_MS
    while (isGroupAlive(pid) && Date.now() < deadline) await sleep(100)
    if (!isGroupAlive(pid)) return true
  }
  return false
}

async function isPortOpen(port: number): Promise<boolean> {
  const reads = ['127.0.0.1', '::1'].map(
    (host) =>
      new Promise<boolean>((resolve) => {
        const socket = createConnection({ host, port })
        socket.setTimeout(1_000)
        socket.once('connect', () => {
          socket.destroy()
          resolve(true)
        })
        socket.once('timeout', () => {
          socket.destroy()
          resolve(false)
        })
        socket.once('error', () => resolve(false))
      }),
  )
  return (await Promise.all(reads)).some(Boolean)
}

/** The final status `path` answers after redirects, or null when nothing answers inside the timeout. */
async function statusOf(
  url: string,
  path: string,
  timeoutMs: number,
): Promise<number | null> {
  try {
    const response = await fetch(`${url}${path}`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    await response.body?.cancel()
    return response.status
  } catch {
    return null
  }
}

function logTail(log: string): readonly string[] {
  const lines = existsSync(log) ? readFileSync(log, 'utf8').split('\n') : []
  while (lines.length > 0 && lines.at(-1)?.trim() === '') lines.pop()
  return lines.slice(-SEED_STDERR_LINES)
}

function readServerRecord(path: string): ServerRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { pid, port } = parsed as Record<string, unknown>
    return Number.isInteger(pid) && Number(pid) > 0 && Number.isInteger(port)
      ? (parsed as ServerRecord)
      : undefined
  } catch {
    return undefined
  }
}

interface ServeExit {
  readonly code: number | null
  readonly error?: string
}

/**
 * Starts `serve` detached on the copy at the worktree's offset plus the shift and
 * waits for HTTP there. It never binds beside a port that already answers, and
 * on every failure it ends what it started and forgets it.
 */
export async function startPassPreview(
  input: PassStartInput,
): Promise<PassStart> {
  const offset = input.worktreeOffset + PASS_OFFSET_SHIFT
  const port = input.basePort + offset
  const url = `http://localhost:${port}`
  if (await isPortOpen(port)) {
    return {
      kind: 'failed',
      cause: 'port-taken',
      exit: null,
      output: [],
      detail: `Port ${port} already answers, so the pass's server would bind beside another server.`,
    }
  }

  const record = recordPath(input.copyRoot)
  const log = join(dirname(record), SERVER_LOG)
  const fd = openSync(log, 'w')
  const [command = '', ...args] = input.serve
  const child = spawn(command, args, {
    cwd: input.worktree,
    env: {
      ...process.env,
      [input.env]: input.copyRoot,
      WORKTREE_PORT_OFFSET: String(offset),
    },
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  closeSync(fd)
  let ended: ServeExit | undefined
  const exited = new Promise<ServeExit>((resolve) => {
    child.once('error', (error) =>
      resolve({ code: null, error: error.message }),
    )
    child.once('exit', (code) => resolve({ code }))
  }).then((exit) => (ended = exit))

  const pid = child.pid
  if (pid === undefined) {
    const exit = await exited
    return {
      kind: 'failed',
      cause: 'spawn',
      exit: null,
      output: logTail(log),
      detail: `The serve command could not start: ${exit.error ?? command}`,
    }
  }
  const server: PassServer = { pid, port, url, log }
  const started = await leaderStart(pid)
  writeFileSync(
    record,
    `${JSON.stringify({ ...server, ...(started === undefined ? {} : { started }) })}\n`,
  )

  const deadline = Date.now() + (input.timeoutMs ?? SERVE_TIMEOUT_MS)
  while (ended === undefined && Date.now() < deadline) {
    if ((await statusOf(url, '/', 2_000)) !== null) {
      child.unref()
      return { kind: 'started', server }
    }
    await sleep(250)
  }

  // Read before the kill, whose own exit event would otherwise read as an early exit.
  const exit = ended
  await endGroup(pid)
  rmSync(record, { force: true })
  const output = logTail(log)
  return exit === undefined
    ? {
        kind: 'failed',
        cause: 'timeout',
        exit: null,
        output,
        detail: `Nothing answered on ${url} within ${(input.timeoutMs ?? SERVE_TIMEOUT_MS) / 1000} seconds, so the server was stopped.`,
      }
    : {
        kind: 'failed',
        cause: 'exited',
        exit: exit.code,
        output,
        detail: `The serve command exited before ${url} answered.`,
      }
}

/**
 * Ends the server the last start recorded beside the copy root, its whole
 * process group, and forgets it. A record whose group is gone, or whose pid now
 * leads another process, reads as not running and is never signalled.
 */
export async function stopPassPreview(copyRoot: string): Promise<PassStop> {
  const path = recordPath(copyRoot)
  if (!existsSync(path)) return { kind: 'not-running' }
  const record = readServerRecord(path)
  const leader =
    record === undefined ? undefined : await leaderStart(record.pid)
  const ours =
    record !== undefined &&
    isGroupAlive(record.pid) &&
    (record.started === undefined ||
      leader === undefined ||
      leader === record.started)
  if (!ours) {
    rmSync(path, { force: true })
    return { kind: 'not-running' }
  }
  const { pid, port } = record
  if (!(await endGroup(pid))) {
    return {
      kind: 'failed',
      pid,
      port,
      detail: `Process group ${pid} survived TERM and KILL, so the server on port ${port} may still answer.`,
    }
  }
  rmSync(path, { force: true })
  return { kind: 'stopped', pid, port }
}

/**
 * Whether the pass's page is fresh: `/` answering inside the timeout with no
 * 5xx, and each declared health path answering 2xx. Returns the first failing
 * path, with a null status for no answer, or undefined when every one passes.
 */
export async function checkPassPage(
  url: string,
  healthPaths: readonly string[],
): Promise<
  { readonly path: string; readonly status: number | null } | undefined
> {
  const root = await statusOf(url, '/', PAGE_TIMEOUT_MS)
  if (root === null || root >= 500) return { path: '/', status: root }
  for (const path of healthPaths) {
    const status = await statusOf(url, path, PAGE_TIMEOUT_MS)
    if (status === null || status < 200 || status >= 300) {
      return { path, status }
    }
  }
  return undefined
}
