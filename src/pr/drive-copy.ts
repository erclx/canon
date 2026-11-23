import {
  cpSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
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
 * Reads `canon/config/preview.json` as `{ "writes", "keep", "env", "seed",
 * "serve", "port" }`. A `serve` needs a `port`, since that is the address a
 * started server is waited on at. It
 * refuses a file that does not parse, a path absolute or climbing with `..`, and
 * a `keep` path outside, or equal to, a `writes` path, never reading as absent.
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
