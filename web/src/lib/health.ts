import { execSync } from 'node:child_process'

import { readCanonJson, repoRoot } from './canon-cli'

/** The weeks the chart spans and the functions the report lists, as the picked still draws them. */
const WEEKS = 6
const ROWS = 3

interface AuditRecord {
  readonly files: number
  readonly fileLimit: number
  readonly functionCheckpoint: number
  readonly longFiles: readonly unknown[]
  readonly longFunctions: readonly {
    file: string
    lines: number
    name: string | null
  }[]
}

interface CommentsRecord {
  readonly fileShareCap: number
  readonly fileShareFloor: number
  readonly snapshot: readonly {
    fileShares: readonly { textLines: number; nonBlankLines: number }[]
  }[]
}

interface HistoryRecord {
  readonly window: { to: string }
  readonly weeks: readonly { week: string; merges: number }[]
}

export interface HealthFunction {
  readonly file: string
  readonly name: string
  readonly lines: number
  readonly past: boolean
}

export interface Health {
  readonly functions: readonly HealthFunction[]
  readonly checkpoint: number
  readonly files: number
  readonly longFiles: number
  readonly fileLimit: number
  readonly denseFiles: number
  readonly shareCap: number
  readonly weeks: readonly { label: string; merges: number }[]
  /** The last day the chart reads, so the page dates the figures beside them. */
  readonly to: string
}

/**
 * Folds the three records into what the health section draws, refusing a read
 * that would print an empty or one-week chart rather than a figure nobody can
 * tell is wrong.
 */
export function summarize(
  audit: AuditRecord,
  comments: CommentsRecord,
  history: HistoryRecord,
): Health {
  if (audit.files === 0)
    throw new Error('canon code audit read no files, so the report is empty')
  if (audit.longFunctions.length < ROWS)
    throw new Error(
      `canon code audit listed ${audit.longFunctions.length} long functions, fewer than the ${ROWS} rows the report draws`,
    )
  const merged = history.weeks.filter((week) => week.merges > 0)
  if (merged.length < 2)
    throw new Error(
      `canon history found merges in ${merged.length} of ${history.weeks.length} weeks, which reads as a shallow clone rather than a trend`,
    )

  const functions = [...audit.longFunctions]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, ROWS)
    .map((fn) => ({
      file: fn.file,
      name: fn.name ?? '(anonymous)',
      lines: fn.lines,
      past: fn.lines > audit.functionCheckpoint,
    }))
  const denseFiles = comments.snapshot
    .flatMap((language) => language.fileShares)
    .filter(
      (share) =>
        share.nonBlankLines >= comments.fileShareFloor &&
        share.textLines / share.nonBlankLines > comments.fileShareCap,
    ).length

  return {
    functions,
    checkpoint: audit.functionCheckpoint,
    files: audit.files,
    longFiles: audit.longFiles.length,
    fileLimit: audit.fileLimit,
    denseFiles,
    shareCap: comments.fileShareCap,
    weeks: history.weeks.map((week) => ({
      label: `w${week.week.split('-W')[1] ?? week.week}`,
      merges: week.merges,
    })),
    to: history.window.to,
  }
}

/**
 * Reads this checkout's audits at build time. A shallow clone holds one
 * commit, so the trend would read as one week, and the build refuses it.
 */
export function readHealth(): Health {
  const shallow = execSync('git rev-parse --is-shallow-repository', {
    cwd: repoRoot(),
    encoding: 'utf8',
  }).trim()
  if (shallow === 'true')
    throw new Error(
      'The checkout is shallow, so canon history cannot read a weekly trend. Fetch full history before building.',
    )
  return summarize(
    readCanonJson<AuditRecord>(['code', 'audit']),
    readCanonJson<CommentsRecord>(['comments', 'scan']),
    readCanonJson<HistoryRecord>(['history', '--weeks', String(WEEKS)]),
  )
}
