import { mkdir, readdir } from 'node:fs/promises'
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

/** `true` when this call won the reservation, `false` when another call holds it. */
async function reserve(root: string, ordinal: string): Promise<boolean> {
  const locks = recordDir(root, 'ordinal-locks')
  await mkdir(locks, { recursive: true })

  try {
    await mkdir(lockPath(root, ordinal), { recursive: false })
    return true
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EEXIST') return false
    throw error
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
 * reservation surfaces as `EEXIST`, and the loser re-reads the highest ordinal
 * and retries, bounded so a run of contention past what an ordinary race
 * produces surfaces as a refusal instead of a longer silent retry.
 *
 * The kind's own leaf `mkdir` still runs with `recursive: false` once the
 * reservation is won, since a recursive `mkdir` succeeds silently against a
 * directory that already exists, and a reservation held with no folder behind
 * it is a defect worth surfacing rather than papering over.
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
