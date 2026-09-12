import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { extractOrdinal } from '@/intake/folder'
import { recordDir } from '@/record-root'

/**
 * The two record folders that share one ordinal sequence, per
 * `standards/intake.md` and `standards/groundwork.md`. A folder opened as
 * either kind blocks the same number for the other, so the two read together
 * rather than each keeping a count of its own.
 */
export const ORDINAL_KINDS = ['intake', 'groundwork'] as const

export type OrdinalKind = (typeof ORDINAL_KINDS)[number]

export function isOrdinalKind(value: string): value is OrdinalKind {
  return (ORDINAL_KINDS as readonly string[]).includes(value)
}

const ORDINAL_WIDTH = 2

/** Bounds the retry loop below. A fifth collision in a row is not a race. */
const MAX_ATTEMPTS = 5

/**
 * How long a reservation with no leaf folder behind it stays live before
 * `reserve` will clear it.
 *
 * An ordinary claim reserves the number and creates its leaf folder with
 * nothing awaited in between, so it finishes in milliseconds. The threshold
 * only has to clear that by a wide margin, not bound it tightly: reading a
 * genuinely abandoned lock as live costs one retry, while reading one still
 * in flight as abandoned reopens the exact duplicate this recovery exists to
 * close, so the cost of guessing too short is the one that matters here.
 */
const STALE_LOCK_MS = 5 * 60 * 1000

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

async function listNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return []
    throw error
  }
}

/**
 * The highest ordinal already claimed across both `.canon/intake/` and
 * `.canon/groundwork/`, or `0` with neither folder holding an entry.
 */
export async function highestOrdinal(root: string): Promise<number> {
  const names = (
    await Promise.all(
      ORDINAL_KINDS.map((kind) => listNames(recordDir(root, kind))),
    )
  ).flat()

  return names
    .map((name) => extractOrdinal(name))
    .filter((ordinal) => ordinal !== '')
    .map(Number)
    .reduce((carry, ordinal) => Math.max(carry, ordinal), 0)
}

function pad(ordinal: number): string {
  return String(ordinal).padStart(ORDINAL_WIDTH, '0')
}

/**
 * Where a number is reserved ahead of creating either kind's own folder.
 *
 * The two kinds share one sequence but not one directory, so a leaf `mkdir`
 * under `intake/` and one under `groundwork/` never collide with each other
 * even when both land on the same number in the same instant, which is the
 * race this verb exists to close. Reserving the number itself, at a path both
 * calls resolve to regardless of kind, is what makes the two contend on the
 * same `mkdir`.
 */
function lockPath(root: string, ordinal: string): string {
  return recordDir(root, 'ordinal-locks', ordinal)
}

async function isBacked(root: string, ordinal: string): Promise<boolean> {
  const names = (
    await Promise.all(
      ORDINAL_KINDS.map((kind) => listNames(recordDir(root, kind))),
    )
  ).flat()

  return names.some((name) => extractOrdinal(name) === ordinal)
}

/**
 * `undefined` when the lock is already gone, otherwise how long ago it was
 * created. The lock directory is never written to after its `mkdir`, so its
 * `mtime` is its creation time.
 */
async function lockAgeMs(dir: string): Promise<number | undefined> {
  try {
    const info = await stat(dir)
    return Date.now() - info.mtimeMs
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * `true` when a lock carries no leaf folder in either kind and is old enough
 * that an ordinary claim could not still be in flight.
 *
 * No backing folder alone is not enough: `claimOrdinal` awaits the leaf
 * `mkdir` after `reserve` returns, so a second process can observe another's
 * lock in that exact gap, with no folder behind it yet even though the first
 * process is seconds from creating one. Reading that gap as abandoned lets
 * both processes land a leaf folder at the same ordinal under their own
 * kind, which never collide with each other, reopening the race this verb
 * exists to close. Requiring the lock to also be older than `STALE_LOCK_MS`
 * is what keeps that window from being read as abandoned.
 */
async function isStale(root: string, ordinal: string): Promise<boolean> {
  if (await isBacked(root, ordinal)) return false

  const age = await lockAgeMs(lockPath(root, ordinal))
  return age !== undefined && age >= STALE_LOCK_MS
}

/**
 * `true` when this call won the reservation, `false` when another call holds
 * a live one.
 *
 * A lock already held is read against the kind folders before it is read as
 * contention. Reserving and creating the leaf folder are two acts rather than
 * one, so a process killed in between leaves a lock with nothing behind it,
 * and a caller walking that lock as ordinary contention would refuse every
 * later claim as `ordinal-contended` on a cause that was never contention.
 * Clearing a stale lock and retrying the same number is what keeps that dead
 * reservation from costing every claim that follows it.
 */
async function reserve(root: string, ordinal: string): Promise<boolean> {
  const locks = recordDir(root, 'ordinal-locks')
  await mkdir(locks, { recursive: true })

  const dir = lockPath(root, ordinal)

  try {
    await mkdir(dir, { recursive: false })
    return true
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'EEXIST') throw error
    if (!(await isStale(root, ordinal))) return false

    await rm(dir, { recursive: true, force: true })

    try {
      await mkdir(dir, { recursive: false })
      return true
    } catch (retryError) {
      if (isErrnoException(retryError) && retryError.code === 'EEXIST') {
        return false
      }
      throw retryError
    }
  }
}

export const ORDINAL_REFUSALS = ['ordinal-contended'] as const

export type OrdinalRefusal = (typeof ORDINAL_REFUSALS)[number]

export interface Claimed {
  readonly ok: true
  readonly kind: OrdinalKind
  readonly slug: string
  readonly ordinal: string
  readonly name: string
  readonly path: string
}

export interface ClaimRefused {
  readonly ok: false
  readonly reason: OrdinalRefusal
  readonly message: string
  readonly lastOrdinal: string
}

export type ClaimOutcome = Claimed | ClaimRefused

/**
 * Computes the next ordinal and creates `.canon/<kind>/<nn>-<slug>/` in one
 * act, so no window sits between the read and the create for a second session
 * to land in, whichever kind that session is claiming.
 *
 * The reservation is what does the serializing: it is the one `mkdir` both an
 * `intake` claim and a `groundwork` claim resolve to the same path for when
 * they land on the same number, where the two kinds' own leaf folders never
 * share a path and so never collide with each other directly. A losing
 * reservation surfaces as `EEXIST`, `reserve` tells a live one from a stale
 * one left by a process that died before its own leaf create ran, and the
 * loser on a live one re-reads the highest ordinal and retries, bounded so a
 * run of contention past what an ordinary race produces surfaces as a refusal
 * instead of a longer silent retry.
 *
 * The kind's own leaf `mkdir` still runs with `recursive: false` once the
 * reservation is won, since a recursive `mkdir` succeeds silently against a
 * directory that already exists, and this call's own reservation ending up
 * stale is exactly the case the staleness check above exists to recover.
 */
export async function claimOrdinal(
  root: string,
  kind: OrdinalKind,
  slug: string,
): Promise<ClaimOutcome> {
  const parent = recordDir(root, kind)
  await mkdir(parent, { recursive: true })

  let lastOrdinal = ''

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ordinal = pad((await highestOrdinal(root)) + 1)
    lastOrdinal = ordinal

    if (!(await reserve(root, ordinal))) continue

    const name = `${ordinal}-${slug}`
    const dir = recordDir(root, kind, name)
    await mkdir(dir, { recursive: false })
    return { ok: true, kind, slug, ordinal, name, path: dir }
  }

  return {
    ok: false,
    reason: 'ordinal-contended',
    message: `${MAX_ATTEMPTS} claims collided in a row, last at ${lastOrdinal}. That is more than an ordinary race, so this stops rather than retrying further.`,
    lastOrdinal,
  }
}
