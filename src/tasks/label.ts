import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { recordDir } from '@/roots/record'
import { callerIdentity } from '@/sessions/resolve'
import {
  archiveDir,
  declinedDir,
  listTaskStems,
  tasksDir,
} from '@/tasks/archive'

/** Every label in the corpus today stops here before rolling to the next major. */
const MINOR_ROLLOVER = 9

/** The label a board with no live or archived task yet allocates first. */
const FIRST_LABEL: Label = { major: 1, minor: 0 }

/**
 * Matches a task filename stem's leading label. Anchored, so a sibling such as
 * `TASK-ARCHIVE` fails it, and `listTaskStems` already filters reserved stems
 * such as `index` before this pattern sees a stem.
 */
export const LABEL_PATTERN = /^v(\d+)\.(\d+)-/

/** A reservation is named by the bare label, with no slug behind it. */
const RESERVATION_PATTERN = /^v(\d+)\.(\d+)$/

/** Bounds the claim loop. A fifth loss in a row is not a race. */
const MAX_ATTEMPTS = 5

/** The owner file each claim writes inside its lock directory. */
const OWNER_FILE = 'claim.json'

interface Label {
  readonly major: number
  readonly minor: number
}

export interface NextLabel {
  readonly ok: true
  readonly label: string
  /** The label this run was derived from, absent when neither folder holds one. */
  readonly highest: string | undefined
  /** Whether this label was reserved on disk rather than only read. */
  readonly claimed: boolean
  /**
   * Each label lock above the highest task label, the only ones that move the
   * next label, read after this run's own claim and release.
   */
  readonly reservations: readonly Reservation[]
  /** The labels this run freed as dead claims. A bare read frees none. */
  readonly released: readonly string[]
}

export interface Reservation {
  readonly label: string
  /** The session that claimed it, null for a lock that predates the owner file or a claim from outside a session. */
  readonly sessionId: string | null
  readonly claimedAt: string | null
}

export interface LabelRefused {
  readonly ok: false
  readonly reason: 'no-board' | 'label-contended'
  readonly message: string
}

export type LabelOutcome = NextLabel | LabelRefused

function parseLabel(
  stem: string,
  pattern: RegExp = LABEL_PATTERN,
): Label | undefined {
  const match = pattern.exec(stem)
  if (!match) return undefined

  return { major: Number(match[1]), minor: Number(match[2]) }
}

function isHigher(candidate: Label, current: Label): boolean {
  return candidate.major !== current.major
    ? candidate.major > current.major
    : candidate.minor > current.minor
}

function formatLabel(label: Label): string {
  return `v${String(label.major).padStart(2, '0')}.${label.minor}`
}

/**
 * The label after the one given, rolling a minor of 9 to the next major rather
 * than continuing to a second minor digit. Every label on the live board and
 * its archive stops at a single digit, so this follows the corpus.
 */
function next(label: Label): Label {
  return label.minor >= MINOR_ROLLOVER
    ? { major: label.major + 1, minor: 0 }
    : { major: label.major, minor: label.minor + 1 }
}

function noBoard(root: string, dir: string): LabelRefused {
  return {
    ok: false,
    reason: 'no-board',
    message: `No task board at ${relative(root, dir)}.`,
  }
}

function reservationsDir(root: string): string {
  return recordDir(root, 'ordinal-locks')
}

async function listReservations(root: string): Promise<string[]> {
  try {
    const entries = await readdir(reservationsDir(root), {
      withFileTypes: true,
    })
    return entries.filter((entry) => entry.isDirectory()).map((e) => e.name)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function readOwner(
  root: string,
  label: string,
): Promise<Omit<Reservation, 'label'>> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(
        join(recordDir(root, 'ordinal-locks', label), OWNER_FILE),
        'utf8',
      ),
    )
    const owner = typeof raw === 'object' && raw !== null ? raw : {}
    const sessionId = 'sessionId' in owner ? owner.sessionId : undefined
    const claimedAt = 'claimedAt' in owner ? owner.claimedAt : undefined
    return {
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      claimedAt: typeof claimedAt === 'string' ? claimedAt : null,
    }
  } catch {
    // An absent or torn owner file reads as no owner, the legacy shape.
    return { sessionId: null, claimedAt: null }
  }
}

/** The label locks above `floor`, each with whatever owner it recorded. */
async function reservationsAbove(
  root: string,
  floor: Label | undefined,
): Promise<Reservation[]> {
  const above = (await listReservations(root))
    .map((name) => ({ name, label: parseLabel(name, RESERVATION_PATTERN) }))
    .filter(
      (entry): entry is { name: string; label: Label } =>
        entry.label !== undefined &&
        (floor === undefined || isHigher(entry.label, floor)),
    )
    .sort((a, b) => (isHigher(a.label, b.label) ? 1 : -1))

  return Promise.all(
    above.map(async ({ name }) => ({
      label: name,
      ...(await readOwner(root, name)),
    })),
  )
}

function highestOf(
  names: readonly string[],
  pattern: RegExp,
): Label | undefined {
  return names
    .map((name) => parseLabel(name, pattern))
    .filter((label): label is Label => label !== undefined)
    .reduce<Label | undefined>(
      (max, label) => (max === undefined || isHigher(label, max) ? label : max),
      undefined,
    )
}

async function readStems(root: string): Promise<string[]> {
  const settled = [archiveDir(root), declinedDir(root)].filter((candidate) =>
    existsSync(candidate),
  )
  const dirs = [tasksDir(root), ...settled]

  return (await Promise.all(dirs.map((d) => listTaskStems(d)))).flat()
}

/**
 * Reports the next unused phase label, read off the true maximum across
 * `.canon/tasks/` and its `archive/` and `declined/`, since a scan of the live
 * board alone misses labels already spent. It reports and never writes.
 */
export async function nextLabel(root: string): Promise<LabelOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) return noBoard(root, dir)

  const highest = highestOf(await readStems(root), LABEL_PATTERN)

  return {
    ok: true,
    label: formatLabel(highest === undefined ? FIRST_LABEL : next(highest)),
    highest: highest === undefined ? undefined : formatLabel(highest),
    claimed: false,
    reservations: await reservationsAbove(root, highest),
    released: [],
  }
}

interface Owner {
  readonly sessionId: string | null
  readonly claimedAt: string
}

interface ClaimOptions {
  /** Takes the reservation, resolving false when another claim holds it. */
  readonly reserve?: (
    root: string,
    label: string,
    owner: Owner,
  ) => Promise<boolean>
  /** The claiming session, defaulting to `CLAUDE_CODE_SESSION_ID`. */
  readonly sessionId?: string | null
  /** The instant the claim is stamped with. Defaults to `Date.now`. */
  readonly now?: () => number
}

/**
 * Takes the lock through an exclusive `mkdir`, which alone decides a race, then
 * stamps the owner inside it. A reader meeting the lock before the stamp sees a
 * fresh directory with no owner, which no release takes inside its age bound.
 */
async function reserveLabel(
  root: string,
  label: string,
  owner: Owner,
): Promise<boolean> {
  await mkdir(reservationsDir(root), { recursive: true })
  const dir = recordDir(root, 'ordinal-locks', label)

  try {
    await mkdir(dir, { recursive: false })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false
    }
    throw error
  }

  await writeFile(join(dir, OWNER_FILE), `${JSON.stringify(owner)}\n`, 'utf8')
  return true
}

/**
 * Reserves the next label through an exclusive `mkdir` under
 * `.canon/ordinal-locks/`, stamping the claiming session and time inside it.
 * The scan counts every reservation beside the stems.
 */
export async function claimLabel(
  root: string,
  options: ClaimOptions = {},
): Promise<LabelOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) return noBoard(root, dir)

  const reserve = options.reserve ?? reserveLabel
  const owner: Owner = {
    sessionId:
      options.sessionId === undefined
        ? callerIdentity().sessionId
        : options.sessionId,
    claimedAt: new Date(options.now?.() ?? Date.now()).toISOString(),
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stems = highestOf(await readStems(root), LABEL_PATTERN)
    const held = highestOf(await listReservations(root), RESERVATION_PATTERN)
    const highest =
      stems !== undefined && (held === undefined || isHigher(stems, held))
        ? stems
        : held
    const label = formatLabel(
      highest === undefined ? FIRST_LABEL : next(highest),
    )

    if (await reserve(root, label, owner)) {
      return {
        ok: true,
        label,
        highest: highest === undefined ? undefined : formatLabel(highest),
        claimed: true,
        reservations: await reservationsAbove(root, stems),
        released: [],
      }
    }
  }

  return {
    ok: false,
    reason: 'label-contended',
    message: `Could not reserve a label after ${MAX_ATTEMPTS} attempts. Re-run the claim.`,
  }
}
