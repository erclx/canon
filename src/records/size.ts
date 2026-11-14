import { existsSync, type Stats } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { RECORD_ROOTS, recordDir, SCRATCH } from '@/roots/record'
import { candidateFolders } from '@/records/backup'

/**
 * The folders a size reading covers at `root`, resolved the way a push
 * resolves its scope rather than pinned to `BACKED_FOLDERS`, which is wrong at
 * a `.canon` root.
 *
 * It is the backed set plus scratch, which a backup skips as deletable but
 * which still accumulates handoffs and the memory archive. `.records.git` is
 * the backup history rather than a record, and `worktrees/` holds checkouts
 * with their own removal verb, so both stay out.
 */
export function sizedFolders(root: string): string[] {
  return [...candidateFolders(root), SCRATCH]
}

/**
 * The windows a reading reports, in days.
 *
 * There are two rather than one, because a single window cannot separate a
 * folder that grows steadily from one that took a single batch. A folder whose
 * 7-day count is most of its 30-day count moved in one pass, and one where the
 * two are proportional is growing at a rate.
 */
export const GROWTH_WINDOWS = [7, 30] as const

const DAY_MS = 24 * 60 * 60 * 1000

export interface WindowCount {
  readonly days: number
  readonly files: number
}

export interface FolderSize {
  /** Relative to the record root, which is the name a reader opens. */
  readonly folder: string
  readonly present: boolean
  readonly files: number
  readonly bytes: number
  /** `YYYY-MM-DD` of the least and most recently modified file, absent when the folder holds none. */
  readonly oldest?: string
  readonly newest?: string
  readonly touched: readonly WindowCount[]
}

export interface SizeReport {
  readonly ok: true
  readonly root: string
  readonly folders: readonly FolderSize[]
  readonly files: number
  readonly bytes: number
}

export const SIZE_REFUSALS = ['no-folder'] as const

export type SizeRefusal = (typeof SIZE_REFUSALS)[number]

export interface SizeRefused {
  readonly ok: false
  readonly reason: SizeRefusal
  readonly message: string
}

export type SizeOutcome = SizeReport | SizeRefused

interface Walked {
  files: number
  bytes: number
  oldest?: number
  newest?: number
  touched: number[]
}

/**
 * Renders the calendar date the writer saw, which is the local one.
 *
 * `toISOString` renders in UTC, so a file written after 17:00 at `-0700` dates
 * to the following day and a reader comparing the column against their own
 * memory of writing it finds the two disagree. The reading is per-machine
 * already, since these folders are gitignored and hold whatever that disk holds,
 * so a local date is the answer consistent with the rest of the report.
 */
export function day(ms: number): string {
  const at = new Date(ms)
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const date = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${date}`
}

/**
 * Adds one file to the running totals.
 *
 * The window counts read `mtime`, so a file edited long after it landed counts
 * as recent, which overstates growth and never understates it, and these
 * folders are append-mostly. A machine restored by `canon records pull` is
 * wrong rather than early, since the hard reset re-dates every file, and the
 * filesystem cannot tell the two apart, so the caveat is published.
 */
function absorb(into: Walked, bytes: number, mtime: number, now: number): void {
  into.files += 1
  into.bytes += bytes
  into.oldest = into.oldest === undefined ? mtime : Math.min(into.oldest, mtime)
  into.newest = into.newest === undefined ? mtime : Math.max(into.newest, mtime)

  GROWTH_WINDOWS.forEach((days, index) => {
    if (now - mtime <= days * DAY_MS) into.touched[index] += 1
  })
}

/**
 * Reads one entry, or undefined when it left between the listing and the read.
 *
 * These folders are written by whatever sessions are running, so a path listed
 * a moment ago can be gone by the time it is read. A vanished file is a file
 * the folder no longer holds, which is the answer the count wants, and letting
 * `ENOENT` out would fail the whole reading over one deleted scratch file.
 * Every other error propagates, since a permission or IO failure would
 * undercount with nothing said.
 */
async function readSize(path: string): Promise<Stats | undefined> {
  try {
    return await stat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/**
 * Walks one folder, counting files and never following a symlink.
 *
 * `isFile()` answers false for a link, so a folder holding one reports it
 * nowhere rather than counting whatever sits behind it. The corpus symlinks
 * point out of `.claude/` and into the authoring roots, where a second reading
 * of the same bytes would be the wrong answer twice over.
 */
async function walk(dir: string, into: Walked, now: number): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return []
      throw error
    },
  )

  for (const entry of entries) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      await walk(path, into, now)
      continue
    }
    if (!entry.isFile()) continue

    const info = await readSize(path)
    if (info) absorb(into, info.size, info.mtimeMs, now)
  }
}

async function measure(
  root: string,
  folder: string,
  now: number,
): Promise<FolderSize> {
  const path = recordDir(root, folder)
  const empty = GROWTH_WINDOWS.map((days) => ({ days, files: 0 }))

  if (!existsSync(path)) {
    return { folder, present: false, files: 0, bytes: 0, touched: empty }
  }

  const walked: Walked = {
    files: 0,
    bytes: 0,
    touched: GROWTH_WINDOWS.map(() => 0),
  }
  await walk(path, walked, now)

  return {
    folder,
    present: true,
    files: walked.files,
    bytes: walked.bytes,
    oldest: walked.oldest === undefined ? undefined : day(walked.oldest),
    newest: walked.newest === undefined ? undefined : day(walked.newest),
    touched: GROWTH_WINDOWS.map((days, index) => ({
      days,
      files: walked.touched[index],
    })),
  }
}

/**
 * Reports what each record folder holds and how much of it is recent.
 *
 * Every folder is reported whether or not it exists, since a caller reading the
 * record wants a stable set of keys, and a folder absent from the output is
 * indistinguishable from one the reading skipped.
 *
 * `now` is a parameter rather than a call inside the walk so a test can pin the
 * windows against fixture timestamps.
 */
export async function sizeRecords(
  root: string,
  now: number = Date.now(),
): Promise<SizeOutcome> {
  // Either root answers, so a migrated tree is read. The roots are tested, since
  // a root with no records yet is empty, and `present` names the folders held.
  if (!RECORD_ROOTS.some((name) => existsSync(join(root, name)))) {
    return {
      ok: false,
      reason: 'no-folder',
      message: `No ${RECORD_ROOTS.join(' or ')} directory at ${root}, so there are no record folders to read.`,
    }
  }

  // Each folder is walked independently, and `Promise.all` keeps the caller's
  // input order while the walks overlap.
  const folders = await Promise.all(
    sizedFolders(root).map((folder) => measure(root, folder, now)),
  )

  return {
    ok: true,
    root,
    folders,
    files: folders.reduce((total, entry) => total + entry.files, 0),
    bytes: folders.reduce((total, entry) => total + entry.bytes, 0),
  }
}

/**
 * The file count, byte total, and newest `mtime` under one path, for a caller
 * that wants a unit's freshness rather than the full per-window reading.
 *
 * It walks with the same `walk`/`absorb` pair `sizeRecords` uses, so the two
 * verbs agree on what counts as a file and which mtime a rewritten entry
 * carries, rather than each answering from a second walk of its own.
 */
export async function newestMtime(
  path: string,
): Promise<{ files: number; bytes: number; newest?: number } | undefined> {
  if (!existsSync(path)) return undefined

  const walked: Walked = {
    files: 0,
    bytes: 0,
    touched: GROWTH_WINDOWS.map(() => 0),
  }
  await walk(path, walked, Date.now())

  return { files: walked.files, bytes: walked.bytes, newest: walked.newest }
}

const UNITS = ['B', 'K', 'M', 'G'] as const

/**
 * Renders a byte count at three significant figures or fewer.
 *
 * The reading is a prompt to go and look rather than an accounting figure, so
 * an exact byte count buys nothing and costs a reader the comparison between
 * two rows.
 */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const rendered =
    unit === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)
  return `${rendered}${UNITS[unit]}`
}
