import { randomUUID } from 'node:crypto'
import { open, readFile, rm, stat, utimes } from 'node:fs/promises'

/** How long a caller waits on another holder, and the age past which a lock is a dead holder's. */
export interface LockTiming {
  readonly waitMs: number
  readonly staleMs: number
}

export type Locked<T> =
  | { readonly busy: false; readonly value: T }
  | { readonly busy: true }

const POLL_MS = 50

/**
 * Runs `run` holding an exclusive lock file at `lock`, or answers busy once
 * `waitMs` passes. The holder refreshes the file every quarter of `staleMs`,
 * so only a dead holder's lock goes stale, however long `run` takes.
 */
export async function withLock<T>(
  lock: string,
  timing: LockTiming,
  run: () => Promise<T>,
): Promise<Locked<T>> {
  const token = `${process.pid}-${randomUUID()}`
  const deadline = Date.now() + timing.waitMs

  for (;;) {
    if (await createExclusive(lock, token)) break
    await clearIfStale(lock, timing.staleMs)
    if (Date.now() >= deadline) return { busy: true }
    await new Promise((settle) => setTimeout(settle, POLL_MS))
  }

  const heartbeat = setInterval(() => {
    const now = new Date()
    utimes(lock, now, now).catch(() => undefined)
  }, timing.staleMs / 4)

  try {
    return { busy: false, value: await run() }
  } finally {
    clearInterval(heartbeat)
    if ((await readToken(lock)) === token) await rm(lock, { force: true })
  }
}

/** Creates `path` holding `token`, or answers false when it already exists. */
async function createExclusive(path: string, token: string): Promise<boolean> {
  try {
    const handle = await open(path, 'wx')
    await handle.writeFile(token)
    await handle.close()
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
}

async function readToken(path: string): Promise<string | undefined> {
  return readFile(path, 'utf8').catch(() => undefined)
}

/**
 * Removes a stale lock under a second, short-lived break lock after re-reading
 * its token, so of two waiters seeing one stale lock, the later never deletes
 * the fresh lock the earlier one took in its place.
 */
async function clearIfStale(lock: string, staleMs: number): Promise<void> {
  const seen = await readToken(lock)
  if (seen === undefined || !(await isStale(lock, staleMs))) return

  const breaker = `${lock}.break`
  if (!(await createExclusive(breaker, seen))) {
    if (await isStale(breaker, staleMs)) await rm(breaker, { force: true })
    return
  }

  try {
    if ((await readToken(lock)) === seen && (await isStale(lock, staleMs))) {
      await rm(lock, { force: true })
    }
  } finally {
    await rm(breaker, { force: true })
  }
}

async function isStale(path: string, staleMs: number): Promise<boolean> {
  const modified = (await stat(path).catch(() => undefined))?.mtimeMs
  return modified !== undefined && Date.now() - modified > staleMs
}
