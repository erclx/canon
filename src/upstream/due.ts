import { existsSync, readFileSync } from 'node:fs'
import { recordDir, SCRATCH } from '@/roots/record'
import { compareVersions, writeAtomic, type Cursor } from '@/upstream/cursor'

const DAY_MS = 86_400_000
const DUE_AFTER_DAYS = 7

// Ported from the groundwork's pre-filter script. It names canon's own surfaces,
// so an Added line matching it is one a digest would act on.
const VOCABULARY =
  /plugin|skill|hook|SendMessage|ListAgents|agent view|agents view|worktree|subagent|background|routine|schedule|Monitor|mod\b|mods\b|CLAUDE\.md|rules|memory|permission|auto mode|stream-json|--bg|headless|-p\b|marketplace|session/i
const ADDED = /^Added/
const CACHE_MAX_AGE_MS = DAY_MS

/** What the gap between the cursor and the installed version holds. */
export interface Gap {
  readonly releases: number
  readonly lines: readonly string[]
}

export interface DueInput {
  /** The installed Claude Code version, or null when it could not be read. */
  readonly installed: string | null
  readonly cursor: Cursor | null
  /** Null when the feed was not read, so only the age path can decide. */
  readonly gap: Gap | null
  readonly now: Date
}

export type DueReason =
  | 'no-cursor'
  | 'week'
  | 'vocabulary'
  | 'current'
  | 'recent'
  | 'unknown-version'

export interface DueResult {
  readonly due: boolean
  readonly reason: DueReason
  /** Releases in the gap, or null when it was not read. */
  readonly releases: number | null
}

export function passesVocabulary(line: string): boolean {
  return ADDED.test(line) && VOCABULARY.test(line)
}

// A cursor date is a calendar day with no time, read at UTC midnight. An
// unreadable one gives NaN, which fails the age test and leaves the vocabulary
// path to decide.
function ageInDays(date: string, now: Date): number {
  return (now.getTime() - Date.parse(`${date}T00:00:00Z`)) / DAY_MS
}

/**
 * Decides whether a digest is due.
 *
 * The age boundary is inclusive: a cursor exactly seven days old is due, since
 * a week has passed. An installed version at or below the cursor is never due,
 * which covers a downgrade as well as a run straight after a digest.
 */
export function decideDue(input: DueInput): DueResult {
  const { installed, cursor, gap, now } = input
  const releases = gap?.releases ?? null

  if (cursor === null) return { due: true, reason: 'no-cursor', releases }
  if (installed === null) {
    return { due: false, reason: 'unknown-version', releases }
  }
  if (compareVersions(installed, cursor.version) <= 0) {
    return { due: false, reason: 'current', releases }
  }
  if (ageInDays(cursor.date, now) >= DUE_AFTER_DAYS) {
    return { due: true, reason: 'week', releases }
  }
  if (gap?.lines.some(passesVocabulary)) {
    return { due: true, reason: 'vocabulary', releases }
  }

  return { due: false, reason: 'recent', releases }
}

/**
 * One reading of the feed, kept so a wave of sessions starting together spends
 * one request rather than one each.
 */
export interface DueCache {
  readonly checkedAt: string
  readonly installed: string
  readonly cursor: string
  /** Null when the read failed, so a failure is held for the day too. */
  readonly gap: Gap | null
}

// Scratch rather than the upstream record folder, which a records push backs
// whole. A file rewritten daily would add a commit to the history each time.
const cachePath = (root: string): string =>
  recordDir(root, SCRATCH, 'upstream-due', 'check.json')

/** The stored reading when it is fresh and answers for this pair of versions. */
export function readDueCache(
  root: string,
  installed: string,
  cursor: string,
  now: Date,
): DueCache | null {
  const path = cachePath(root)
  if (!existsSync(path)) return null

  try {
    const cache = JSON.parse(readFileSync(path, 'utf8')) as DueCache
    const age = now.getTime() - Date.parse(cache.checkedAt)
    const isFresh = age >= 0 && age < CACHE_MAX_AGE_MS
    const isSamePair = cache.installed === installed && cache.cursor === cursor

    return isFresh && isSamePair ? cache : null
  } catch {
    return null
  }
}

export async function writeDueCache(
  root: string,
  cache: DueCache,
): Promise<void> {
  await writeAtomic(cachePath(root), `${JSON.stringify(cache)}\n`)
}
