import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { relative } from 'node:path'
import { recordDir } from '@/record-root'
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
 * `TASK-ARCHIVE` fails it outright, and a reserved stem such as `index` or
 * `priority` never reaches it at all, since `listTaskStems` already filters
 * those out before this pattern sees a stem.
 */
export const LABEL_PATTERN = /^v(\d+)\.(\d+)-/

/** A reservation is named by the bare label, with no slug behind it. */
const RESERVATION_PATTERN = /^v(\d+)\.(\d+)$/

/** Bounds the claim loop. A fifth loss in a row is not a race. */
const MAX_ATTEMPTS = 5

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
 * than continuing to a second minor digit. Every one of the 587 labels measured
 * across the live board and its archive on 2026-09-06 stops at a single digit,
 * so this is the rollover the whole corpus already follows rather than a rule
 * this verb introduces.
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
 * `.canon/tasks/` and its `archive/` and `declined/` siblings together. A scan
 * confined to the live board is blind to every label a settled folder already
 * spent, which is what let two sessions hand out the same label within
 * minutes of each other.
 *
 * It reports and never writes. `claimLabel` is the variant that reserves. A
 * duplicate label already sitting in the tree, and a gap left by a
 * renumbering, both fold into the same max scan without needing a dedicated
 * check.
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
  }
}

interface ClaimOptions {
  /** Takes the reservation, resolving false when another claim holds it. */
  readonly reserve?: (root: string, label: string) => Promise<boolean>
}

async function reserveLabel(root: string, label: string): Promise<boolean> {
  await mkdir(reservationsDir(root), { recursive: true })

  try {
    await mkdir(recordDir(root, 'ordinal-locks', label), { recursive: false })
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false
    }
    throw error
  }
}

/**
 * Reserves the next label through an exclusive `mkdir` under
 * `.canon/ordinal-locks/`, so a second claim lands on a different one.
 *
 * The scan counts every reservation beside the task stems. The skill writes
 * the task file after this returns, so a reservation with no file behind it is
 * the ordinary state for a few seconds, and a scan blind to it would offer the
 * same label to every retry. Reservations are never expired: a claim that died
 * leaves a gap, and `standards/versioning.md` permits gaps.
 */
export async function claimLabel(
  root: string,
  options: ClaimOptions = {},
): Promise<LabelOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) return noBoard(root, dir)

  const reserve = options.reserve ?? reserveLabel

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

    if (await reserve(root, label)) {
      return {
        ok: true,
        label,
        highest: highest === undefined ? undefined : formatLabel(highest),
        claimed: true,
      }
    }
  }

  return {
    ok: false,
    reason: 'label-contended',
    message: `Could not reserve a label after ${MAX_ATTEMPTS} attempts. Re-run the claim.`,
  }
}
