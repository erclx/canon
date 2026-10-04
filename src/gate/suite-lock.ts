import {
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { liveness, type LivenessProbes, SYSTEM_PROBES } from '@/sessions/live'
import { stateDir } from '@/targets/registry'

/**
 * Who holds a machine lock, as the file records it.
 *
 * The start time is what separates the holder from whatever inherits its pid
 * after a crash, so a takeover never waits on a recycled number.
 */
export interface LockHolder {
  readonly pid: number
  readonly procStart: string | undefined
  /** The worktree whose gate holds the lock, which the wait line names. */
  readonly root: string
}

export interface SuiteLockOptions {
  readonly path: string
  readonly root: string
  readonly pid?: number
  readonly probes?: LivenessProbes
  readonly pollMs?: number
  readonly sleep?: (ms: number) => Promise<void>
}

export interface HeldLock {
  readonly release: () => void
  /** The holder this acquirer queued behind, absent when it never waited. */
  readonly waitedOn?: LockHolder
  readonly waitedMs: number
}

export type AcquireOutcome =
  | { readonly acquired: true; readonly release: () => void }
  | { readonly acquired: false; readonly holder: LockHolder | undefined }

/**
 * The file a named machine lock lives at, resolved at call time so a test run
 * that redirects the state folder never touches the real one.
 */
export function machineLockPath(name: string): string {
  return join(stateDir(), 'locks', `${name}.lock`)
}

function isHolder(value: unknown): value is LockHolder {
  if (typeof value !== 'object' || value === null) return false
  const fields = value as Record<string, unknown>
  return typeof fields.pid === 'number' && typeof fields.root === 'string'
}

function readText(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
}

function parseHolder(text: string): LockHolder | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return isHolder(value) ? value : undefined
  } catch {
    return undefined
  }
}

function isCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code
}

/**
 * Publishes the holder's file whole or not at all.
 *
 * `link` refuses an existing name the way an exclusive open does, and the
 * linked file is already written, so no reader meets an empty lock and mistakes
 * a holder mid-write for a corrupt file it may take over.
 */
function publish(path: string, text: string, pid: number): boolean {
  const staged = `${path}.${pid}.tmp`
  writeFileSync(staged, text)
  try {
    linkSync(staged, path)
    return true
  } catch (error) {
    if (isCode(error, 'EEXIST')) return false
    throw error
  } finally {
    unlinkSync(staged)
  }
}

/**
 * Moves a dead holder's file aside, or puts back one that changed under it.
 *
 * Unlink then create is two calls, and two acquirers judging one stale file
 * would both get through. A rename moves the file to a name only this acquirer
 * uses, so only one of them gets it, and comparing what moved against what was
 * judged catches the case where another acquirer already replaced it.
 *
 * One interleaving still gets through. A third acquirer publishing between the
 * rename and the restore leaves the moved holder's file with nowhere to go, so
 * two suites run at once. That costs one oversubscribed run and never a hang,
 * and closing it needs a lock the kernel releases, which `node:fs` does not
 * offer.
 */
function displace(path: string, judged: string, pid: number): void {
  const aside = `${path}.${pid}.stale`
  try {
    renameSync(path, aside)
  } catch (error) {
    if (isCode(error, 'ENOENT')) return
    throw error
  }

  if (readText(aside) !== judged) {
    try {
      linkSync(aside, path)
    } catch (error) {
      if (!isCode(error, 'EEXIST')) throw error
    }
  }
  unlinkSync(aside)
}

/**
 * One attempt at the lock: take it free, take it over from a dead holder, or
 * report who holds it.
 */
export function tryAcquire(options: SuiteLockOptions): AcquireOutcome {
  const pid = options.pid ?? process.pid
  const probes = options.probes ?? SYSTEM_PROBES
  const own: LockHolder = {
    pid,
    procStart: probes.procStartOf(pid) ?? undefined,
    root: options.root,
  }
  const text = JSON.stringify(own)

  mkdirSync(dirname(options.path), { recursive: true })

  if (publish(options.path, text, pid)) {
    return { acquired: true, release: () => release(options.path, text) }
  }

  const judged = readText(options.path)
  if (judged === undefined) return { acquired: false, holder: undefined }

  const holder = parseHolder(judged)
  if (holder !== undefined && liveness(holder, probes).alive) {
    return { acquired: false, holder }
  }

  displace(options.path, judged, pid)

  if (publish(options.path, text, pid)) {
    return { acquired: true, release: () => release(options.path, text) }
  }
  return { acquired: false, holder: parseHolder(readText(options.path) ?? '') }
}

/** Removes the file only while it is still this holder's own. */
function release(path: string, text: string): void {
  if (readText(path) !== text) return
  try {
    unlinkSync(path)
  } catch (error) {
    if (!isCode(error, 'ENOENT')) throw error
  }
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Waits for the lock with no deadline while its holder lives. A deadline would
 * turn a long queue back into the intermittent failure the lock removes, and a
 * dead holder is taken over on the next poll rather than waited out.
 */
export async function acquireSuiteLock(
  options: SuiteLockOptions,
): Promise<HeldLock> {
  const sleep = options.sleep ?? wait
  const pollMs = options.pollMs ?? 500
  const startedAt = performance.now()
  let waitedOn: LockHolder | undefined

  for (;;) {
    const outcome = tryAcquire(options)
    if (outcome.acquired) {
      return {
        release: outcome.release,
        waitedOn,
        waitedMs: waitedOn === undefined ? 0 : performance.now() - startedAt,
      }
    }
    waitedOn = outcome.holder ?? waitedOn
    await sleep(pollMs)
  }
}
