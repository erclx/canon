import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DISPATCH_SHIM = fileURLToPath(
  new URL('dispatch-shim.sh', import.meta.url),
)

/*
 * The bound on a nested background dispatch and the recording behind it, since
 * a dispatched `claude --bg` session writes where the `watch.ts` watches never
 * read. The three mechanisms sit here so `dispatch.test.ts` can drive them without spawning the real thing.
 */

/**
 * The prevention. Writes a `claude` that refuses a background dispatch by flag
 * name and delegates everything else, placed first on the session's PATH. The
 * real binary is baked in rather than passed by env var, which would hand an arm the string that walks around the shim.
 */
export function installDispatchShim(dir: string, real: string): void {
  const wrapper = [
    '#!/usr/bin/env bash',
    `exec bash ${shellQuote(DISPATCH_SHIM)} ${shellQuote(real)} "$@"`,
    '',
  ].join('\n')

  writeFileSync(join(dir, 'claude'), wrapper, 'utf8')
  chmodSync(join(dir, 'claude'), 0o755)
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** The process group `pid` belongs to, or undefined once it has exited. */
export function processGroupOf(pid: number): string | undefined {
  const ps = spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], {
    encoding: 'utf8',
  })
  const pgid = (ps.stdout ?? '').trim()

  return pgid === '' ? undefined : pgid
}

/**
 * True while any live process still carries this group id, reading the whole
 * table rather than `ps -g`. A zombie does not count, since the wait below blocks
 * the loop that would collect it and signal 0 alone would call a dead group a survivor.
 */
function processGroupAlive(pgid: number): boolean {
  const ps = spawnSync('ps', ['-eo', 'pgid=,stat='], { encoding: 'utf8' })

  return (ps.stdout ?? '').split('\n').some((line) => {
    const [group, stat] = line.trim().split(/\s+/)
    return group === String(pgid) && stat !== undefined && !stat.startsWith('Z')
  })
}

/**
 * Five seconds per signal. A shorter window reports a survivor for a process
 * that was already exiting, and a longer one stalls a run whose verdict is
 * already taken.
 */
function waitForGroupExit(pgid: number): void {
  for (let waited = 0; waited < 20 && processGroupAlive(pgid); waited++)
    Bun.sleepSync(250)
}

export type ReapState =
  | 'clear'
  | 'reaped-term'
  | 'reaped-kill'
  | 'survived'
  | 'refused-own-group'

/**
 * The backstop. Signals a process group the runner created, escalating, and
 * returns its outcome without throwing. Synchronous, so a signal handler can
 * run it. It refuses its own group and cannot reach a `setsid` dispatch, which the shim covers.
 */
export function reapProcessGroup(pgid: number): ReapState {
  if (String(pgid) === processGroupOf(process.pid)) return 'refused-own-group'
  if (!processGroupAlive(pgid)) return 'clear'

  signalGroup(pgid, 'SIGTERM')
  waitForGroupExit(pgid)
  if (!processGroupAlive(pgid)) return 'reaped-term'

  signalGroup(pgid, 'SIGKILL')
  waitForGroupExit(pgid)

  return processGroupAlive(pgid) ? 'survived' : 'reaped-kill'
}

function signalGroup(pgid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pgid, signal)
  } catch {
    // The group emptied between the liveness read and the signal.
  }
}

/**
 * The client's own session registry, the only surface a nested dispatch leaves a
 * trace on that this harness can read. It carries no contract, so what reads it
 * reports rather than asserts.
 */
export function sessionsDir(env: NodeJS.ProcessEnv = process.env): string {
  const config = env.CLAUDE_CONFIG_DIR
  const base =
    config !== undefined && config !== ''
      ? config
      : join(env.HOME || homedir(), '.claude')

  return join(base, 'sessions')
}

export interface SessionSnapshot {
  /** Record names, sorted. */
  readonly names: readonly string[]
  /**
   * The registry directory existed. An absent registry produces the same empty
   * list a quiet run does, and the two mean opposite things, so the report
   * carries this rather than letting an unwatched run read as a clean one.
   */
  readonly isWatched: boolean
}

/**
 * Record names only, never hashes, since a live session rewrites its record on
 * every status change and a content manifest would name every session running
 * beside this one. A record appearing between the snapshots started during the run.
 */
export function snapshotSessions(dir: string): SessionSnapshot {
  if (!existsSync(dir)) return { names: [], isWatched: false }

  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()

  return { names, isWatched: true }
}

/**
 * The new side alone, unlike `writesBetween`. A record that vanished is a
 * session that ended and a record that changed is one that was already
 * running, and neither is a dispatch this run made.
 */
export function sessionsBetween(
  before: SessionSnapshot,
  after: SessionSnapshot,
): string[] {
  const seen = new Set(before.names)

  return after.names.filter((name) => !seen.has(name))
}

/**
 * The side `sessionsBetween` drops. A record present on both sides was already
 * running, which rules it out as this run's dispatch and in as a witness to a write.
 */
export function sessionsConcurrent(
  before: SessionSnapshot,
  after: SessionSnapshot,
): string[] {
  const seen = new Set(before.names)

  return after.names.filter((name) => seen.has(name))
}

/**
 * Turns a record name into a line a person can act on. An unreadable record still
 * reports its name, since the file can be gone. One record is one line, since a
 * newline in a peer-written name would split it across two entries.
 */
export function describeSession(dir: string, name: string): string {
  let record: unknown
  try {
    record = JSON.parse(readFileSync(join(dir, name), 'utf8'))
  } catch {
    return `${name}: record already gone`
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record))
    return `${name}: record already gone`

  const fields = record as Record<string, unknown>
  const label = (value: unknown, fallback: string): string =>
    value === undefined || value === null || value === false
      ? fallback
      : typeof value === 'string'
        ? value
        : JSON.stringify(value)
  const desc = `${label(fields.name, 'unnamed')} in ${label(fields.cwd, 'an unrecorded directory')}`

  return `${name}: ${desc.replace(/\s+/g, ' ')}`
}
