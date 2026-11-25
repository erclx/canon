import { linesOutsideFences, maskCodeSpans } from '@/markdown/scan'

const PERF_TITLE = /^perf(\([^)]*\))?!?:/
const H2 = /^##\s/
const OUTCOME = '## Outcome'
const TECHNICAL_CONTEXT = '## Technical context'
const VERIFICATION = '## Verification'
const MEASUREMENT_WORD =
  /\b(eval|evals|benchmark|benchmarks|benchmarked|latency|p50|p95|median|timed|frame time|frames per second)\b/i
const SEPARATOR_ROW = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/

/** True when a line of prose names a measurement, a word in a code span never counting. */
export function namesMeasurement(line: string): boolean {
  return MEASUREMENT_WORD.test(maskCodeSpans(line))
}

export type MeasurementGap =
  | 'table'
  | 'technical-context'
  | 'results-table'
  | 'run-link'

export interface MeasurementCheck {
  /** False for a title that is not `perf`, which carries no measurement rule. */
  readonly checked: boolean
  /** What a `perf` body lacks, in the order the standard states it. */
  readonly missing: readonly MeasurementGap[]
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.indexOf('|', 1) > 0
}

/** True when the lines hold a header row, a separator, and at least one data row. */
function holdsTable(lines: readonly string[]): boolean {
  for (let i = 0; i + 2 < lines.length; i++) {
    if (
      isTableRow(lines[i]) &&
      SEPARATOR_ROW.test(lines[i + 1]) &&
      isTableRow(lines[i + 2]) &&
      !SEPARATOR_ROW.test(lines[i + 2])
    ) {
      return true
    }
  }
  return false
}

/** The lines under one level-two heading, stopping at the next one. */
function sectionLines(lines: readonly string[], heading: string): string[] {
  const held: string[] = []
  let section = ''

  for (const line of lines) {
    if (H2.test(line)) section = line
    else if (section === heading) held.push(line)
  }

  return held
}

/**
 * Reads that a `perf` body has an Outcome table and a Technical context, never
 * that its numbers are true. A fenced table is an example, so it never counts.
 */
export function checkMeasurement(
  title: string,
  body: string,
): MeasurementCheck {
  if (!PERF_TITLE.test(title)) return { checked: false, missing: [] }

  const lines = linesOutsideFences(body).map((line) => line.trim())
  const outcome = sectionLines(lines, OUTCOME)
  const hasContext = lines.includes(TECHNICAL_CONTEXT)

  const missing: MeasurementGap[] = []
  if (!holdsTable(outcome)) missing.push('table')
  if (!hasContext) missing.push('technical-context')

  return { checked: true, missing }
}

/**
 * Grades the Outcome table a plan's Verification owes, whatever the title. Only
 * a measurement word in prose triggers it, never a fence or a code span.
 */
export function checkMeasuredResults(
  body: string,
  plan: string,
): MeasurementCheck {
  const verification = sectionLines(
    linesOutsideFences(plan).map((line) => line.trim()),
    VERIFICATION,
  )
  const measured = verification.some(namesMeasurement)
  if (!measured) return { checked: false, missing: [] }

  const outcome = sectionLines(
    linesOutsideFences(body).map((line) => line.trim()),
    OUTCOME,
  )

  return {
    checked: true,
    missing: holdsTable(outcome) ? [] : ['results-table'],
  }
}

const RUN_LINK =
  /https:\/\/github\.com\/[^\s/()|]+\/[^\s/()|]+\/actions\/runs\/\d+/
const PENDING = /^pending\b/i

export interface PendingMeasurement {
  /** The row's first cell. */
  readonly row: string
  /** The Actions run address the row carries, absent when it links none. */
  readonly run?: string
}

function cellsOf(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * Each Outcome table row whose Result cell opens on `pending`, read only from a
 * table with a `result` header cell and never from a fence. The one parser the
 * scan, the lift, and the merge share, so none passes what another refuses.
 */
export function pendingMeasurements(body: string): PendingMeasurement[] {
  const lines = sectionLines(
    linesOutsideFences(body).map((line) => line.trim()),
    OUTCOME,
  )
  const pending: PendingMeasurement[] = []

  for (let i = 0; i + 1 < lines.length; i++) {
    if (!isTableRow(lines[i]) || !SEPARATOR_ROW.test(lines[i + 1])) continue

    const column = cellsOf(lines[i]).findIndex(
      (cell) => cell.toLowerCase() === 'result',
    )
    if (column < 0) continue

    for (let j = i + 2; j < lines.length && isTableRow(lines[j]); j++) {
      const cells = cellsOf(lines[j])
      if (!PENDING.test(cells[column] ?? '')) continue
      const run = RUN_LINK.exec(lines[j])?.[0]
      pending.push(
        run === undefined ? { row: cells[0] } : { row: cells[0], run },
      )
    }
  }

  return pending
}
