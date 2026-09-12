import { mkdir, readdir, rm } from 'node:fs/promises'
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

/**
 * `true` when no kind's folder carries this ordinal, which means the number
 * was reserved and never claimed: a process died between `reserve` and the
 * leaf `mkdir`, or an earlier attempt in this same call lost the leaf create
 * to something other than a collision. A live reservation always has a leaf
 * folder behind it by the time another caller can observe the lock, since the
 * two happen inside one call with nothing awaited between them.
 */
async function isStale(root: string, ordinal: string): Promise<boolean> {
  const names = (
    await Promise.all(
      ORDINAL_KINDS.map((kind) => listNames(recordDir(root, kind))),
    )
  ).flat()

  return !names.some((name) => extractOrdinal(name) === ordinal)
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
