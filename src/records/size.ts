import { existsSync, type Stats } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { RECORD_ROOTS, recordDir, SCRATCH } from '@/roots/record'
import { candidateFolders } from '@/records/backup'

/**
 * The folders a size reading covers at `root`, resolved the way a push resolves its scope.
 * It is the backed set plus scratch, and `.records.git` and `worktrees/` stay out, being the
 * backup history and checkouts with their own removal verb.
 */
export function sizedFolders(root: string): string[] {
  return [...candidateFolders(root), SCRATCH]
}

/**
 * The windows a reading reports, in days. A single window cannot separate a folder that grows
 * steadily from one that took a single batch, so there are two.
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
 * Renders the calendar date the writer saw, which is the local one. `toISOString` renders in
 * UTC and would date a late-evening file to the next day, and the reading is per-machine
 * already.
 */
export function day(ms: number): string {
  const at = new Date(ms)
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const date = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${date}`
}

/**
 * Adds one file to the running totals. The window counts read `mtime`, which overstates growth
 * and never understates it, and a machine restored by `canon records pull` re-dates every
 * file, so the caveat is published.
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
 * Reads one entry, or undefined when it left between the listing and the read, which is the
 * answer the count wants. Every other error propagates, since a permission or IO failure
 * would undercount with nothing said.
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
 * Walks one folder, counting files and never following a symlink. `isFile()` answers false
 * for a link, so the corpus symlinks into the authoring roots are not counted twice.
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
 * Reports what each record folder holds and how much of it is recent. Every folder is
 * reported whether or not it exists, so the keys are stable. `now` is a parameter so a test
 * can pin the windows.
 */
export async function sizeRecords(
  root: string,
  now: number = Date.now(),
): Promise<SizeOutcome> {
  // Either root answers, so a migrated tree is read, and `present` names the folders held.
  if (!RECORD_ROOTS.some((name) => existsSync(join(root, name)))) {
    return {
      ok: false,
      reason: 'no-folder',
      message: `No ${RECORD_ROOTS.join(' or ')} directory at ${root}, so there are no record folders to read.`,
    }
  }

  // Each folder is walked independently, and `Promise.all` keeps the caller's input order.
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
 * The file count, byte total, and newest `mtime` under one path. It walks with the same
 * `walk`/`absorb` pair `sizeRecords` uses, so the two verbs agree on what counts as a file.
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
 * Renders a byte count at three significant figures or fewer. The reading is a prompt to go
 * and look rather than an accounting figure.
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
