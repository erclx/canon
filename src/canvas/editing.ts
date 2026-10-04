import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type ContentRefused,
  canvasDir,
  isValidName,
  readPage,
  TEMP_SUFFIX,
  withFileLock,
} from '@/canvas/content'

/**
 * Which frames a session says it is editing, beside `selection.json`. The
 * server cannot see a write until it lands, so the mark is a record a session
 * writes rather than something inferred, and it gates no edit.
 */
export const EDITING_FILE = 'editing.json'

/**
 * How long a mark lives unrenewed. A session that crashes or compacts never
 * clears its mark, so this is how long a dead one can mislead the operator.
 */
export const EDITING_TTL_MS = 5 * 60_000

export interface EditingMark {
  readonly page: string
  readonly frame: string
  readonly by: string
  readonly since: string
  readonly until: string
}

type Stored = Omit<EditingMark, 'page' | 'frame'>

export type MarkOutcome =
  | { readonly ok: true; readonly mark: EditingMark }
  | ContentRefused

export type ClearOutcome =
  | { readonly ok: true; readonly cleared: boolean }
  | ContentRefused

function recordPath(root: string): string {
  return join(canvasDir(root), EDITING_FILE)
}

function isStored(value: unknown): value is Stored {
  if (typeof value !== 'object' || value === null) return false
  const { by, since, until } = value as Record<string, unknown>
  return (
    typeof by === 'string' &&
    typeof since === 'string' &&
    typeof until === 'string' &&
    !Number.isNaN(Date.parse(until))
  )
}

/** Every well-formed entry, with a malformed file read as holding none. */
function readStored(root: string): Map<string, Stored> {
  const entries = new Map<string, Stored>()
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(recordPath(root), 'utf8'))
  } catch {
    return entries
  }
  if (typeof parsed !== 'object' || parsed === null) return entries
  for (const [key, value] of Object.entries(parsed)) {
    if (isStored(value)) entries.set(key, value)
  }
  return entries
}

function toMark(key: string, stored: Stored): EditingMark | undefined {
  const [page, frame, ...rest] = key.split('/')
  if (!page || !frame || rest.length > 0) return undefined
  return { page, frame, ...stored }
}

/** A mark still inside its expiry, on a frame still on disk. */
function isLive(root: string, mark: EditingMark, now: Date): boolean {
  if (Date.parse(mark.until) <= now.getTime()) return false
  return (
    readPage(root, mark.page)?.frames.some(
      (candidate) => candidate.name === mark.frame,
    ) ?? false
  )
}

function liveMarks(
  root: string,
  entries: ReadonlyMap<string, Stored>,
  now: Date,
): EditingMark[] {
  return [...entries]
    .flatMap(([key, stored]) => toMark(key, stored) ?? [])
    .filter((mark) => isLive(root, mark, now))
    .sort((a, b) =>
      `${a.page}/${a.frame}`.localeCompare(`${b.page}/${b.frame}`),
    )
}

/**
 * Replaces the record through a rename, keeping only live marks, so the file
 * never grows with marks nobody cleared. The caller holds the lock, which is
 * what keeps two sessions marking at once from dropping each other's key.
 */
function writeMarks(root: string, marks: readonly EditingMark[]): void {
  const record = Object.fromEntries(
    marks.map(({ page, frame, ...stored }) => [`${page}/${frame}`, stored]),
  )
  const target = recordPath(root)
  const temp = `${target}.${process.pid}${TEMP_SUFFIX}`
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`)
  renameSync(temp, target)
}

export function markEditing(
  root: string,
  page: string,
  frame: string,
  by: string,
  now: Date,
): MarkOutcome {
  if (!isValidName(page) || !isValidName(frame)) {
    return {
      ok: false,
      reason: 'invalid-name',
      detail: `${page}/${frame} is not a valid frame`,
    }
  }
  const onPage = readPage(root, page)
  if (!onPage) {
    return {
      ok: false,
      reason: 'no-page',
      detail: `page ${page} does not exist`,
    }
  }
  if (!onPage.frames.some((candidate) => candidate.name === frame)) {
    return {
      ok: false,
      reason: 'no-frame',
      detail: `frame ${frame} does not exist on ${page}`,
    }
  }

  const mark: EditingMark = {
    page,
    frame,
    by,
    since: now.toISOString(),
    until: new Date(now.getTime() + EDITING_TTL_MS).toISOString(),
  }
  return withFileLock(recordPath(root), (): MarkOutcome => {
    const entries = readStored(root)
    entries.set(`${page}/${frame}`, {
      by,
      since: mark.since,
      until: mark.until,
    })
    writeMarks(root, liveMarks(root, entries, now))
    return { ok: true, mark }
  })
}

/**
 * Drops one frame's mark. Clearing a frame that holds none succeeds and writes
 * nothing, so a session clearing defensively never fails, and a frame removed
 * while marked still clears.
 */
export function clearEditing(
  root: string,
  page: string,
  frame: string,
): ClearOutcome {
  if (!isValidName(page) || !isValidName(frame)) {
    return {
      ok: false,
      reason: 'invalid-name',
      detail: `${page}/${frame} is not a valid frame`,
    }
  }
  if (!existsSync(recordPath(root))) return { ok: true, cleared: false }

  return withFileLock(recordPath(root), (): ClearOutcome => {
    const entries = readStored(root)
    if (!entries.delete(`${page}/${frame}`)) return { ok: true, cleared: false }
    writeMarks(
      root,
      [...entries].flatMap(([key, stored]) => toMark(key, stored) ?? []),
    )
    return { ok: true, cleared: true }
  })
}

/**
 * The live marks, sorted by frame. A mark past its expiry or on a frame since
 * removed reads as absent with no write, so a reader never gets a dead name.
 */
export function readEditing(root: string, now: Date): EditingMark[] {
  return liveMarks(root, readStored(root), now)
}
