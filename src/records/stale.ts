import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import {
  CREATION_ROOT,
  RECORD_ROOTS,
  recordDir,
  SCRATCH,
  spell,
} from '@/record-root'

/** The window after which a reviewed entry is due again, in days. */
export const DEFAULT_REVIEW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

const MEMORY_INDEX = 'index.md'

export interface StaleEntry {
  /** The filename stem, which is what a review names an entry by. */
  readonly name: string
  readonly category: string | null
  /** `YYYY-MM-DD`, or null when the entry carries no readable review date. */
  readonly reviewed: string | null
  /** The raw value of a `reviewed` field that is not a date, present only then. */
  readonly invalidReviewed?: string
  readonly due: boolean
  /** Backticked paths the entry cites that the project root does not hold. */
  readonly unresolved: readonly string[]
}

export interface StaleReport {
  readonly ok: true
  readonly root: string
  /** The pen read, relative to the root. */
  readonly folder: string
  readonly days: number
  readonly total: number
  readonly due: number
  readonly entries: readonly StaleEntry[]
}

export const STALE_REFUSALS = ['no-folder'] as const

export type StaleRefusal = (typeof STALE_REFUSALS)[number]

export interface StaleRefused {
  readonly ok: false
  readonly reason: StaleRefusal
  readonly message: string
}

export type StaleOutcome = StaleReport | StaleRefused

const REVIEWED_FIELD = /^reviewed:[ \t]*(.*?)[ \t]*$/m
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const RAW_FRONTMATTER = /^---\n([\s\S]*?)\n---/

/**
 * Reads `reviewed` off the raw block rather than the parsed fields, for the
 * reason `hasOpeningDate` in the validator gives: a YAML parser resolves a
 * bare `YYYY-MM-DD` to a date on one schema and a string on another.
 *
 * A value that is not a calendar date reads as never reviewed and is carried
 * back so the review can see it, rather than throwing over one hand edit.
 */
function readReviewed(
  text: string,
): Pick<StaleEntry, 'reviewed' | 'invalidReviewed'> {
  const block = RAW_FRONTMATTER.exec(text)?.[1]
  const match = block ? REVIEWED_FIELD.exec(block) : null
  if (!match) return { reviewed: null }

  const value = match[1].replace(/^(['"])(.*)\1$/, '$2')
  const parsed = Date.parse(`${value}T00:00:00Z`)
  const isDate =
    ISO_DATE.test(value) &&
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value

  return isDate
    ? { reviewed: value }
    : { reviewed: null, invalidReviewed: value }
}

/**
 * Tokens that name a session record, scratch at either root, or a checkout,
 * none of which a tree commits. The scratch spellings come from `spell` so the
 * legacy root's variant is stated in one place.
 */
const UNTRACKED_PREFIXES = [
  ...RECORD_ROOTS.map((at) => `${at}/${spell(at, SCRATCH)}/`),
  `${CREATION_ROOT}/`,
  '.claude/worktrees/',
]

const INLINE_CODE = /`([^`\n]+)`/g
const LINE_ANCHOR = /:\d+(?:[-:]\d+)*$/
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/

/**
 * Reduces one backticked token to the repository path it cites, or undefined
 * when it cites none.
 *
 * A path is a token carrying a `/` and ending in a file extension once any
 * line or heading anchor is stripped. A placeholder, an elided path, a glob, a
 * variable, a URL, and a path outside the project all look like paths and
 * resolve against nothing in the tree, so each is dropped rather than reported.
 */
function toCitedPath(token: string): string | undefined {
  if (/\s/.test(token) || token.includes('://')) return undefined
  if (/[<*{$]/.test(token) || token.includes('...')) return undefined
  if (/^(?:\/|~|\.\.\/)/.test(token)) return undefined

  const path = token
    .replace(/#.*$/, '')
    .replace(LINE_ANCHOR, '')
    .replace(/^\.\//, '')

  if (!path.includes('/') || !FILE_EXTENSION.test(path)) return undefined
  if (UNTRACKED_PREFIXES.some((prefix) => path.startsWith(prefix)))
    return undefined

  return path
}

/** Every distinct repository path a body cites in inline code, in order. */
export function citedPaths(body: string): string[] {
  const paths = new Set<string>()

  for (const match of body.matchAll(INLINE_CODE)) {
    const path = toCitedPath(match[1])
    if (path) paths.add(path)
  }

  return [...paths]
}

function isDue(reviewed: string | null, days: number, now: number): boolean {
  if (reviewed === null) return true
  return now - Date.parse(`${reviewed}T00:00:00`) > days * DAY_MS
}

async function readEntry(
  root: string,
  dir: string,
  file: string,
  days: number,
  now: number,
): Promise<StaleEntry> {
  const text = (await readFile(join(dir, file), 'utf8')).replaceAll(
    '\r\n',
    '\n',
  )
  const frontmatter = parseFrontmatter(text)
  const review = readReviewed(text)
  const body = text.slice(RAW_FRONTMATTER.exec(text)?.[0].length ?? 0)

  return {
    name: file.replace(/\.md$/, ''),
    category: readField(frontmatter, 'category') ?? null,
    ...review,
    due: isDue(review.reviewed, days, now),
    unresolved: citedPaths(body).filter(
      (path) => !existsSync(join(root, path)),
    ),
  }
}

/**
 * The order a review takes a batch in: due entries first, and among them the
 * ones citing a tree that moved, then the longest unreviewed, then by name so
 * two runs over one pen agree.
 */
function compareEntries(left: StaleEntry, right: StaleEntry): number {
  if (left.due !== right.due) return left.due ? -1 : 1

  const leftMoved = left.unresolved.length > 0
  const rightMoved = right.unresolved.length > 0
  if (leftMoved !== rightMoved) return leftMoved ? -1 : 1

  if (left.reviewed !== right.reviewed) {
    if (left.reviewed === null) return -1
    if (right.reviewed === null) return 1
    return left.reviewed < right.reviewed ? -1 : 1
  }

  return left.name.localeCompare(right.name)
}

/**
 * Reports each memory entry's review state and the paths it cites that the
 * project no longer holds, ordered so a caller takes the first N as a batch.
 *
 * It reads the top level of the pen alone. `review/` holds receipts and
 * `archive/` holds retirements, and neither is an entry a review would queue.
 * Paths resolve against the project root rather than the entry's folder, since
 * an entry cites the tree it was written about. It reports and never writes.
 *
 * `now` is a parameter so a test can pin the window against fixture dates.
 */
export async function staleMemory(
  root: string,
  days: number = DEFAULT_REVIEW_DAYS,
  now: number = Date.now(),
): Promise<StaleOutcome> {
  const dir = recordDir(root, 'memory')

  if (!existsSync(dir)) {
    return {
      ok: false,
      reason: 'no-folder',
      message: `No memory folder at ${dir}, so there are no entries to read.`,
    }
  }

  const listed = await readdir(dir, { withFileTypes: true })
  const files = listed
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== MEMORY_INDEX,
    )
    .map((entry) => entry.name)

  const entries = (
    await Promise.all(
      files.map((file) => readEntry(root, dir, file, days, now)),
    )
  ).toSorted(compareEntries)

  return {
    ok: true,
    root,
    folder: relative(root, dir),
    days,
    total: entries.length,
    due: entries.filter((entry) => entry.due).length,
    entries,
  }
}
